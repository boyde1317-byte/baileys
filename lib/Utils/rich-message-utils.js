/**
 * Rich message utilities: tables and code blocks via richResponseMessage / botForwardedMessage.
 * Originally authored by itsliaaa (itsliaaa/Baileys). Included with attribution.
 */
import { getRandomValues, randomBytes, randomUUID } from 'crypto';
import { LEXER_REGEX } from '../Defaults/index.js';
import { LANGUAGE_KEYWORDS } from '../WABinary/constants.js';
import { CodeHighlightType, RichSubMessageType } from '../Types/RichType.js';
import { proto } from '../../WAProto/index.js';
import { unixTimestampSeconds } from './generics.js';
const NOOP = new Set([]);
export const tokenizeCode = (code, language = 'javascript') => {
    const keywords = LANGUAGE_KEYWORDS[language] || NOOP;
    const blocks = [];
    LEXER_REGEX.lastIndex = 0;
    let match;
    while ((match = LEXER_REGEX.exec(code)) !== null) {
        if (match[1]) {
            blocks.push({ highlightType: CodeHighlightType.COMMENT, codeContent: match[1] });
        }
        else if (match[2]) {
            blocks.push({ highlightType: CodeHighlightType.STRING, codeContent: match[2] });
        }
        else if (match[3]) {
            blocks.push({
                highlightType: keywords.has(match[3]) ? CodeHighlightType.KEYWORD : CodeHighlightType.METHOD,
                codeContent: match[3],
            });
        }
        else if (match[4]) {
            blocks.push({
                highlightType: keywords.has(match[4]) ? CodeHighlightType.KEYWORD : CodeHighlightType.DEFAULT,
                codeContent: match[4],
            });
        }
        else if (match[5]) {
            blocks.push({ highlightType: CodeHighlightType.NUMBER, codeContent: match[5] });
        }
        else {
            blocks.push({ highlightType: CodeHighlightType.DEFAULT, codeContent: match[6] });
        }
    }
    return blocks;
};
export const toUnified = (submessages, uuid) => ({
    response_id: uuid || randomUUID(),
    sections: submessages.map((submessage, index) => {
        switch (submessage.messageType) {
            case RichSubMessageType.CODE:
                const codeMetadata = submessage.codeMetadata;
                return {
                    view_model: {
                        primitive: {
                            language: codeMetadata.codeLanguage,
                            code_blocks: codeMetadata.codeBlocks.map((block) => ({ content: block.codeContent, type: CodeHighlightType[block.highlightType] })),
                            __typename: 'GenAICodeUXPrimitive'
                        },
                        __typename: 'GenAISingleLayoutViewModel'
                    }
                };
            case RichSubMessageType.CONTENT_ITEMS:
                return {};
            case RichSubMessageType.INLINE_IMAGE:
                return {};
            case RichSubMessageType.LATEX:
                return {};
            case RichSubMessageType.TABLE:
                const tableMetadata = submessage.tableMetadata;
                return {
                    view_model: {
                        primitive: {
                            title: tableMetadata.title,
                            rows: tableMetadata.rows.map((row) => ({
                                is_header: row.isHeading,
                                cells: row.items,
                                markdown_cells: row.items.map((item) => ({ text: item }))
                            })),
                            __typename: 'GenATableUXPrimitive'
                        },
                        __typename: 'GenAISingleLayoutViewModel'
                    }
                };
            case RichSubMessageType.TEXT:
                return {
                    view_model: {
                        primitive: {
                            text: submessage.messageText,
                            inline_entities: submessage.inlineEntities || [],
                            __typename: 'GenAIMarkdownTextUXPrimitive'
                        },
                        __typename: 'GenAISingleLayoutViewModel'
                    }
                };
        }
        return submessage;
    })
});
export const prepareRichResponseMessage = (content) => {
    const { alignment, code, contentText, disclaimerText, footerText, headerText, imageText, inlineImage, inlineVideo, items, language, latex, links, noHeading, posts, products, suggested, richResponse, table, tapLinkUrl, title } = content;
    let submessages = [];
    if (Array.isArray(richResponse)) {
        submessages = richResponse.map((submessage) => {
            if (submessage.text) {
                return {
                    messageType: RichSubMessageType.TEXT,
                    messageText: submessage.text,
                    inlineEntities: submessage.inlineEntities
                };
            }
            else if (submessage.code) {
                return {
                    messageType: RichSubMessageType.CODE,
                    codeMetadata: {
                        codeLanguage: submessage.language,
                        codeBlocks: submessage.code
                    }
                };
            }
            else if (submessage.items) {
                return {
                    messageType: RichSubMessageType.CONTENT_ITEMS,
                    contentItemsMetadata: {
                        itemsMetadata: submessage.items,
                        contentType: proto.AIRichResponseContentItemsMetadata.ContentType.CAROUSEL
                    }
                };
            }
            else if (submessage.inlineImage) {
                return {
                    messageType: RichSubMessageType.INLINE_IMAGE,
                    imageMetadata: {
                        imageUrl: submessage.inlineImage,
                        imageText: submessage.imageText,
                        alignment: submessage.alignment,
                        tapLinkUrl: submessage.tapLinkUrl
                    }
                };
            }
            else if (submessage.inlineVideo) {
                return {
                    messageType: RichSubMessageType.TEXT,
                    messageText: 'INLINE_VIDEO'
                };
            }
            else if (submessage.latex) {
                return {
                    messageType: RichSubMessageType.LATEX,
                    latexMetadata: {
                        text: submessage.text,
                        expressions: submessage.latex
                    }
                };
            }
            else if (submessage.posts) {
                return {
                    messageType: RichSubMessageType.TEXT,
                    messageText: 'POSTS'
                };
            }
            else if (submessage.products) {
                return {
                    messageType: RichSubMessageType.TEXT,
                    messageText: 'PRODUCTS'
                };
            }
            else if (submessage.suggested) {
                return {
                    messageType: RichSubMessageType.TEXT,
                    messageText: 'SUGGESTED_PROMPT'
                };
            }
            else if (submessage.table) {
                return {
                    messageType: RichSubMessageType.TABLE,
                    tableMetadata: {
                        title: submessage.title || submessage.headerText || '',
                        rows: submessage.table.map((items, index) => ({
                            isHeading: !submessage.noHeading && index == 0,
                            items: Array.isArray(items) ? items : [items]
                        }))
                    }
                };
            }
            return submessage;
        });
    }
    else {
        if (headerText) {
            submessages.push({
                messageType: RichSubMessageType.TEXT,
                messageText: headerText
            });
        }
        if (contentText) {
            submessages.push({
                messageType: RichSubMessageType.TEXT,
                messageText: contentText
            });
        }
        if (code) {
            language ||= 'javascript';
            submessages.push({
                messageType: RichSubMessageType.CODE,
                codeMetadata: {
                    codeLanguage: language,
                    codeBlocks: tokenizeCode(code, language)
                }
            });
        }
        if (items) {
            submessages.push({
                messageType: RichSubMessageType.CONTENT_ITEMS,
                contentItemsMetadata: {
                    itemsMetadata: items,
                    contentType: proto.AIRichResponseContentItemsMetadata.ContentType.CAROUSEL
                }
            });
        }
        if (inlineImage) {
            submessages.push({
                messageType: RichSubMessageType.INLINE_IMAGE,
                imageMetadata: {
                    imageUrl: inlineImage,
                    imageText,
                    alignment,
                    tapLinkUrl
                }
            });
        }
        if (inlineVideo) {
            submessages.push({
                messageType: RichSubMessageType.TEXT,
                messageText: 'INLINE_VIDEO'
            });
        }
        if (latex) {
            submessages.push({
                messageType: RichSubMessageType.LATEX,
                latexMetadata: {
                    text,
                    expressions: latex
                }
            });
        }
        if (links) {
            links.forEach((linkField, index) => {
                const prefix = 'SS_' + index;
                const url = linkField.url || '';
                const sources = linkField.sources?.map((sourceField) => ({
                    source_type: 'THIRD_PARTY',
                    source_display_name: sourceField.displayName || '',
                    source_subtitle: sourceField.subtitle || '',
                    source_url: sourceField.url || url
                }));
                submessages.push({
                    messageType: RichSubMessageType.TEXT,
                    messageText: linkField.text + ` {{${prefix}}}¹{{/${prefix}}} `,
                    inlineEntities: [{
                            key: prefix,
                            metadata: {
                                reference_id: index + 1,
                                reference_url: url,
                                reference_title: linkField.title || 'For Donation via Saweria',
                                reference_display_name: linkField.displayName || 'Donation',
                                sources: sources || [],
                                __typename: 'GenAISearchCitationItem'
                            }
                        }]
                });
            });
        }
        if (posts) {
            submessages.push({
                messageType: RichSubMessageType.TEXT,
                messageText: 'POSTS'
            });
        }
        if (products) {
            submessages.push({
                messageType: RichSubMessageType.TEXT,
                messageText: 'PRODUCTS'
            });
        }
        if (suggested) {
            submessages.push({
                messageType: RichSubMessageType.TEXT,
                messageText: 'SUGGESTED_PROMPT'
            });
        }
        if (table) {
            submessages.push({
                messageType: RichSubMessageType.TABLE,
                tableMetadata: {
                    title: title || headerText || '',
                    rows: table.map((items, index) => ({
                        isHeading: !noHeading && index == 0,
                        items: Array.isArray(items) ? items : [items]
                    }))
                }
            });
        }
        if (footerText) {
            submessages.push({
                messageType: RichSubMessageType.TEXT,
                messageText: footerText
            });
        }
    }
    const uuid = randomUUID();
    const unified = toUnified(submessages, uuid);
    const richResponseMessage = proto.AIRichResponseMessage.create({
        submessages,
        messageType: proto.AIRichResponseMessageType.AI_RICH_RESPONSE_TYPE_STANDARD,
        unifiedResponse: {
            data: Buffer.from(JSON.stringify(unified))
        },
        contextInfo: {
            isForwarded: true,
            forwardingScore: 1,
            forwardedAiBotMessageInfo: { botJid: '867051314767696@bot' },
            forwardOrigin: 4
        }
    });
    const message = wrapToBotForwardedMessage(richResponseMessage);
    const botMetadata = message.messageContextInfo.botMetadata;
    if (disclaimerText) {
        botMetadata.messageDisclaimerText = disclaimerText;
    }
    botMetadata.botResponseId = uuid;
    return message;
};
export const botMetadataSignature = () => {
    const signature = new Uint8Array(64);
    getRandomValues(signature);
    return signature;
};
export const botMetadataCertificate = (length = 685) => {
    const certificate = new Uint8Array(length);
    certificate[0] = 48;
    certificate[1] = 130;
    getRandomValues(certificate.subarray(2));
    return certificate;
};
export const wrapToBotForwardedMessage = (richResponseMessage) => ({
    messageContextInfo: {
        botMetadata: {
            verificationMetadata: {
                proofs: [
                    {
                        certificateChain: [
                            botMetadataCertificate(),
                            botMetadataCertificate(892)
                        ],
                        version: 1,
                        useCase: 1,
                        signature: botMetadataSignature()
                    }
                ]
            }
        }
    },
    botForwardedMessage: {
        message: { richResponseMessage }
    }
});
//# sourceMappingURL=rich-message-utils.js.map

