/**
 * genai-utils — the GenAI unified-response envelope, as a package feature.
 *
 * Builds the `botForwardedMessage` / `richResponseMessage` card family that
 * WhatsApp renders as an AI answer: base64 `unifiedResponse` sections, a
 * per-send `messageContextInfo.messageSecret`, `forwardedAiBotMessageInfo`
 * and `forwardOrigin: 4`, plus the verification proof chain when you want one.
 *
 * Everything here was previously bot-layer code; it is generic now:
 *
 *   const content = buildUnifiedRichContent({
 *     disclaimer: 'VIP card',
 *     submessages: [{ messageType: 2, messageText: 'Hello' }],
 *     sections: [singleSection(markdownText('**hi**'))]
 *   })
 *   await sendUnifiedRich(sock, jid, content)     // or relay it yourself
 *
 * Or use a preset: `vipCard()`, `htmlCard()`, `buildSecretFlowContent()`.
 *
 * Two proof chains ship in the box, both taken from cards observed to render
 * on device. They are not interchangeable and neither is "correct":
 *   - PROOF_CHAINS.omegatech  (161-byte signature) — the VIP card chain.
 *   - PROOF_CHAINS.nixcode    (base64 text signature) — the HTML card chain.
 * `withProofs` accepts true (omegatech), false, or a chain object. Random
 * bytes do NOT work: the client masks the card instead of rendering it.
 */
import crypto from 'crypto';
import { generateWAMessageFromContent } from './messages.js';
import { generateMessageIDV2 } from './generics.js';
import { proto } from '../../WAProto/index.js';

/** Meta AI's bot JID — what a real AI answer carries. */
export const META_AI_BOT_JID = '867051314767696@bot';

// ─── Proof chains ──────────────────────────────────────────────────────────

/** Harvested 161-byte signature from a rendering VIP card. */
const OMEGATECH_SIGNATURE =
  'HAgEAkwAawAgV60r8LC1zhSDWyiFYBJWUVI4xgUu1c5EF3ibZoOXhByVMVFcM4AJlETvUyKTKIEJt9+q9TLa0BRuAJKEQdImFnIwZe0bfvAHWPCD+zTPDcsENCTIQ1Gf98f70kFTzECEAI7Z+F4IHhTfWj0DTvVXqEFx4lB21qgvGRIQCIH3wOh35UjNTCXeN0O6EBMSAKyGM0EBIFQZcPZ';

/** 58-byte signature that the HTML game card family ships. */
const NIXCODE_SIGNATURE =
  'TklYRUwuTWVzc2FnZUJ1aWxkZXJWNC43LVZlcmlmaWNhdGlvblNpZ25hdHVyZS5NZXRhZGF0YeN55YRyad2+ZA==';

const CERTIFICATE_CHAIN = [
  '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',
];

/** Named proof chains. Pass one to `withProofs`, or `true` for the default. */
export const PROOF_CHAINS = {
  /** 161-byte signature + 912/1192-char certs — the VIP / unified card chain. */
  omegatech: {
    name: 'omegatech',
    signature: OMEGATECH_SIGNATURE,
    certificateChain: CERTIFICATE_CHAIN,
  },
  /** Base64 text signature — the HTML card chain (GenAIaeacdsnwHtmlPrimitive). */
  nixcode: {
    name: 'nixcode',
    signature: NIXCODE_SIGNATURE,
    certificateChain: CERTIFICATE_CHAIN,
  },
};

/** Override the shipped chains at runtime (e.g. with your own harvested blob). */
export const setProofChains = (chains) => Object.assign(PROOF_CHAINS, chains);

const resolveProof = (withProofs) => {
  if (!withProofs) return null;
  if (withProofs === true) return PROOF_CHAINS.omegatech;
  if (typeof withProofs === 'object' && withProofs.signature) return withProofs;
  if (typeof withProofs === 'string') return PROOF_CHAINS[withProofs] ?? null;
  return PROOF_CHAINS.omegatech;
};

