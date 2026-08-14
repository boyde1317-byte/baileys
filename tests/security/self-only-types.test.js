/**
 * Security regression test for CVE-2026-48063 / GHSA-qvv5-jq5g-4cgg
 *
 * Verifies that self-only protocolMessage types (HISTORY_SYNC_NOTIFICATION,
 * APP_STATE_SYNC_KEY_SHARE, LID_MIGRATION_MAPPING_SYNC,
 * PEER_DATA_OPERATION_REQUEST_RESPONSE_MESSAGE) are dropped when they
 * arrive from a non-self origin (fromMe: false).
 *
 * This is the spoofing vector from CVE-2026-48063 — an attacker could
 * craft a protocolMessage payload to trigger fake messages.upsert events,
 * corrupt app state sync, or inject fake history sync data.
 */
import { describe, it, expect, vi } from 'vitest';

// Mock the heavy dependencies of process-message.js.
// All paths are relative to the test file's location.

vi.mock('../../../baileys/WAProto/index.js', () => {
  const Type = {
    HISTORY_SYNC_NOTIFICATION: 10,
    APP_STATE_SYNC_KEY_SHARE: 11,
    LID_MIGRATION_MAPPING_SYNC: 14,
    PEER_DATA_OPERATION_REQUEST_RESPONSE_MESSAGE: 12,
    REVOKE: 0,
    MESSAGE_EDIT: 1,
    EPHEMERAL_SETTING: 2,
    GROUP_MEMBER_LABEL_CHANGE: 13,
  };
  return {
    proto: {
      Message: {
        ProtocolMessage: { Type },
      },
      HistorySync: {
        HistorySyncType: {
          INITIAL_BOOTSTRAP: 0,
          PUSH_NAME: 1,
          RECENT: 2,
          FULL: 3,
          ON_DEMAND: 4,
          NON_BLOCKING_DATA: 5,
          INITIAL_STATUS_V3: 6,
        },
      },
      WebMessageInfo: {
        decode: vi.fn(),
        fromObject: vi.fn((obj) => obj),
      },
    },
  };
});

vi.mock('../../../baileys/lib/WABinary/index.js', () => ({
  jidNormalizedUser: vi.fn((jid) => jid),
  jidDecode: vi.fn(),
  jidEncode: vi.fn(),
  isJidBroadcast: vi.fn(() => false),
  isJidStatusBroadcast: vi.fn(() => false),
  isLidUser: vi.fn(() => false),
  isPnUser: vi.fn(() => false),
  isHostedLidUser: vi.fn(() => false),
  isHostedPnUser: vi.fn(() => false),
  areJidsSameUser: vi.fn(() => false),
}));

vi.mock('../../../baileys/lib/Utils/crypto.js', () => ({
  aesDecryptGCM: vi.fn(),
  hmacSign: vi.fn(),
}));

vi.mock('../../../baileys/lib/Utils/history.js', () => ({
  downloadAndProcessHistorySyncNotification: vi.fn().mockResolvedValue({
    lidPnMappings: [],
    chats: [],
  }),
}));

vi.mock('../../../baileys/lib/Utils/tc-token-utils.js', () => ({
  buildMergedTcTokenIndexWrite: vi.fn(),
  resolveTcTokenJid: vi.fn(),
}));

vi.mock('../../../baileys/lib/Utils/generics.js', () => ({
  getKeyAuthor: vi.fn(),
  toNumber: vi.fn((v) => (typeof v === 'number' ? v : Number(v) || 0)),
}));

vi.mock('../../../baileys/lib/Utils/messages.js', () => ({
  getContentType: vi.fn((msg) => {
    if (!msg) return undefined;
    return Object.keys(msg)[0];
  }),
  normalizeMessageContent: vi.fn((msg) => msg),
}));