// ============================================================================
// OURIN-baileys rich message generators — ported for NEXORA-MD compatibility
// Originally authored by OURIN-baileys. Included with attribution.
// ============================================================================

import { generateMessageIDV2 } from './generics.js';

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

export const buildRichContextInfo = (quoted) => {
    const ctxInfo = {
        forwardingScore: 1,
        isForwarded: true,
        forwardedAiBotMessageInfo: { botJid: '867051314767696@bot' },
        forwardOrigin: 4,
    };
    if (quoted?.key) {
        ctxInfo.stanzaId = quoted.key.id;
        ctxInfo.participant = quoted.key.participant || quoted.sender || quoted.key.remoteJid;
        ctxInfo.quotedMessage = quoted.message;
    }
    return ctxInfo;
};

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

export const generateTableContent = (title, headers, rows, quoted, options = {}) => {
    const { footer, headerText } = options;
    const tableRows = [
        { items: headers, isHeading: true },
        ...rows.map(row => ({ items: row.map(String) })),
    ];
    const submessages = [];
    if (headerText) {
        submessages.push({ messageType: 2, messageText: headerText });
    }
    submessages.push({
        messageType: 4,
        tableMetadata: { title, rows: tableRows },
    });
    if (footer) {
        submessages.push({ messageType: 2, messageText: footer });
    }
    const ctxInfo = buildRichContextInfo(quoted);
    return {
        message: buildBotForwardedMessage(submessages, ctxInfo),
        messageId: generateMessageIDV2(),
    };
};

