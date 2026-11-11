/**
 * rich-media-utils — make sure rich-card images are actually seen.
 *
 * Rich cards reference images by URL inside a base64 `unifiedResponse` blob.
 * The CLIENT has to fetch that URL, and plenty of clients silently do not
 * (redirects, hotlink policies, strict fetchers), which shows up as an empty
 * image slot in an otherwise perfect card.
 *
 * Two fixes, both opt-out and both non-throwing:
 *
 *   rehostRichCardMedia(sock, message)  ← run BEFORE relay. Downloads each
 *     image, uploads the original bytes to WhatsApp's own media CDN and
 *     rewrites the card to point at that URL. This is the primary fix, since
 *     WA media URLs are exactly what real AI image cards carry.
 *
 *   hoistAfterRelay(sock, jid, message) ← run AFTER relay. Sends the images
 *     as ordinary photo messages so the picture arrives regardless.
 *
 * Kill switches: REHOST_RICH_MEDIA=0 and RICH_MEDIA_HOIST=0.
 * Re-encoding (hoist) needs `sharp`, imported lazily so it stays optional.
 */
import crypto from 'crypto';

const HOIST_ENABLED = process.env.RICH_MEDIA_HOIST !== '0';
const REHOST_ENABLED = process.env.REHOST_RICH_MEDIA !== '0';
const FETCH_TIMEOUT_MS = 10000;
const MAX_IMAGES = 6;
const MAX_DIM = 1080;
const MAX_BYTES = 420 * 1024;

let _sharp;
const getSharp = async () => {
  if (_sharp !== undefined) return _sharp;
  try {
    _sharp = (await import('sharp')).default;
  } catch {
    _sharp = null;
  }
  return _sharp;
};

/** Deep-walk a decoded unifiedResponse object collecting image URLs. */
const collectUrls = (obj, out) => {
  if (!obj || typeof obj !== 'object') return;
  if (Array.isArray(obj)) {
    for (const v of obj) collectUrls(v, out);
    return;
  }
  const prim = obj.primitive || obj;
  const iu = prim.image_url || prim.imageUrl;
  if (iu) {
    if (iu.image_high_res_url) out.push(iu.image_high_res_url);
    if (iu.image_preview_url) out.push(iu.image_preview_url);
  }
  if (prim.media?.url) out.push(prim.media.url);
  if (prim.thumbnail_url) out.push(prim.thumbnail_url);
  if (obj.view_model) collectUrls(obj.view_model, out);
  for (const v of Object.values(obj)) {
    if (v && typeof v === 'object') collectUrls(v, out);
  }
};

/** Extract image URLs from a generated proto message (base64 blobs inside). */
export const extractProtoImageUrls = (message) => {
  const urls = [];
  try {
    const json = JSON.stringify(message || {});
    const blobs = json.match(/[A-Za-z0-9+/=]{80,}/g) || [];
    for (const blob of blobs) {
      try {
        const decoded = Buffer.from(blob, 'base64').toString('utf8');
        if (!decoded.startsWith('{')) continue;
        const parsed = JSON.parse(decoded);
        if (!parsed?.sections) continue;
        collectUrls(parsed.sections, urls);
      } catch {
        /* not a unifiedResponse blob */
      }
    }
  } catch {
    /* never throw from extraction */
  }
  return [...new Set(urls)].filter((u) => u && /^https?:\/\//.test(u));
};

/** Extract image URLs from a declarative `richResponse: [...]` content object. */
export const extractDeclarativeImageUrls = (content) => {
  const urls = [];
  try {
    for (const sub of content?.richResponse || []) {
      if (!sub) continue;
      const img = sub.inlineImage;
      if (img) {
        const u = typeof img === 'string' ? img : img.imageHighResUrl || img.imagePreviewUrl || img.sourceUrl;
        if (u) urls.push(u);
      }
      const grid = sub.gridImage;
      if (grid) {
        const main = typeof grid.gridImageUrl === 'string'
          ? grid.gridImageUrl
          : grid.gridImageUrl?.imageHighResUrl || grid.gridImageUrl?.imagePreviewUrl;
        if (main) urls.push(main);
        for (const iu of grid.imageUrls || []) {
          const u = typeof iu === 'string' ? iu : iu.imageHighResUrl || iu.imagePreviewUrl;
          if (u) urls.push(u);
        }
      }
      if (sub.dynamic?.url) urls.push(sub.dynamic.url);
    }
  } catch {
    /* never throw */
  }
  return [...new Set(urls)].filter((u) => /^https?:\/\//.test(u));
};

const fetchBuffer = async (url, timeoutMs = FETCH_TIMEOUT_MS) => {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), redirect: 'follow' });
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    return buffer.length ? { buffer, mime: (res.headers.get('content-type') || '').split(';')[0].trim() } : null;
  } catch {
    return null;
  }
};

