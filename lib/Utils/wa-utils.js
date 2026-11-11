/**
 * @file lib/Utils/wa-utils.js
 *
 * Fake quotes, external ad-reply banners and status broadcasts — the small
 * render tricks that make a plain message look like it came from WhatsApp or
 * from a real AI account. Moved here from bot code so consumers of this
 * package get them without copying a file.
 *
 * Three families of helpers:
 *
 *   1. fakeQuote  — text message with a "WhatsApp"-branded quoted header
 *   2. adReply    — external ad-reply card (branded banner above a message)
 *   3. status     — post text / image / video to status@broadcast
 *
 * Every helper has two forms:
 *   send*(sock, jid, ...)  — raw form, works anywhere
 *   reply*(m, sock, ...)   — convenience form; auto-quotes the triggering message
 *
 * Usage:
 *   import { replyFakeQuote, replyAdReply, sendStatus, buildFakeOrderQuote } from 'baileys'
 *
 * None of these helpers take a socket-shape dependency: the builders return
 * plain objects you pass as `{ quoted }` to any send, and the senders only
 * call sock.sendMessage. Everything is proto-only, so it works on any
 * Baileys 0.3.x socket.
 */

/**
 * WhatsApp's own server JID — kept for proto fields that expect a business
 * server JID (orderMessage.sellerJid etc.). NOTE: as the `participant` of a
 * fake status quote, some clients resolve 0@s.whatsapp.net to the bot's own
 * profile, so quote builders use META_AI_JID instead.
 */
export const WA_JID = '0@s.whatsapp.net'

/**
 * Meta AI's official WhatsApp account (+1 313 555 0002 — wa.me/13135550002).
 * Kept exported for callers that want a fixed author; the quote builders
 * rotate through AI_JIDS instead.
 */
export const META_AI_JID = '13135550002@s.whatsapp.net'

/**
 * Real, public AI assistant accounts on WhatsApp. Each is a verified business
 * account, so every client resolves its official profile picture and name
 * server-side — no contact caching needed on the receiving device.
 */
export const AI_JIDS = [
  META_AI_JID,                    // Meta AI    (+1 313 555 0002)
  '18002428478@s.whatsapp.net',   // ChatGPT    (+1-800-242-8478, 1-800-CHATGPT)
  '18334363285@s.whatsapp.net',   // Perplexity (+1 833 436-3285)
  // '15551234567@s.whatsapp.net',  // Base44 Superagent — add your agent's
  // provisioned WhatsApp number here, then map a display name in AI_NAMES.
  // No public Base44 number exists; only add one you provision yourself.
]

/**
 * Display names for the AI accounts above — used when a fake contact quote
 * defaults to an AI author (vcard FN + contactMessage.displayName).
 */
export const AI_NAMES = {
  [META_AI_JID]:                 'Meta AI',
  '18002428478@s.whatsapp.net':  'ChatGPT',
  '18334363285@s.whatsapp.net':  'Perplexity',
}

/**
 * Pick the fake-quote author. Rotates randomly per quote so consecutive
 * messages attribute to different AIs.
 */
export function pickAiJid() {
  return AI_JIDS[Math.floor(Math.random() * AI_JIDS.length)]
}

/**
 * Pick a complete random AI contact for a message.
 *
 * Returns everything a builder/call site needs to attribute a message to a
 * real AI account — jid for participants/mentions, bare number for vcard
 * waids, display name for cards and headers. Consecutive calls rotate
 * randomly so back-to-back messages attribute to different AIs.
 *
 * @returns {{ jid: string, number: string, name: string }}
 *
 * @example
 * const ai = pickAiContact()
 * // ai.jid     → '13135550002@s.whatsapp.net' (Meta AI)
 * // ai.number  → '13135550002'
 * // ai.name    → 'Meta AI'
 */
export function pickAiContact() {
  const jid = pickAiJid()
  return {
    jid,
    number: jid.split('@')[0],
    name:   AI_NAMES[jid] || 'Meta AI',
  }
}

/** Status broadcast pseudo-JID */
export const STATUS_JID = 'status@broadcast'

// ─────────────────────────────────────────────────────────────────────────────
// 1.  FAKE WHATSAPP QUOTE
//     The reply bar at the top of the message shows fakeText attributed to
//     WhatsApp itself (green bar, "WhatsApp" name).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send a text message with a fake WhatsApp-branded quoted header.
 *
 * @param {import('baileys').WASocket} sock      Baileys socket
 * @param {string}                     jid       Destination chat JID
 * @param {string}                     text      Actual message body
 * @param {string}                    [fakeText] Text inside the green quote bar
 *                                               (defaults to an invisible space)
 * @param {object}                    [opts]     Extra options forwarded to sock.sendMessage
 * @returns {Promise<object>}                    Sent message proto
 *
 * @example
 * await sendFakeQuote(sock, m.from, 'Hello!', 'WhatsApp notification', { quoted: m })
 */
/**
 * Generate a Baileys-compatible fake stanza ID.
 * Quoted contextInfo requires a non-empty stanzaId or several WA clients
 * silently degrade the reply header to plain text.
 * Format mirrors real Baileys IDs: "3EB0" + 12 random hex chars (uppercase).
 * @returns {string}
 */
function fakeStanzaId() {
  const hex = () => Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0').toUpperCase()
  return '3EB0' + hex() + hex()
}