// ─── Primitives ────────────────────────────────────────────────────────────

/**
 * Product card, repurposed as a branded status banner.
 * `image` wins over `imageUrl`; pass a WhatsApp-hosted URL where possible.
 */
export const productItemCard = ({
  title,
  brand = '',
  price = '✅ Success',
  salePrice,
  productUrl = 'https://wa.me/0',
  imageUrl,
  additionalImages = [],
  image = null,
} = {}) => ({
  title,
  brand,
  price,
  ...(salePrice ? { sale_price: salePrice } : {}),
  product_url: productUrl,
  image: image || { url: imageUrl, mime_type: 'image/jpeg' },
  additional_images: additionalImages,
  __typename: 'GenAIProductItemCardPrimitive',
});

/**
 * Markdown body text, optionally with tappable citation chips.
 * citations: [{ url, title, displayName }]
 */
export const markdownText = (text, citations = []) => ({
  text,
  ...(citations.length
    ? {
        inline_entities: citations.map((c, i) => ({
          key: `CI_${i}`,
          metadata: {
            reference_id: i + 1,
            reference_url: c.url,
            reference_title: c.title || c.url,
            reference_display_name: c.displayName || '🔗 Link',
            sources: [],
            __typename: 'GenAISearchCitationItem',
          },
        })),
      }
    : {}),
  __typename: 'GenAIMarkdownTextUXPrimitive',
});

/** Suggested-prompt pills; each renders as a rounded chip. */
export const followUpPills = (textOrArray, type = 'SUGGESTED_PROMPT') =>
  (Array.isArray(textOrArray) ? textOrArray : [textOrArray]).map((p) =>
    typeof p === 'object'
      ? { ...p, __typename: 'GenAIFollowUpSuggestionPillPrimitive' }
      : {
          prompt_text: p,
          prompt_type: type,
          __typename: 'GenAIFollowUpSuggestionPillPrimitive',
        }
  );

/**
 * 3P extension widget: a header plus CTA rows. Taps show a toast only —
 * WhatsApp has no server-side handler for them unless you are a Meta endpoint.
 * ctas: [{ label, state, kind, toolCallId, toast }]
 */
export const extWidget = ({ title, subtitle, ctas = [] }) => ({
  __typename: 'GenAI3PExtWidgetPrimitive',
  header: {
    __typename: 'GenAI3PExtWidgetStandardHeader',
    title,
    ...(subtitle ? { subtitle } : {}),
  },
  body: {
    __typename: 'GenAI3PExtCalendarEventList',
    sections: [],
    ctas: ctas.map((c, i) => ({
      __typename: 'GenAI3PExtWidgetCTA',
      label: c.label || `Action ${i + 1}`,
      state: c.state || 'PENDING',
      kind: c.kind || 'OTHER',
      tool_call_id: c.toolCallId || String(i).padStart(2, '0'),
      toast: {
        __typename: 'GenAI3PExtWidgetToast',
        label: c.toast || c.label || 'OK',
      },
    })),
  },
});

/**
 * In-chat HTML primitive: a full HTML document rendered in WhatsApp's
 * sandboxed webview. Vendor your own payload and host it yourself — never
 * hot-link one, since whoever controls the URL controls what your users run.
 */
export const htmlPrimitive = (payload, { sources = [] } = {}) => ({
  __typename: 'GenAIaeacdsnwHtmlPrimitive',
  payload,
  trusted_sources: sources,
});

/** Any raw primitive object, as long as it carries its own __typename. */
export const rawPrimitive = (obj) => obj;

/** A GenAIImagine media primitive (what `addVideo`/`addImage` emit). */
export const imaginePrimitive = ({
  url,
  mime_type = 'image/jpeg',
  media_type = 'IMAGE',
  alt_text = '',
  prompt,
} = {}) => ({
  __typename: 'GenAIImaginePrimitive',
  media: { url, mime_type, media_type },
  ...(alt_text ? { alt_text } : {}),
  ...(prompt ? { prompt } : {}),
});