/** Download + re-encode one URL into a size-capped JPEG buffer. */
const fetchImageBuffer = async (url) => {
  const got = await fetchBuffer(url);
  if (!got) return null;
  const sharp = await getSharp();
  if (!sharp) return got.buffer;
  try {
    let buf = await sharp(got.buffer)
      .resize({ width: MAX_DIM, height: MAX_DIM, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer();
    if (buf.length > MAX_BYTES) buf = await sharp(buf).jpeg({ quality: 60 }).toBuffer();
    return buf;
  } catch {
    return null;
  }
};

/**
 * Send the URLs as real photo uploads. Best effort, capped, never throws.
 * @returns {Promise<number>} how many photos were delivered
 */
export const hoistImages = async (sock, jid, urls) => {
  if (!HOIST_ENABLED || !sock?.sendMessage || !Array.isArray(urls)) return 0;
  let sent = 0;
  for (const url of urls.slice(0, MAX_IMAGES)) {
    try {
      const buf = await fetchImageBuffer(url);
      if (!buf) continue;
      await sock.sendMessage(jid, {
        image: buf,
        caption: sent === 0 ? '🖼️ _Attached for guaranteed display_' : undefined,
      });
      sent += 1;
    } catch {
      /* one image, never the batch */
    }
  }
  return sent;
};

/** Fire-and-forget wrapper for the relay seam. */
export const hoistAfterRelay = (sock, jid, message) => {
  if (!HOIST_ENABLED) return;
  const urls = extractProtoImageUrls(message);
  if (!urls.length) return;
  hoistImages(sock, jid, urls).catch(() => {});
};

// ── Rehosting (primary fix) ────────────────────────────────────────────────

const REHOST_MAX_IMAGES = 8;
const REHOST_TIMEOUT_MS = 15000;

// leaf keys that carry image URLs (never citation/text links)
const IMAGE_FIELD_KEYS = new Set(['imagePreviewUrl', 'imageHighResUrl', 'thumbnailUrl', 'thumbnail_url', 'url']);
// parent/grandparent keys that mark a leaf as image context
const IMAGE_CONTEXT_KEYS = new Set([
  'media', 'dynamic', 'gridImageUrl', 'imageUrl', 'image_url', 'imageUrls',
  'imageMetadata', 'gridImageMetadata', 'thumbnails',
]);

const isRehostableUrl = (u) =>
  typeof u === 'string' && /^https?:\/\//.test(u) && !/\.whatsapp\.net\//.test(u);

const isBase64Blob = (v) => typeof v === 'string' && v.length >= 80 && /^[A-Za-z0-9+/=]+$/.test(v);

const decodeBlob = (v) => {
  try {
    const decoded = Buffer.from(v, 'base64').toString('utf8');
    if (!decoded.startsWith('{')) return null;
    const parsed = JSON.parse(decoded);
    return parsed?.sections ? parsed : null;
  } catch {
    return null;
  }
};

/** Find rehostable URLs and every unifiedResponse blob inside a proto object. */
const collectRichMedia = (node, parentKey = '', grandparentKey = '', out = { urls: new Set(), blobs: new Set() }) => {
  if (!node || typeof node !== 'object') return out;
  if (Array.isArray(node)) {
    for (const v of node) collectRichMedia(v, parentKey, grandparentKey, out);
    return out;
  }
  for (const [k, v] of Object.entries(node)) {
    if (typeof v === 'string') {
      if (isBase64Blob(v)) {
        const parsed = decodeBlob(v);
        if (parsed) {
          out.blobs.add({ node, key: k, parsed });
          const urls = [];
          collectUrls(parsed.sections, urls);
          for (const u of urls) if (isRehostableUrl(u)) out.urls.add(u);
          continue;
        }
      }
      const inImageContext =
        IMAGE_CONTEXT_KEYS.has(parentKey) ||
        IMAGE_CONTEXT_KEYS.has(grandparentKey) ||
        IMAGE_FIELD_KEYS.has(parentKey) ||
        parentKey.endsWith('Metadata');
      const isIndex = Number.isInteger(Number(k)) && IMAGE_CONTEXT_KEYS.has(parentKey);
      if (isRehostableUrl(v) && inImageContext && (IMAGE_FIELD_KEYS.has(k) || isIndex)) {
        out.urls.add(v);
      }
    } else if (v && typeof v === 'object') {
      collectRichMedia(v, k, parentKey, out);
    }
  }
  return out;
};

/** Rewrite mapped URLs inside a decoded unifiedResponse; sync media.mime_type. */
const rewriteDecoded = (node, urlMap, byNewUrl) => {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.forEach((v) => rewriteDecoded(v, urlMap, byNewUrl));
    return;
  }
  for (const [k, v] of Object.entries(node)) {
    if (typeof v === 'string') {
      const hosted = urlMap.get(v);
      if (hosted) node[k] = hosted.url;
    } else if (v && typeof v === 'object') {
      rewriteDecoded(v, urlMap, byNewUrl);
    }
  }
  if (typeof node.url === 'string' && typeof node.mime_type === 'string') {
    const hosted = byNewUrl.get(node.url);
    if (hosted) node.mime_type = hosted.mime;
  }
};

/** Deep-walk the proto replacing mapped plain-field URLs. */
const rewritePlain = (node, urlMap) => {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.forEach((v) => rewritePlain(v, urlMap));
    return;
  }
  for (const [k, v] of Object.entries(node)) {
    if (typeof v === 'string') {
      const hosted = urlMap.get(v);
      if (hosted) node[k] = hosted.url;
    } else if (v && typeof v === 'object') {
      rewritePlain(v, urlMap);
    }
  }
};