// ─────────────────────────────────────────────────────────────────────────────
// 0.  FAKE QUOTED CONTEXT BUILDERS
//     These build a synthetic WAMessage object to pass as { quoted: ... }.
//     WhatsApp renders the `.message` content in the reply bar above your
//     message — the type you choose determines what the card looks like:
//       buildFakeOrderQuote   → business order card  (thumbnail + item count + title)
//       buildFakeContactQuote → contact card          (name + contact icon)
//     The quote participant rotates through AI_JIDS (Meta AI / ChatGPT /
//     Perplexity — all real verified accounts, so the client renders each
//     one's official name + picture).
//
//     KEY SHAPE (Moonson-proven, what their .brand ships): participant
//     0@s.whatsapp.net + remoteJid status@broadcast. The AI attribution
//     does NOT live on contextInfo.participant — clients resolve a status
//     quote's author among REAL status senders, AI accounts post no
//     statuses, so an AI participant falls back to the outer sender
//     ("[You . Status]"). The AI identity lives in the vcard's waid for
//     contact quotes (buildFakeContactQuote): the real AI number makes
//     WhatsApp resolve that account's official name + profile picture
//     as the quoted contact.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a fake orderMessage quoted context.
 * Pass the result as `{ quoted: buildFakeOrderQuote(...) }` to any sock.sendMessage call.
 *
 * @param {object}  [opts]
 * @param {string}  [opts.title]      Text shown as the order title in the reply bar
 * @param {Buffer}  [opts.thumbnail]  Image buffer shown as the order thumbnail
 * @param {number|string} [opts.itemCount=1]  Item count displayed on the card
 * @param {string}  [opts.orderId]    Order ID string (any value, cosmetic only)
 *
 * @example
 * const fakeQuote = buildFakeOrderQuote({ title: 'baileys MENU', thumbnail: imgBuffer, itemCount: 42 })
 * await sock.sendMessage(m.from, { text: 'Hello' }, { quoted: fakeQuote })
 */
export function buildFakeOrderQuote({ title, thumbnail, itemCount = 1, orderId, orderTitle, sellerJid } = {}) {
  return {
    key: {
      fromMe:      false,
      participant: WA_JID,
      remoteJid:   STATUS_JID,
      id:          'BAE5' + Math.random().toString(36).slice(2, 10).toUpperCase(),
    },
    message: {
      orderMessage: {
        orderId:    orderId    || String(Date.now()).slice(-6),
        thumbnail:  thumbnail  || undefined,
        itemCount:  Number(itemCount),   // int32 — proto rejects strings
        status:     'INQUIRY',
        surface:    'CATALOG',
        message:    title      || 'baileys',
        orderTitle: orderTitle || undefined,   // shown as bold heading above itemCount
        sellerJid:  sellerJid  || WA_JID,     // business seller JID
        token:      'AR6baileys==',
      }
    }
  }
}



/**
 * Build a fake contactMessage quoted context.
 * Renders as a contact card (name + contact icon) in the reply bar.
 * Pass the result as `{ quoted: buildFakeContactQuote(...) }`.
 *
 * @param {object} [opts]
 * @param {string} [opts.displayName]  Contact name shown in the reply bar
 * @param {string} [opts.phoneNumber]  Phone number (digits only or E.164)
 * @param {string} [opts.vcard]        Full vCard string — generated automatically if omitted
 *
 * @example
 * const fakeQuote = buildFakeContactQuote({ displayName: 'baileys', phoneNumber: '233533416608' })
 * await sock.sendMessage(m.from, { text: 'Hello' }, { quoted: fakeQuote })
 */
