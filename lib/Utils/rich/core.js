/**
 * Rich message core: tokenization, unified response builder, prepareRichResponseMessage.
 * Originally authored by itsliaaa (itsliaaa/Baileys). Included with attribution.
 */
import { LEXER_REGEX, LANGUAGE_KEYWORDS, CodeHighlightType, RichSubMessageType, NOOP, getRandomValues, randomUUID, proto } from './common.js';
import { buildRichContextInfo } from './context.js';

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
                const dynType = typeof dynMeta?.type === 'string'
                    ? dynMeta.type.toUpperCase()
                    : (typeMap[dynMeta?.type ?? 0] || 'UNKNOWN');
                return {
                    view_model: {
                        primitive: {
                            type: dynType,
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
