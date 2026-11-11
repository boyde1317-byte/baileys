/**
 * ai-rich-builder — fluent builder for GenAI unified-response cards.
 *
 * A re-implementation of the NIXCODE/Moonson `AIRich` chain (addProduct →
 * addText → addTip → addSuggest → send) on top of this package's own
 * `genai-utils` envelope. Upstream's builder is vendored third-party code
 * whose licence forbids standalone redistribution, so this one is written
 * against the same wire shape instead of copied from it.
 *
 *   import { AiRich } from 'baileys'
 *
 *   await new AiRich(sock)
 *     .addProduct({ title: 'Ping', brand: 'Host', price: '42 ms', image_url, icon_url })
 *     .addText('## ◈ Latency\n\n› API : **42 ms**')
 *     .addTip('Platform: linux x64 · Node 22')
 *     .addSuggest(['.menu', '.ping', '.stats'])
 *     .setFooter('built with baileys')
 *     .send(jid, { quoted })
 *
 * Every method returns `this`. `build()` gives you the content object so you
 * can relay it yourself, and each section can be a primitive from
 * `genai-utils` if the convenience methods do not cover it.
 */
import crypto from 'crypto';
import { generateWAMessageFromContent } from './messages.js';
import {
  META_AI_BOT_JID,
  buildUnifiedRichContent,
  followUpPills,
  layout,
  markdownText,
  singleSection,
} from './genai-utils.js';

const LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
const URL_RE = /(?<!\()\bhttps?:\/\/[^\s<>")]+/g;

/** Pull links out of a markdown string into GenAI inline-link entities. */
const extractLinks = (text, { hyperlink = true } = {}) => {
  const entities = [];
  let plain = text;
  if (!hyperlink) return { text: plain, entities };

  let i = 0;
  plain = text.replace(LINK_RE, (_, label, url) => {
    entities.push({
      key: `IE_${i++}`,
      metadata: {
        display_name: label,
        is_trusted: true,
        url,
        __typename: 'GenAIInlineLinkItem',
      },
    });
    return label;
  });

  plain = plain.replace(URL_RE, (url) => {
    entities.push({
      key: `IE_${i++}`,
      metadata: { display_name: url, is_trusted: true, url, __typename: 'GenAIInlineLinkItem' },
    });
    return url;
  });

  return { text: plain, entities };
};

/** Product primitive, upstream field names (`image_url` / `icon_url`). */
const productPrimitive = ({
  title,
  brand = '',
  price = '',
  sale_price,
  product_url = 'https://wa.me/0',
  image_url,
  icon_url,
  additional_images = [],
}) => ({
  title,
  brand,
  price,
  ...(sale_price ? { sale_price } : {}),
  product_url,
  ...(image_url ? { image_url } : {}),
  ...(icon_url ? { icon_url } : {}),
  additional_images,
  __typename: 'GenAIProductItemCardPrimitive',
});

export class AiRich {
  #client;
  #sections = [];
  #submessages = [];
  #footer = null;
  #disclaimer = '';
  #contextInfo = {};

  constructor(client, { disclaimer = '' } = {}) {
    this.#client = client;
    this.#disclaimer = disclaimer;
  }

  /** Raw layout around one primitive or an array of them. */
  addLayout(name, data) {
    this.#sections.push(layout(name, data));
    return this;
  }

  /** Raw section, exactly as it will be encoded. */
  addSection(section) {
    this.#sections.push(section);
    return this;
  }

  /** Raw submessage row (messageType 2 = text row above the card). */
  addSubmessage(submessage) {
    this.#submessages.push(...(Array.isArray(submessage) ? submessage : [submessage]));
    return this;
  }

  addProduct(product) {
    this.#sections.push(layout('Single', productPrimitive(product)));
    return this;
  }

  /**
   * Markdown body. `[label](url)` and bare URLs become tappable inline links.
   * citations: [{ url, title, displayName }]
   */
  addText(text, { hyperlink = true, citations = [], submessage = true } = {}) {
    if (typeof text !== 'string') throw new TypeError('addText: text must be a string');
    const { text: plain, entities } = extractLinks(text, { hyperlink });
    if (submessage) this.#submessages.push({ messageType: 2, messageText: plain });
    this.#sections.push(
      layout('Single', {
        ...markdownText(text, citations),
        ...(entities.length ? { inline_entities: [...entities] } : {}),
      })
    );
    return this;
  }

  /** Monospace block with the fork's syntax classes (DEFAULT/KEYWORD/…). */
  addCode(code, language = 'javascript') {
    this.#submessages.push({ messageType: 2, messageText: `\`\`\`${language}\n${code}\n\`\`\`` });
    this.#sections.push(layout('Single', { codeBlock: code, language, __typename: 'GenAICodeBlockPrimitive' }));
    return this;
  }

  /** rows: [[header...], [cell...], ...] → GenAI table primitive. */
  addTable(rows, { title = '' } = {}) {
    if (!Array.isArray(rows) || !rows.length) throw new TypeError('addTable: rows required');
    const [header, ...body] = rows;
    const width = Math.max(header.length, ...body.map((r) => r.length));
    const pad = (r) => [...r, ...Array(width - r.length).fill('')];
    const unified_rows = [
      { is_header: true, cells: pad(header) },
      ...body.map((r) => ({ is_header: false, cells: pad(r) })),
    ];
    this.#sections.push(
      layout('Single', {
        title,
        rows: unified_rows.map((r) => ({ items: r.cells, ...(r.is_header ? { isHeading: true } : {}) })),
        unified_rows,
        __typename: 'GenAITableUXPrimitive',
      })
    );
    return this;
  }

  /** Image by URL. WhatsApp fetches it client-side — rehost it for reliability. */
  addImage(url, { alt_text = '', prompt } = {}) {
    this.#sections.push(
      layout('Single', {
        media: { url, mime_type: 'image/jpeg', media_type: 'IMAGE' },
        ...(alt_text ? { alt_text } : {}),
        ...(prompt ? { prompt } : {}),
        __typename: 'GenAIImaginePrimitive',
      })
    );
    return this;
  }

  /** Video by URL. `"url|seconds"` sets the duration badge. */
  addVideo(videoUrl, { sourceUrl } = {}) {
    const items = Array.isArray(videoUrl) ? videoUrl : [videoUrl];
    this.#submessages.push({ messageType: 2, messageText: items.length > 1 ? 'Videos' : 'Video' });
    for (const item of items) {
      const [url, duration = 0] = String(item).split('|');
      this.#sections.push(
        layout('Single', {
          media: { url, mime_type: 'video/mp4', duration: Number(duration) || 0 },
          imagine_type: 'ANIMATE',
          status: { status: 'READY' },
          ...(sourceUrl ? { sourceUrl } : {}),
          __typename: 'GenAIImaginePrimitive',
        })
      );
    }
    return this;
  }

  /** Small muted metadata line. */
  addTip(text) {
    this.#submessages.push({ messageType: 2, messageText: text });
    this.#sections.push(layout('Single', { text, __typename: 'GenAIMetadataTextPrimitive' }));
    return this;
  }

  /** Suggested-prompt pills in an action row. */
  addSuggest(suggestion) {
    this.#sections.push(layout('ActionRow', followUpPills(suggestion)));
    return this;
  }

  /** Horizontal-scroll row of primitives. */
  addCarousel(primitives) {
    this.#sections.push(layout('HScroll', Array.isArray(primitives) ? primitives : [primitives]));
    return this;
  }

  /** Single-primitive section, for anything built with genai-utils. */
  addPrimitive(primitive) {
    this.#sections.push(singleSection(primitive));
    return this;
  }

  /** Footer line rendered as metadata under the card. */
  setFooter(text) {
    this.#footer = text;
    return this;
  }

  /** Badge text (botMetadata.messageDisclaimerText). */
  setDisclaimer(text) {
    this.#disclaimer = text;
    return this;
  }

  /** Extra contextInfo merged into the card (mentions, forwarding, …). */
  setContextInfo(info) {
    this.#contextInfo = { ...this.#contextInfo, ...info };
    return this;
  }

  get sections() {
    return [...this.#sections];
  }

  /**
   * Build the content object.
   * @param {{ quoted?: object, withProofs?: boolean|object, botJid?: string }} options
   */
  build({ quoted = null, withProofs = true, botJid = META_AI_BOT_JID } = {}) {
    if (!this.#sections.length) throw new Error('AiRich: nothing added yet');
    const content = buildUnifiedRichContent({
      sections: this.#sections,
      submessages: this.#submessages,
      disclaimer: this.#disclaimer,
      quoted,
      botJid,
      withProofs,
      responseId: crypto.randomUUID(),
    });
    if (this.#footer) {
      const rich = content.botForwardedMessage.message.richResponseMessage;
      const unified = JSON.parse(Buffer.from(rich.unifiedResponse.data, 'base64').toString());
      unified.sections.push(layout('Single', { text: this.#footer, __typename: 'GenAIMetadataTextPrimitive' }));
      rich.unifiedResponse.data = Buffer.from(JSON.stringify(unified)).toString('base64');
    }
    if (Object.keys(this.#contextInfo).length) {
      Object.assign(content.botForwardedMessage.message.richResponseMessage.contextInfo, this.#contextInfo);
    }
    return content;
  }

  /** Relay the card and return the generated message. */
  async send(jid, options = {}) {
    const content = this.build(options);
    const message = await generateWAMessageFromContent(jid, content, {
      userJid: this.#client?.user?.id || '0@s.whatsapp.net',
    });
    await this.#client.relayMessage(jid, message.message, { messageId: message.key.id });
    return message;
  }
}

/** Shorthand factory: `aiRich(sock).addText('hi').send(jid)`. */
export const aiRich = (client, options) => new AiRich(client, options);

export default AiRich;