/** Download one URL, upload the original bytes to WhatsApp's CDN. */
const rehostUrl = async (sock, url) => {
  try {
    const got = await fetchBuffer(url, REHOST_TIMEOUT_MS);
    if (!got) return null;
    if (!/^image\//.test(got.mime)) return null;
    // waUploadToServer contract: { mediaType, fileEncSha256B64, timeoutMs }
    const fileEncSha256B64 = crypto.createHash('sha256').update(got.buffer).digest('base64');
    const up = await sock.waUploadToServer(got.buffer, {
      mediaType: 'image',
      fileEncSha256B64,
      timeoutMs: 10000,
    });
    const hosted = up?.mediaUrl || up?.url || (up?.directPath ? 'https://mmg.whatsapp.net' + up.directPath : null);
    if (!hosted) return null;
    return { url: hosted, mime: got.mime };
  } catch {
    return null;
  }
};

/**
 * Rehost every rich-card image URL onto WhatsApp's media CDN, in place.
 * Mutates `message` (the generated proto object). Never throws.
 * @returns {Promise<number>} how many URLs were rehosted
 */
export const rehostRichCardMedia = async (sock, message) => {
  if (!REHOST_ENABLED || !sock?.waUploadToServer || !message) return 0;
  try {
    const found = collectRichMedia(message);
    const urls = [...found.urls].slice(0, REHOST_MAX_IMAGES);
    if (!urls.length) return 0;
    const results = await Promise.all(urls.map((u) => rehostUrl(sock, u)));
    const urlMap = new Map();
    urls.forEach((u, i) => {
      if (results[i]) urlMap.set(u, results[i]);
    });
    if (!urlMap.size) return 0;
    const byNewUrl = new Map([...urlMap.values()].map((h) => [h.url, h]));
    for (const blob of found.blobs) {
      const before = JSON.stringify(blob.parsed);
      rewriteDecoded(blob.parsed, urlMap, byNewUrl);
      if (JSON.stringify(blob.parsed) !== before) {
        blob.node[blob.key] = Buffer.from(JSON.stringify(blob.parsed), 'utf8').toString('base64');
      }
    }
    rewritePlain(message, urlMap);
    return urlMap.size;
  } catch {
    return 0;
  }
};

export default {
  extractProtoImageUrls,
  extractDeclarativeImageUrls,
  hoistImages,
  hoistAfterRelay,
  rehostRichCardMedia,
};