// ─── Layouts + sections ────────────────────────────────────────────────────

/** `GenAI<Name>LayoutViewModel` around one primitive or an array of them. */
export const layout = (name, data) => ({
  view_model: {
    [Array.isArray(data) ? 'primitives' : 'primitive']: data,
    __typename: `GenAI${name}LayoutViewModel`,
  },
});

/** Single-primitive section. */
export const singleSection = (primitive) => ({
  view_model: { primitive, __typename: 'GenAISingleLayoutViewModel' },
  __typename: 'GenAIUnifiedResponseSection',
});

/** Horizontal-scroll (carousel) section. */
export const hScrollSection = (primitives) => ({
  view_model: { primitives, __typename: 'GenAIHScrollLayoutViewModel' },
  __typename: 'GenAIUnifiedResponseSection',
});

/** Section around a layout you built yourself. */
export const section = (view_model) => ({ view_model, __typename: 'GenAIUnifiedResponseSection' });

// ─── Envelope ──────────────────────────────────────────────────────────────

/** Build the contextInfo a rich card carries (also used for quoting). */
export const richContextInfo = (
  quoted,
  { botJid = META_AI_BOT_JID, newsletter = null, mentionedJid = [] } = {}
) => ({
  ...(quoted && typeof quoted === 'object'
    ? {
        stanzaId: quoted.key?.id || crypto.randomBytes(16).toString('hex').toUpperCase(),
        participant: quoted.key?.participant || quoted.participant,
        quotedMessage: quoted.message ?? quoted,
      }
    : {}),
  forwardingScore: 1,
  isForwarded: true,
  expiration: 7776000,
  forwardedAiBotMessageInfo: { botJid },
  forwardOrigin: 4,
  ...(mentionedJid.length ? { mentionedJid } : {}),
  ...(newsletter
    ? {
        forwardedNewsletterMessageInfo: {
          newsletterJid: newsletter.jid,
          serverMessageId: newsletter.serverMessageId ?? 1,
          newsletterName: newsletter.name || '',
        },
      }
    : {}),
});

/**
 * Build the content object for a unified-response card.
 * Returns a proto Message content, ready for `generateWAMessageFromContent`.
 */
export const buildUnifiedRichContent = ({
  sections,
  disclaimer = '',
  submessages = [],
  quoted = null,
  newsletter = null,
  mentionedJid = [],
  botJid = META_AI_BOT_JID,
  withProofs = true,
  responseId = crypto.randomUUID(),
  messageSecret = crypto.randomBytes(32),
  messageType = 1,
} = {}) => {
  if (!Array.isArray(sections) || sections.length === 0) {
    throw new Error('buildUnifiedRichContent: sections array required');
  }
  const proof = resolveProof(withProofs);
  const unified = Buffer.from(JSON.stringify({ response_id: responseId, sections })).toString(
    'base64'
  );

  return {
    messageContextInfo: {
      messageSecret,
      deviceListMetadata: {},
      deviceListMetadataVersion: 2,
      botMetadata: {
        messageDisclaimerText: disclaimer,
        botResponseId: responseId,
        ...(proof
          ? {
              verificationMetadata: {
                proofs: [
                  {
                    version: 1,
                    useCase: 1,
                    signature: proof.signature,
                    certificateChain: proof.certificateChain || [],
                  },
                ],
              },
            }
          : {}),
      },
    },
    botForwardedMessage: {
      message: {
        richResponseMessage: {
          messageType,
          ...(submessages.length ? { submessages } : {}),
          unifiedResponse: { data: unified },
          contextInfo: richContextInfo(quoted, { botJid, newsletter, mentionedJid }),
        },
      },
    },
  };
};

/** Same, but wrapped in a viewOnce container so it opens once and vanishes. */
export const buildSecretFlowContent = (content) => ({
  viewOnceMessage: { message: content },
});