export const generateListContent = (title, items, quoted, options = {}) => {
    const { footer, headerText } = options;
    const tableRows = items.map(item => ({
        items: Array.isArray(item) ? item.map(String) : [String(item)],
    }));
    const submessages = [];
    if (headerText) {
        submessages.push({ messageType: 2, messageText: headerText });
    }
    submessages.push({
        messageType: 4,
        tableMetadata: { title, rows: tableRows },
    });
    if (footer) {
        submessages.push({ messageType: 2, messageText: footer });
    }
    const ctxInfo = buildRichContextInfo(quoted);
    return {
        message: buildBotForwardedMessage(submessages, ctxInfo),
        messageId: generateMessageIDV2(),
    };
};

export const generateCodeBlockContent = (code, quoted, options = {}) => {
    const { title, footer, language = 'javascript' } = options;
    const submessages = [];
    if (title) {
        submessages.push({ messageType: 2, messageText: title });
    }
    submessages.push({
        messageType: 5,
        codeMetadata: {
            codeLanguage: language,
            codeBlocks: tokenizeCode(code, language),
        },
    });
    if (footer) {
        submessages.push({ messageType: 2, messageText: footer });
    }
    const ctxInfo = buildRichContextInfo(quoted);
    return {
        message: buildBotForwardedMessage(submessages, ctxInfo),
        messageId: generateMessageIDV2(),
    };
};

