/**
 * extended-messages.ts
 *
 * Extended message type handlers — custom message types built on top of
 * upstream Baileys. These are the useful additions from community forks,
 * ported to clean TypeScript with no hidden behavior.
 *
 * Usage:
 *   import { detectExtendedMessageType, makeExtendedMessageHandlers } from './extended-messages.js'
 */
import { randomBytes } from 'node:crypto'
import type { proto } from '../../WAProto/index.js'
import type {
  AlbumMessageContent,
  EventV2MessageContent,
  GroupStatusMessageContent,
  PollResultMessageContent,
  RequestPaymentMessageContent,
  MessageRelayOptions,
  MiscMessageGenerationOptions,
} from '../Types/index.js'
import type { WAMediaUploadFunction } from '../Types/Message.js'
import { generateWAMessage, generateWAMessageFromContent } from '../Utils/messages.js'
import { generateMessageIDV2 } from '../Utils/generics.js'

// ─── Extended type detection ──────────────────────────────────────────────────

export type ExtendedMessageType =
  | 'ALBUM'
  | 'EVENT'
  | 'POLL_RESULT'
  | 'PAYMENT'
  | 'GROUP_STATUS'

/**
 * Returns the extended message type key if the content is a custom type,
 * or null if it should be handled by the normal Baileys flow.
 */
export const detectExtendedMessageType = (content: object): ExtendedMessageType | null => {
  if ('albumMessage' in content) return 'ALBUM'
  if ('eventMessage' in content) return 'EVENT'
  if ('pollResultMessage' in content) return 'POLL_RESULT'
  if ('requestPaymentMessage' in content) return 'PAYMENT'
  if ('groupStatusMessage' in content) return 'GROUP_STATUS'
  return null
}

// ─── Handler factory ──────────────────────────────────────────────────────────

type RelayFn = (
  jid: string,
  message: proto.IMessage,
  opts: MessageRelayOptions,
) => Promise<string>

export interface ExtendedHandlerContext {
  waUploadToServer: WAMediaUploadFunction
  relayMessage: RelayFn
  meJid?: string
}

/**
 * Create all extended message handlers bound to the socket's internal
 * relay and upload functions. Call once per socket instance.
 */