/**
 * Relay a unified-response card.
 * Accepts either options (sections, ...) or an already-built content object.
 * @returns {Promise<{ ok: true, key: object, messageId: string, responseId?: string }>}
 */
export const sendUnifiedRich = async (sock, jid, optionsOrContent = {}, extra = {}) => {
  const isContent = !!optionsOrContent?.botForwardedMessage;
  const content = isContent
    ? optionsOrContent
    : buildUnifiedRichContent({ ...(optionsOrContent || {}), ...extra });

  const message = await generateWAMessageFromContent(jid, content, {
    userJid: sock.user?.id || '0@s.whatsapp.net',
  });
  await sock.relayMessage(jid, message.message, { messageId: message.key.id });
  return {
    ok: true,
    key: message.key,
    messageId: message.key.id,
    responseId: content.messageContextInfo?.botMetadata?.botResponseId,
  };
};

/**
 * Relay an in-chat HTML card (GenAIaeacdsnwHtmlPrimitive).
 * @param {{ html: string, title?: string, sources?: string[] }} opts
 */
export const sendHtmlCard = async (sock, jid, { html, title = '', sources = [], quoted, ...rest } = {}) => {
  if (typeof html !== 'string' || !html.trim()) {
    throw new Error('sendHtmlCard: html payload required');
  }
  const content = buildUnifiedRichContent({
    sections: [singleSection(htmlPrimitive(html, { sources }))],
    submessages: title ? [{ messageType: 2, messageText: title }] : [],
    quoted,
    withProofs: rest.withProofs ?? PROOF_CHAINS.nixcode,
    ...rest,
  });
  return sendUnifiedRich(sock, jid, content);
};

/**
 * The VIP card: product banner, markdown body, CTA widget + pills carousel,
 * and a closing link section — one envelope, four sections.
 *
 * @returns the built content object; pass it to `sendUnifiedRich(sock, jid, content)`.
 */
export const vipCard = ({
  title = '👑 VIP Rich Card',
  brand = 'baileys',
  price = '✅ Online',
  salePrice,
  productUrl = 'https://wa.me/0',
  imageUrl,
  statusText = 'Section 1 — product banner',
  body = '',
  bodyCitations = [],
  widget = null,
  pills = [],
  gallery = [],
  channelText = '',
  channelUrl = '',
  disclaimer = 'VIP Rich Card',
  submessage,
  ...rest
} = {}) => {
  const sections = [
    singleSection(
      productItemCard({ title, brand, price, salePrice, productUrl, imageUrl })
    ),
  ];
  if (body) sections.push(singleSection(markdownText(body, bodyCitations)));
  if (widget) sections.push(hScrollSection([extWidget(widget), ...gallery]));
  else if (gallery.length) sections.push(hScrollSection(gallery));
  if (pills.length) sections.push(singleSection(layout('Single', markdownText(pills.join(' · ')))));
  if (channelText) {
    sections.push(
      singleSection(
        markdownText(channelText, channelUrl ? [{ url: channelUrl, title: channelText, displayName: '📢 Link' }] : [])
      )
    );
  }
  return buildUnifiedRichContent({
    sections,
    disclaimer,
    submessages: submessage
      ? [{ messageType: 2, messageText: submessage }]
      : [],
    ...rest,
  });
};

/** Convenience: send the VIP card in one call. */
export const sendVipCard = (sock, jid, opts = {}) =>
  sendUnifiedRich(sock, jid, vipCard(opts));

export default {
  PROOF_CHAINS,
  setProofChains,
  META_AI_BOT_JID,
  productItemCard,
  markdownText,
  followUpPills,
  extWidget,
  htmlPrimitive,
  imaginePrimitive,
  rawPrimitive,
  layout,
  singleSection,
  hScrollSection,
  section,
  richContextInfo,
  buildUnifiedRichContent,
  buildSecretFlowContent,
  sendUnifiedRich,
  sendHtmlCard,
  vipCard,
  sendVipCard,
};