export const generateLatexContent = (quoted, options) => {
    const { text, expressions, headerText, footer } = options;
    const submessages = [];
    if (headerText) {
        submessages.push({ messageType: 2, messageText: headerText });
    }
    const latexExpressions = expressions.map(expr => {
        const entry = {
            latexExpression: expr.latexExpression,
            url: expr.url,
            width: expr.width,
            height: expr.height,
        };
        if (expr.fontHeight !== undefined) entry.fontHeight = expr.fontHeight;
        if (expr.imageTopPadding !== undefined) entry.imageTopPadding = expr.imageTopPadding;
        if (expr.imageLeadingPadding !== undefined) entry.imageLeadingPadding = expr.imageLeadingPadding;
        if (expr.imageBottomPadding !== undefined) entry.imageBottomPadding = expr.imageBottomPadding;
        if (expr.imageTrailingPadding !== undefined) entry.imageTrailingPadding = expr.imageTrailingPadding;
        return entry;
    });
    submessages.push({
        messageType: 8,
        latexMetadata: {
            text: text || '',
            expressions: latexExpressions,
        },
    });
    if (footer) {
        submessages.push({ messageType: 2, messageText: footer });
    }
    const ctxInfo = buildRichContextInfo(quoted);
    return {
        message: buildBotForwardedMessage(submessages, ctxInfo),
        messageId: generateMessageIDV2(),
    };
};

export const generateLatexImageContent = async (quoted, options, uploadFn, renderLatexToPng) => {
    const { text, expressions, headerText, footer } = options;
    const submessages = [];
    if (headerText) {
        submessages.push({ messageType: 2, messageText: headerText });
    }
    const latexExpressions = await Promise.all(
        expressions.map(async (expr) => {
            const { buffer, width, height } = await renderLatexToPng(expr.latexExpression);
            const uploadResult = await uploadFn(buffer, 'image');
            const imageUrl = uploadResult.url || uploadResult.directPath;
            return {
                latexExpression: expr.latexExpression,
                url: imageUrl,
                width,
                height,
            };
        })
    );
    submessages.push({
        messageType: 8,
        latexMetadata: {
            text: text || '',
            expressions: latexExpressions,
        },
    });
    if (footer) {
        submessages.push({ messageType: 2, messageText: footer });
    }
    const ctxInfo = buildRichContextInfo(quoted);
    return {
        message: buildBotForwardedMessage(submessages, ctxInfo),
        messageId: generateMessageIDV2(),
    };
};

