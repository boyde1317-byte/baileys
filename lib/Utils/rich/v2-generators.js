/**
 * V2 rich message generators (section-based).
 * Originally authored by itsliaaa (itsliaaa/Baileys) + OURIN-baileys. Included with attribution.
 */
import { CodeHighlightType, RichSubMessageType, proto, unixTimestampSeconds, NOOP, generateMessageIDV2, randomUUID, randomBytes } from './common.js';
import { buildV2ContextInfo, buildRichContextInfo, buildV2Content, buildBotForwardedMessage, EXTENDED_LANGUAGE_KEYWORDS } from './context.js';

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
    const ctxInfo = buildV2ContextInfo(quoted);
    return {
        message: buildV2Content(sections, ctxInfo),
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
    const ctxInfo = buildV2ContextInfo(quoted);
    return {
        message: buildV2Content(sections, ctxInfo),
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
    const unifiedDataBytes = Buffer.from(JSON.stringify(unifiedData));
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
                    unifiedResponse: { data: unifiedDataBytes },
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
    const unifiedDataBytes = Buffer.from(JSON.stringify(unifiedData));
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
                    messageType: 1,
                    submessages,
                    unifiedResponse: { data: unifiedDataBytes },
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

// --- Reel / Content Items generators (video + thumbnail carousel) ---

/**
 * Generates a contentItems submessage (type 9) containing ReelItem entries.
 * Each ReelItem carries a videoUrl, thumbnailUrl, profileIconUrl, and title —
 * the same structure Meta AI uses for video carousel responses.
 *
 * @param {Array<{title, profileIconUrl, thumbnailUrl, videoUrl}>} reels
 * @param {object} quoted
 * @param {object} [options] — { headerText, footer, contentType }
 *   contentType: 0 = DEFAULT (list), 1 = CAROUSEL (swipeable)
 */
export const generateReelContent = (reels, quoted, options = {}) => {
    const { footer, headerText, contentType } = options;
    const ct = contentType ?? proto.AIRichResponseContentItemsMetadata.ContentType.CAROUSEL;
    const submessages = [];
    if (headerText) {
        submessages.push({ messageType: 2, messageText: headerText });
    }
    submessages.push({
        messageType: 9, // CONTENT_ITEMS
        contentItemsMetadata: {
            itemsMetadata: reels.map(reel => ({
                reelItem: {
                    title:          reel.title          || '',
                    profileIconUrl: reel.profileIconUrl  || '',
                    thumbnailUrl:   reel.thumbnailUrl   || '',
                    videoUrl:       reel.videoUrl        || '',
                },
            })),
            contentType: ct,
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

/**
 * Generates a combined rich response with a reel/video carousel followed by
 * a stats table — the TikTok/Instagram download pattern.
 *
 * @param {object}  params
 * @param {Array}    params.reels   — ReelItem array [{ title, profileIconUrl, thumbnailUrl, videoUrl }]
 * @param {string}   params.tableTitle
 * @param {Array}    params.tableHeaders — ['Views', 'Likes', 'Shares']
 * @param {Array}    params.tableRows    — [['1.2M', '45K', '3.2K'], ...]
 * @param {object}   quoted
 * @param {object}   [options] — { headerText, footer, contentType }
 */
export const generateReelWithStats = (params, quoted, options = {}) => {
    const { reels, tableTitle, tableHeaders, tableRows } = params;
    const { footer, headerText, contentType } = options;
    const ct = contentType ?? proto.AIRichResponseContentItemsMetadata.ContentType.CAROUSEL;
    const submessages = [];
    if (headerText) {
        submessages.push({ messageType: 2, messageText: headerText });
    }
    // Submessage 1: content items (video reels)
    submessages.push({
        messageType: 9,
        contentItemsMetadata: {
            itemsMetadata: reels.map(reel => ({
                reelItem: {
                    title:          reel.title          || '',
                    profileIconUrl: reel.profileIconUrl  || '',
                    thumbnailUrl:   reel.thumbnailUrl   || '',
                    videoUrl:       reel.videoUrl        || '',
                },
            })),
            contentType: ct,
        },
    });
    // Submessage 2: stats table
    const tableMetadataRows = [
        { items: tableHeaders, isHeading: true },
        ...tableRows.map(row => ({ items: row.map(String) })),
    ];
    submessages.push({
        messageType: 4, // TABLE
        tableMetadata: { title: tableTitle, rows: tableMetadataRows },
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

// --- Inline Image + Table (INLINE_IMAGE submessage + TABLE submessage) ---

/**
 * Generates a richResponseMessage with an inline image followed by a stats
 * table — useful for search results, weather cards, etc.
 *
 * Uses messageType 3 (INLINE_IMAGE) for the image and messageType 4 (TABLE)
 * for the table, both as submessages in the same richResponseMessage.
 *
 * @param {object}  params
 * @param {object}  params.image     — { imageUrl, imageText, alignment, tapLinkUrl }
 * @param {string}  params.tableTitle
 * @param {Array}   params.tableHeaders  — ['Field', 'Value']
 * @param {Array}   params.tableRows     — [['Name', 'NEXORA'], ...]
 * @param {object}  quoted
 * @param {object}  [options] — { headerText, footer }
 */
export const generateInlineImageWithTable = (params, quoted, options = {}) => {
    const { image, tableTitle, tableHeaders, tableRows } = params;
    const { footer, headerText } = options;
    const submessages = [];
    if (headerText) {
        submessages.push({ messageType: 2, messageText: headerText });
    }
    // Submessage 1: inline image (type 3)
    const imgUrl = image.imageUrl;
    submessages.push({
        messageType: 3, // INLINE_IMAGE
        imageMetadata: {
            imageUrl: {
                imagePreviewUrl: typeof imgUrl === 'string' ? imgUrl : (imgUrl.imagePreviewUrl || imgUrl.imageHighResUrl || ''),
                imageHighResUrl: typeof imgUrl === 'string' ? imgUrl : (imgUrl.imageHighResUrl || imgUrl.imagePreviewUrl || ''),
                sourceUrl: typeof imgUrl === 'string' ? (image.tapLinkUrl || '') : (imgUrl.sourceUrl || ''),
            },
            imageText: image.imageText || '',
            alignment: image.alignment ?? 0,
            tapLinkUrl: image.tapLinkUrl || '',
        },
    });
    // Submessage 2: stats table
    const tableMetadataRows = [
        { items: tableHeaders, isHeading: true },
        ...tableRows.map(row => ({ items: row.map(String) })),
    ];
    submessages.push({
        messageType: 4, // TABLE
        tableMetadata: { title: tableTitle, rows: tableMetadataRows },
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

// --- Location / Map content (AIRichResponseMapMetadata, messageType 7) ---

/**
 * Generates a richResponseMessage Location Card — a map preview pin(s)
 * rendered natively in WhatsApp (Meta AI's "Location Card" component).
 *
 * @param {object}  params
 * @param {number}  params.centerLatitude
 * @param {number}  params.centerLongitude
 * @param {number}  [params.latitudeDelta=0.01]   — Zoom/viewport span (smaller = more zoomed in)
 * @param {number}  [params.longitudeDelta=0.01]
 * @param {Array}   [params.annotations]  — Pins: [{ latitude, longitude, title, body, annotationNumber }]
 * @param {boolean} [params.showInfoList=true] — Show the list of pins below the map
 * @param {object}  quoted
 * @param {object}  [options] — { headerText, footer }
 */
export const generateMapContent = (params, quoted, options = {}) => {
    const {
        centerLatitude,
        centerLongitude,
        latitudeDelta = 0.01,
        longitudeDelta = 0.01,
        annotations = [],
        showInfoList = true,
    } = params;
    const { footer, headerText } = options;
    const submessages = [];
    if (headerText) {
        submessages.push({ messageType: 2, messageText: headerText });
    }
    submessages.push({
        messageType: 7, // MAP
        mapMetadata: {
            centerLatitude,
            centerLongitude,
            latitudeDelta,
            longitudeDelta,
            annotations: annotations.map((a, i) => ({
                annotationNumber: a.annotationNumber ?? i + 1,
                latitude: a.latitude,
                longitude: a.longitude,
                title: a.title || '',
                body: a.body || '',
            })),
            showInfoList,
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

// --- Inline Video + Table (ContentType.DEFAULT — Meta AI's "inlineVideo + table" layout) ---

/**
 * Generates a richResponseMessage with a single inline video player
 * (not a carousel) followed by a stats table — the exact layout Meta AI
 * shows for video download / analysis results.
 *
 * This is the same proto structure as generateReelWithStats but uses
 * ContentType.DEFAULT (0) instead of CAROUSEL (1), so WhatsApp renders
 * a single embedded video player instead of a swipeable carousel.
 *
 * @param {object}  params
 * @param {object}   params.video         — { title, profileIconUrl, thumbnailUrl, videoUrl }
 * @param {string}   params.tableTitle
 * @param {Array}    params.tableHeaders  — ['Views', 'Likes', 'Shares']
 * @param {Array}    params.tableRows     — [['1.2M', '45K', '3.2K'], ...]
 * @param {object}   quoted
 * @param {object}   [options] — { headerText, footer }
 */
export const generateInlineVideoWithStats = (params, quoted, options = {}) => {
    const { video, tableTitle, tableHeaders, tableRows } = params;
    const { footer, headerText } = options;
    const submessages = [];
    if (headerText) {
        submessages.push({ messageType: 2, messageText: headerText });
    }
    // Submessage 1: single inline video (DEFAULT, not CAROUSEL)
    submessages.push({
        messageType: 9, // CONTENT_ITEMS
        contentItemsMetadata: {
            itemsMetadata: [{
                reelItem: {
                    title:          video.title          || '',
                    profileIconUrl: video.profileIconUrl  || '',
                    thumbnailUrl:   video.thumbnailUrl   || '',
                    videoUrl:       video.videoUrl        || '',
                },
            }],
            contentType: proto.AIRichResponseContentItemsMetadata.ContentType.DEFAULT,
        },
    });
    // Submessage 2: stats table
    const tableMetadataRows = [
        { items: tableHeaders, isHeading: true },
        ...tableRows.map(row => ({ items: row.map(String) })),
    ];
    submessages.push({
        messageType: 4, // TABLE
        tableMetadata: { title: tableTitle, rows: tableMetadataRows },
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

// ============================================================================
// V2 Generators — base64-encoded unifiedResponse (Meta AI format)
// Uses buildV2ContextInfo + buildV2Content for consistency
// ============================================================================

// --- V2: List content (table-based list with no header row) ---

export const generateListContentV2 = (title, items, quoted, options = {}) => {
    const { footer, headerText, text } = options;
    const sections = [];
    if (headerText || title) {
        sections.push({
            view_model: {
                primitive: {
                    text: headerText || title,
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
    const unified_rows = items.map((item) => ({
        is_header: false,
        cells: Array.isArray(item) ? item.map(String) : [String(item)],
    }));
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
    const ctxInfo = buildV2ContextInfo(quoted);
    return {
        message: buildV2Content(sections, ctxInfo),
        messageId: generateMessageIDV2(),
    };
};

// --- V2: LaTeX content ---

export const generateLatexContentV2 = (quoted, options = {}) => {
    const { text = '', expressions = [], footer, headerText } = options;
    const sections = [];
    if (headerText) {
        sections.push({
            view_model: {
                primitive: {
                    text: headerText,
                    __typename: 'GenAIMarkdownTextUXPrimitive',
                },
                __typename: 'GenAISingleLayoutViewModel',
            },
        });
    }
    sections.push({
        view_model: {
            primitive: {
                text,
                expressions: expressions.map(expr => ({
                    latex_expression: expr.latexExpression || expr.latex || '',
                    url: expr.url || '',
                    width: expr.width || 0,
                    height: expr.height || 0,
                })),
                __typename: 'GenAILatexUXPrimitive',
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
    const ctxInfo = buildV2ContextInfo(quoted);
    return {
        message: buildV2Content(sections, ctxInfo),
        messageId: generateMessageIDV2(),
    };
};

// --- V2: Map content ---

export const generateMapContentV2 = (params, quoted, options = {}) => {
    const {
        centerLatitude,
        centerLongitude,
        latitudeDelta = 0.01,
        longitudeDelta = 0.01,
        annotations = [],
        showInfoList = true,
    } = params;
    const { footer, headerText } = options;
    const sections = [];
    if (headerText) {
        sections.push({
            view_model: {
                primitive: {
                    text: headerText,
                    __typename: 'GenAIMarkdownTextUXPrimitive',
                },
                __typename: 'GenAISingleLayoutViewModel',
            },
        });
    }
    sections.push({
        view_model: {
            primitive: {
                center_latitude: centerLatitude,
                center_longitude: centerLongitude,
                latitude_delta: latitudeDelta,
                longitude_delta: longitudeDelta,
                annotations: annotations.map((a, i) => ({
                    annotation_number: a.annotationNumber ?? i + 1,
                    latitude: a.latitude,
                    longitude: a.longitude,
                    title: a.title || '',
                    body: a.body || '',
                })),
                show_info_list: showInfoList,
                __typename: 'GenAIMapUXPrimitive',
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
    const ctxInfo = buildV2ContextInfo(quoted);
    return {
        message: buildV2Content(sections, ctxInfo),
        messageId: generateMessageIDV2(),
    };
};

// --- V2: Reel content (video carousel) ---

export const generateReelContentV2 = (reels, quoted, options = {}) => {
    const { footer, headerText, contentType } = options;
    const contentTypeStr = contentType === 'DEFAULT' || contentType === 0 ? 'DEFAULT' : 'CAROUSEL';
    const sections = [];
    if (headerText) {
        sections.push({
            view_model: {
                primitive: {
                    text: headerText,
                    __typename: 'GenAIMarkdownTextUXPrimitive',
                },
                __typename: 'GenAISingleLayoutViewModel',
            },
        });
    }
    sections.push({
        view_model: {
            primitive: {
                items: reels.map(reel => ({
                    reel_item: {
                        title: reel.title || '',
                        profile_icon_url: reel.profileIconUrl || '',
                        thumbnail_url: reel.thumbnailUrl || '',
                        video_url: reel.videoUrl || '',
                    },
                })),
                content_type: contentTypeStr,
                __typename: 'GenAIContentItemsUXPrimitive',
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
    const ctxInfo = buildV2ContextInfo(quoted);
    return {
        message: buildV2Content(sections, ctxInfo),
        messageId: generateMessageIDV2(),
    };
};

// --- V2: Reel + Stats Table ---

export const generateReelWithStatsV2 = (params, quoted, options = {}) => {
    const { reels, tableTitle, tableHeaders, tableRows } = params;
    const { footer, headerText, contentType } = options;
    const contentTypeStr = contentType === 'DEFAULT' || contentType === 0 ? 'DEFAULT' : 'CAROUSEL';
    const sections = [];
    if (headerText) {
        sections.push({
            view_model: {
                primitive: {
                    text: headerText,
                    __typename: 'GenAIMarkdownTextUXPrimitive',
                },
                __typename: 'GenAISingleLayoutViewModel',
            },
        });
    }
    sections.push({
        view_model: {
            primitive: {
                items: reels.map(reel => ({
                    reel_item: {
                        title: reel.title || '',
                        profile_icon_url: reel.profileIconUrl || '',
                        thumbnail_url: reel.thumbnailUrl || '',
                        video_url: reel.videoUrl || '',
                    },
                })),
                content_type: contentTypeStr,
                __typename: 'GenAIContentItemsUXPrimitive',
            },
            __typename: 'GenAISingleLayoutViewModel',
        },
    });
    sections.push({
        view_model: {
            primitive: {
                rows: [
                    { is_header: true, cells: tableHeaders },
                    ...tableRows.map(row => ({ is_header: false, cells: row.map(String) })),
                ],
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
    const ctxInfo = buildV2ContextInfo(quoted);
    return {
        message: buildV2Content(sections, ctxInfo),
        messageId: generateMessageIDV2(),
    };
};

// --- V2: Inline Image + Table ---

export const generateInlineImageWithTableV2 = (params, quoted, options = {}) => {
    const { image, tableHeaders, tableRows } = params;
    const { footer, headerText } = options;
    const sections = [];
    if (headerText) {
        sections.push({
            view_model: {
                primitive: {
                    text: headerText,
                    __typename: 'GenAIMarkdownTextUXPrimitive',
                },
                __typename: 'GenAISingleLayoutViewModel',
            },
        });
    }
    const imgUrl = image.imageUrl;
    sections.push({
        view_model: {
            primitive: {
                image_url: {
                    image_preview_url: typeof imgUrl === 'string' ? imgUrl : (imgUrl.imagePreviewUrl || imgUrl.imageHighResUrl || ''),
                    image_high_res_url: typeof imgUrl === 'string' ? imgUrl : (imgUrl.imageHighResUrl || imgUrl.imagePreviewUrl || ''),
                    source_url: typeof imgUrl === 'string' ? (image.tapLinkUrl || '') : (imgUrl.sourceUrl || ''),
                },
                image_text: image.imageText || '',
                alignment: image.alignment ?? 0,
                tap_link_url: image.tapLinkUrl || '',
                __typename: 'GenAIImageUXPrimitive',
            },
            __typename: 'GenAISingleLayoutViewModel',
        },
    });
    sections.push({
        view_model: {
            primitive: {
                rows: [
                    { is_header: true, cells: tableHeaders },
                    ...tableRows.map(row => ({ is_header: false, cells: row.map(String) })),
                ],
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
    const ctxInfo = buildV2ContextInfo(quoted);
    return {
        message: buildV2Content(sections, ctxInfo),
        messageId: generateMessageIDV2(),
    };
};

// --- V2: Inline Video + Stats Table ---

export const generateInlineVideoWithStatsV2 = (params, quoted, options = {}) => {
    const { video, tableHeaders, tableRows } = params;
    const { footer, headerText } = options;
    const sections = [];
    if (headerText) {
        sections.push({
            view_model: {
                primitive: {
                    text: headerText,
                    __typename: 'GenAIMarkdownTextUXPrimitive',
                },
                __typename: 'GenAISingleLayoutViewModel',
            },
        });
    }
    sections.push({
        view_model: {
            primitive: {
                items: [{
                    reel_item: {
                        title: video.title || '',
                        profile_icon_url: video.profileIconUrl || '',
                        thumbnail_url: video.thumbnailUrl || '',
                        video_url: video.videoUrl || '',
                    },
                }],
                content_type: 'DEFAULT',
                __typename: 'GenAIContentItemsUXPrimitive',
            },
            __typename: 'GenAISingleLayoutViewModel',
        },
    });
    sections.push({
        view_model: {
            primitive: {
                rows: [
                    { is_header: true, cells: tableHeaders },
                    ...tableRows.map(row => ({ is_header: false, cells: row.map(String) })),
                ],
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
    const ctxInfo = buildV2ContextInfo(quoted);
    return {
        message: buildV2Content(sections, ctxInfo),
        messageId: generateMessageIDV2(),
    };
};

// --- V1: Grid Image content (messageType 1 — GRID_IMAGE) ---

export const generateGridImageContent = (gridImage, quoted, options = {}) => {
    const { footer, headerText } = options;
    const submessages = [];
    if (headerText) {
        submessages.push({ messageType: RichSubMessageType.TEXT, messageText: headerText });
    }
    const normalizeUrl = (u) => typeof u === 'string'
        ? { imagePreviewUrl: u, imageHighResUrl: u, sourceUrl: '' }
        : u;
    submessages.push({
        messageType: RichSubMessageType.GRID_IMAGE,
        gridImageMetadata: {
            gridImageUrl: normalizeUrl(gridImage.gridImageUrl || gridImage.mainImage || gridImage),
            imageUrls: (gridImage.imageUrls || gridImage.images || []).map(normalizeUrl),
        },
    });
    if (footer) {
        submessages.push({ messageType: RichSubMessageType.TEXT, messageText: footer });
    }
    const ctxInfo = buildRichContextInfo(quoted);
    return {
        message: buildBotForwardedMessage(submessages, ctxInfo),
        messageId: generateMessageIDV2(),
    };
};

// --- V1: Dynamic content (messageType 6 — DYNAMIC: animated GIF/image) ---

export const generateDynamicContent = (dynamic, quoted, options = {}) => {
    const { footer, headerText } = options;
    const submessages = [];
    if (headerText) {
        submessages.push({ messageType: RichSubMessageType.TEXT, messageText: headerText });
    }
    const dynType = typeof dynamic.type === 'string'
        ? proto.AIRichResponseDynamicMetadata.AIRichResponseDynamicMetadataType[
            dynamic.type.toUpperCase() === 'GIF' ? 'AI_RICH_RESPONSE_DYNAMIC_METADATA_TYPE_GIF'
            : dynamic.type.toUpperCase() === 'IMAGE' ? 'AI_RICH_RESPONSE_DYNAMIC_METADATA_TYPE_IMAGE'
            : 'AI_RICH_RESPONSE_DYNAMIC_METADATA_TYPE_UNKNOWN'
        ]
        : (dynamic.type ?? 0);
    submessages.push({
        messageType: RichSubMessageType.DYNAMIC,
        dynamicMetadata: {
            type: dynType,
            version: dynamic.version ?? 1,
            url: dynamic.url || '',
            loopCount: dynamic.loopCount ?? 0,
        },
    });
    if (footer) {
        submessages.push({ messageType: RichSubMessageType.TEXT, messageText: footer });
    }
    const ctxInfo = buildRichContextInfo(quoted);
    return {
        message: buildBotForwardedMessage(submessages, ctxInfo),
        messageId: generateMessageIDV2(),
    };
};

// --- V2: Grid Image content ---

export const generateGridImageContentV2 = (gridImage, quoted, options = {}) => {
    const { footer, headerText } = options;
    const sections = [];
    if (headerText) {
        sections.push({
            view_model: {
                primitive: {
                    text: headerText,
                    __typename: 'GenAIMarkdownTextUXPrimitive',
                },
                __typename: 'GenAISingleLayoutViewModel',
            },
        });
    }
    const toImgUrl = (u) => typeof u === 'string'
        ? { image_preview_url: u, image_high_res_url: u, source_url: '' }
        : { image_preview_url: u?.imagePreviewUrl || '', image_high_res_url: u?.imageHighResUrl || '', source_url: u?.sourceUrl || '' };
    sections.push({
        view_model: {
            primitive: {
                grid_image_url: toImgUrl(gridImage.gridImageUrl || gridImage.mainImage || gridImage),
                image_urls: (gridImage.imageUrls || gridImage.images || []).map(toImgUrl),
                __typename: 'GenAIGridImageUXPrimitive',
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
    const ctxInfo = buildV2ContextInfo(quoted);
    return {
        message: buildV2Content(sections, ctxInfo),
        messageId: generateMessageIDV2(),
    };
};

// --- V2: Dynamic content ---

export const generateDynamicContentV2 = (dynamic, quoted, options = {}) => {
    const { footer, headerText } = options;
    const sections = [];
    if (headerText) {
        sections.push({
            view_model: {
                primitive: {
                    text: headerText,
                    __typename: 'GenAIMarkdownTextUXPrimitive',
                },
                __typename: 'GenAISingleLayoutViewModel',
            },
        });
    }
    const typeMap = ['UNKNOWN', 'IMAGE', 'GIF'];
    sections.push({
        view_model: {
            primitive: {
                type: typeof dynamic.type === 'string' ? dynamic.type.toUpperCase() : typeMap[dynamic.type ?? 0],
                version: dynamic.version ?? 1,
                url: dynamic.url || '',
                loop_count: dynamic.loopCount ?? 0,
                __typename: 'GenAIDynamicUXPrimitive',
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
    const ctxInfo = buildV2ContextInfo(quoted);
    return {
        message: buildV2Content(sections, ctxInfo),
        messageId: generateMessageIDV2(),
    };
};

// --- V2: LaTeX image content (base64-encoded unifiedResponse + rendered PNGs) ---

export const generateLatexImageContentV2 = async (quoted, options, uploadFn, renderLatexToPng = defaultRenderLatexToPng) => {
    const { text = '', expressions = [], headerText, footer } = options;
    const sections = [];
    if (headerText) {
        sections.push({
            view_model: {
                primitive: {
                    text: headerText,
                    __typename: 'GenAIMarkdownTextUXPrimitive',
                },
                __typename: 'GenAISingleLayoutViewModel',
            },
        });
    }
    const latexExpressions = await Promise.all(
        expressions.map(async (expr) => {
            const { buffer, width, height } = await renderLatexToPng(expr.latexExpression || expr.latex || '');
            const uploadResult = await uploadFn(buffer, 'image');
            const imageUrl = uploadResult.url || uploadResult.directPath;
            return {
                latex_expression: expr.latexExpression || expr.latex || '',
                url: imageUrl,
                width,
                height,
            };
        })
    );
    sections.push({
        view_model: {
            primitive: {
                text,
                expressions: latexExpressions,
                __typename: 'GenAILatexUXPrimitive',
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
    const ctxInfo = buildV2ContextInfo(quoted);
    return {
        message: buildV2Content(sections, ctxInfo),
        messageId: generateMessageIDV2(),
    };
};

// --- V2: LaTeX inline image content (base64-encoded unifiedResponse + rendered PNGs) ---

export const generateLatexInlineImageContentV2 = async (quoted, options, uploadFn, renderLatexToPng = defaultRenderLatexToPng) => {
    const { text = '', expressions = [], headerText, footer } = options;
    const sections = [];
    if (headerText) {
        sections.push({
            view_model: {
                primitive: {
                    text: headerText,
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
    for (const expr of expressions) {
        const { buffer, width, height } = await renderLatexToPng(expr.latexExpression || expr.latex || '');
        const uploadResult = await uploadFn(buffer, 'image');
        const imageUrl = uploadResult.url || uploadResult.directPath;
        sections.push({
            view_model: {
                primitive: {
                    image_url: {
                        image_preview_url: imageUrl,
                        image_high_res_url: imageUrl,
                        source_url: '',
                    },
                    image_text: expr.latexExpression || expr.latex || '',
                    alignment: 2,
                    __typename: 'GenAIImageUXPrimitive',
                },
                __typename: 'GenAISingleLayoutViewModel',
            },
        });
    }
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
    const ctxInfo = buildV2ContextInfo(quoted);
    return {
        message: buildV2Content(sections, ctxInfo),
        messageId: generateMessageIDV2(),
    };
};