export function buildFakeContactQuote({ displayName, _phoneNumber, vcard, ai } = {}) {
  // The vcard waid ALWAYS resolves to a real AI account (Meta AI / ChatGPT /
  // Perplexity, picked at random per message). The caller's phoneNumber is
  // deliberately NOT used as the waid — it resolves to the owner's own
  // number, so the quote renders the owner's profile instead of the AI's.
  // `phoneNumber` stays in the signature for backward compatibility only.
  // Pin a specific account with `ai` (a JID from AI_JIDS), e.g.
  //   buildFakeContactQuote({ ai: META_AI_JID })
  const { number: aiNumber, name: aiName } = ai
    ? { number: ai.split('@')[0], name: AI_NAMES[ai] || 'Meta AI' }
    : pickAiContact()

  const vcardStr = vcard || [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${displayName || aiName}`,
    `TEL;type=CELL;waid=${aiNumber}:+${aiNumber}`,
    'END:VCARD',
  ].filter(Boolean).join('\r\n')

  return {
    key: {
      fromMe:      false,
      participant: WA_JID,
      remoteJid:   STATUS_JID,
      id:          'BAE5' + Math.random().toString(36).slice(2, 10).toUpperCase(),
    },
    message: {
      // ContactMessage proto (verified): only displayName, vcard, contextInfo.
      // No jpegThumbnail or thumbnail field exists — WA derives the avatar
      // from the contact's actual profile picture (via the vcard waid),
      // not from the message proto.
      contactMessage: {
        displayName: displayName || aiName,
        vcard:       vcardStr,
      }
    }
  }
}

/**
 * Build a fake audioMessage quoted context.
 * Renders as a voice-note waveform + duration in the reply bar.
 *
 * IMPORTANT — WA CDN URLs expire. Two usage modes:
 *
 *   1. Pass a full `audioMessage` proto captured from a received ptt/audio message
 *      (the `.message.audioMessage` field of the WAMessage object Baileys gives you).
 *      This produces a fully playable voice-note preview in the reply bar.
 *
 *   2. Omit `audioMessage`. A minimal shell is built — renders the voice-note icon
 *      and duration (`seconds`) in the reply bar but is not playable. Still visually
 *      impactful.
 *
 * @param {object}  [opts]
 * @param {object}  [opts.audioMessage]  Full audioMessage proto from a received message
 * @param {number}  [opts.seconds=9999999]  Duration shown on the waveform (cosmetic if no real audio)
 * @param {boolean} [opts.ptt=true]      True = voice note waveform, false = audio file icon
 *
 * @example
 * // Shell (not playable, but renders the waveform):
 * const fakeQuote = buildFakeAudioQuote({ seconds: 9999999 })
 *
 * // Real audio from a received message:
 * const fakeQuote = buildFakeAudioQuote({ audioMessage: receivedMsg.message.audioMessage })
 *
 * await sock.sendMessage(m.from, { text: menuText }, { quoted: fakeQuote })
 */
export function buildFakeAudioQuote({ audioMessage, seconds = 9999999, ptt = true } = {}) {
  return {
    key: {
      fromMe:      false,
      participant: WA_JID,
      remoteJid:   STATUS_JID,
      id:          'BAE5' + Math.random().toString(36).slice(2, 10).toUpperCase(),
    },
    message: {
      audioMessage: audioMessage || {
        // Minimal shell — visible in reply bar as a voice note icon + duration.
        // mediaKey / fileSha256 / fileEncSha256 are zeroed-out buffers so the
        // proto serialises without errors; the audio itself is not playable.
        mimetype:       'audio/mp4',
        seconds,
        ptt,
        fileLength:     0,                  // uint64 — number, not string
        mediaKey:       Buffer.alloc(32),
        fileSha256:     Buffer.alloc(32),
        fileEncSha256:  Buffer.alloc(32),
      },
    },
  }
}

/**
 * Build a fake locationMessage quoted context.
 * Renders as a compact location card (📍 name + address) in the reply bar —
 * NOT a full map tile. The coordinates satisfy the proto requirement but are
 * not shown to the user; name and address are the displayed content.
 *
 * Pass the result as `{ quoted: buildFakeLocationQuote(...) }` to any
 * sock.sendMessage / baileysBridge call.
 *
 * @param {object}  [opts]
 * @param {string}  [opts.name]              Location name shown in the reply bar
 * @param {string}  [opts.address]           Address / subtitle line
 * @param {number}  [opts.degreesLatitude=0]
 * @param {number}  [opts.degreesLongitude=0]
 *
 * @example
 * const fakeQuote = buildFakeLocationQuote({ name: 'baileys', address: 'baileys' })
 * await sock.sendMessage(m.from, { text: menuText }, { quoted: fakeQuote })
 */
export function buildFakeLocationQuote({
  name             = 'baileys',
  address          = 'baileys',
  degreesLatitude  = 6.6745,
  degreesLongitude = -1.5716,
  jpegThumbnail,
} = {}) {
  return {
    key: {
      fromMe:      false,
      participant: WA_JID,
      remoteJid:   STATUS_JID,
      id:          'BAE5' + Math.random().toString(36).slice(2, 10).toUpperCase(),
    },
    message: {
      locationMessage: {
        degreesLatitude,
        degreesLongitude,
        name,
        address,
        jpegThumbnail: jpegThumbnail || undefined,
      },
    },
  }
}

/**
 * Build a fake liveLocationMessage quoted context.
 *
 * Renders differently from a regular locationMessage — shows as a "Live Location"
 * card with caption text and optional thumbnail in the reply bar. This is the
 * preferred quote type for the location menu style.
 *
 * @param {object}  [opts]
 * @param {string}  [opts.caption]          Text shown on the live location card
 * @param {string}  [opts.name]             Alias for caption
 * @param {Buffer}  [opts.jpegThumbnail]    Thumbnail image shown on the card
 * @param {number}  [opts.degreesLatitude]
 * @param {number}  [opts.degreesLongitude]
 * @param {number}  [opts.forwardingScore]  Adds forwarded badge when set
 */
export function buildFakeLiveLocationQuote({
  caption,
  name,
  jpegThumbnail,
  degreesLatitude  = 6.6745,
  degreesLongitude = -1.5716,
  sequenceNumber,
  forwardingScore,
} = {}) {
  return {
    key: {
      fromMe:      false,
      participant: WA_JID,
      remoteJid:   STATUS_JID,
      id:          'BAE5' + Math.random().toString(36).slice(2, 10).toUpperCase(),
    },
    message: {
      liveLocationMessage: {
        degreesLatitude,
        degreesLongitude,
        caption:        caption || name || 'baileys',
        sequenceNumber: sequenceNumber || Date.now(),  // int64 — number, not string
        jpegThumbnail:  jpegThumbnail  || undefined,
        ...(forwardingScore != null ? {
          contextInfo: { forwardingScore, isForwarded: true },
        } : {}),
      },
    },
  }
}

/**
 * Build a fake extendedTextMessage quoted context.
 * Renders as a rich text card in the reply bar — title + body text + optional thumbnail.
 *
 * @param {object}  [opts]
 * @param {string}  [opts.text]          Body text shown in the reply bar
 * @param {string}  [opts.title]         Bold heading above the text
 * @param {Buffer}  [opts.jpegThumbnail] Thumbnail shown alongside the text
 */
// ExtendedTextMessage proto (verified): text(1), matchedText(2), description(5),
// title(6), font(9), previewType(10), jpegThumbnail(16), contextInfo(17) — all valid.
export function buildFakeTextQuote({ text, title, jpegThumbnail } = {}) {
  return {
    key: {
      fromMe:      false,
      participant: WA_JID,
      remoteJid:   STATUS_JID,
      id:          'BAE5' + Math.random().toString(36).slice(2, 10).toUpperCase(),
    },
    message: {
      extendedTextMessage: {
        text:          text          || 'baileys',
        title:         title         || undefined,
        jpegThumbnail: jpegThumbnail || undefined,
      },
    },
  }
}

/**
 * Build a fake documentMessage quoted context.
 * Renders as a document card (file icon + title) in the reply bar.
 *
 * @param {object}  [opts]
 * @param {string}  [opts.title]         Document title / filename shown
 * @param {string}  [opts.fileName]      File name (default: nexora.pdf)
 * @param {string}  [opts.mimetype]      MIME type (default: application/pdf)
 * @param {Buffer}  [opts.jpegThumbnail] Preview thumbnail
 */
export function buildFakeDocumentQuote({ title, fileName, mimetype, jpegThumbnail } = {}) {
  return {
    key: {
      fromMe:      false,
      participant: WA_JID,
      remoteJid:   STATUS_JID,
      id:          'BAE5' + Math.random().toString(36).slice(2, 10).toUpperCase(),
    },
    message: {
      documentMessage: {
        title:         title         || 'baileys',
        fileName:      fileName      || 'nexora.pdf',
        mimetype:      mimetype      || 'application/pdf',
        jpegThumbnail: jpegThumbnail || undefined,
      },
    },
  }
}

/**
 * Build a fake imageMessage quoted context.
 * Renders as an image thumbnail in the reply bar.
 * Pass a real `jpegThumbnail` buffer for a visible image; without it WA shows
 * a grey placeholder.
 *
 * @param {object}  [opts]
 * @param {string}  [opts.url]           CDN URL (cosmetic — expires; thumbnail is what shows)
 * @param {Buffer}  [opts.jpegThumbnail] Actual visible thumbnail in the reply bar
 * @param {boolean} [opts.viewOnce=false] Mark as view-once
 * @param {number}  [opts.height=306]
 * @param {number}  [opts.width=366]
 */
export function buildFakeImageQuote({ url, jpegThumbnail, viewOnce = false, height = 306, width = 366 } = {}) {
  return {
    key: {
      fromMe:      false,
      participant: WA_JID,
      remoteJid:   STATUS_JID,
      id:          'BAE5' + Math.random().toString(36).slice(2, 10).toUpperCase(),
    },
    message: {
      imageMessage: {
        url:           url           || '',
        mimetype:      'image/jpeg',
        jpegThumbnail: jpegThumbnail || undefined,
        fileLength:    0,            // uint64 — number, not string
        height,
        width,
        ...(viewOnce ? { viewOnce: true } : {}),
      },
    },
  }
}

/**
 * Build a fake videoMessage quoted context with gifPlayback.
 * Renders as an animated GIF preview / video card in the reply bar.
 *
 * @param {object}  [opts]
 * @param {string}  [opts.title]         Card title
 * @param {string}  [opts.caption]       Caption text
 * @param {Buffer}  [opts.jpegThumbnail] Preview frame thumbnail
 * @param {number}  [opts.seconds=999999999] Duration (cosmetic)
 * @param {boolean} [opts.gifPlayback=true]  GIF loop mode
 */
// VideoMessage proto (verified): no `title` field exists — removed.
// seconds = uint32, fileLength = uint64 — must be numbers, not strings.
export function buildFakeGifQuote({ caption, jpegThumbnail, seconds = 999999999, gifPlayback = true } = {}) {
  return {
    key: {
      fromMe:      false,
      participant: WA_JID,
      remoteJid:   STATUS_JID,
      id:          'BAE5' + Math.random().toString(36).slice(2, 10).toUpperCase(),
    },
    message: {
      videoMessage: {
        caption:       caption       || '',
        jpegThumbnail: jpegThumbnail || undefined,
        seconds:       Number(seconds),   // uint32
        gifPlayback,
        mimetype:      'video/mp4',
        fileLength:    0,                 // uint64
      },
    },
  }
}

/**
 * Build a fake productMessage quoted context.
 * Renders as a product catalogue card (image + name + price) in the reply bar.
 *
 * @param {object}  [opts]
 * @param {string}  [opts.title]            Product name
 * @param {string}  [opts.description]      Product description
 * @param {string}  [opts.currencyCode]     ISO 4217 currency (default: 'USD')
 * @param {string}  [opts.priceAmount1000]  Price × 1000 (e.g. "20000" = $20.00)
 * @param {Buffer}  [opts.jpegThumbnail]    Product image thumbnail
 * @param {string}  [opts.businessOwnerJid] Business JID
 */
// NOTE: productMessage as a fake quote renders best on WA Business accounts
// or in catalog contexts. On regular accounts WA still shows the card but
// may show a "view product" placeholder rather than full product details.
export function buildFakeProductQuote({
  title,
  description,
  currencyCode     = 'USD',
  priceAmount1000  = 1000,
  jpegThumbnail,
  businessOwnerJid,
} = {}) {
  return {
    key: {
      fromMe:      false,
      participant: WA_JID,
      remoteJid:   STATUS_JID,
      id:          'BAE5' + Math.random().toString(36).slice(2, 10).toUpperCase(),
    },
    message: {
      productMessage: {
        product: {
          productImage: {
            mimetype:      'image/jpeg',
            jpegThumbnail: jpegThumbnail || undefined,
          },
          title:               title             || 'baileys',
          description:         description       || '',
          currencyCode,
          priceAmount1000:     Number(priceAmount1000),  // int64 — number, not string
          productImageCount:   1,
        },
        businessOwnerJid: businessOwnerJid || WA_JID,
      },
    },
  }
}

/**
 * Build a fake groupInviteMessage quoted context.
 * Renders as a group invite card (group name + join button) in the reply bar.
 *
 * @param {object}  [opts]
 * @param {string}  [opts.groupJid]      The group JID (can be fake)
 * @param {string}  [opts.inviteCode]    Invite code (cosmetic — 'null' is accepted)
 * @param {string}  [opts.groupName]     Group name shown on the card
 * @param {string}  [opts.caption]       Caption / description text
 * @param {Buffer}  [opts.jpegThumbnail] Group icon thumbnail
 */
export function buildFakeGroupInviteQuote({ groupJid, inviteCode = 'null', groupName, caption, jpegThumbnail } = {}) {
  return {
    key: {
      fromMe:      false,
      participant: WA_JID,
      remoteJid:   STATUS_JID,
      id:          'BAE5' + Math.random().toString(36).slice(2, 10).toUpperCase(),
    },
    message: {
      groupInviteMessage: {
        groupJid:      groupJid      || WA_JID,
        inviteCode,
        groupName:     groupName     || 'baileys',
        caption:       caption       || '',
        jpegThumbnail: jpegThumbnail || undefined,
      },
    },
  }
}

/**
 * Build a fake requestPaymentMessage quoted context.
 * Renders as a payment request card in the reply bar.
 *
 * @param {object}  [opts]
 * @param {string}  [opts.currencyCode]    ISO 4217 code (default: 'USD')
 * @param {string}  [opts.amount1000]      Amount × 1000 (e.g. '5000' = $5.00)
 * @param {string}  [opts.note]            Note text on the payment card
 * @param {string}  [opts.expiryTimestamp] Unix ms timestamp (defaults to 24h from now)
 */
// NOTE: requestPaymentMessage renders correctly only in WA Pay regions
// (Brazil, India, Singapore, etc.). In unsupported regions WA client may
// show a generic "payment" icon or an unknown-message placeholder.
// Still valid as a fake quoted context — the proto fields are correct.
export function buildFakePaymentQuote({ currencyCode = 'USD', amount1000 = 1000, note, expiryTimestamp } = {}) {
  const amt = Number(amount1000)
  return {
    key: {
      fromMe:      false,
      participant: WA_JID,
      remoteJid:   STATUS_JID,
      id:          'BAE5' + Math.random().toString(36).slice(2, 10).toUpperCase(),
    },
    message: {
      requestPaymentMessage: {
        currencyCodeIso4217: currencyCode,
        amount1000:          amt,                                  // uint64 — number
        requestFrom:         WA_JID,
        // noteMessage is optional Message — wraps extendedTextMessage
        noteMessage: {
          extendedTextMessage: { text: note || 'baileys' },
        },
        expiryTimestamp: expiryTimestamp || (Date.now() + 86_400_000), // int64 — number
        // Money proto: value = raw amount (same as amount1000), offset = scale (1000)
        amount: {
          value:        amt,         // int64
          offset:       1000,        // uint32 — divide value by offset for display amount
          currencyCode,
        },
      },
    },
  }
}

/**
 * Build a fake newsletterAdminInviteMessage quoted context.
 * Renders as a WhatsApp Channel invite card in the reply bar.
 * Pass the result as { quoted: buildFakeNewsletterQuote(...) }.
 *
 * @param {object} [opts]
 * @param {string} [opts.newsletterJid]  Channel JID (e.g. 123456789@newsletter)
 * @param {string} [opts.newsletterName] Channel display name
 * @param {string} [opts.caption]        Caption text on the invite
 *
 * @example
 * const quote = buildFakeNewsletterQuote({ newsletterJid: '123@newsletter', newsletterName: 'My Channel' })
 * await sock.sendMessage(m.from, { text: 'Hello' }, { quoted: quote })
 */
export function buildFakeNewsletterQuote({ newsletterJid, newsletterName, caption } = {}) {
  return {
    key: {
      fromMe:      false,
      participant: WA_JID,
      remoteJid:   STATUS_JID,
      id:          'BAE5' + Math.random().toString(36).slice(2, 10).toUpperCase(),
    },
    message: {
      newsletterAdminInviteMessage: {
        newsletterJid:    newsletterJid || '120363293577041544@newsletter',
        newsletterName:   newsletterName || 'baileys Updates',
        caption:          caption || 'Made with ♥️ By Aizen',
        inviteExpiration: Math.floor(Date.now() / 1000) + 86400 * 7,
      },
    },
  }
}

/**
 * Pick a random fake quote from the full pool of available builders.
 * Useful for adding variety to greetings, welcome messages, or any send
 * where the specific quote type doesn't matter.
 *
 * @param {object} [perTypeOpts]  Optional per-type option overrides keyed by builder name:
 *   { order, contact, audio, liveLocation, location, text, document, image, gif, product, groupInvite, payment, newsletter }
 *
 * @example
 * await sock.sendMessage(m.from, { text: 'Hello!' }, { quoted: buildRandomFakeQuote() })
 */
export function buildRandomFakeQuote(perTypeOpts = {}) {
  const pool = [
    () => buildFakeOrderQuote(perTypeOpts.order || {}),
    () => buildFakeContactQuote(perTypeOpts.contact || {}),
    () => buildFakeAudioQuote(perTypeOpts.audio || {}),
    () => buildFakeLiveLocationQuote(perTypeOpts.liveLocation || {}),
    () => buildFakeLocationQuote(perTypeOpts.location || {}),
    () => buildFakeTextQuote(perTypeOpts.text || {}),
    () => buildFakeDocumentQuote(perTypeOpts.document || {}),
    () => buildFakeImageQuote(perTypeOpts.image || {}),
    () => buildFakeGifQuote(perTypeOpts.gif || {}),
    () => buildFakeProductQuote(perTypeOpts.product || {}),
    () => buildFakeGroupInviteQuote(perTypeOpts.groupInvite || {}),
    () => buildFakePaymentQuote(perTypeOpts.payment || {}),
    () => buildFakeNewsletterQuote(perTypeOpts.newsletter || {}),
  ]
  return pool[Math.floor(Math.random() * pool.length)]()
}

export async function sendFakeQuote(sock, jid, text, fakeText = '\u200e', opts = {}) {
  return sock.sendMessage(jid, {
    text,
    contextInfo: {
      stanzaId:      fakeStanzaId(),   // required for reliable reply-bar rendering
      quotedMessage: { conversation: fakeText },
      participant:   pickAiJid(),      // "Meta AI" shown as the quoted sender
      remoteJid:     jid,              // must be the actual destination chat, not WA_JID
    },
  }, opts)
}

/**
 * Convenience wrapper — takes the serialised `m` object and automatically
 * quotes the triggering message.
 *
 * @param {object}                     m          Serialised message (from serializer.js)
 * @param {import('baileys').WASocket} sock
 * @param {string}                     text       Message body
 * @param {string}                    [fakeText]  Text in the green quote bar
 * @param {object}                    [opts]      Extra options (merged after { quoted: m })
 *
 * @example
 * await replyFakeQuote(m, sock, '*baileys* joined the chat.', 'WhatsApp')
 */
export async function replyFakeQuote(m, sock, text, fakeText = '\u200e', opts = {}) {
  return sendFakeQuote(sock, m.from, text, fakeText, { quoted: m, ...opts })
}

// ─────────────────────────────────────────────────────────────────────────────
// 2.  EXTERNAL AD REPLY
//     A branded card (title + body + thumbnail + tap-to-open URL) floats
//     above the message text. Setting sourceId to WA_JID makes the card
//     appear to come from WhatsApp itself.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {object} AdReplyOpts
 * @property {string}       title                    Card heading (bold)
 * @property {string}      [body]                    Card subtext / description
 * @property {Buffer}      [thumbnail]               Raw image buffer (takes priority over thumbnailUrl)
 * @property {string}      [thumbnailUrl]            HTTPS URL of the thumbnail image (link-preview format)
 * @property {string}      [originalImageUrl]        HTTPS URL of the high-quality image (fork extension:
 *                                           WhatsApp fetches this for full-quality link preview rendering)
 * @property {string}      [sourceUrl]               URL opened when the card is tapped
 * @property {string}      [sourceId]                Source JID (default: WA_JID → "WhatsApp")
 * @property {1|2}         [mediaType]               1 = IMAGE (default), 2 = VIDEO
 * @property {boolean}     [renderLargerThumbnail]   Show large-image layout (default: false)
 * @property {boolean}     [showAdAttribution]       Show attribution label (default: true)
 */

/**
 * Send a text message topped with an external ad-reply card.
 *
 * @param {import('baileys').WASocket} sock
 * @param {string}      jid   Destination chat JID
 * @param {string}      text  Message body (shown below the card)
 * @param {AdReplyOpts} ad    Card configuration
 * @param {object}     [opts] Extra options forwarded to sock.sendMessage
 *
 * @example
 * await sendAdReply(sock, m.from, 'Check this out!', {
 *   title: 'baileys',
 *   body:  'The next-gen WhatsApp bot',
 *   thumbnailUrl: 'https://example.com/logo.jpg',
 *   sourceUrl:    'https://example.com',
 * }, { quoted: m })
 */
/**
 * Build the `contextInfo` block for an externalAdReply card (title/body/
 * thumbnail banner) plus its related optional badges (forwarded, newsletter,
 * mentions). Shared by `sendAdReply` and by `actionCardWithAd` in
 * interactiveKit.js, so a single interactive message can carry both the ad
 * banner AND nativeFlow buttons instead of needing two separate messages.
 *
 * @param {AdReplyOpts} ad
 * @returns {object} contextInfo fragment — merge into any sendMessage/
 *                    interactiveMessage contextInfo object.
 */
export function buildAdReplyContext(ad = {}) {
  const card = {
    title:                 ad.title                 ?? 'WhatsApp',
    body:                  ad.body                  ?? '',
    sourceUrl:             ad.sourceUrl             ?? 'https://whatsapp.com',
    sourceId:              ad.sourceId              ?? WA_JID,
    mediaType:             ad.mediaType             ?? 1,
    renderLargerThumbnail: ad.renderLargerThumbnail ?? false,
    showAdAttribution:     ad.showAdAttribution     ?? true,
  }

  // Optional visible fields
  if (ad.description)         card.description         = ad.description   // subtitle below body
  if (ad.previewType)         card.previewType         = ad.previewType   // e.g. 'PHOTO'
  if (ad.mediaUrl)            card.mediaUrl            = ad.mediaUrl       // media CDN URL
  if (ad.containsAutoReply)   card.containsAutoReply   = true             // auto-reply badge

  // URL-based thumbnail (link-preview format) — preferred over buffer
  // The fork's externalAdReply proto supports originalImageUrl for
  // high-quality link preview rendering alongside thumbnailUrl.
  if (ad.thumbnail) {
    card.thumbnail = ad.thumbnail
  } else if (ad.thumbnailUrl) {
    card.thumbnailUrl = ad.thumbnailUrl
    // Pass through originalImageUrl if provided (high-quality preview)
    if (ad.originalImageUrl) card.originalImageUrl = ad.originalImageUrl
  } else if (ad.originalImageUrl) {
    // If only originalImageUrl is given, use it as the thumbnail too
    card.thumbnailUrl = ad.originalImageUrl
    card.originalImageUrl = ad.originalImageUrl
  }

  const contextInfo = { externalAdReply: card }

  // Optional: "Forwarded" / "Forwarded many times" badge (score > 5 = "many times")
  if (ad.forwardingScore != null) {
    contextInfo.forwardingScore = ad.forwardingScore
    contextInfo.isForwarded     = true
  }

  // Optional: Channel forward-origin badge — shows newsletterName above the message
  if (ad.newsletterJid) {
    contextInfo.forwardedNewsletterMessageInfo = {
      newsletterJid:      ad.newsletterJid,
      serverMessageId:    1,
      newsletterName:     ad.newsletterName     || '',
      contentType:        1,
      accessibilityText:  ad.newsletterName     || '',
    }
    contextInfo.isForwarded = true
  }

  // Optional: mentionedJid list (triggers notification for those users)
  if (Array.isArray(ad.mentionedJid) && ad.mentionedJid.length) {
    contextInfo.mentionedJid = ad.mentionedJid
  }

  return contextInfo
}

export async function sendAdReply(sock, jid, text, ad = {}, opts = {}) {
  const contextInfo = buildAdReplyContext(ad)
  return sock.sendMessage(jid, { text, contextInfo }, opts)
}

/**
 * Convenience wrapper — takes `m` and automatically quotes the triggering message.
 *
 * @param {object}                     m     Serialised message
 * @param {import('baileys').WASocket} sock
 * @param {string}                     text  Message body
 * @param {AdReplyOpts}                ad    Card configuration
 * @param {object}                    [opts] Extra options
 *
 * @example
 * await replyAdReply(m, sock, 'Bot info', {
 *   title: 'baileys v2',
 *   body:  'Type .menu for commands',
 *   thumbnailUrl: 'https://example.com/banner.jpg',
 * })
 */
export async function replyAdReply(m, sock, text, ad = {}, opts = {}) {
  return sendAdReply(sock, m.from, text, ad, { quoted: m, ...opts })
}

// ─────────────────────────────────────────────────────────────────────────────
// 3.  STATUS BROADCAST
//     Sends a text, image, or video status visible to the contacts listed in
//     statusJidList.  An empty list means all saved contacts can see it
//     (Baileys default behaviour).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {object} StatusOpts
 * @property {string[]}     [statusJidList]    Contacts who can see the status (default: [])
 * @property {string}       [backgroundColor]  Hex colour for text statuses (default: '#25D366')
 * @property {0|1|2|3|4|5} [font]             Font style index 0–5 for text (default: 0)
 * @property {string}       [caption]          Caption for image / video statuses
 */

/**
 * Post a text status to status@broadcast.
 *
 * @param {import('baileys').WASocket} sock
 * @param {string}     text  Status text content
 * @param {StatusOpts} [opts]
 *
 * @example
 * await sendTextStatus(sock, 'Bot is online!', {
 *   backgroundColor: '#128C7E',
 *   statusJidList: ['233597514499@s.whatsapp.net'],
 * })
 */
export async function sendTextStatus(sock, text, opts = {}) {
  const { statusJidList = [], backgroundColor = '#25D366', font = 0 } = opts
  return sock.sendMessage(
    STATUS_JID,
    { text, backgroundColor, font },
    { statusJidList },
  )
}

/**
 * Post an image status.
 *
 * @param {import('baileys').WASocket} sock
 * @param {Buffer|string} image  Image buffer or HTTPS URL string
 * @param {StatusOpts}   [opts]
 *
 * @example
 * await sendImageStatus(sock, 'https://example.com/banner.jpg', {
 *   caption: 'New update dropped!',
 * })
 */
export async function sendImageStatus(sock, image, opts = {}) {
  const { statusJidList = [], caption = '' } = opts
  const content = typeof image === 'string'
    ? { image: { url: image }, caption }
    : { image, caption }
  return sock.sendMessage(STATUS_JID, content, { statusJidList })
}

/**
 * Post a video status.
 *
 * @param {import('baileys').WASocket} sock
 * @param {Buffer|string} video  Video buffer or HTTPS URL string
 * @param {StatusOpts}   [opts]
 *
 * @example
 * await sendVideoStatus(sock, videoBuffer, { caption: 'Watch this!' })
 */
export async function sendVideoStatus(sock, video, opts = {}) {
  const { statusJidList = [], caption = '' } = opts
  const content = typeof video === 'string'
    ? { video: { url: video }, caption, gifPlayback: false }
    : { video, caption, gifPlayback: false }
  return sock.sendMessage(STATUS_JID, content, { statusJidList })
}

/**
 * Unified status dispatcher — picks the right sender based on `type`.
 *
 * @param {import('baileys').WASocket}  sock
 * @param {'text'|'image'|'video'}     type     Media kind (default: 'text')
 * @param {string|Buffer}              content  Text, image/video buffer, or URL
 * @param {StatusOpts}                [opts]
 *
 * @example
 * // Text status
 * await sendStatus(sock, 'text', 'Going offline for maintenance.')
 *
 * // Image via URL
 * await sendStatus(sock, 'image', 'https://example.com/photo.jpg', { caption: 'Fresh drop' })
 *
 * // Video via buffer
 * await sendStatus(sock, 'video', videoBuffer, { caption: 'Check this out' })
 */
export async function sendStatus(sock, type = 'text', content, opts = {}) {
  if (!sock)    throw new TypeError('sendStatus: sock is required')
  if (!content && content !== 0) throw new TypeError('sendStatus: content is required')

  const validTypes = ['text', 'image', 'video']
  if (!validTypes.includes(type)) {
    throw new TypeError(`sendStatus: invalid type "${type}" — must be one of: ${validTypes.join(', ')}`)
  }

  switch (type) {
    case 'image': return sendImageStatus(sock, content, opts)
    case 'video': return sendVideoStatus(sock, content, opts)
    default:      return sendTextStatus(sock, String(content), opts)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4.  MENU BANNER — fake product quote + externalAdReply banner
//     Builds a combined { quoted, contextInfo } pair for plain-text and
//     plain-text-with-buttons fallback tiers. Uses the .about command's
//     rendering style:
//       - buildFakeProductQuote catalog card in the reply bar
//       - externalAdReply banner with .about-style title/body
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a fake product quote + externalAdReply banner for plain-text fallbacks.
 * Matches the .about command's visual style: catalog card in the reply bar,
 * banner with brand name as title and status info as body.
 *
 * @param {object}  opts
 * @param {object} [opts.imgData]        Image data from imageManager.getMenuImage()
 * @param {object} [opts.adReply]        Pre-built externalAdReply object (optional — auto-built if omitted)
 * @param {string} [opts.botName]        Bot name (for auto-built adReply + product quote)
 * @param {number|string} [opts.totalCommands]  Command count (for auto-built adReply)
 * @param {object} [opts.quoted]         Existing quoted message to preserve (takes priority over fake product quote)
 * @returns {{ quoted: object, contextInfo: { externalAdReply: object } }}
 *
 * @example
 * const { quoted, contextInfo } = buildMenuBanner({ imgData, adReply, botName: menuData.botName, totalCommands: menuData.totalCommands })
 * await sock.sendMessage(m.from, { text: bodyText, contextInfo }, { quoted })
 */
export function buildMenuBanner({ imgData, adReply, botName, totalCommands, quoted } = {}) {
  // ── Fake product quote — catalog card in the reply bar (.about style) ──
  const fakeProductQuote = buildFakeProductQuote({
    title:           botName || 'baileys',
    description:     `${totalCommands || 0} commands`,
    currencyCode:    'USD',
    priceAmount1000: 0,
    businessOwnerJid: WA_JID,
    ...(imgData?.buffer ? { jpegThumbnail: imgData.buffer } : {}),
  });

  // ── External ad-reply banner — .about style ──
  // Title = brand name (no decorative symbols), body = status info
  let banner;
  if (adReply) {
    banner = adReply;
  } else {
    banner = {
      title:                 botName || 'baileys',
      body:                  `${totalCommands || 0} commands • Online`,
      sourceUrl:             'https://example.com',
      mediaType:             1,
      renderLargerThumbnail: true,
      showAdAttribution:     false,
    };
    if (imgData?.buffer) {
      banner.thumbnail = imgData.buffer;
    } else if (imgData?.source?.startsWith('http')) {
      banner.thumbnailUrl = imgData.source;
      banner.originalImageUrl = imgData.source;
    }
  }

  return {
    quoted: quoted || fakeProductQuote,
    contextInfo: { externalAdReply: banner },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ABOUT-STYLE CARD BUILDER
//     Standardized .about command rendering for all menu types.
//     Uses sendButtonsCard with:
//       - Thumbnail header (title + subtitle + 300x300 image)
//       - buildFakeProductQuote catalog card in the reply bar
//       - Pill buttons (displayText/id/type:1 + buildNavigationButton)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the contextInfo for an .about-style card.
 * Creates a buildFakeProductQuote catalog card in the reply bar with
 * the bot's brand image as the thumbnail.
 *
 * @param {object}  opts
 * @param {string} [opts.botName]        Bot name for the product title
 * @param {string} [opts.description]    Product description
 * @param {Buffer} [opts.thumbnail]      Image buffer for the product thumbnail
 * @param {string} [opts.mentionedJid]   JID to mention in the message
 * @returns {object}                     contextInfo object for sendButtonsCard
 */
export function buildAboutContextInfo({ botName, description, thumbnail, mentionedJid } = {}) {
  const catalogQuote = buildFakeProductQuote({
    title:           botName || 'baileys',
    description:      description || '',
    currencyCode:    'USD',
    priceAmount1000: 0,
    businessOwnerJid: WA_JID,
    ...(thumbnail ? { jpegThumbnail: thumbnail } : {}),
  });
  return {
    stanzaId:      catalogQuote.key.id || 'catalog',
    participant:   catalogQuote.key.participant,
    remoteJid:     catalogQuote.key.remoteJid,
    quotedMessage: catalogQuote.message,
    ...(mentionedJid ? { mentionedJid: Array.isArray(mentionedJid) ? mentionedJid : [mentionedJid] } : {}),
  };
}

/**
 * Build the standard .about-style button set.
 * Two pill buttons: one quick action + one navigation category picker.
 *
 * @param {string} [prefix='.']      Command prefix
 * @param {Array}  [customButtons]   Custom buttons to use instead of defaults
 * @returns {Array}                   Array of button objects for sendButtonsCard
 */
export function buildAboutButtons(prefix = '.', customButtons) {
  if (customButtons && Array.isArray(customButtons)) return customButtons;
  return [
    { displayText: '📋 All Commands', id: `${prefix}menu all`, type: 1 },
    { displayText: '🤖 System Info',  id: `${prefix}about`,     type: 1 },
  ];
}

/**
 * Resolve a thumbnail for sendButtonsCard from imageManager data.
 * Returns a URL string (preferred) or Buffer.
 *
 * @param {object} [imgData]   Image data from imageManager.getMenuImage()
 * @param {string} [fallback]  Fallback URL if no imgData
 * @returns {string|Buffer|undefined}
 */
export function resolveThumbnail(imgData, fallback) {
  if (imgData?.source?.startsWith('http')) return imgData.source;
  if (imgData?.buffer) return imgData.buffer;
  return fallback;
}