export const generateLatexInlineImageContent = async (quoted, options, uploadFn, renderLatexToPng) => {
    const { text, expressions, headerText, footer } = options;
    const submessages = [];
    if (headerText) {
        submessages.push({ messageType: 2, messageText: headerText });
    }
    if (text) {
        submessages.push({ messageType: 2, messageText: text });
    }
    for (const expr of expressions) {
        const { buffer, width, height } = await renderLatexToPng(expr.latexExpression);
        const uploadResult = await uploadFn(buffer, 'image');
        const imageUrl = uploadResult.url || uploadResult.directPath;
        submessages.push({
            messageType: 3,
            imageMetadata: {
                imageUrl: {
                    imagePreviewUrl: imageUrl,
                    imageHighResUrl: imageUrl,
                },
                imageText: expr.latexExpression,
                alignment: 2,
            },
        });
    }
    if (footer) {
        submessages.push({ messageType: 2, messageText: footer });
    }
    const ctxInfo = buildRichContextInfo(quoted);
    return {
        message: buildBotForwardedMessage(submessages, ctxInfo),
        messageId: generateMessageIDV2(),
    };
};

// --- Capture & relay unified responses ---

export const captureUnifiedResponse = (msg) => {
    const botFwd = msg?.botForwardedMessage?.message;
    if (!botFwd) return null;
    const rich = botFwd.richResponseMessage;
    if (!rich?.unifiedResponse?.data) return null;
    return {
        unifiedResponse: { data: rich.unifiedResponse.data },
        submessages: rich.submessages || [],
        contextInfo: rich.contextInfo || {},
    };
};

export const generateUnifiedResponseContent = (quoted, captured) => {
    const ctxInfo = buildRichContextInfo(quoted);
    return {
        message: buildBotForwardedMessage(captured.submessages, ctxInfo, captured.unifiedResponse),
        messageId: generateMessageIDV2(),
    };
};

export const generateRichMessageContent = (submessages, quoted) => {
    const ctxInfo = buildRichContextInfo(quoted);
    return {
        message: buildBotForwardedMessage(submessages, ctxInfo),
        messageId: generateMessageIDV2(),
    };
};

// --- V2 Tokenizer (improved) ---

const HIGHLIGHT_TYPE_MAP = {
    0: 'DEFAULT',
    1: 'KEYWORD',
    2: 'METHOD',
    3: 'STRING',
    4: 'NUMBER',
    5: 'COMMENT',
};

export const tokenizeCodeV2 = (code, language = 'javascript') => {
    const keywords = EXTENDED_LANGUAGE_KEYWORDS[language] || EXTENDED_LANGUAGE_KEYWORDS.javascript;
    const tokens = [];
    let i = 0;
    const n = code.length;
    const push = (codeContent, highlightType) => {
        if (!codeContent) return;
        const last = tokens[tokens.length - 1];
        if (last && last.highlightType === highlightType) {
            last.codeContent += codeContent;
        } else {
            tokens.push({ codeContent, highlightType });
        }
    };
    const isWordStart = (c) => /[a-zA-Z_$]/.test(c);
    const isWord = (c) => /[a-zA-Z0-9_$]/.test(c);
    const isNum = (c) => /[0-9]/.test(c);
    while (i < n) {
        const c = code[i];
        if (c === '\n' || c === '\t' || c === ' ' || /\s/.test(c)) {
            let s = i;
            while (i < n && /\s/.test(code[i])) i++;
            push(code.slice(s, i), 0);
            continue;
        }
        if (c === '/' && code[i + 1] === '/') {
            let s = i;
            i += 2;
            while (i < n && code[i] !== '\n') i++;
            push(code.slice(s, i), 5);
            continue;
        }
        if (c === '/' && code[i + 1] === '*') {
            let s = i;
            i += 2;
            while (i < n - 1 && !(code[i] === '*' && code[i + 1] === '/')) i++;
            i += 2;
            push(code.slice(s, i), 5);
            continue;
        }
        if (c === '#' && (language === 'python' || language === 'py' || language === 'bash' || language === 'sh' || language === 'shell' || language === 'lua')) {
            let s = i;
            i++;
            while (i < n && code[i] !== '\n') i++;
            push(code.slice(s, i), 5);
            continue;
        }
        if (c === '"' || c === "'" || c === '`') {
            let s = i;
            const q = c;
            i++;
            while (i < n) {
                if (code[i] === '\\' && i + 1 < n) {
                    i += 2;
                } else if (code[i] === q) {
                    i++;
                    break;
                } else i++;
            }
            push(code.slice(s, i), 3);
            continue;
        }
        if (isNum(c)) {
            let s = i;
            while (i < n && /[0-9.xXa-fA-FeEbBoO_]/.test(code[i])) i++;
            push(code.slice(s, i), 4);
            continue;
        }
        if (isWordStart(c)) {
            let s = i;
            while (i < n && isWord(code[i])) i++;
            const word = code.slice(s, i);
            let type = 0;
            if (keywords.has(word)) {
                type = 1;
            } else {
                let j = i;
                while (j < n && /\s/.test(code[j])) j++;
                if (code[j] === '(') type = 2;
            }
            push(word, type);
            continue;
        }
        push(c, 0);
        i++;
    }
    return {
        codeBlock: tokens,
        unified_codeBlock: tokens.map(t => ({
            content: t.codeContent,
            type: HIGHLIGHT_TYPE_MAP[t.highlightType] || 'DEFAULT',
        })),
    };
};

