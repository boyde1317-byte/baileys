/**
 * Rich message context helpers and extended language keywords.
 * Originally authored by OURIN-baileys. Included with attribution.
 */
import { LANGUAGE_KEYWORDS, randomBytes, randomUUID, proto, generateMessageIDV2 } from './common.js';


// ============================================================================
// OURIN-baileys rich message generators — ported for NEXORA-MD compatibility
// Originally authored by OURIN-baileys. Included with attribution.
// ============================================================================


// --- Extended language keyword sets ---

const PYTHON_KEYWORDS = new Set([
    'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await', 'break',
    'class', 'continue', 'def', 'del', 'elif', 'else', 'except', 'finally',
    'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal',
    'not', 'or', 'pass', 'raise', 'return', 'try', 'while', 'with', 'yield',
    'print', 'len', 'range', 'str', 'int', 'float', 'list', 'dict', 'set',
    'tuple', 'bool', 'type', 'isinstance', 'super', 'self', 'cls'
]);

const GO_KEYWORDS = new Set([
    'break', 'case', 'chan', 'const', 'continue', 'default', 'defer', 'else',
    'fallthrough', 'for', 'func', 'go', 'goto', 'if', 'import', 'interface',
    'map', 'package', 'range', 'return', 'select', 'struct', 'switch', 'type',
    'var', 'nil', 'true', 'false', 'iota', 'make', 'new', 'len', 'cap', 'append'
]);

const LUA_KEYWORDS = new Set([
    'and', 'break', 'do', 'else', 'elseif', 'end', 'false', 'for', 'function',
    'goto', 'if', 'in', 'local', 'nil', 'not', 'or', 'repeat', 'return',
    'then', 'true', 'until', 'while', 'self'
]);

const BASH_KEYWORDS = new Set([
    'if', 'then', 'else', 'elif', 'fi', 'for', 'while', 'do', 'done', 'case',
    'esac', 'function', 'in', 'select', 'until', 'echo', 'printf', 'read',
    'export', 'local', 'return', 'exit', 'break', 'continue', 'shift', 'unset',
    'source', 'alias', 'set', 'trap'
]);

export const EXTENDED_LANGUAGE_KEYWORDS = {
    ...LANGUAGE_KEYWORDS,
    python: PYTHON_KEYWORDS,
    py: PYTHON_KEYWORDS,
    go: GO_KEYWORDS,
    lua: LUA_KEYWORDS,
    bash: BASH_KEYWORDS,
    sh: BASH_KEYWORDS,
    shell: BASH_KEYWORDS,
};

// --- Core helpers ---

export const buildRichContextInfo = (quoted, options = {}) => {
    const {
        forwardingScore = 1,
        botJid = '867051314767696@bot',
        botMessageSharingInfo = null,
    } = options;
    const ctxInfo = {
        forwardingScore,
        isForwarded: true,
        forwardedAiBotMessageInfo: { botJid },
        forwardOrigin: 4,
    };
    if (botMessageSharingInfo) {
        ctxInfo.botMessageSharingInfo = botMessageSharingInfo;
    }
    if (quoted?.key) {
        ctxInfo.stanzaId = quoted.key.id;
        ctxInfo.participant = quoted.key.participant || quoted.sender || quoted.key.remoteJid;
        ctxInfo.quotedMessage = quoted.message;
    }
    return ctxInfo;
};

export const buildV2ContextInfo = (quoted, options = {}) => {
    const {
        forwardingScore = 2,
        botJid = '259786046210223@bot',
        botMessageSharingInfo = null,
    } = options;
    const ctxInfo = {
        forwardingScore,
        isForwarded: true,
        forwardedAiBotMessageInfo: { botJid },
        forwardOrigin: 4,
        botMessageSharingInfo: botMessageSharingInfo || {
            botEntryPointOrigin: 1,
            forwardScore: forwardingScore,
        },
    };
    if (quoted?.key) {
        ctxInfo.stanzaId = quoted.key.id;
        ctxInfo.participant = quoted.key.participant || quoted.sender || quoted.key.remoteJid;
        ctxInfo.quotedMessage = quoted.message;
    }
    return ctxInfo;
};

export const buildV2Content = (sections, ctxInfo) => ({
    messageContextInfo: {
        threadId: [],
        deviceListMetadata: {
            senderKeyIndexes: [],
            recipientKeyIndexes: [],
            recipientKeyHash: '',
            recipientTimestamp: Math.floor(Date.now() / 1000),
        },
        deviceListMetadataVersion: 2,
        messageSecret: randomBytes(32),
    },
    botForwardedMessage: {
        message: {
            richResponseMessage: {
                submessages: [],
                messageType: proto.AIRichResponseMessageType.AI_RICH_RESPONSE_TYPE_STANDARD,
                unifiedResponse: { data: Buffer.from(JSON.stringify({ response_id: randomUUID(), sections })) },
                contextInfo: ctxInfo,
            },
        },
    },
});

export const buildBotForwardedMessage = (submessages, contextInfo, unifiedResponse) => {
    const richResponse = {
        messageType: 1,
        submessages,
        contextInfo,
    };
    if (unifiedResponse) {
        richResponse.unifiedResponse = unifiedResponse;
    }
    return {
        botForwardedMessage: {
            message: {
                richResponseMessage: richResponse,
            },
        },
    };
};

// --- V1 Generators (submessage-based) ---

