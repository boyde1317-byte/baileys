/**
 * Rich message multi-type combinations (V1 + V2).
 * Originally authored by OURIN-baileys. Included with attribution.
 */
import { RichSubMessageType, proto, unixTimestampSeconds, NOOP, generateMessageIDV2 } from './common.js';
import { buildRichContextInfo, buildV2ContextInfo, buildV2Content, buildBotForwardedMessage, EXTENDED_LANGUAGE_KEYWORDS } from './context.js';
import { tokenizeCodeV2 } from './v2-generators.js';
import { tokenizeCode } from './core.js';

export const generateCodeWithTable = (params, quoted, options = {}) => {
    const { code, language = 'javascript', tableTitle, tableHeaders, tableRows } = params;
    const { footer, headerText } = options;
    const submessages = [];
    if (headerText) {
        submessages.push({ messageType: RichSubMessageType.TEXT, messageText: headerText });
    }
    submessages.push({
        messageType: RichSubMessageType.CODE,
        codeMetadata: {
            codeLanguage: language,
            codeBlocks: tokenizeCode(code, language),
        },
    });
    const tableMetadataRows = [
        { items: tableHeaders, isHeading: true },
        ...tableRows.map(row => ({ items: row.map(String) })),
    ];
    submessages.push({
        messageType: RichSubMessageType.TABLE,
        tableMetadata: { title: tableTitle, rows: tableMetadataRows },
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

// --- V1: Map + Table (location card + nearby stats) ---

/**
 * Generates a richResponseMessage with a map card followed by a table.
 * Renders natively as: interactive map preview → stats table below it.
 *
 * @param {object}  params
 * @param {object}  params.map     — { centerLatitude, centerLongitude, annotations, ... }
 * @param {string}  params.tableTitle
 * @param {Array}   params.tableHeaders
 * @param {Array}   params.tableRows
 * @param {object}  quoted
 * @param {object}  [options] — { headerText, footer }
 */
export const generateMapWithTable = (params, quoted, options = {}) => {
    const { map, tableTitle, tableHeaders, tableRows } = params;
    const { footer, headerText } = options;
    const submessages = [];
    if (headerText) {
        submessages.push({ messageType: RichSubMessageType.TEXT, messageText: headerText });
    }
    submessages.push({
        messageType: RichSubMessageType.MAP,
        mapMetadata: {
            centerLatitude: map.centerLatitude,
            centerLongitude: map.centerLongitude,
            latitudeDelta: map.latitudeDelta ?? 0.01,
            longitudeDelta: map.longitudeDelta ?? 0.01,
            annotations: (map.annotations || []).map((a, i) => ({
                annotationNumber: a.annotationNumber ?? i + 1,
                latitude: a.latitude,
                longitude: a.longitude,
                title: a.title || '',
                body: a.body || '',
            })),
            showInfoList: map.showInfoList ?? true,
        },
    });
    const tableMetadataRows = [
        { items: tableHeaders, isHeading: true },
        ...tableRows.map(row => ({ items: row.map(String) })),
    ];
    submessages.push({
        messageType: RichSubMessageType.TABLE,
        tableMetadata: { title: tableTitle, rows: tableMetadataRows },
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

// --- V1: Text + Inline Image (text followed by a single image, no table) ---

/**
 * Generates a richResponseMessage with text followed by an inline image.
 * Renders natively as: markdown text bubble → inline image below it.
 *
 * @param {string}  text      — Text content (supports markdown)
 * @param {object}  image     — { imageUrl, imageText, alignment, tapLinkUrl }
 * @param {object}  quoted
 * @param {object}  [options] — { headerText, footer }
 */
export const generateTextWithInlineImage = (text, image, quoted, options = {}) => {
    const { footer, headerText } = options;
    const submessages = [];
    if (headerText) {
        submessages.push({ messageType: RichSubMessageType.TEXT, messageText: headerText });
    }
    submessages.push({ messageType: RichSubMessageType.TEXT, messageText: text });
    const imgUrl = image.imageUrl || image;
    submessages.push({
        messageType: RichSubMessageType.INLINE_IMAGE,
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
    if (footer) {
        submessages.push({ messageType: RichSubMessageType.TEXT, messageText: footer });
    }
    const ctxInfo = buildRichContextInfo(quoted);
    return {
        message: buildBotForwardedMessage(submessages, ctxInfo),
        messageId: generateMessageIDV2(),
    };
};

// --- V1: Multiple inline images (image gallery, not grid) ---

/**
 * Generates a richResponseMessage with multiple inline images in sequence.
 * Renders natively as: each image stacked vertically with optional captions.
 *
 * @param {Array}   images    — [{ imageUrl, imageText, alignment, tapLinkUrl }, ...]
 * @param {object}  quoted
 * @param {object}  [options] — { headerText, footer }
 */
export const generateMultiInlineImages = (images, quoted, options = {}) => {
    const { footer, headerText } = options;
    const submessages = [];
    if (headerText) {
        submessages.push({ messageType: RichSubMessageType.TEXT, messageText: headerText });
    }
    for (const image of images) {
        const imgUrl = image.imageUrl || image;
        submessages.push({
            messageType: RichSubMessageType.INLINE_IMAGE,
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
    }
    if (footer) {
        submessages.push({ messageType: RichSubMessageType.TEXT, messageText: footer });
    }
    const ctxInfo = buildRichContextInfo(quoted);
    return {
        message: buildBotForwardedMessage(submessages, ctxInfo),
        messageId: generateMessageIDV2(),
    };
};

// --- V1: Grid Image + Table (image gallery + stats) ---

/**
 * Generates a richResponseMessage with a grid image gallery followed by a table.
 * Renders natively as: image grid → data table below it.
 *
 * @param {object}  params
 * @param {object}  params.gridImage   — { gridImageUrl, imageUrls, ... }
 * @param {string}  params.tableTitle
 * @param {Array}   params.tableHeaders
 * @param {Array}   params.tableRows
 * @param {object}  quoted
 * @param {object}  [options] — { headerText, footer }
 */
export const generateGridImageWithTable = (params, quoted, options = {}) => {
    const { gridImage, tableTitle, tableHeaders, tableRows } = params;
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
    const tableMetadataRows = [
        { items: tableHeaders, isHeading: true },
        ...tableRows.map(row => ({ items: row.map(String) })),
    ];
    submessages.push({
        messageType: RichSubMessageType.TABLE,
        tableMetadata: { title: tableTitle, rows: tableMetadataRows },
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

// --- V1: Dynamic + Table (animated content + stats) ---

/**
 * Generates a richResponseMessage with a dynamic (animated GIF/image) followed by a table.
 * Renders natively as: animated content → data table below it.
 *
 * @param {object}  params
 * @param {object}  params.dynamic     — { type, url, version, loopCount }
 * @param {string}  params.tableTitle
 * @param {Array}   params.tableHeaders
 * @param {Array}   params.tableRows
 * @param {object}  quoted
 * @param {object}  [options] — { headerText, footer }
 */
export const generateDynamicWithTable = (params, quoted, options = {}) => {
    const { dynamic, tableTitle, tableHeaders, tableRows } = params;
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
    const tableMetadataRows = [
        { items: tableHeaders, isHeading: true },
        ...tableRows.map(row => ({ items: row.map(String) })),
    ];
    submessages.push({
        messageType: RichSubMessageType.TABLE,
        tableMetadata: { title: tableTitle, rows: tableMetadataRows },
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

// ============================================================================
// V2 versions of new submessage combinations (base64-encoded unifiedResponse)
// ============================================================================

// --- V2: Code + Table ---

export const generateCodeWithTableV2 = (params, quoted, options = {}) => {
    const { code, language = 'javascript', tableTitle, tableHeaders, tableRows } = params;
    const { footer, headerText, text } = options;
    const { unified_codeBlock } = tokenizeCodeV2(code, language);
    const sections = [];
    if (headerText || text) {
        sections.push({
            view_model: {
                primitive: { text: headerText || text, __typename: 'GenAIMarkdownTextUXPrimitive' },
                __typename: 'GenAISingleLayoutViewModel',
            },
        });
    }
    sections.push({
        view_model: {
            primitive: { language, code_blocks: unified_codeBlock, __typename: 'GenAICodeUXPrimitive' },
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
                primitive: { text: footer, __typename: 'GenAIMarkdownTextUXPrimitive' },
                __typename: 'GenAISingleLayoutViewModel',
            },
        });
    }
    const ctxInfo = buildV2ContextInfo(quoted);
    return { message: buildV2Content(sections, ctxInfo), messageId: generateMessageIDV2() };
};

// --- V2: Map + Table ---

export const generateMapWithTableV2 = (params, quoted, options = {}) => {
    const { map, tableTitle, tableHeaders, tableRows } = params;
    const { footer, headerText } = options;
    const sections = [];
    if (headerText) {
        sections.push({
            view_model: {
                primitive: { text: headerText, __typename: 'GenAIMarkdownTextUXPrimitive' },
                __typename: 'GenAISingleLayoutViewModel',
            },
        });
    }
    sections.push({
        view_model: {
            primitive: {
                center_latitude: map.centerLatitude,
                center_longitude: map.centerLongitude,
                latitude_delta: map.latitudeDelta ?? 0.01,
                longitude_delta: map.longitudeDelta ?? 0.01,
                annotations: (map.annotations || []).map((a, i) => ({
                    annotation_number: a.annotationNumber ?? i + 1,
                    latitude: a.latitude,
                    longitude: a.longitude,
                    title: a.title || '',
                    body: a.body || '',
                })),
                show_info_list: map.showInfoList ?? true,
                __typename: 'GenAIMapUXPrimitive',
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
                primitive: { text: footer, __typename: 'GenAIMarkdownTextUXPrimitive' },
                __typename: 'GenAISingleLayoutViewModel',
            },
        });
    }
    const ctxInfo = buildV2ContextInfo(quoted);
    return { message: buildV2Content(sections, ctxInfo), messageId: generateMessageIDV2() };
};

// --- V2: Text + Inline Image ---

export const generateTextWithInlineImageV2 = (text, image, quoted, options = {}) => {
    const { footer, headerText } = options;
    const sections = [];
    if (headerText) {
        sections.push({
            view_model: {
                primitive: { text: headerText, __typename: 'GenAIMarkdownTextUXPrimitive' },
                __typename: 'GenAISingleLayoutViewModel',
            },
        });
    }
    sections.push({
        view_model: {
            primitive: { text, __typename: 'GenAIMarkdownTextUXPrimitive' },
            __typename: 'GenAISingleLayoutViewModel',
        },
    });
    const imgUrl = image.imageUrl || image;
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
    if (footer) {
        sections.push({
            view_model: {
                primitive: { text: footer, __typename: 'GenAIMarkdownTextUXPrimitive' },
                __typename: 'GenAISingleLayoutViewModel',
            },
        });
    }
    const ctxInfo = buildV2ContextInfo(quoted);
    return { message: buildV2Content(sections, ctxInfo), messageId: generateMessageIDV2() };
};

// --- V2: Multiple inline images ---

export const generateMultiInlineImagesV2 = (images, quoted, options = {}) => {
    const { footer, headerText } = options;
    const sections = [];
    if (headerText) {
        sections.push({
            view_model: {
                primitive: { text: headerText, __typename: 'GenAIMarkdownTextUXPrimitive' },
                __typename: 'GenAISingleLayoutViewModel',
            },
        });
    }
    for (const image of images) {
        const imgUrl = image.imageUrl || image;
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
    }
    if (footer) {
        sections.push({
            view_model: {
                primitive: { text: footer, __typename: 'GenAIMarkdownTextUXPrimitive' },
                __typename: 'GenAISingleLayoutViewModel',
            },
        });
    }
    const ctxInfo = buildV2ContextInfo(quoted);
    return { message: buildV2Content(sections, ctxInfo), messageId: generateMessageIDV2() };
};

// --- V2: Grid Image + Table ---

export const generateGridImageWithTableV2 = (params, quoted, options = {}) => {
    const { gridImage, tableTitle, tableHeaders, tableRows } = params;
    const { footer, headerText } = options;
    const sections = [];
    if (headerText) {
        sections.push({
            view_model: {
                primitive: { text: headerText, __typename: 'GenAIMarkdownTextUXPrimitive' },
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
                primitive: { text: footer, __typename: 'GenAIMarkdownTextUXPrimitive' },
                __typename: 'GenAISingleLayoutViewModel',
            },
        });
    }
    const ctxInfo = buildV2ContextInfo(quoted);
    return { message: buildV2Content(sections, ctxInfo), messageId: generateMessageIDV2() };
};

// --- V2: Dynamic + Table ---

export const generateDynamicWithTableV2 = (params, quoted, options = {}) => {
    const { dynamic, tableTitle, tableHeaders, tableRows } = params;
    const { footer, headerText } = options;
    const sections = [];
    if (headerText) {
        sections.push({
            view_model: {
                primitive: { text: headerText, __typename: 'GenAIMarkdownTextUXPrimitive' },
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
                primitive: { text: footer, __typename: 'GenAIMarkdownTextUXPrimitive' },
                __typename: 'GenAISingleLayoutViewModel',
            },
        });
    }
    const ctxInfo = buildV2ContextInfo(quoted);
    return { message: buildV2Content(sections, ctxInfo), messageId: generateMessageIDV2() };
};