// --- V2 Table metadata parser ---

export const toTableMetadataV2 = (arr) => {
    if (!Array.isArray(arr) || arr.length === 0) {
        throw new Error('Input must be a non-empty array');
    }
    const [title, headerStr, ...rest] = arr;
    const splitCols = (str) => {
        if (typeof str !== 'string') return [];
        return str.includes('|')
            ? str.split('|').map(s => s.trim())
            : str.split(',').map(s => s.trim());
    };
    const splitRows = (str) => {
        if (typeof str !== 'string') return [];
        return str.split(';;').map(row => splitCols(row));
    };
    const header = splitCols(headerStr);
    const parsedRows = rest.flatMap(splitRows);
    const maxLen = Math.max(header.length, ...parsedRows.map(r => r.length));
    const unified_rows = [
        {
            is_header: true,
            cells: [...header, ...Array(maxLen - header.length).fill('')],
        },
        ...parsedRows.map(cells => ({
            is_header: false,
            cells: [...cells, ...Array(maxLen - cells.length).fill('')],
        })),
    ];
    const rows = unified_rows.map(r => ({
        items: r.cells,
        ...(r.is_header ? { isHeading: true } : {}),
    }));
    return { title, rows, unified_rows };
};

// --- V2 Generators (base64-encoded unifiedResponse) ---

export const generateTableContentV2 = (table, quoted, options = {}) => {
    const { title, footer, headerText, text } = options;
    const { unified_rows } = toTableMetadataV2(table);
    const sections = [];
    if (headerText || title) {
        const headingText = headerText || title;
        sections.push({
            view_model: {
                primitive: {
                    text: headingText,
                    __typename: 'GenAIMarkdownTextUXPrimitive',
                },
                __typename: 'GenAISingleLayoutViewModel',
            },
        });
    }
    if (text) {
        sections.push({
            view_model: {
                primitive: {
                    text,
                    __typename: 'GenAIMarkdownTextUXPrimitive',
                },
                __typename: 'GenAISingleLayoutViewModel',
            },
        });
    }
    sections.push({
        view_model: {
            primitive: {
                rows: unified_rows,
                __typename: 'GenATableUXPrimitive',
            },
            __typename: 'GenAISingleLayoutViewModel',
        },
    });
    if (footer) {
        sections.push({
            view_model: {
                primitive: {
                    text: footer,
                    __typename: 'GenAIMarkdownTextUXPrimitive',
                },
                __typename: 'GenAISingleLayoutViewModel',
            },
        });
    }
    const responseId = randomUUID();
    const unifiedData = { response_id: responseId, sections };
    const base64Data = Buffer.from(JSON.stringify(unifiedData)).toString('base64');
    const ctxInfo = {
        forwardingScore: 2,
        isForwarded: true,
        forwardedAiBotMessageInfo: { botJid: '259786046210223@bot' },
        forwardOrigin: 4,
        botMessageSharingInfo: {
            botEntryPointOrigin: 1,
            forwardScore: 2,
        },
    };
    if (quoted?.key) {
        ctxInfo.stanzaId = quoted.key.id;
        ctxInfo.participant = quoted.key.participant || quoted.sender || quoted.key.remoteJid;
        ctxInfo.quotedMessage = quoted.message;
    }
    const content = {
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
                    messageType: 1,
                    unifiedResponse: { data: base64Data },
                    contextInfo: ctxInfo,
                },
            },
        },
    };
    return {
        message: content,
        messageId: generateMessageIDV2(),
    };
};

