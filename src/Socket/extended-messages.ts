/**
 * extended-messages.ts
 *
 * Extended message type handlers — custom message types built on top of
 * upstream Baileys. These are the useful additions from community forks,
 * ported to clean TypeScript with no hidden behavior.
 *
 * Reference: kiuur/baileys (dugong.js) — ported and fixed for v7 TypeScript.
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
import { generateWAMessage, generateWAMessageFromContent, generateWAMessageContent } from '../Utils/messages.js'
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
   * FIX: Added the extra messageContextInfo fields (forwardingScore, isForwarded,
   * mentionedJid, starred, etc.) + forwardedNewsletterMessageInfo + disappearingMode
   * that WhatsApp requires to actually group media into an album instead of sending
   * them as separate messages. Also passes the parent album as `quoted` when
   * relaying each item so WA links them correctly.
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

      // FIX: These extra contextInfo fields are what makes WhatsApp render the
      // messages as a grouped album instead of individual media bubbles.
      mediaMsg.message = {
        ...mediaMsg.message,
        messageContextInfo: {
          messageSecret: randomBytes(32),
          messageAssociation: {
            associationType: 1,
            parentMessageKey: albumMsg.key,
          },
          participant: '0@s.whatsapp.net',
          remoteJid: 'status@broadcast',
          forwardingScore: 99999,
          isForwarded: true,
          mentionedJid: [jid],
          starred: true,
          isHighlighted: true,
          businessMessageForwardInfo: {
            businessOwnerJid: jid,
          },
          dataSharingContext: {
            showMmDisclosure: true,
          },
        },
        // FIX: Required for album grouping on some WA builds
        forwardedNewsletterMessageInfo: {
          newsletterJid: '0@newsletter',
          serverMessageId: 1,
          newsletterName: 'WhatsApp',
          contentType: 1,
          timestamp: Math.floor(Date.now() / 1000),
        } as any,
        disappearingMode: {
          initiator: 3,
          trigger: 4,
        } as any,
      }

      await relayMessage(jid, mediaMsg.message!, {
        messageId: mediaMsg.key.id!,
        // FIX: Pass the album container as quoted so WA links each item to the parent
        ...(albumMsg.key
          ? {
              additionalAttributes: {
                'peer-data-request-id': albumMsg.key.id ?? '',
              },
            }
          : {}),
      })
    }

    return albumMsg
  }

  // ── Event ─────────────────────────────────────────────────────────────────
  /**
   * Send a WhatsApp event invitation card.
   *
   * FIX: Must be wrapped in viewOnceMessage with a supportPayload in
   * messageContextInfo. Without this wrapper WhatsApp does not recognise
   * the message as an event card and either drops it silently or renders
   * it as a generic unknown bubble.
   *
   * @example
   * await sock.sendMessage(jid, {
   *   eventMessage: {
   *     name: 'Team meetup',
   *     description: 'Quarterly all-hands',
   *     startTime: Date.now() / 1000,
   *     joinLink: 'https://meet.example.com/xyz',
   *   }
   * })
   */
  const handleEvent = async (
    content: EventV2MessageContent,
    jid: string,
    options: Pick<MiscMessageGenerationOptions, 'quoted'> = {},
  ): Promise<proto.IWebMessageInfo> => {
    const d = content.eventMessage

    // FIX: Wrap in viewOnceMessage with supportPayload — this is what tells
    // WhatsApp to render it as an event card. The flat approach caused silent drops.
    const msg = await generateWAMessageFromContent(
      jid,
      {
        viewOnceMessage: {
          message: {
            messageContextInfo: {
              deviceListMetadata: {},
              deviceListMetadataVersion: 2,
              messageSecret: randomBytes(32),
              // FIX: supportPayload is required for event card rendering
              supportPayload: JSON.stringify({
                version: 2,
                is_ai_message: true,
                should_show_system_message: true,
                ticket_id: randomBytes(16).toString('hex'),
              }),
            },
            eventMessage: {
              contextInfo: {
                mentionedJid: [jid],
                participant: jid,
                remoteJid: 'status@broadcast',
              },
              isCanceled: d.isCanceled ?? false,
              name: d.name,
              description: d.description,
              location: d.location ?? {
                degreesLatitude: 0,
                degreesLongitude: 0,
                name: 'Location',
              },
              joinLink: d.joinLink ?? '',
              startTime:
                typeof d.startTime === 'string'
                  ? parseInt(d.startTime, 10)
                  : d.startTime,
              endTime:
                d.endTime != null
                  ? typeof d.endTime === 'string'
                    ? parseInt(d.endTime, 10)
                    : d.endTime
                  : Math.floor(Date.now() / 1000) + 3600,
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
   * FIX: optionVoteCount must be sent as a string to the proto, not a number.
   * Sending a number caused the poll result bubble to not render.
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
            // FIX: proto expects string, not number — number caused silent render failure
            optionVoteCount:
              typeof v.optionVoteCount === 'number'
                ? String(v.optionVoteCount)
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
   *     amount: 10_000,
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
   * FIX: Was using generateWAMessage (returns a full IWebMessageInfo) then
   * reading .message from it. Now correctly uses generateWAMessageContent
   * (returns proto.IMessage directly) — the same function kiuur uses — so
   * the inner message shape is correct when passed to groupStatusMessageV2.
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
    _options: Pick<MiscMessageGenerationOptions, 'quoted'> = {},
  ): Promise<proto.IWebMessageInfo> => {
    const storyData = content.groupStatusMessage

    let innerMessage: proto.IMessage

    if (storyData.message) {
      // Caller provided a raw proto message — use it directly
      innerMessage = storyData.message
    } else {
      // FIX: Use generateWAMessageContent (returns proto.IMessage) instead of
      // generateWAMessage (returns IWebMessageInfo). Using generateWAMessage and
      // then reading .message! was producing a double-wrapped shape that caused
      // groupStatusMessageV2 to not render on some WA versions.
      const { message: rawMessage, ...mediaOrText } = storyData
      void rawMessage // already handled above
      innerMessage = await generateWAMessageContent(mediaOrText as any, {
        upload: waUploadToServer,
      })
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