export const makeExtendedMessageHandlers = (ctx: ExtendedHandlerContext) => {
  const { waUploadToServer, relayMessage, meJid } = ctx
  const jidOrFallback = meJid ?? '0@s.whatsapp.net'

  // ── Album ─────────────────────────────────────────────────────────────────
  /**
   * Send multiple images/videos as a single WhatsApp album thread.
   *
   * @example
   * await sock.sendMessage(jid, {
   *   albumMessage: [
   *     { image: buffer, caption: 'First' },
   *     { video: { url: 'https://...' }, caption: 'Second' },
   *   ]
   * })
   */
  const handleAlbum = async (
    content: AlbumMessageContent,
    jid: string,
    options: Pick<MiscMessageGenerationOptions, 'quoted'> = {},
  ): Promise<proto.IWebMessageInfo> => {
    const items = content.albumMessage

    // 1. Send the parent album container
    const albumMsg = await generateWAMessageFromContent(
      jid,
      {
        messageContextInfo: { messageSecret: randomBytes(32) },
        albumMessage: {
          expectedImageCount: items.filter(a => 'image' in a).length,
          expectedVideoCount: items.filter(a => 'video' in a).length,
        },
      },
      { userJid: jidOrFallback, quoted: options.quoted },
    )

    await relayMessage(jid, albumMsg.message!, { messageId: albumMsg.key.id! })

    // 2. Send each media item linked back to the parent
    for (const item of items) {
      const mediaMsg = await generateWAMessage(jid, item as any, {
        userJid: jidOrFallback,
        upload: waUploadToServer,
      })

      mediaMsg.message = {
        ...mediaMsg.message,
        messageContextInfo: {
          messageSecret: randomBytes(32),
          messageAssociation: {
            associationType: 1,
            parentMessageKey: albumMsg.key,
          },
        },
      }

      await relayMessage(jid, mediaMsg.message!, { messageId: mediaMsg.key.id! })
    }

    return albumMsg
  }

  // ── Event ─────────────────────────────────────────────────────────────────
  /**
   * Send a WhatsApp event invitation card.
   * (Distinct from the upstream `{ event: ... }` content type.)
   *
   * @example
   * await sock.sendMessage(jid, {
   *   eventMessage: {
   *     name: 'Team meeting',
   *     startTime: '1763019000',
   *     joinLink: 'https://call.whatsapp.com/video/...',
   *   }
   * })
   */
  const handleEvent = async (
    content: EventV2MessageContent,
    jid: string,
    options: Pick<MiscMessageGenerationOptions, 'quoted'> = {},
  ): Promise<proto.IWebMessageInfo> => {
    const d = content.eventMessage

    const msg = await generateWAMessageFromContent(
      jid,
      {
        viewOnceMessage: {
          message: {
            messageContextInfo: {
              deviceListMetadata: {},
              deviceListMetadataVersion: 2,
              messageSecret: randomBytes(32),
            },
            eventMessage: {
              isCanceled: d.isCanceled ?? false,
              name: d.name,
              description: d.description,
              location: d.location ?? { degreesLatitude: 0, degreesLongitude: 0, name: 'Location' },
              joinLink: d.joinLink ?? '',
              startTime:
                typeof d.startTime === 'string' ? parseInt(d.startTime, 10) : d.startTime,
              endTime:
                d.endTime != null
                  ? typeof d.endTime === 'string'
                    ? parseInt(d.endTime, 10)
                    : d.endTime
                  : undefined,
              extraGuestsAllowed: d.extraGuestsAllowed !== false,
            },
          },
        },
      },
      { userJid: jidOrFallback, quoted: options.quoted },
    )

    await relayMessage(jid, msg.message!, { messageId: msg.key.id! })
    return msg
  }

  // ── Poll result ───────────────────────────────────────────────────────────
  /**
   * Display poll results with vote counts.
   *
   * @example
   * await sock.sendMessage(jid, {
   *   pollResultMessage: {
   *     name: 'Favourite colour',
   *     pollVotes: [{ optionName: 'Blue', optionVoteCount: 42 }],
   *   }
   * })
   */
  const handlePollResult = async (
    content: PollResultMessageContent,
    jid: string,
    options: Pick<MiscMessageGenerationOptions, 'quoted'> = {},
  ): Promise<proto.IWebMessageInfo> => {
    const { name, pollVotes } = content.pollResultMessage

    const msg = await generateWAMessageFromContent(
      jid,
      {
        pollResultSnapshotMessage: {
          name,
          pollVotes: pollVotes.map(v => ({
            optionName: v.optionName,
            // proto field is number|Long|null — keep as number, accept string input
            optionVoteCount: typeof v.optionVoteCount === 'string'
              ? parseInt(v.optionVoteCount, 10)
              : v.optionVoteCount,
          })),
        },
      },
      { userJid: jidOrFallback, quoted: options.quoted },
    )

    await relayMessage(jid, msg.message!, { messageId: msg.key.id! })
    return msg
  }

  // ── Payment request ───────────────────────────────────────────────────────
  /**
   * Send a payment request message with optional background and note/sticker.
   *
   * @example
   * await sock.sendMessage(jid, {
   *   requestPaymentMessage: {
   *     currency: 'USD',
   *     amount: 10_000,   // in smallest currency unit × 1000
   *     note: 'For the invoice',
   *   }
   * })
   */
  const handlePayment = async (
    content: RequestPaymentMessageContent,
    jid: string,
    options: Pick<MiscMessageGenerationOptions, 'quoted'> = {},
  ): Promise<proto.IWebMessageInfo> => {
    const d = content.requestPaymentMessage

    let noteMessage: proto.IMessage | undefined
    if (d.sticker) {
      noteMessage = d.sticker
    } else if (d.note) {
      noteMessage = { extendedTextMessage: { text: d.note } }
    }

    const payloadMessage: proto.IMessage = {
      requestPaymentMessage: {
        expiryTimestamp: d.expiry ?? 0,
        amount1000: d.amount ?? 0,
        currencyCodeIso4217: d.currency ?? 'IDR',
        requestFrom: d.from ?? '0@s.whatsapp.net',
        noteMessage,
        background: d.background ?? { id: 'DEFAULT', placeholderArgb: 0xfff0f0f0 },
      },
    }

    const msg = await generateWAMessageFromContent(jid, payloadMessage, {
      userJid: jidOrFallback,
      quoted: options.quoted,
    })

    await relayMessage(jid, msg.message!, { messageId: msg.key.id! })
    return msg
  }

  // ── Group status ──────────────────────────────────────────────────────────
  /**
   * Send a group story/status message via groupStatusMessageV2.
   *
   * @example
   * await sock.sendMessage(jid, {
   *   groupStatusMessage: { text: 'Hello group!' }
   * })
   * // or with media:
   * await sock.sendMessage(jid, {
   *   groupStatusMessage: { image: buffer, caption: 'Morning!' }
   * })
   */
  const handleGroupStatus = async (
    content: GroupStatusMessageContent,
    jid: string,
  ): Promise<proto.IWebMessageInfo> => {
    const { message: rawMessage, ...rest } = content.groupStatusMessage

    let innerMessage: proto.IMessage
    if (rawMessage) {
      innerMessage = rawMessage
    } else {
      // Build a regular message from text/image/video, then wrap it
      const simpleMsg = await generateWAMessage(jid, rest as any, {
        userJid: jidOrFallback,
        upload: waUploadToServer,
      })
      innerMessage = simpleMsg.message!
    }

    const msgId = generateMessageIDV2(meJid)
    await relayMessage(
      jid,
      { groupStatusMessageV2: { message: innerMessage } },
      { messageId: msgId },
    )

    return {
      key: { remoteJid: jid, fromMe: true, id: msgId },
      message: { groupStatusMessageV2: { message: innerMessage } },
    }
  }

  return { handleAlbum, handleEvent, handlePollResult, handlePayment, handleGroupStatus }
}