export const generateCodeBlockContentV2 = (code, quoted, options = {}) => {
    const { title, footer, language = 'javascript', text } = options;
    const { unified_codeBlock } = tokenizeCodeV2(code, language);
    const sections = [];
    if (text) {
        sections.push({
            view_model: {
                primitive: {
                    text,
                    __typename: 'GenAIMarkdownTextUXPrimitive',
                },
                __typename: 'GenAISingleLayoutViewModel',
            },
        });
    }
    sections.push({
        view_model: {
            primitive: {
                language,
                code_blocks: unified_codeBlock,
                __typename: 'GenAICodeUXPrimitive',
            },
            __typename: 'GenAISingleLayoutViewModel',
        },
    });
    if (footer) {
        sections.push({
            view_model: {
                primitive: {
                    text: footer,
                    __typename: 'GenAIMarkdownTextUXPrimitive',
                },
                __typename: 'GenAISingleLayoutViewModel',
            },
        });
    }
    const responseId = randomUUID();
    const unifiedData = { response_id: responseId, sections };
    const base64Data = Buffer.from(JSON.stringify(unifiedData)).toString('base64');
    const ctxInfo = {
        mentionedJid: [],
        groupMentions: [],
        statusAttributions: [],
        forwardingScore: 2,
        isForwarded: true,
        forwardedAiBotMessageInfo: { botJid: '259786046210223@bot' },
        forwardOrigin: 4,
        botMessageSharingInfo: {
            botEntryPointOrigin: 1,
            forwardScore: 2,
        },
    };
    if (quoted?.key) {
        ctxInfo.stanzaId = quoted.key.id;
        ctxInfo.participant = quoted.key.participant || quoted.sender || quoted.key.remoteJid;
        ctxInfo.quotedMessage = quoted.message;
    }
    const content = {
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
                    messageType: 1,
                    unifiedResponse: { data: base64Data },
                    contextInfo: ctxInfo,
                },
            },
        },
    };
    return {
        message: content,
        messageId: generateMessageIDV2(),
    };
};

// --- V1 Link content with citations & proofs ---

export const generateLinkContent = (text, links, quoted, options = {}) => {
    const {
        footer,
        botJid = '867051314767696@bot',
        forwardingScore = 3,
        citations = [],
        proofs = [],
    } = options;
    const submessages = [];
    const fullText = footer ? `${text}${footer}` : text;
    submessages.push({ messageType: 2, messageText: fullText });
    const sections = [];
    const inlineEntities = links.map((link, i) => {
        const url = typeof link === 'string' ? link : link.url;
        const displayName = typeof link === 'object' && link.displayName
            ? link.displayName
            : citations[i]?.sourceTitle || `Link ${i + 1}`;
        return {
            key: `IE_${i}`,
            metadata: {
                display_name: displayName,
                is_trusted: false,
                url,
                __typename: 'GenAIInlineLinkItem',
            },
        };
    });
    sections.push({
        view_model: {
            primitive: {
                text,
                inline_entities: inlineEntities,
                __typename: 'GenAIMarkdownTextUXPrimitive',
            },
            __typename: 'GenAISingleLayoutViewModel',
        },
    });
    if (footer) {
        sections.push({
            view_model: {
                primitive: {
                    text: footer,
                    __typename: 'GenAIMarkdownTextUXPrimitive',
                },
                __typename: 'GenAISingleLayoutViewModel',
            },
        });
    }
    const responseId = randomUUID();
    const unifiedData = { response_id: responseId, sections };
    const base64Data = Buffer.from(JSON.stringify(unifiedData)).toString('base64');
    const ctxInfo = {
        forwardingScore,
        isForwarded: true,
        forwardedAiBotMessageInfo: { botJid },
        forwardOrigin: 4,
        botMessageSharingInfo: { forwardScore: forwardingScore },
    };
    if (quoted?.key) {
        ctxInfo.stanzaId = quoted.key.id;
        ctxInfo.participant = quoted.key.participant || quoted.sender || quoted.key.remoteJid;
        ctxInfo.quotedMessage = quoted.message;
    }
    const messageContextInfo = { messageSecret: randomBytes(32) };
    if (citations.length > 0 || proofs.length > 0) {
        const botMetadata = {};
        if (citations.length > 0) {
            botMetadata.richResponseSourcesMetadata = {
                sources: citations.map((c, i) => ({
                    provider: 1,
                    thumbnailCdnUrl: '',
                    sourceProviderUrl: typeof links[i] === 'string' ? links[i] : links[i]?.url || '',
                    sourceQuery: c.sourceQuery || '',
                    faviconCdnUrl: c.faviconCdnUrl || '',
                    citationNumber: c.citationNumber ?? i + 1,
                    sourceTitle: c.sourceTitle || '',
                })),
            };
        }
        if (proofs.length > 0) {
            botMetadata.verificationMetadata = {
                proofs: proofs.map(p => ({
                    version: p.version || 1,
                    useCase: p.useCase || 1,
                    signature: p.signature || '',
                    certificateChain: p.certificateChain || [],
                })),
            };
        }
        messageContextInfo.botMetadata = botMetadata;
    }
    const content = {
        messageContextInfo,
        botForwardedMessage: {
            message: {
                richResponseMessage: {
                    messageType: 1,
                    submessages,
                    unifiedResponse: { data: base64Data },
                    contextInfo: ctxInfo,
                },
            },
        },
    };
    return {
        message: content,
        messageId: generateMessageIDV2(),
    };
};

