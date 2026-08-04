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
            case RichSubMessageType.CODE: {
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
            }
            case RichSubMessageType.CONTENT_ITEMS: {
                const itemsMeta = submessage.contentItemsMetadata;
                const contentTypeStr = itemsMeta.contentType === proto.AIRichResponseContentItemsMetadata.ContentType.CAROUSEL
                    ? 'CAROUSEL' : 'DEFAULT';
                return {
                    view_model: {
                        primitive: {
                            items: (itemsMeta.itemsMetadata || []).map((item) => {
                                if (item.reelItem) {
                                    return {
                                        reel_item: {
                                            title: item.reelItem.title || '',
                                            profile_icon_url: item.reelItem.profileIconUrl || '',
                                            thumbnail_url: item.reelItem.thumbnailUrl || '',
                                            video_url: item.reelItem.videoUrl || '',
                                        },
                                    };
                                }
                                return item;
                            }),
                            content_type: contentTypeStr,
                            __typename: 'GenAIContentItemsUXPrimitive'
                        },
                        __typename: 'GenAISingleLayoutViewModel'
                    }
                };
            }
            case RichSubMessageType.INLINE_IMAGE: {
                const imgMeta = submessage.imageMetadata;
                const imageUrl = imgMeta.imageUrl || {};
                return {
                    view_model: {
                        primitive: {
                            image_url: {
                                image_preview_url: imageUrl.imagePreviewUrl || imageUrl.imageHighResUrl || '',
                                image_high_res_url: imageUrl.imageHighResUrl || imageUrl.imagePreviewUrl || '',
                                source_url: imageUrl.sourceUrl || '',
                            },
                            image_text: imgMeta.imageText || '',
                            alignment: imgMeta.alignment ?? 0,
                            tap_link_url: imgMeta.tapLinkUrl || '',
                            __typename: 'GenAIImageUXPrimitive'
                        },
                        __typename: 'GenAISingleLayoutViewModel'
                    }
                };
            }
            case RichSubMessageType.LATEX: {
                const latexMeta = submessage.latexMetadata;
                return {
                    view_model: {
                        primitive: {
                            text: latexMeta.text || '',
                            expressions: (latexMeta.expressions || []).map((expr) => ({
                                latex_expression: expr.latexExpression || '',
                                url: expr.url || '',
                                width: expr.width || 0,
                                height: expr.height || 0,
                                ...(expr.fontHeight !== undefined ? { font_height: expr.fontHeight } : {}),
                                ...(expr.imageTopPadding !== undefined ? { image_top_padding: expr.imageTopPadding } : {}),
                                ...(expr.imageLeadingPadding !== undefined ? { image_leading_padding: expr.imageLeadingPadding } : {}),
                                ...(expr.imageBottomPadding !== undefined ? { image_bottom_padding: expr.imageBottomPadding } : {}),
                                ...(expr.imageTrailingPadding !== undefined ? { image_trailing_padding: expr.imageTrailingPadding } : {}),
                            })),
                            __typename: 'GenAILatexUXPrimitive'
                        },
                        __typename: 'GenAISingleLayoutViewModel'
                    }
                };
            }
            case RichSubMessageType.MAP: {
                const mapMeta = submessage.mapMetadata;
                return {
                    view_model: {
                        primitive: {
                            center_latitude: mapMeta.centerLatitude,
                            center_longitude: mapMeta.centerLongitude,
                            latitude_delta: mapMeta.latitudeDelta ?? 0.01,
                            longitude_delta: mapMeta.longitudeDelta ?? 0.01,
                            annotations: (mapMeta.annotations || []).map((a) => ({
                                annotation_number: a.annotationNumber ?? 0,
                                latitude: a.latitude,
                                longitude: a.longitude,
                                title: a.title || '',
                                body: a.body || '',
                            })),
                            show_info_list: mapMeta.showInfoList ?? true,
                            __typename: 'GenAIMapUXPrimitive'
                        },
                        __typename: 'GenAISingleLayoutViewModel'
                    }
                };
            }
            case RichSubMessageType.TABLE: {
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
            }
            case RichSubMessageType.GRID_IMAGE: {
                const gridMeta = submessage.gridImageMetadata;
                const toImgUrl = (iu) => ({
                    image_preview_url: iu?.imagePreviewUrl || '',
                    image_high_res_url: iu?.imageHighResUrl || '',
                    source_url: iu?.sourceUrl || '',
                });
                return {
                    view_model: {
                        primitive: {
                            grid_image_url: toImgUrl(gridMeta?.gridImageUrl),
                            image_urls: (gridMeta?.imageUrls || []).map(toImgUrl),
                            __typename: 'GenAIGridImageUXPrimitive'
                        },
                        __typename: 'GenAISingleLayoutViewModel'
                    }
                };
            }
            case RichSubMessageType.DYNAMIC: {
                const dynMeta = submessage.dynamicMetadata;
                const typeMap = ['UNKNOWN', 'IMAGE', 'GIF'];
                return {
                    view_model: {
                        primitive: {
                            type: typeMap[dynMeta?.type ?? 0] || 'UNKNOWN',
                            version: dynMeta?.version ?? 1,
                            url: dynMeta?.url || '',
                            loop_count: dynMeta?.loopCount ?? 0,
                            __typename: 'GenAIDynamicUXPrimitive'
                        },
                        __typename: 'GenAISingleLayoutViewModel'
                    }
                };
            }
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
        return null;
    }).filter(Boolean)
});
export const prepareRichResponseMessage = (content) => {
    const { alignment, code, contentText, disclaimerText, dynamic, footerText, gridImage, headerText, imageText, inlineImage, inlineVideo, items, language, latex, links, noHeading, posts, products, suggested, richResponse, table, tapLinkUrl, title } = content;
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
                const imgUrl = submessage.inlineImage;
                return {
                    messageType: RichSubMessageType.INLINE_IMAGE,
                    imageMetadata: {
                        imageUrl: {
                            imagePreviewUrl: typeof imgUrl === 'string' ? imgUrl : (imgUrl.imagePreviewUrl || imgUrl.imageHighResUrl || ''),
                            imageHighResUrl: typeof imgUrl === 'string' ? imgUrl : (imgUrl.imageHighResUrl || imgUrl.imagePreviewUrl || ''),
                            sourceUrl: typeof imgUrl === 'string' ? '' : (imgUrl.sourceUrl || ''),
                        },
                        imageText: submessage.imageText,
                        alignment: submessage.alignment,
                        tapLinkUrl: submessage.tapLinkUrl
                    }
                };
            }
            else if (submessage.inlineVideo) {
                const v = submessage.inlineVideo;
                return {
                    messageType: RichSubMessageType.CONTENT_ITEMS,
                    contentItemsMetadata: {
                        itemsMetadata: [{
                            reelItem: {
                                title:          v.title          || '',
                                profileIconUrl: v.profileIconUrl  || '',
                                thumbnailUrl:   v.thumbnailUrl   || '',
                                videoUrl:       v.videoUrl        || '',
                            }
                        }],
                        contentType: proto.AIRichResponseContentItemsMetadata.ContentType.DEFAULT,
                    }
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
            else if (submessage.gridImage) {
                const gi = submessage.gridImage;
                const normalizeUrl = (u) => typeof u === 'string'
                    ? { imagePreviewUrl: u, imageHighResUrl: u, sourceUrl: '' }
                    : u;
                return {
                    messageType: RichSubMessageType.GRID_IMAGE,
                    gridImageMetadata: {
                        gridImageUrl: normalizeUrl(gi.gridImageUrl || gi.mainImage || gi),
                        imageUrls: (gi.imageUrls || gi.images || []).map(normalizeUrl),
                    }
                };
            }
            else if (submessage.dynamic) {
                const d = submessage.dynamic;
                return {
                    messageType: RichSubMessageType.DYNAMIC,
                    dynamicMetadata: {
                        type: typeof d.type === 'string'
                            ? proto.AIRichResponseDynamicMetadata.AIRichResponseDynamicMetadataType[
                                d.type.toUpperCase() === 'GIF' ? 'AI_RICH_RESPONSE_DYNAMIC_METADATA_TYPE_GIF'
                                : d.type.toUpperCase() === 'IMAGE' ? 'AI_RICH_RESPONSE_DYNAMIC_METADATA_TYPE_IMAGE'
                                : 'AI_RICH_RESPONSE_DYNAMIC_METADATA_TYPE_UNKNOWN'
                            ]
                            : (d.type ?? 0),
                        version: d.version ?? 1,
                        url: d.url || '',
                        loopCount: d.loopCount ?? 0,
                    }
                };
            }
            else if (submessage.posts) {
                return {
                    messageType: RichSubMessageType.CONTENT_ITEMS,
                    contentItemsMetadata: {
                        itemsMetadata: submessage.posts.map((post) => ({
                            reelItem: {
                                title: post.title || post.author || '',
                                profileIconUrl: post.profileIconUrl || post.authorAvatar || '',
                                thumbnailUrl: post.thumbnailUrl || post.imageUrl || '',
                                videoUrl: post.videoUrl || post.url || '',
                            }
                        })),
                        contentType: proto.AIRichResponseContentItemsMetadata.ContentType.CAROUSEL
                    }
                };
            }
            else if (submessage.products) {
                return {
                    messageType: RichSubMessageType.CONTENT_ITEMS,
                    contentItemsMetadata: {
                        itemsMetadata: submessage.products.map((product) => ({
                            reelItem: {
                                title: product.title || product.name || '',
                                profileIconUrl: product.profileIconUrl || '',
                                thumbnailUrl: product.thumbnailUrl || product.imageUrl || '',
                                videoUrl: product.videoUrl || product.url || '',
                            }
                        })),
                        contentType: proto.AIRichResponseContentItemsMetadata.ContentType.CAROUSEL
                    }
                };
            }
            else if (submessage.suggested) {
                return {
                    messageType: RichSubMessageType.TEXT,
                    messageText: Array.isArray(submessage.suggested) 
                        ? submessage.suggested.map(s => typeof s === 'string' ? s : s.text || '').join('\n')
                        : (typeof submessage.suggested === 'string' ? submessage.suggested : submessage.suggested.text || '')
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
            console.warn(`[Baileys] Unknown submessage type in richResponse array, skipping: ${JSON.stringify(Object.keys(submessage))}`);
            return null;
        }).filter(Boolean);
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
            const imgUrl = inlineImage;
            submessages.push({
                messageType: RichSubMessageType.INLINE_IMAGE,
                imageMetadata: {
                    imageUrl: {
                        imagePreviewUrl: typeof imgUrl === 'string' ? imgUrl : (imgUrl.imagePreviewUrl || imgUrl.imageHighResUrl || ''),
                        imageHighResUrl: typeof imgUrl === 'string' ? imgUrl : (imgUrl.imageHighResUrl || imgUrl.imagePreviewUrl || ''),
                        sourceUrl: typeof imgUrl === 'string' ? '' : (imgUrl.sourceUrl || ''),
                    },
                    imageText,
                    alignment,
                    tapLinkUrl
                }
            });
        }
        if (inlineVideo) {
            const v = inlineVideo;
            submessages.push({
                messageType: RichSubMessageType.CONTENT_ITEMS,
                contentItemsMetadata: {
                    itemsMetadata: [{
                        reelItem: {
                            title:          v.title          || '',
                            profileIconUrl: v.profileIconUrl  || '',
                            thumbnailUrl:   v.thumbnailUrl   || '',
                            videoUrl:       v.videoUrl        || '',
                        }
                    }],
                    contentType: proto.AIRichResponseContentItemsMetadata.ContentType.DEFAULT,
                }
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
        if (gridImage) {
            const normalizeUrl = (u) => typeof u === 'string'
                ? { imagePreviewUrl: u, imageHighResUrl: u, sourceUrl: '' }
                : u;
            submessages.push({
                messageType: RichSubMessageType.GRID_IMAGE,
                gridImageMetadata: {
                    gridImageUrl: normalizeUrl(gridImage.gridImageUrl || gridImage.mainImage || gridImage),
                    imageUrls: (gridImage.imageUrls || gridImage.images || []).map(normalizeUrl),
                }
            });
        }
        if (dynamic) {
            submessages.push({
                messageType: RichSubMessageType.DYNAMIC,
                dynamicMetadata: {
                    type: typeof dynamic.type === 'string'
                        ? proto.AIRichResponseDynamicMetadata.AIRichResponseDynamicMetadataType[
                            dynamic.type.toUpperCase() === 'GIF' ? 'AI_RICH_RESPONSE_DYNAMIC_METADATA_TYPE_GIF'
                            : dynamic.type.toUpperCase() === 'IMAGE' ? 'AI_RICH_RESPONSE_DYNAMIC_METADATA_TYPE_IMAGE'
                            : 'AI_RICH_RESPONSE_DYNAMIC_METADATA_TYPE_UNKNOWN'
                        ]
                        : (dynamic.type ?? 0),
                    version: dynamic.version ?? 1,
                    url: dynamic.url || '',
                    loopCount: dynamic.loopCount ?? 0,
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
                messageType: RichSubMessageType.CONTENT_ITEMS,
                contentItemsMetadata: {
                    itemsMetadata: posts.map((post) => ({
                        reelItem: {
                            title: post.title || post.author || '',
                            profileIconUrl: post.profileIconUrl || post.authorAvatar || '',
                            thumbnailUrl: post.thumbnailUrl || post.imageUrl || '',
                            videoUrl: post.videoUrl || post.url || '',
                        }
                    })),
                    contentType: proto.AIRichResponseContentItemsMetadata.ContentType.CAROUSEL
                }
            });
        }
        if (products) {
            submessages.push({
                messageType: RichSubMessageType.CONTENT_ITEMS,
                contentItemsMetadata: {
                    itemsMetadata: products.map((product) => ({
                        reelItem: {
                            title: product.title || product.name || '',
                            profileIconUrl: product.profileIconUrl || '',
                            thumbnailUrl: product.thumbnailUrl || product.imageUrl || '',
                            videoUrl: product.videoUrl || product.url || '',
                        }
                    })),
                    contentType: proto.AIRichResponseContentItemsMetadata.ContentType.CAROUSEL
                }
            });
        }
        if (suggested) {
            submessages.push({
                messageType: RichSubMessageType.TEXT,
                messageText: Array.isArray(suggested)
                    ? suggested.map(s => typeof s === 'string' ? s : s.text || '').join('\n')
                    : (typeof suggested === 'string' ? suggested : suggested.text || '')
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
        contextInfo: buildRichContextInfo(null)
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
    } = options;
    const ctxInfo = {
        forwardingScore,
        isForwarded: true,
        forwardedAiBotMessageInfo: { botJid },
        forwardOrigin: 4,
        botMessageSharingInfo: {
            botEntryPointOrigin: 1,
            forwardingScore,
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
                messageType: 1,
                unifiedResponse: { data: Buffer.from(JSON.stringify({ response_id: randomUUID(), sections })).toString('base64') },
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
        message: buildBotForwardedMessage(submessages, ctxInfo, { data: Buffer.from(JSON.stringify(toUnified(submessages))) }),
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
        message: buildBotForwardedMessage(submessages, ctxInfo, { data: Buffer.from(JSON.stringify(toUnified(submessages))) }),
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
        message: buildBotForwardedMessage(submessages, ctxInfo, { data: Buffer.from(JSON.stringify(toUnified(submessages))) }),
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
        message: buildBotForwardedMessage(submessages, ctxInfo, { data: Buffer.from(JSON.stringify(toUnified(submessages))) }),
        messageId: generateMessageIDV2(),
    };
};

// --- Default LaTeX-to-PNG renderer (lazy-loads mathjax-node) ---

let _mathjaxInstance = null;

/**
 * Default LaTeX-to-PNG renderer using mathjax-node.
 *
 * Lazily loads mathjax-node on first call to avoid forcing the dependency
 * on consumers who don't need LaTeX rendering. Returns a PNG buffer
 * plus dimensions for the expression.
 *
 * @param {string} latex — The LaTeX expression (without $$ delimiters)
 * @param {object} [opts] — { scale=2, fontColor='#ffffff', backgroundColor='transparent' }
 * @returns {Promise<{buffer: Buffer, width: number, height: number}>}
 */
export const defaultRenderLatexToPng = async (latex, opts = {}) => {
    const {
        scale = 2,
        fontColor = '#ffffff',
        backgroundColor = 'transparent',
    } = opts;

    if (!_mathjaxInstance) {
        try {
            _mathjaxInstance = (await import('mathjax-node')).default || (await import('mathjax-node'));
            _mathjaxInstance.start();
        } catch (err) {
            throw new Error(
                'defaultRenderLatexToPng requires mathjax-node. Install it with: npm install mathjax-node\n' +
                'Or pass a custom renderLatexToPng function to generateLatexImageContent.'
            );
        }
    }

    const result = await _mathjaxInstance.typeset({
        math: latex,
        format: 'TeX',
        svg: false,
        png: true,
        scale,
        font_color: fontColor,
        background: backgroundColor,
    });

    if (!result?.png) {
        throw new Error('mathjax-node did not produce a PNG for: ' + latex);
    }

    // mathjax-node returns base64 data URI for png
    const base64 = result.png.replace(/^data:image\/png;base64,/, '');
    const buffer = Buffer.from(base64, 'base64');

    // Dimensions from SVG metadata (mathjax-node fills these even when png=true)
    const width = Math.ceil((result.width || 0) * scale);
    const height = Math.ceil((result.height || 0) * scale);

    return { buffer, width, height };
};

export const generateLatexImageContent = async (quoted, options, uploadFn, renderLatexToPng = defaultRenderLatexToPng) => {
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
        message: buildBotForwardedMessage(submessages, ctxInfo, { data: Buffer.from(JSON.stringify(toUnified(submessages))) }),
        messageId: generateMessageIDV2(),
    };
};

export const generateLatexInlineImageContent = async (quoted, options, uploadFn, renderLatexToPng = defaultRenderLatexToPng) => {
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
        message: buildBotForwardedMessage(submessages, ctxInfo, { data: Buffer.from(JSON.stringify(toUnified(submessages))) }),
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
        message: buildBotForwardedMessage(submessages, ctxInfo, { data: Buffer.from(JSON.stringify(toUnified(submessages))) }),
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
        message: buildBotForwardedMessage(submessages, ctxInfo, { data: Buffer.from(JSON.stringify(toUnified(submessages))) }),
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
    // Build unifiedResponse so all submessage types render correctly
    const unified = toUnified(submessages);
    return {
        message: buildBotForwardedMessage(submessages, ctxInfo, { data: Buffer.from(JSON.stringify(unified)) }),
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
    const unified = toUnified(submessages);
    return {
        message: buildBotForwardedMessage(submessages, ctxInfo, { data: Buffer.from(JSON.stringify(unified)) }),
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
        message: buildBotForwardedMessage(submessages, ctxInfo, { data: Buffer.from(JSON.stringify(toUnified(submessages))) }),
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
        message: buildBotForwardedMessage(submessages, ctxInfo, { data: Buffer.from(JSON.stringify(toUnified(submessages))) }),
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
        message: buildBotForwardedMessage(submessages, ctxInfo, { data: Buffer.from(JSON.stringify(toUnified(submessages))) }),
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
        message: buildBotForwardedMessage(submessages, ctxInfo, { data: Buffer.from(JSON.stringify(toUnified(submessages))) }),
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
