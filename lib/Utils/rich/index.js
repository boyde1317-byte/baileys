/**
 * Rich message utilities — barrel re-export.
 *
 * This module replaces the monolithic rich-message-utils.js with a split
 * structure under lib/Utils/rich/. All exports are re-exported here for
 * backward compatibility with consumers that import from the original path.
 *
 * Originally authored by itsliaaa (itsliaaa/Baileys) + OURIN-baileys.
 * Included with attribution.
 */

// Core: tokenizeCode, toUnified, prepareRichResponseMessage, botMetadataSignature,
//   botMetadataCertificate, wrapToBotForwardedMessage
export * from './core.js';

// Context: EXTENDED_LANGUAGE_KEYWORDS, buildRichContextInfo, buildV2ContextInfo,
//   buildV2Content, buildBotForwardedMessage
export * from './context.js';

// V1 generators: generateTableContent, generateListContent, generateCodeBlockContent,
//   generateLatexContent, defaultRenderLatexToPng, generateLatexImageContent,
//   generateLatexInlineImageContent, captureUnifiedResponse,
//   generateUnifiedResponseContent, generateRichMessageContent,
//   generateLinkContent, generateReelContent, generateReelWithStats,
//   generateInlineImageWithTable, generateMapContent,
//   generateInlineVideoWithStats, generateGridImageContent, generateDynamicContent
export * from './v1-generators.js';

// V2 generators: tokenizeCodeV2, toTableMetadataV2, generateTableContentV2,
//   generateCodeBlockContentV2, generateLinkContentV2, generateReelContentV2,
//   generateReelWithStatsV2, generateInlineImageWithTableV2,
//   generateInlineVideoWithStatsV2, generateListContentV2, generateLatexContentV2,
//   generateMapContentV2, generateGridImageContentV2, generateDynamicContentV2,
//   generateLatexImageContentV2, generateLatexInlineImageContentV2
export * from './v2-generators.js';

// Combinations: generateCodeWithTable, generateMapWithTable,
//   generateTextWithInlineImage, generateMultiInlineImages,
//   generateGridImageWithTable, generateDynamicWithTable,
//   generateCodeWithTableV2, generateMapWithTableV2,
//   generateTextWithInlineImageV2, generateMultiInlineImagesV2,
//   generateGridImageWithTableV2, generateDynamicWithTableV2
export * from './combinations.js';