// --- V2 Link content with search citations ---

export const generateLinkContentV2 = (text, links, quoted, options = {}) => {
    const { footer, searchEngine = 'MAME' } = options;
    const submessages = [];
    const fullText = footer ? `${text}${footer}` : text;
    submessages.push({ messageType: 2, messageText: fullText });
    const sections = [];
    const inlineEntities = links.map((link, i) => {
        const url = typeof link === 'string' ? link : link.url;
        const displayName = typeof link === 'object' && link.displayName
            ? link.displayName
            : `Link ${i + 1}`;
        const sourceDisplayName = typeof link === 'object' && link.sourceDisplayName
            ? link.sourceDisplayName
            : `Source ${i + 1}`;
        const sourceSubtitle = typeof link === 'object' && link.sourceSubtitle
            ? link.sourceSubtitle
            : '';
        return {
            key: `IE_${i}`,
            metadata: {
                reference_id: i + 1,
                reference_url: url,
                reference_title: displayName,
                reference_display_name: displayName,
                sources: [{
                    source_type: 'THIRD_PARTY',
                    source_display_name: sourceDisplayName,
                    source_subtitle: sourceSubtitle,
                    source_url: url,
                }],
                __typename: 'GenAISearchCitationItem',
            },
        };
    });
    sections.push({
        view_model: {
            primitive: {
                text,
                inline_entities: inlineEntities,
                __typename: 'GenAIMarkdownTextUXPrimitive',
            },
            __typename: 'GenAISingleLayoutViewModel',
        },
    });
    const searchSources = links.map((link, i) => {
        const url = typeof link === 'string' ? link : link.url;
        const sourceDisplayName = typeof link === 'object' && link.sourceDisplayName
            ? link.sourceDisplayName
            : `Source ${i + 1}`;
        const sourceSubtitle = typeof link === 'object' && link.sourceSubtitle
            ? link.sourceSubtitle
            : '';
        return {
            source_type: 'THIRD_PARTY',
            source_display_name: sourceDisplayName,
            source_subtitle: sourceSubtitle,
            source_url: url,
        };
    });
    sections.push({
        view_model: {
            primitive: {
                sources: searchSources,
                search_engine: searchEngine,
                __typename: 'GenAISearchResultPrimitive',
            },
            __typename: 'GenAISingleLayoutViewModel',
        },
    });
    if (footer) {
        sections.push({
            view_model: {
                primitive: {
                    text: footer,
                    __typename: 'GenAIMarkdownTextUXPrimitive',
                },
                __typename: 'GenAISingleLayoutViewModel',
            },
        });
    }
    const responseId = randomUUID();
    const unifiedData = { response_id: responseId, sections };
    const base64Data = Buffer.from(JSON.stringify(unifiedData)).toString('base64');
    const ctxInfo = {
        isForwarded: true,
        forwardOrigin: 4,
    };
    if (quoted?.key) {
        ctxInfo.participant = quoted.key.participant || quoted.sender || quoted.key.remoteJid;
        ctxInfo.quotedMessage = quoted.message;
    }
    const content = {
        messageContextInfo: {
            threadId: [],
            messageSecret: randomBytes(32),
        },
        botForwardedMessage: {
            message: {
                richResponseMessage: {
                    messageType: 1,
                    submessages,
                    unifiedResponse: { data: base64Data },
                    contextInfo: ctxInfo,
                },
            },
        },
    };
    return {
        message: content,
        messageId: generateMessageIDV2(),
    };
};