vi.mock('../../../baileys/lib/Types/index.js', () => ({
  WAMessageStubType: {
    CALL_MISSED_GROUP_VIDEO: 1,
    CALL_MISSED_GROUP_VOICE: 2,
    CALL_MISSED_VIDEO: 3,
    CALL_MISSED_VOICE: 4,
    GROUP_PARTICIPANT_ADD: 5,
    REVOKE: 6,
  },
}));

import processMessage from '../../../baileys/lib/Utils/process-message.js';

function makeCtx() {
  return {
    shouldProcessHistoryMsg: true,
    placeholderResendCache: { get: vi.fn(), set: vi.fn(), del: vi.fn() },
    ev: { emit: vi.fn() },
    creds: {
      me: { id: 'ownjid@s.whatsapp.net' },
      accountSettings: {},
      processedHistoryMessages: [],
    },
    signalRepository: {
      lidMapping: {
        storeLIDPNMappings: vi.fn().mockResolvedValue(undefined),
        getLIDForPN: vi.fn(),
      },
    },
    keyStore: {
      transaction: vi.fn((fn) => fn()),
      get: vi.fn(),
      set: vi.fn(),
    },
    logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() },
    options: {},
    getMessage: vi.fn(),
  };
}

describe('CVE-2026-48063 / GHSA-qvv5-jq5g-4cgg — Self-only protocolMessage spoofing guard', () => {
  const SELF_ONLY_TYPE_IDS = [
    [10, 'HISTORY_SYNC_NOTIFICATION'],
    [11, 'APP_STATE_SYNC_KEY_SHARE'],
    [14, 'LID_MIGRATION_MAPPING_SYNC'],
    [12, 'PEER_DATA_OPERATION_REQUEST_RESPONSE_MESSAGE'],
  ];

  for (const [typeId, typeName] of SELF_ONLY_TYPE_IDS) {
    it(`drops ${typeName} (type ${typeId}) when fromMe is false`, async () => {
      const ctx = makeCtx();

      const message = {
        key: {
          remoteJid: '201234567890@s.whatsapp.net',
          id: 'spoofed-msg-id',
          fromMe: false,
        },
        message: {
          protocolMessage: {
            type: typeId,
            historySyncNotification: typeId === 10 ? { syncType: 2 } : undefined,
            appStateSyncKeyShare: typeId === 11 ? { keys: [] } : undefined,
            peerDataOperationRequestResponseMessage: typeId === 12 ? {} : undefined,
          },
        },
        messageTimestamp: Date.now(),
      };

      await processMessage(message, ctx);

      // The security guard should have returned early — no events emitted
      expect(ctx.ev.emit).not.toHaveBeenCalled();
    });
  }

  it('does NOT drop REVOKE (type 0) when fromMe is false — cross-user type', async () => {
    const ctx = makeCtx();

    const message = {
      key: {
        remoteJid: '201234567890@s.whatsapp.net',
        id: 'revoke-msg-id',
        fromMe: false,
      },
      message: {
        protocolMessage: {
          type: 0, // REVOKE
          key: { id: 'original-msg-id' },
        },
      },
      messageTimestamp: Date.now(),
    };

    await processMessage(message, ctx);

    // REVOKE should emit messages.update (cross-user type, not dropped)
    expect(ctx.ev.emit).toHaveBeenCalledWith('messages.update', expect.any(Array));
  });

  it('allows HISTORY_SYNC_NOTIFICATION (type 10) when fromMe is true', async () => {
    const ctx = makeCtx();

    const message = {
      key: {
        remoteJid: 'ownjid@s.whatsapp.net',
        id: 'legit-history-msg',
        fromMe: true,
      },
      message: {
        protocolMessage: {
          type: 10, // HISTORY_SYNC_NOTIFICATION
          historySyncNotification: { syncType: 2 },
        },
      },
      messageTimestamp: Date.now(),
    };

    await processMessage(message, ctx);

    // Should NOT be dropped — fromMe is true, so history sync proceeds
    const emitCalls = ctx.ev.emit.mock.calls.map((c) => c[0]);
    expect(emitCalls).toContain('creds.update');
  });
});
