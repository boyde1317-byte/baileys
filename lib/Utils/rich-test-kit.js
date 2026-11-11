/**
 * @file lib/Utils/rich-test-kit.js
 *
 * Device audit kit: one callable test per rich message type this package can
 * build. Each test sends a real message through the socket you pass in, so a
 * pass here is evidence from a phone, not proof from a unit test.
 *
 *   import { RICH_TESTS, runRichTest } from 'baileys'
 *   await runRichTest(sock, jid, 'vipcard')
 *
 * Wiring an owner command is a few lines: loop RICH_TESTS and call
 * `fn(sock, jid, quoted)` for the id the owner asked for.
 *
 * Ported from the baileys bot harness and genericised for the package:
 * brand strings, channel links and media URLs are placeholders, the HTML
 * tests ship their own inline documents, and the NIXCODE AIRich chain is
 * re-implemented here as AiRich (see ai-rich-builder.js).
 */

import { generateWAMessageContent, generateWAMessageFromContent } from './messages.js';
import {
  // V1 generators (submessage-based)
  generateTableContent,
  generateListContent,
  generateCodeBlockContent,
  generateLatexContent,
  captureUnifiedResponse,
  generateUnifiedResponseContent,
  generateRichMessageContent,
  // V2 generators (base64 unifiedResponse - Meta AI format)
  tokenizeCodeV2,
  toTableMetadataV2,
  generateTableContentV2,
  generateCodeBlockContentV2,
  generateLinkContent,
  generateLinkContentV2,
  generateReelContent,
  generateReelWithStats,
  generateMapContent,
  generateInlineImageWithTable,
  generateInlineVideoWithStats,
  generateListContentV2,
  generateLatexContentV2,
  generateMapContentV2,
  generateReelContentV2,
  generateReelWithStatsV2,
  generateInlineImageWithTableV2,
  generateInlineVideoWithStatsV2,
  generateGridImageContent,
  generateDynamicContent,
  generateGridImageContentV2,
  generateDynamicContentV2,
  defaultRenderLatexToPng,
  generateLatexImageContent,
  generateLatexInlineImageContent,
  generateLatexImageContentV2,
  generateCodeWithTable,
  generateMapWithTable,
  generateTextWithInlineImage,
  generateMultiInlineImages,
  generateGridImageWithTable,
  generateDynamicWithTable,
  generateCodeWithTableV2,
  generateMapWithTableV2,
  generateTextWithInlineImageV2,
  generateMultiInlineImagesV2,
  generateGridImageWithTableV2,
  generateDynamicWithTableV2,
} from './rich-message-utils.js';
import { AiRich as AIRich } from './ai-rich-builder.js';
import { hoistAfterRelay, rehostRichCardMedia } from './rich-media-utils.js';
import {
  buildSecretFlowContent,
  buildUnifiedRichContent,
  extWidget,
  followUpPills,
  hScrollSection,
  markdownText,
  productItemCard,
  sendHtmlCard,
  sendUnifiedRich,
  singleSection,
} from './genai-utils.js';
import {
  a2uiCard as card,
  a2uiColumn as column,
  a2uiDivider as divider,
  a2uiText as text,
  a2uiUrlButton as urlButton,
  bloksWidgetSupport,
  buildA2uiSurface as buildA2uiSpec,
  buildBloksWidget,
  validateA2uiComponents as validateComponents,
} from './a2ui-utils.js';
import { randomUUID } from 'node:crypto';

// ─────────────────────────────────────────────────────────────────────────────
// Relay helper — takes a { message, messageId } from any generator and
// sends it via sock.relayMessage (bypasses sendMessage's content processing
// so the raw botForwardedMessage structure reaches WA servers untouched).
// ─────────────────────────────────────────────────────────────────────────────

// LaTeX primitives don't typeset client-side — the device paints the
// latex_image.url. Pre-render via codecogs (no local deps needed).
const _codecogsUrl = (expr) =>
  'https://latex.codecogs.com/png.image?\\dpi{150}%20' + encodeURIComponent(expr);

async function _relayGenerated(sock, jid, generated, options = {}) {
  // Generators embed quoted context via buildRichContextInfo / buildV2ContextInfo.
  // Do NOT pass quoted here — it would double-set contextInfo at the wrong level
  // and cause WhatsApp to drop native rendering on the message.
  await rehostRichCardMedia(sock, generated.message); // move card images onto WA CDN pre-relay
  const message = await generateWAMessageFromContent(jid, generated.message, {
    userJid: sock.user?.id || '0@s.whatsapp.net',
  });
  await sock.relayMessage(jid, message.message, { messageId: message.key.id });
  // URL-based rich images (inlineImage/gridImage) are client-fetched — many
  // clients never fetch them. Hoist them as real photo uploads right after
  // the card so the image is guaranteed to arrive (fire-and-forget).
  try { hoistAfterRelay(sock, jid, generated.message); } catch (_) { /* never block the relay */ }
  return message;
}

// ─────────────────────────────────────────────────────────────────────────────
// Test definitions — each returns a human-readable label + the relay result.
// All are async because some generators are async (latex image upload).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * V1 Table — submessage-based table with heading row.
 */
export async function testV1Table(sock, jid, quoted) {
  const generated = generateTableContent(
    'baileys Feature Matrix',
    ['Feature', 'Status', 'Notes'],
    [
      ['Interactive Buttons', '✅', 'nativeFlow'],
      ['Carousels',          '✅', 'albumMessage'],
      ['Rich Tables',        '🧪', 'V1 submessage'],
      ['Rich Code',          '🧪', 'V1 submessage'],
      ['LaTeX',              '🧪', 'requires renderer'],
    ],
    quoted,
    { headerText: '🧪 V1 Table Generator Test', footer: 'baileys • baileys Baileys fork' },
  );
  await _relayGenerated(sock, jid, generated, { quoted });
  return 'V1 table ✓';
}

/**
 * V1 List — flat list as a single-column table.
 */
export async function testV1List(sock, jid, quoted) {
  const generated = generateListContent(
    'Command Categories',
    [
      ['General', 'ping, about, menu'],
      ['Utility', 'encode, decode, qr'],
      ['Media',   'sticker, toimg, tourl'],
      ['Economy', 'daily, balance, top'],
      ['Owner',   'eval, restart, testmessage'],
      ['AI',      'ai, gpt, dalle'],
    ],
    quoted,
    { headerText: '🧪 V1 List Generator Test', footer: 'baileys' },
  );
  await _relayGenerated(sock, jid, generated, { quoted });
  return 'V1 list ✓';
}

/**
 * V1 Code block — syntax-highlighted JavaScript.
 */
export async function testV1Code(sock, jid, quoted) {
  const code = [
    "import { baileysBridge } from './src/core/baileysBridge.js';",
    '',
    '// Send an interactive card with quick_reply buttons',
    'await baileysBridge.sendInteractive(sock, jid, {',
    "  body: 'Hello from baileys!',",
    "  footer: 'Powered by the baileys Baileys fork',",
    '  buttons: [',
    "    { name: 'quick_reply', params: { text: 'Ping', id: '.ping' } },",
    "    { name: 'cta_url',     params: { text: 'GitHub', url: 'https://github.com/boyde1317-byte' } },",
    '  ],',
    '});',
  ].join('\n');
  const generated = generateCodeBlockContent(code, quoted, {
    title: '🧪 V1 Code Block Test',
    footer: 'Syntax: JavaScript',
    language: 'javascript',
  });
  await _relayGenerated(sock, jid, generated, { quoted });
  return 'V1 code ✓';
}

/**
 * V1 Code block — Python (exercises extended keyword sets).
 */
export async function testV1Python(sock, jid, quoted) {
  const code = [
    'import asyncio',
    'from nexora import Bot',
    '',
    'async def main():',
    '    bot = Bot(prefix=".")',
    '    await bot.start()',
    '    print("baileys is running!")',
    '',
    'if __name__ == "__main__":',
    '    asyncio.run(main())',
  ].join('\n');
  const generated = generateCodeBlockContent(code, quoted, {
    title: '🧪 V1 Python Code Test',
    footer: 'Syntax: Python — extended keywords',
    language: 'python',
  });
  await _relayGenerated(sock, jid, generated, { quoted });
  return 'V1 python ✓';
}

/**
 * V1 LaTeX — inline expression (no image upload, just the metadata).
 */
export async function testV1Latex(sock, jid, quoted) {
  const generated = generateLatexContent(quoted, {
    text: '🧪 V1 LaTeX Test — quadratic formula:',
    expressions: [
      {
        latexExpression: 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}',
        url: _codecogsUrl('x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}'),
        width: 200,
        height: 60,
      },
    ],
    headerText: 'LaTeX Expression',
    footer: 'baileys • codecogs PNG — FIXED 2026-09-14: GenAILatexItem inline entities, re-verify',
  });
  await _relayGenerated(sock, jid, generated, { quoted });
  return 'V1 latex ✓';
}

/**
 * V1 Rich Message — raw submessages (manual construction).
 */
export async function testV1Raw(sock, jid, quoted) {
  const submessages = [
    { messageType: 2, messageText: '🧪 V1 Raw Submessage Test' },
    { messageType: 2, messageText: 'This message was built from manually-constructed submessages.' },
    {
      messageType: 4,
      tableMetadata: {
        title: 'Submessage Types',
        rows: [
          { items: ['Type', 'ID', 'Description'], isHeading: true },
          { items: ['TEXT', '2', 'Plain text line'] },
          { items: ['TABLE', '4', 'Structured table'] },
          { items: ['CODE', '5', 'Syntax-highlighted code'] },
          { items: ['LATEX', '8', 'LaTeX expression'] },
        ],
      },
    },
    { messageType: 2, messageText: '_baileys_ — testing raw submessage assembly.' },
  ];
  const generated = generateRichMessageContent(submessages, quoted);
  await _relayGenerated(sock, jid, generated, { quoted });
  return 'V1 raw ✓';
}

// ─────────────────────────────────────────────────────────────────────────────
// V2 Generators (base64-encoded unifiedResponse — Meta AI format)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * V2 Table — uses toTableMetadataV2 string parsing + base64 unifiedResponse.
 */
export async function testV2Table(sock, jid, quoted) {
  // Format: [title, "header1|header2|header3", "row1col1,row1col2;;row2col1,row2col2"]
  const table = [
    'baileys V2 Table',
    'Plugin | Category | Status',
    'ping | general | ✅\n;; about | general | ✅\n;; menu | general | ✅\n;; sticker | media | ✅\n;; daily | economy | ✅\n;; eval | owner | 🔒',
  ];
  const generated = generateTableContentV2(table, quoted, {
    headerText: '🧪 V2 Table Generator',
    footer: 'base64 unifiedResponse — Meta AI format',
  });
  await _relayGenerated(sock, jid, generated, { quoted });
  return 'V2 table ✓';
}

/**
 * V2 Code block — base64-encoded code with improved tokenizer.
 */
export async function testV2Code(sock, jid, quoted) {
  const code = [
    '// V2 Code Block — improved tokenizer with Python/Go/Lua/Bash support',
    "const { tokenizeCodeV2 } = require('baileys');",
    '',
    "const { codeBlock, unified_codeBlock } = tokenizeCodeV2(code, 'javascript');",
    'console.log(unified_codeBlock);',
    '// → [{ content: "const", type: "KEYWORD" }, { content: " ", type: "DEFAULT" }, ...]',
  ].join('\n');
  const generated = generateCodeBlockContentV2(code, quoted, {
    title: '🧪 V2 Code Block',
    language: 'javascript',
    footer: 'base64 unifiedResponse — improved tokenizer',
  });
  await _relayGenerated(sock, jid, generated, { quoted });
  return 'V2 code ✓';
}

/**
 * V2 Code block — Go (exercises Go keyword set).
 */
export async function testV2Go(sock, jid, quoted) {
  const code = [
    'package main',
    '',
    'import "fmt"',
    '',
    'func main() {',
    '    fmt.Println("baileys — V2 Go syntax test")',
    '}',
  ].join('\n');
  const generated = generateCodeBlockContentV2(code, quoted, {
    title: '🧪 V2 Go Code',
    language: 'go',
    footer: 'Go keyword highlighting — V2 tokenizer',
  });
  await _relayGenerated(sock, jid, generated, { quoted });
  return 'V2 go ✓';
}

// ─────────────────────────────────────────────────────────────────────────────
// Link content with citations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * V1 Link — inline link entities with citations and proofs.
 */
export async function testV1Link(sock, jid, quoted) {
  const generated = generateLinkContent(
    'baileys uses a custom Baileys fork with rich message support. The fork extends the Baileys reference with OURIN-baileys generators for tables, code blocks, and LaTeX.',
    [
      { url: 'https://github.com/boyde1317-byte/baileys', displayName: 'Baileys Fork' },
      { url: 'https://github.com/boyde1317-byte/baileys', displayName: 'baileys' },
    ],
    quoted,
    {
      footer: 'baileys • link content with citations',
      citations: [
        { sourceTitle: 'GitHub — boyde1317-byte/baileys', sourceQuery: 'baileys fork rich messages', citationNumber: 1 },
        { sourceTitle: 'GitHub — boyde1317-byte/baileys', sourceQuery: 'baileys MD bot', citationNumber: 2 },
      ],
    },
  );
  await _relayGenerated(sock, jid, generated, { quoted });
  return 'V1 link ✓';
}

/**
 * V2 Link — search-engine-style citations with GenAISearchCitationItem.
 */
export async function testV2Link(sock, jid, quoted) {
  const generated = generateLinkContentV2(
    'baileys is a next-gen WhatsApp bot built on a custom Baileys fork. It supports nativeFlow interactive messages, carousels, sticker packs, and rich response messages.',
    [
      {
        url: 'https://github.com/boyde1317-byte/baileys',
        displayName: 'baileys on GitHub',
        sourceDisplayName: 'GitHub',
        sourceSubtitle: 'boyde1317-byte/baileys',
      },
      {
        url: 'https://github.com/boyde1317-byte/baileys',
        displayName: 'Baileys Fork on GitHub',
        sourceDisplayName: 'GitHub',
        sourceSubtitle: 'boyde1317-byte/baileys',
      },
    ],
    quoted,
    {
      footer: 'baileys • V2 search citations',
      searchEngine: 'MAME',
    },
  );
  await _relayGenerated(sock, jid, generated, { quoted });
  return 'V2 link ✓';
}

// ─────────────────────────────────────────────────────────────────────────────
// Tokenizer unit tests (no relay — just validates output)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tokenizer V2 — validate that tokenizeCodeV2 produces correct highlight types.
 */
export async function testTokenizerV2(sock, jid, quoted) {
  const code = 'const x = 42; // comment\nfunction hello(name) { return "world"; }';
  const { codeBlock, unified_codeBlock } = tokenizeCodeV2(code, 'javascript');

  const hasKeyword  = unified_codeBlock.some(t => t.type === 'KEYWORD');
  const hasString   = unified_codeBlock.some(t => t.type === 'STRING');
  const hasNumber   = unified_codeBlock.some(t => t.type === 'NUMBER');
  const hasComment  = unified_codeBlock.some(t => t.type === 'COMMENT');
  const hasMethod   = unified_codeBlock.some(t => t.type === 'METHOD');

  const report = [
    '🧪 *V2 Tokenizer Test*',
    '',
    '*Code:*',
    '```' + code + '```',
    '',
    '*Results:*',
    '• KEYWORD detected: ' + (hasKeyword ? '✅' : '❌'),
    '• STRING detected:  ' + (hasString ? '✅' : '❌'),
    '• NUMBER detected:  ' + (hasNumber ? '✅' : '❌'),
    '• COMMENT detected: ' + (hasComment ? '✅' : '❌'),
    '• METHOD detected:  ' + (hasMethod ? '✅' : '❌'),
    '• Total tokens:     ' + codeBlock.length,
    '• Unified entries:  ' + unified_codeBlock.length,
    '',
    '_All checks ' + (hasKeyword && hasString && hasNumber && hasComment && hasMethod ? 'PASSED ✅' : 'FAILED ❌') + '_',
  ].join('\n');

  await sock.sendMessage(jid, { text: report }, { quoted });
  return 'tokenizer V2 ✓';
}

/**
 * Table metadata V2 — validate string parsing with | and ;; delimiters.
 */
export async function testTableMetadataV2(sock, jid, quoted) {
  const input = [
    'Test Table',
    'A | B | C',
    '1,2,3;;4,5,6;;7,8,9',
  ];
  const result = toTableMetadataV2(input);

  const report = [
    '🧪 *V2 Table Metadata Parser Test*',
    '',
    '*Input:*',
    '```' + JSON.stringify(input, null, 2) + '```',
    '',
    '*Output:*',
    '```' + JSON.stringify(result, null, 2) + '```',
    '',
    '• Title:      ' + result.title,
    '• Row count:  ' + result.rows.length,
    '• Has header: ' + (result.rows[0]?.isHeading ? '✅' : '❌'),
  ].join('\n');

  await sock.sendMessage(jid, { text: report }, { quoted });
  return 'table metadata V2 ✓';
}

// ─────────────────────────────────────────────────────────────────────────────
// Unified response capture & relay
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Capture & relay — builds a V1 message, captures the unified response,
 * and regenerates it. This tests the captureUnifiedResponse and
 * generateUnifiedResponseContent round-trip.
 */
export async function testCaptureRelay(sock, jid, quoted) {
  // Build a V1 table
  const original = generateTableContent(
    'Capture & Relay Test',
    ['Field', 'Value'],
    [
      ['Generator', 'V1 table'],
      ['Method', 'captureUnifiedResponse -> generateUnifiedResponseContent'],
      ['Round-trip', 'should preserve submessages'],
    ],
    quoted,
    { headerText: '🧪 Capture & Relay Round-Trip' },
  );

  // Simulate receiving this message (build a fake msg object)
  const fakeMsg = original.message;

  // Capture
  const captured = captureUnifiedResponse(fakeMsg);
  if (!captured) {
    await sock.sendMessage(jid, {
      text: '🧪 *Capture & Relay Test*\n\n❌ captureUnifiedResponse returned null — no unifiedResponse data found.\n\n_Note: Since fork commit ae26d2e, V1 generators also embed unifiedResponse.data (protobuf-encoded). If this fails, the message may predate that fix._',
    }, { quoted });
    return 'capture relay — no unifiedResponse found';
  }

  // Regenerate
  const regenerated = generateUnifiedResponseContent(quoted, captured);
  await _relayGenerated(sock, jid, regenerated, { quoted });
  return 'capture relay ✓';
}

// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Reel / Content Items generators (video + thumbnail carousel)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reel content — video carousel using contentItemsMetadata + ReelItem proto.
 * Each item has a thumbnail, video URL, profile icon, and title.
 */
export async function testReelContent(sock, jid, quoted) {
  const reels = [
    {
      title:          'baileys Demo Video',
      profileIconUrl: 'https://i.pravatar.cc/150?img=12',
      thumbnailUrl:   'https://picsum.photos/id/237/400/600',
      videoUrl:       'https://www.w3schools.com/html/mov_bbb.mp4',
    },
    {
      title:          'Interactive Menu Showcase',
      profileIconUrl: 'https://i.pravatar.cc/150?img=13',
      thumbnailUrl:   'https://picsum.photos/id/238/400/600',
      videoUrl:       'https://www.w3schools.com/html/mov_bbb.mp4',
    },
  ];
  const generated = generateReelContentV2(reels, quoted, { primitiveStyle: 'nixcode',
    headerText: '🧪 Reel Content Test — Video Carousel',
    footer: 'baileys • contentItemsMetadata (type 9)',
  });
  await _relayGenerated(sock, jid, generated, { quoted });
  return 'reel content ✓';
}

/**
 * Reel + Stats — the TikTok download pattern: video carousel + stats table
 * combined in a single botForwardedMessage.
 */
export async function testReelWithStats(sock, jid, quoted) {
  const params = {
    reels: [
      {
        title:          'TikTok @user/video/123456',
        profileIconUrl: 'https://i.pravatar.cc/150?img=14',
        thumbnailUrl:   'https://picsum.photos/id/239/400/600',
        videoUrl:       'https://www.w3schools.com/html/mov_bbb.mp4',
      },
    ],
    tableTitle: 'Download Stats',
    tableHeaders: ['Metric', 'Value'],
    tableRows: [
      ['Views',     '1,234,567'],
      ['Likes',     '45,678'],
      ['Comments',  '1,234'],
      ['Shares',    '3,210'],
      ['Downloads', '890'],
      ['Duration',  '00:58'],
      ['Quality',   'HD (720p)'],
    ],
  };
  const generated = generateReelWithStatsV2(params, quoted, { primitiveStyle: 'nixcode',
    headerText: '🧪 Reel + Stats Table — TikTok Download Pattern',
    footer: 'baileys • contentItems (type 9) + table (type 4) combined',
  });
  await _relayGenerated(sock, jid, generated, { quoted });
  return 'reel + stats ✓';
}
/**
 * Location Card — AIRichResponseMapMetadata (messageType 7). Renders a
 * map preview with one or more pins, matching Meta AI's "Location Card"
 * component (e.g. "coffee shops near me in Accra").
 */
export async function testMapContent(sock, jid, quoted) {
  const generated = generateMapContent(
    {
      centerLatitude: 5.6037,
      centerLongitude: -0.1870,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
      annotations: [
        { latitude: 5.6050, longitude: -0.1880, title: 'Cafe One', body: 'Independence Ave' },
        { latitude: 5.6020, longitude: -0.1860, title: 'Cafe Two', body: 'Ring Road Central' },
      ],
      showInfoList: true,
    },
    quoted,
    {
      headerText: '🧪 Location Card Test — Coffee shops near Accra',
      footer: 'baileys • FIXED 2026-09-14: OSM tile (ImaginePrimitive) + info text — re-verify on device',
    }
  );
  await _relayGenerated(sock, jid, generated, { quoted });
  return 'map content ✓';
}

/**
 * Inline Video + Table — ContentType.DEFAULT (not CAROUSEL). This is the
 * exact layout Meta AI showed us: a single embedded video player sitting
 * above a stats table, not a swipeable carousel. Uses the same proto
 * contentItemsMetadata but with contentType=0 instead of 1.
 */
export async function testInlineVideoWithStats(sock, jid, quoted) {
  const generated = generateInlineVideoWithStatsV2(
    {
      video: {
        title:          'TikTok @user/video/123456',
        profileIconUrl: 'https://i.pravatar.cc/150?img=14',
        thumbnailUrl:   'https://picsum.photos/id/239/400/600',
        videoUrl:       'https://www.w3schools.com/html/mov_bbb.mp4',
      },
      tableHeaders: ['Metric', 'Value'],
      tableRows: [
        ['Views',     '1,234,567'],
        ['Likes',     '45,678'],
        ['Comments',  '1,234'],
        ['Shares',    '3,210'],
        ['Downloads', '890'],
        ['Duration',  '00:58'],
        ['Quality',   'HD (720p)'],
      ],
    },
    quoted,
    { primitiveStyle: 'nixcode',
      headerText: '\ud83e\uddea Inline Video + Table \u2014 Meta AI layout (V2)',
      footer: 'baileys \u2022 contentItems (V2) + table (V2)',
    }
  );
  await _relayGenerated(sock, jid, generated, { quoted });
  return 'inline video + stats \u2713';
}

/**
 * Inline Image + Table — INLINE_IMAGE (type 3) + TABLE (type 4) submessages.
 * Combines an image preview with a stats table — ideal for search results,
 * weather cards, and download info with thumbnails.
 */
export async function testInlineImageWithTable(sock, jid, quoted) {
  const generated = generateInlineImageWithTableV2(
    {
      image: {
        imageUrl: {
          imagePreviewUrl: 'https://picsum.photos/id/237/400/300',
          imageHighResUrl: 'https://picsum.photos/id/237/800/600',
          sourceUrl: 'https://picsum.photos',
        },
        imageText: 'baileys Test Image',
        alignment: 0,
        tapLinkUrl: 'https://github.com/boyde1317-byte/baileys',
      },
      tableHeaders: [ 'Property', 'Value' ],
      tableRows: [
        [ 'Resolution',   '800x600'  ],
        [ 'Format',       'JPEG'     ],
        [ 'Source',       'picsum.photos' ],
        [ 'License',      'Unsplash'  ],
      ],
    },
    quoted,
    { primitiveStyle: 'nixcode',
      headerText: '🧪 Inline Image + Table — search result card layout',
      footer: 'baileys • inlineImage (type 3) + table (type 4)',
    }
  );
  await _relayGenerated(sock, jid, generated, { quoted });
  return 'inline image + table ✓';
}

// ─────────────────────────────────────────────────────────────────────────────
// V2 Generators — new generators added in fork commit b9f5c84
// ─────────────────────────────────────────────────────────────────────────────

/**
 * V2 List — base64-encoded list with no header row (list vs table distinction).
 */
export async function testV2List(sock, jid, quoted) {
  const generated = generateListContentV2(
    'baileys Plugins',
    [
      ['ping',    'general',  '✅'],
      ['about',   'general',  '✅'],
      ['sticker', 'media',    '✅'],
      ['daily',   'economy',  '✅'],
      ['eval',    'owner',    '🔒'],
      ['ai',      'ai',       '🧪'],
    ],
    quoted,
    { headerText: '🧪 V2 List Generator', footer: 'base64 unifiedResponse — no header row' },
  );
  await _relayGenerated(sock, jid, generated, { quoted });
  return 'V2 list ✓';
}

/**
 * V2 LaTeX — base64-encoded LaTeX expression.
 */
export async function testV2Latex(sock, jid, quoted) {
  const generated = generateLatexContentV2(quoted, {
    text: '🧪 V2 LaTeX Test — Euler identity:',
    expressions: [
      { latexExpression: 'e^{i\\pi} + 1 = 0', url: _codecogsUrl('e^{i\\pi} + 1 = 0'), width: 180, height: 50 },
    ],
    headerText: 'LaTeX V2',
    footer: 'baileys • base64 unifiedResponse • codecogs PNG — FIXED 2026-09-14: GenAILatexItem inline entities, re-verify',
  });
  await _relayGenerated(sock, jid, generated, { quoted });
  return 'V2 latex ✓';
}

/**
 * V2 Map — base64-encoded location card.
 */
export async function testV2Map(sock, jid, quoted) {
  const generated = generateMapContentV2(
    {
      centerLatitude: 5.6037,
      centerLongitude: -0.1870,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
      annotations: [
        { latitude: 5.6050, longitude: -0.1880, title: 'Cafe V2 One', body: 'Independence Ave' },
        { latitude: 5.6020, longitude: -0.1860, title: 'Cafe V2 Two', body: 'Ring Road Central' },
      ],
      showInfoList: true,
    },
    quoted,
    {
      headerText: '🧪 V2 Location Card — Accra',
      footer: 'baileys • FIXED 2026-09-14: OSM tile + info text (base64) — re-verify on device',
    },
  );
  await _relayGenerated(sock, jid, generated, { quoted });
  return 'V2 map ✓';
}

/**
 * V2 Reel — base64-encoded video carousel.
 */
export async function testV2Reel(sock, jid, quoted) {
  const reels = [
    {
      title:          'V2 Reel Demo',
      profileIconUrl: 'https://i.pravatar.cc/150?img=20',
      thumbnailUrl:   'https://picsum.photos/id/240/400/600',
      videoUrl:       'https://www.w3schools.com/html/mov_bbb.mp4',
    },
    {
      title:          'V2 Reel Demo 2',
      profileIconUrl: 'https://i.pravatar.cc/150?img=21',
      thumbnailUrl:   'https://picsum.photos/id/241/400/600',
      videoUrl:       'https://www.w3schools.com/html/mov_bbb.mp4',
    },
  ];
  const generated = generateReelContentV2(reels, quoted, { primitiveStyle: 'nixcode',
    headerText: '🧪 V2 Reel Content — Video Carousel',
    footer: 'baileys • base64 unifiedResponse',
    contentType: 'CAROUSEL',
  });
  await _relayGenerated(sock, jid, generated, { quoted });
  return 'V2 reel ✓';
}

/**
 * V2 Reel + Stats — base64-encoded video carousel + stats table.
 */
export async function testV2ReelWithStats(sock, jid, quoted) {
  const generated = generateReelWithStatsV2(
    {
      reels: [
        {
          title:          'V2 TikTok Download',
          profileIconUrl: 'https://i.pravatar.cc/150?img=22',
          thumbnailUrl:   'https://picsum.photos/id/242/400/600',
          videoUrl:       'https://www.w3schools.com/html/mov_bbb.mp4',
        },
      ],
      tableHeaders: ['Metric', 'Value'],
      tableRows: [
        ['Views',     '2,345,678'],
        ['Likes',     '56,789'],
        ['Comments',  '2,345'],
        ['Shares',    '4,321'],
        ['Duration',  '01:12'],
        ['Quality',   'HD (1080p)'],
      ],
    },
    quoted,
    {
      primitiveStyle: 'nixcode',
      headerText: '🧪 V2 Reel + Stats — TikTok Download',
      footer: 'baileys • base64 unifiedResponse',
    },
  );

  await _relayGenerated(sock, jid, generated, { quoted });
  return 'V2 reel + stats ✓';
}

/**
 * V2 Inline Image + Table — base64-encoded image preview + stats table.
 */
export async function testV2InlineImageWithTable(sock, jid, quoted) {
  const generated = generateInlineImageWithTableV2(
    {
      image: {
        imageUrl: {
          imagePreviewUrl: 'https://picsum.photos/id/237/400/300',
          imageHighResUrl: 'https://picsum.photos/id/237/800/600',
          sourceUrl: 'https://picsum.photos',
        },
        imageText: 'V2 Image Preview',
        alignment: 0,
        tapLinkUrl: 'https://github.com/boyde1317-byte/baileys',
      },
      tableHeaders: ['Property', 'Value'],
      tableRows: [
        ['Resolution', '800x600'],
        ['Format',     'JPEG'],
        ['Source',     'picsum.photos'],
        ['License',    'Unsplash'],
      ],
    },
    quoted,
    {
      primitiveStyle: 'nixcode',
      headerText: '🧪 V2 Inline Image + Table',
      footer: 'baileys • base64 unifiedResponse',
    },
  );

  await _relayGenerated(sock, jid, generated, { quoted });
  return 'V2 inline image + table ✓';
}

/**
 * V2 Inline Video + Stats — base64-encoded single video + stats table.
 */
export async function testV2InlineVideoWithStats(sock, jid, quoted) {
  const generated = generateInlineVideoWithStatsV2(
    {
      video: {
        title:          'V2 Inline Video',
        profileIconUrl: 'https://i.pravatar.cc/150?img=23',
        thumbnailUrl:   'https://picsum.photos/id/243/400/600',
        videoUrl:       'https://www.w3schools.com/html/mov_bbb.mp4',
      },
      tableHeaders: ['Metric', 'Value'],
      tableRows: [
        ['Views',     '3,456,789'],
        ['Likes',     '67,890'],
        ['Comments',  '3,456'],
        ['Shares',    '5,432'],
        ['Duration',  '01:30'],
        ['Quality',   'HD (1080p)'],
      ],
    },
    quoted,
    {
      primitiveStyle: 'nixcode',
      headerText: '🧪 V2 Inline Video + Stats',
      footer: 'baileys • base64 unifiedResponse',
    },
  );

  await _relayGenerated(sock, jid, generated, { quoted });
  return 'V2 inline video + stats ✓';
}

// ─────────────────────────────────────────────────────────────────────────────
// GRID_IMAGE + DYNAMIC generators (fork commit b9f5c84)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * V1 Grid Image — image gallery grid using gridImageMetadata (messageType 1).
 * Shows a main grid image + collection of thumbnails.
 */
export async function testV1GridImage(sock, jid, quoted) {
  const generated = generateGridImageContent(
    {
      gridImageUrl: {
        imagePreviewUrl: 'https://picsum.photos/id/237/400/400',
        imageHighResUrl: 'https://picsum.photos/id/237/800/800',
        sourceUrl: 'https://picsum.photos',
      },
      imageUrls: [
        { imagePreviewUrl: 'https://picsum.photos/id/238/200/200', imageHighResUrl: 'https://picsum.photos/id/238/400/400', sourceUrl: 'https://picsum.photos' },
        { imagePreviewUrl: 'https://picsum.photos/id/239/200/200', imageHighResUrl: 'https://picsum.photos/id/239/400/400', sourceUrl: 'https://picsum.photos' },
        { imagePreviewUrl: 'https://picsum.photos/id/240/200/200', imageHighResUrl: 'https://picsum.photos/id/240/400/400', sourceUrl: 'https://picsum.photos' },
        { imagePreviewUrl: 'https://picsum.photos/id/241/200/200', imageHighResUrl: 'https://picsum.photos/id/241/400/400', sourceUrl: 'https://picsum.photos' },
      ],
    },
    quoted,
    {
      primitiveStyle: 'nixcode',
      headerText: '🧪 V1 Grid Image — Photo Gallery',
      footer: 'baileys • gridImageMetadata (type 1)',
    },
  );

  await _relayGenerated(sock, jid, generated, { quoted });
  return 'V1 grid image ✓';
}

/**
 * V1 Dynamic — animated GIF/image using dynamicMetadata (messageType 6).
 */
export async function testV1Dynamic(sock, jid, quoted) {
  const generated = generateDynamicContent(
    { type: 'gif', url: 'https://media.giphy.com/media/3oEjI6SIIHBdIwqEoI/giphy.gif', loopCount: 3, version: 1 },
    quoted,
    {
      primitiveStyle: 'nixcode',
      headerText: '🧪 V1 Dynamic — Animated GIF',
      footer: 'baileys • dynamicMetadata (type 6, GIF)',
    },
  );

  await _relayGenerated(sock, jid, generated, { quoted });
  return 'V1 dynamic ✓';
}

/**
 * V2 Grid Image — base64-encoded image gallery grid.
 */
export async function testV2GridImage(sock, jid, quoted) {
  const generated = generateGridImageContentV2(
    {
      gridImageUrl: {
        imagePreviewUrl: 'https://picsum.photos/id/237/400/400',
        imageHighResUrl: 'https://picsum.photos/id/237/800/800',
        sourceUrl: 'https://picsum.photos',
      },
      imageUrls: [
        { imagePreviewUrl: 'https://picsum.photos/id/238/200/200', imageHighResUrl: 'https://picsum.photos/id/238/400/400', sourceUrl: 'https://picsum.photos' },
        { imagePreviewUrl: 'https://picsum.photos/id/239/200/200', imageHighResUrl: 'https://picsum.photos/id/239/400/400', sourceUrl: 'https://picsum.photos' },
      ],
    },
    quoted,
    {
      primitiveStyle: 'nixcode',
      headerText: '🧪 V2 Grid Image — Photo Gallery',
      footer: 'baileys • base64 unifiedResponse',
    },
  );

  await _relayGenerated(sock, jid, generated, { quoted });
  return 'V2 grid image ✓';
}

/**
 * V2 Dynamic — base64-encoded animated content.
 */
export async function testV2Dynamic(sock, jid, quoted) {
  const generated = generateDynamicContentV2(
    { type: 'image', url: 'https://picsum.photos/id/300/400/300', loopCount: 0, version: 1 },
    quoted,
    {
      primitiveStyle: 'nixcode',
      headerText: '🧪 V2 Dynamic — Animated Image',
      footer: 'baileys • base64 unifiedResponse',
    },
  );

  await _relayGenerated(sock, jid, generated, { quoted });
  return 'V2 dynamic ✓';
}

// ─────────────────────────────────────────────────────────────────────────────
// LaTeX Image Rendering (Item G — mathjax-node default renderer)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * V1 LaTeX Image — renders LaTeX to PNG via defaultRenderLatexToPng, uploads,
 * and sends. Requires mathjax-node to be installed in the bot's node_modules.
 */
export async function testV1LatexImage(sock, jid, quoted) {
  // Use sock.waUploadToServer as the upload function if available
  const uploadFn = sock.waUploadToServer || sock.uploadToServer;
  if (!uploadFn) {
    await sock.sendMessage(jid, { text: '🧪 *V1 LaTeX Image Test*\n\n❌ No upload function available (sock.waUploadToServer missing).' }, { quoted });
    return 'V1 latex image — no upload fn';
  }
  try {
    const generated = await generateLatexImageContent(quoted, {
      text: '🧪 V1 LaTeX Image Test — rendered to PNG:',
      expressions: [
        { latexExpression: '\\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6}' },
        { latexExpression: 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}' },
      ],
      headerText: 'LaTeX Image Rendering',
      footer: 'baileys • mathjax-node default renderer',
    }, uploadFn);
    await _relayGenerated(sock, jid, generated, { quoted });
    return 'V1 latex image ✓';
  } catch (err) {
    // mathjax-node not installed — fall back to the codecogs pre-rendered URL
    const expr = '\\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6}';
    const generated = generateLatexContent(quoted, {
      text: '🧪 V1 LaTeX Image Test — codecogs fallback (mathjax-node unavailable):',
      expressions: [
        { latexExpression: expr, url: _codecogsUrl(expr), width: 300, height: 50 },
      ],
      headerText: 'LaTeX Image (fallback)',
      footer: 'baileys • codecogs PNG — FIXED 2026-09-14: GenAILatexItem inline entities, re-verify',
    });
    await _relayGenerated(sock, jid, generated, { quoted });
    return 'V1 latex image — codecogs fallback (mathjax-node: ' + err.message + ')';
  }
}

/**
 * V2 LaTeX Image — base64-encoded unifiedResponse with rendered PNG LaTeX.
 */
export async function testV2LatexImage(sock, jid, quoted) {
  const uploadFn = sock.waUploadToServer || sock.uploadToServer;
  if (!uploadFn) {
    await sock.sendMessage(jid, { text: '🧪 *V2 LaTeX Image Test*\n\n❌ No upload function available.' }, { quoted });
    return 'V2 latex image — no upload fn';
  }
  try {
    const generated = await generateLatexImageContentV2(quoted, {
      text: '🧪 V2 LaTeX Image Test — Euler identity:',
      expressions: [
        { latexExpression: 'e^{i\\pi} + 1 = 0' },
      ],
      headerText: 'LaTeX V2 Image',
      footer: 'baileys • base64 + mathjax-node',
    }, uploadFn);
    await _relayGenerated(sock, jid, generated, { quoted });
    return 'V2 latex image ✓';
  } catch (err) {
    // mathjax-node not installed — fall back to the codecogs pre-rendered URL
    const expr = 'e^{i\\pi} + 1 = 0';
    const generated = generateLatexContentV2(quoted, {
      text: '🧪 V2 LaTeX Image Test — codecogs fallback (mathjax-node unavailable):',
      expressions: [
        { latexExpression: expr, url: _codecogsUrl(expr), width: 180, height: 50 },
      ],
      headerText: 'LaTeX V2 Image (fallback)',
      footer: 'baileys • base64 unifiedResponse • codecogs PNG — FIXED 2026-09-14: GenAILatexItem inline entities, re-verify',
    });
    await _relayGenerated(sock, jid, generated, { quoted });
    return 'V2 latex image — codecogs fallback (mathjax-node: ' + err.message + ')';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// NEW: Combination generators (v0.3.18-r3 — code+table, map+table, etc.)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * V1 Code + Table — code block followed by a results table.
 */
export async function testV1CodeWithTable(sock, jid, quoted) {
  const generated = generateCodeWithTable({
    code: [
      'const results = await db.query("SELECT * FROM plugins");',
      'console.log(results.length + " plugins loaded");',
    ].join('\n'),
    language: 'javascript',
    tableTitle: 'Query Results',
    tableHeaders: ['Plugin', 'Category', 'Status'],
    tableRows: [
      ['ping', 'general', '✅'],
      ['sticker', 'media', '✅'],
      ['daily', 'economy', '✅'],
    ],
  }, quoted, {
    headerText: '🧪 V1 Code+Table Combo',
    footer: 'baileys • new combination generator',
  });
  await _relayGenerated(sock, jid, generated, { quoted });
  return 'V1 code+table ✓';
}

/**
 * V1 Map + Table — map card followed by a stats table.
 */
export async function testV1MapWithTable(sock, jid, quoted) {
  const generated = generateMapWithTable({
    map: {
      centerLatitude: 5.6037,
      centerLongitude: -0.1870,
      annotations: [
        { latitude: 5.6037, longitude: -0.1870, title: 'Accra', body: 'Ghana capital' },
      ],
    },
    tableTitle: 'City Stats',
    tableHeaders: ['Population', 'Area', 'Timezone'],
    tableRows: [['2.5M', '225 km²', 'GMT+0']],
  }, quoted, {
    headerText: '🧪 V1 Map+Table Combo',
    footer: 'baileys • FIXED 2026-09-14: OSM tile + info + table — re-verify on device',
  });
  await _relayGenerated(sock, jid, generated, { quoted });
  return 'V1 map+table ✓';
}

/**
 * V1 Text + Inline Image — text followed by a single image.
 */
export async function testV1TextWithImage(sock, jid, quoted) {
  const generated = generateTextWithInlineImage(
    'Here is an inline image rendered natively:',
    { imageUrl: 'https://picsum.photos/seed/ping/600/400', imageText: 'baileys Test Image', tapLinkUrl: 'https://github.com/boyde1317-byte' },
    quoted,
    {
      primitiveStyle: 'nixcode', headerText: '🧪 V1 Text+Image Combo', footer: 'baileys' },
  );

  await _relayGenerated(sock, jid, generated, { quoted });
  return 'V1 text+image ✓';
}

/**
 * V1 Multi Inline Images — stacked image gallery.
 */
export async function testV1MultiImages(sock, jid, quoted) {
  const generated = generateMultiInlineImages([
    { imageUrl: 'https://picsum.photos/seed/ping/600/400', imageText: 'Image 1' },
    { imageUrl: 'https://picsum.photos/seed/ping/600/400', imageText: 'Image 2' },
  ], quoted, { primitiveStyle: 'nixcode',
    headerText: '🧪 V1 Multi-Image Gallery',
    footer: 'baileys • stacked inline images',
  });
  await _relayGenerated(sock, jid, generated, { quoted });
  return 'V1 multi-images ✓';
}

/**
 * V1 Grid Image + Table — image grid followed by a table.
 */
export async function testV1GridWithTable(sock, jid, quoted) {
  const generated = generateGridImageWithTable({
    gridImage: {
      gridImageUrl: 'https://picsum.photos/seed/ping/600/400',
      imageUrls: ['https://picsum.photos/seed/ping/600/400'],
    },
    tableTitle: 'Gallery Stats',
    tableHeaders: ['Count', 'Resolution'],
    tableRows: [['1', '1080p']],
  }, quoted, { primitiveStyle: 'nixcode',
    headerText: '🧪 V1 Grid+Table Combo',
    footer: 'baileys',
  });
  await _relayGenerated(sock, jid, generated, { quoted });
  return 'V1 grid+table ✓';
}

/**
 * V1 Dynamic + Table — animated content followed by a table.
 */
export async function testV1DynamicWithTable(sock, jid, quoted) {
  const generated = generateDynamicWithTable({
    dynamic: { type: 'GIF', url: 'https://media.giphy.com/media/example.gif', loopCount: 0 },
    tableTitle: 'GIF Info',
    tableHeaders: ['Type', 'Loop'],
    tableRows: [['GIF', 'Infinite']],
  }, quoted, { primitiveStyle: 'nixcode',
    headerText: '🧪 V1 Dynamic+Table Combo',
    footer: 'baileys',
  });
  await _relayGenerated(sock, jid, generated, { quoted });
  return 'V1 dynamic+table ✓';
}

/**
 * V2 Code + Table — base64-encoded combo.
 */
export async function testV2CodeWithTable(sock, jid, quoted) {
  const generated = generateCodeWithTableV2({
    code: [
      '// V2 Code+Table — base64 unifiedResponse',
      "import { generateCodeWithTableV2 } from 'baileys';",
      "const result = generateCodeWithTableV2(params, quoted, opts);",
    ].join('\n'),
    language: 'javascript',
    tableTitle: 'V2 Features',
    tableHeaders: ['Generator', 'Format', 'Renders'],
    tableRows: [
      ['Code+Table V2', 'base64', '✅'],
      ['Map+Table V2', 'base64', '✅'],
      ['Text+Image V2', 'base64', '✅'],
    ],
  }, quoted, {
    headerText: '🧪 V2 Code+Table Combo',
    footer: 'base64 unifiedResponse — Meta AI format',
  });
  await _relayGenerated(sock, jid, generated, { quoted });
  return 'V2 code+table ✓';
}

/**
 * V2 Map + Table — base64-encoded combo.
 */
export async function testV2MapWithTable(sock, jid, quoted) {
  const generated = generateMapWithTableV2({
    map: {
      centerLatitude: 5.6037,
      centerLongitude: -0.1870,
      annotations: [
        { latitude: 5.6037, longitude: -0.1870, title: 'Accra' },
      ],
    },
    tableTitle: 'Location Stats',
    tableHeaders: ['City', 'Country'],
    tableRows: [['Accra', 'Ghana']],
  }, quoted, {
    headerText: '🧪 V2 Map+Table Combo',
    footer: 'baileys • FIXED 2026-09-14: OSM tile + info + table (base64) — re-verify on device',
  });
  await _relayGenerated(sock, jid, generated, { quoted });
  return 'V2 map+table ✓';
}

/**
 * V2 Text + Inline Image — base64-encoded combo.
 */
export async function testV2TextWithImage(sock, jid, quoted) {
  const generated = generateTextWithInlineImageV2(
    'V2 text+image combo — base64 unifiedResponse:',
    { imageUrl: 'https://picsum.photos/seed/ping/600/400', imageText: 'V2 Test Image' },
    quoted,
    {
      primitiveStyle: 'nixcode', headerText: '🧪 V2 Text+Image Combo', footer: 'baileys' },
  );

  await _relayGenerated(sock, jid, generated, { quoted });
  return 'V2 text+image ✓';
}

/**
 * V2 Multi Inline Images — base64-encoded gallery.
 */
export async function testV2MultiImages(sock, jid, quoted) {
  const generated = generateMultiInlineImagesV2([
    { imageUrl: 'https://picsum.photos/seed/ping/600/400', imageText: 'V2 Image 1' },
    { imageUrl: 'https://picsum.photos/seed/ping/600/400', imageText: 'V2 Image 2' },
  ], quoted, { primitiveStyle: 'nixcode',
    headerText: '🧪 V2 Multi-Image Gallery',
    footer: 'baileys • base64',
  });
  await _relayGenerated(sock, jid, generated, { quoted });
  return 'V2 multi-images ✓';
}

/**
 * V2 Grid Image + Table — base64-encoded combo.
 */
export async function testV2GridWithTable(sock, jid, quoted) {
  const generated = generateGridImageWithTableV2({
    gridImage: {
      gridImageUrl: 'https://picsum.photos/seed/ping/600/400',
      imageUrls: ['https://picsum.photos/seed/ping/600/400'],
    },
    tableTitle: 'V2 Grid Stats',
    tableHeaders: ['Images', 'Format'],
    tableRows: [['1', 'base64']],
  }, quoted, { primitiveStyle: 'nixcode',
    headerText: '🧪 V2 Grid+Table Combo',
    footer: 'baileys',
  });
  await _relayGenerated(sock, jid, generated, { quoted });
  return 'V2 grid+table ✓';
}

/**
 * V2 Dynamic + Table — base64-encoded combo.
 */
export async function testV2DynamicWithTable(sock, jid, quoted) {
  const generated = generateDynamicWithTableV2({
    dynamic: { type: 'GIF', url: 'https://media.giphy.com/media/example.gif' },
    tableTitle: 'V2 Dynamic Info',
    tableHeaders: ['Type', 'Format'],
    tableRows: [['GIF', 'base64']],
  }, quoted, { primitiveStyle: 'nixcode',
    headerText: '🧪 V2 Dynamic+Table Combo',
    footer: 'baileys',
  });
  await _relayGenerated(sock, jid, generated, { quoted });
  return 'V2 dynamic+table ✓';
}

// Master test registry
// ─────────────────────────────────────────────────────────────────────────────

// ─── Moonson-proven AIRich combos (vendored NIXCODE builder) ─────────────────
// These replicate the exact multi-section payload composition Moonson ships in
// production: .ping (addProduct banner → addText × N → addTip → addSuggest)
// and .facebookdl (addVideo → addText → addTip → setFooter). Unlike the
// single-primitive generators above, AIRich stacks several primitives in ONE
// unifiedResponse message. Device-proven by Moonson + NIXCODE + itsliaaa.

export async function testMoonsonPingCombo(sock, jid, quoted) {
  const os = await import('node:os');
  const start = performance.now();
  await fetch('https://httpbin.org/get').catch(() => null);
  const apiLatency = (performance.now() - start).toFixed(0);

  const totalRam = os.totalmem();
  const usedRam  = totalRam - os.freemem();
  const ramPct   = ((usedRam / totalRam) * 100).toFixed(1);
  const cores    = os.cpus().length;
  const cpuModel = os.cpus()[0]?.model?.trim() || 'Unknown';

  const fmtRam = (b) => { const mb = b / 1024 / 1024; return mb >= 1024 ? (mb / 1024).toFixed(2) + ' GB' : mb.toFixed(0) + ' MB'; };
  const bar = (p, size = 10) => '█'.repeat(Math.round((p / 100) * size)) + '░'.repeat(size - Math.round((p / 100) * size));

  const thumb = 'https://picsum.photos/seed/ping/600/400';

  await new AIRich(sock)
    .addProduct({
      title:      'baileys',
      brand:      'System Monitor',
      price:      apiLatency + ' ms',
      sale_price: 'Excellent',
      product_url: 'https://github.com/boyde1317-byte/baileys',
      image_url:  thumb,
      icon_url:   thumb,
    })
    .addText(
      '## ◈ Latency\n\n' +
      '› API Ping : **' + apiLatency + ' ms**\n' +
      '› Uptime   : device-proven AIRich ping combo'
    )
    .addText(
      '## ◈ Memory\n\n' +
      '› Used : **' + fmtRam(usedRam) + '** / ' + fmtRam(totalRam) + '\n' +
      '› Load : `' + bar(ramPct) + '` ' + ramPct + '%'
    )
    .addText(
      '## ◈ Processor\n\n' +
      '› Model : ' + cpuModel + '\n' +
      '› Cores : ' + cores + ' core'
    )
    .addTip('Platform : ' + os.type() + ' ' + os.arch() + ' · Node.js : ' + process.version)
    .addSuggest(['.menu', '.ping', '.stats'])
    .send(jid, { quoted });
  return 'AIRich ping combo ✓';
}

/**
 * Moonson .facebookdl combo — addVideo + addText + addTip + setFooter.
 * addVideo emits a GenAIImaginePrimitive (ANIMATE) like Moonson ships.
 */
export async function testMoonsonFbCombo(sock, jid, quoted) {
  await new AIRich(sock)
    .addVideo('https://download.samplelib.com/mp4/sample-5s.mp4|5')
    .addText(
      '📝 **Description:**\nbaileys test video — Moonson .facebookdl combo\n\n' +
      '🔗 **Link:** https://download.samplelib.com/mp4/sample-5s.mp4'
    )
    .addTip('_Tap the video to play_')
    .setFooter('© baileys by Aizen')
    .send(jid, { quoted });
  return 'AIRich fb combo ✓';
}

// ─────────────────────────────────────────────────────────────────────────────
// r19 — BloksWidget / A2UI v0.9 surface.
//
// The one path in the whole stack that needs nothing from Meta: the surface is
// composed locally and rides `InteractiveMessage.bloksWidget` (proto tag 66,
// field 8). No flow_id, no WABA, no hosted screen.
//
// This test exists because every other generator in this kit has a device audit
// case and this one had none. It fails loudly when the pinned proto has no
// widget slot, so a silent skip can never be mistaken for a rendering bug.
// ─────────────────────────────────────────────────────────────────────────────
export async function testBloksSurface(sock, jid, quoted) {
  if (!bloksWidgetSupport()) {
    throw new Error('proto.Message.InteractiveMessage.BloksWidget is missing on this fork — widget cannot be built');
  }

  const uuid = randomUUID();
  const spec = buildA2uiSpec({
    uuid,
    components: [
      column('root', ['info_card', 'channel_text', 'open_button']),
      card('info_card', 'info_body'),
      column('info_body', ['title', 'rule', 'body']),
      text('title', 'A2UI Surface — built locally, not by Meta', 'h3'),
      divider('rule'),
      text('body', 'Column → Card → Column → Text/Divider, plus a Button whose action is openUrl. If this renders as a real card, the bloksWidget path works.'),
      text('channel_text', 'baileys Channel'),
      urlButton('open_button', 'channel_text', 'https://example.com/channel'),
    ],
  });

  const check = validateComponents(spec.createSurface.components);
  if (!check.ok) throw new Error('surface invalid before send: ' + check.errors.join('; '));

  const bloksWidget = buildBloksWidget(spec, { uuid });
  if (!bloksWidget) throw new Error('buildBloksWidget returned nothing despite a passing support check');

  const messageParamsJson = JSON.stringify({
    limited_time_offer: { text: 'A2UI v0.9', url: 'https://example.com/channel', copy_code: 'a2ui', expiration_time: Date.now() * 999 },
    bottom_sheet: { in_thread_buttons_limit: 0, divider_indices: [1, 2, 3, 999], list_title: 'A2UI surface', button_title: ' ' },
  });

  const interactiveMessage = {
    body: { text: '🧩 *BloksWidget / A2UI surface*\n\nCard above = widget rendered. Body text only = widget skipped by the client.' },
    footer: { text: 'baileys • r19 (im_a2ui, surfaceId ' + spec.createSurface.surfaceId + ')' },
    nativeFlowMessage: {
      messageParamsJson,
      messageVersion: 1,
      buttons: [
        { name: 'single_select', buttonParamsJson: JSON.stringify({ has_multiple_buttons: true }) },
        { name: 'call_permission_request', buttonParamsJson: JSON.stringify({ has_multiple_buttons: true }) },
        { name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: 'Open channel', url: 'https://example.com/channel' }) },
      ],
    },
    bloksWidget,
  };

  const generated = generateWAMessageFromContent(
    jid,
    { viewOnceMessage: { message: { interactiveMessage } } },
    { ...(sock.user?.id ? { userJid: sock.user.id } : {}) }
  );
  await sock.relayMessage(jid, generated.message, { messageId: generated.key.id });

  return 'bloks a2ui surface ✓ (' + spec.createSurface.components.length + ' components, ' + JSON.stringify(spec).length + 'B spec)';
}

export const RICH_TESTS = [
  // V1 generators (submessage-based)
  { id: 'v1table',    label: '📊 V1 Table',           fn: testV1Table,         group: 'V1' },
  { id: 'v1list',     label: '📋 V1 List',            fn: testV1List,          group: 'V1' },
  { id: 'v1code',     label: '💻 V1 Code (JS)',       fn: testV1Code,          group: 'V1' },
  { id: 'v1python',   label: '🐍 V1 Code (Python)',    fn: testV1Python,        group: 'V1' },
  { id: 'v1latex',    label: '∫ V1 LaTeX',             fn: testV1Latex,        group: 'V1' },
  { id: 'v1raw',      label: '🔧 V1 Raw Submessages',  fn: testV1Raw,           group: 'V1' },
  // V2 generators (base64 unifiedResponse — Meta AI format)
  { id: 'v2table',    label: '📊 V2 Table',           fn: testV2Table,         group: 'V2' },
  { id: 'v2code',     label: '💻 V2 Code (JS)',       fn: testV2Code,          group: 'V2' },
  { id: 'v2go',       label: '🐹 V2 Code (Go)',        fn: testV2Go,            group: 'V2' },
  // Link content
  { id: 'v1link',     label: '🔗 V1 Link+Cit',        fn: testV1Link,          group: 'Links' },
  { id: 'v2link',     label: '🔍 V2 Search Cit',       fn: testV2Link,         group: 'Links' },
  // Tokenizer / parser unit tests
  { id: 'tokenizer',  label: '🔬 Tokenizer V2',       fn: testTokenizerV2,    group: 'Unit' },
  { id: 'tablemeta',  label: '🔬 Table Metadata V2',   fn: testTableMetadataV2, group: 'Unit' },
  // Capture & relay
  { id: "reel",       label: "🎬 Reel Content",       fn: testReelContent,     group: "Reels" },
  { id: "reelstats",  label: "🎬 Reel + Stats Table", fn: testReelWithStats,   group: "Reels" },
  { id: "map",        label: "📍 Location Card",     fn: testMapContent,      group: "Location" },
  { id: "inlinevid",  label: "🎬 Inline Video+Table", fn: testInlineVideoWithStats, group: "Location" },
  { id: "inlineimg",  label: "🖼️ Inline Image+Table", fn: testInlineImageWithTable, group: "Images" },
  { id: "capture",    label: "🔄 Capture & Relay",   fn: testCaptureRelay,    group: "Capture" },
  // V2 generators (new — fork commit b9f5c84)
  { id: 'v2list',     label: '📋 V2 List',            fn: testV2List,          group: 'V2' },
  { id: 'v2latex',    label: '∫ V2 LaTeX',            fn: testV2Latex,        group: 'V2' },
  { id: 'v2map',      label: '📍 V2 Location Card',   fn: testV2Map,           group: 'V2' },
  { id: 'v2reel',     label: '🎬 V2 Reel Carousel',  fn: testV2Reel,          group: 'V2' },
  { id: 'v2reelstats',label: '🎬 V2 Reel + Stats',    fn: testV2ReelWithStats,  group: 'V2' },
  { id: 'v2imgtable', label: '🖼️ V2 Image+Table',   fn: testV2InlineImageWithTable, group: 'V2' },
  { id: 'v2vidtable', label: '🎬 V2 Video+Table',    fn: testV2InlineVideoWithStats, group: 'V2' },
  // GRID_IMAGE + DYNAMIC (new — fork commit b9f5c84)
  { id: 'v1grid',     label: '🖼️ V1 Grid Image',    fn: testV1GridImage,     group: 'Grid/Dynamic' },
  { id: 'v1dyn',      label: '🎞️ V1 Dynamic GIF',    fn: testV1Dynamic,       group: 'Grid/Dynamic' },
  { id: 'v2grid',     label: '🖼️ V2 Grid Image',    fn: testV2GridImage,     group: 'Grid/Dynamic' },
  { id: 'v2dyn',      label: '🎞️ V2 Dynamic Image',  fn: testV2Dynamic,       group: 'Grid/Dynamic' },
  // LaTeX image rendering (requires mathjax-node)
  { id: 'v1lateximg', label: '📐 V1 LaTeX Image',     fn: testV1LatexImage,   group: 'LaTeX Image' },
  { id: 'v2lateximg', label: '📐 V2 LaTeX Image',     fn: testV2LatexImage,   group: 'LaTeX Image' },
  // NEW: Combination generators (v0.3.18-r3)
  { id: 'v1codetable',  label: '💻 V1 Code+Table',     fn: testV1CodeWithTable,     group: 'Combos V1' },
  { id: 'v1maptable',   label: '📍 V1 Map+Table',      fn: testV1MapWithTable,      group: 'Combos V1' },
  { id: 'v1textimg',    label: '🖼️ V1 Text+Image',    fn: testV1TextWithImage,     group: 'Combos V1' },
  { id: 'v1multiimg',   label: '🖼️ V1 Multi-Images',  fn: testV1MultiImages,      group: 'Combos V1' },
  { id: 'v1gridtable',  label: '🖼️ V1 Grid+Table',    fn: testV1GridWithTable,     group: 'Combos V1' },
  { id: 'v1dyntable',   label: '🎞️ V1 Dynamic+Table', fn: testV1DynamicWithTable,  group: 'Combos V1' },
  // v0.3.18-r14 gems (galaxy_message + proto-native carousel)
  { id: 'galaxy',   label: '🌌 Galaxy Flows Bar', fn: testGalaxyBar,      group: 'r14 Gems' },
  { id: 'carousel', label: '🎠 Native Carousel',  fn: testNativeCarousel, group: 'r14 Gems' },
  { id: 'secret',   label: '🔒 Secret Flow Card', fn: testSecretFlow,      group: 'r14 Gems' },
  { id: 'htmlcounter', label: '🎯 HTML Tap Counter', fn: testHtmlGame('counter'), group: 'HTML' },
  { id: 'vipcard',  label: '👑 VIP Rich Card',   fn: testVipRichCard,       group: 'r18 Gems' },
  { id: 'blokssurface', label: '🧩 Bloks A2UI Surface', fn: testBloksSurface, group: 'Bloks' },
  { id: 'htmlcalc', label: '🧮 HTML Calculator',  fn: testHtmlGame('calc'),    group: 'HTML' },
  { id: 'htmlmonitor', label: '📡 HTML Host Monitor', fn: testHtmlGame('monitor'), group: 'HTML' },
  { id: 'v2codetable',  label: '💻 V2 Code+Table',     fn: testV2CodeWithTable,     group: 'Combos V2' },
  { id: 'v2maptable',   label: '📍 V2 Map+Table',      fn: testV2MapWithTable,      group: 'Combos V2' },
  { id: 'v2textimg',    label: '🖼️ V2 Text+Image',    fn: testV2TextWithImage,     group: 'Combos V2' },
  { id: 'v2multiimg',   label: '🖼️ V2 Multi-Images',  fn: testV2MultiImages,      group: 'Combos V2' },
  { id: 'v2gridtable',  label: '🖼️ V2 Grid+Table',    fn: testV2GridWithTable,     group: 'Combos V2' },
  { id: 'v2dyntable',   label: '🎞️ V2 Dynamic+Table', fn: testV2DynamicWithTable,  group: 'Combos V2' },
  // Moonson-proven AIRich combos (multi-primitive unifiedResponse)
  { id: 'msping',      label: '🏓 AIRich Ping Combo', fn: testMoonsonPingCombo, group: 'AIRich' },
  { id: 'msfb',        label: '📘 AIRich FB Combo',    fn: testMoonsonFbCombo,   group: 'AIRich' },
];

export async function runRichTest(sock, jid, testId, quoted) {
  const test = RICH_TESTS.find(t => t.id === testId);
  if (!test) throw new Error('Unknown test: ' + testId);
  return test.fn(sock, jid, quoted);
}

export async function runAllRichTests(sock, jid, quoted) {
  const results = [];
  for (const test of RICH_TESTS) {
    try {
      const result = await test.fn(sock, jid, quoted);
      results.push({ id: test.id, label: test.label, ok: true, result });
    } catch (err) {
      results.push({ id: test.id, label: test.label, ok: false, result: err.message });
    }
    // Small delay between tests to avoid flooding
    await new Promise(r => setTimeout(r, 500));
  }
  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// v0.3.18-r14 gems — galaxy_message Flows bar + proto-native carousel.
// Unlike the generators above, these go through sock.sendMessage so the
// fork's own generateWAMessageContent branches (nativeFlow / cards) are
// exercised end-to-end — the same path baileysBridge uses in production.
// ─────────────────────────────────────────────────────────────────────────────
export async function testGalaxyBar(sock, jid, quoted) {
  // r17 FIX: the bar does NOT render from a bare galaxy_message button —
  // device-verified. The scene envelope (Paxley/Moongod, working in
  // production) always ships: (1) messageParamsJson carrying a
  // limited_time_offer + bottom_sheet (fork r17 auto-attaches this when a
  // galaxyBar is present), and (2) two stub buttons before the bar —
  // single_select + call_permission_request with has_multiple_buttons:true.
  // This test replicates that envelope exactly.
  await sock.sendMessage(jid, {
    nativeFlow: [
      { name: 'single_select', paramsJson: JSON.stringify({ has_multiple_buttons: true }) },
      { name: 'call_permission_request', paramsJson: JSON.stringify({ has_multiple_buttons: true }) },
      { galaxyBar: { cta: '› # baileys Flows', flowId: '.x7' } },
      { text: '📋 Copy this code', copy: 'baileys-R17' },
      { text: '🌐 Open channel', url: 'https://example.com/channel' },
    ],
    text: '🌌 *Galaxy Flows Bar test (r17 envelope)*\n\nA WhatsApp-branded Flows bar, faked without a real flow. If this still renders flat, the missing piece is client-side version gating.',
    footer: 'baileys • v0.3.18-r17 gem (galaxy_message + limited_time_offer)',
  }, { quoted });
  return 'galaxy flows bar ✓ (r17 envelope)';
}

export async function testNativeCarousel(sock, jid, quoted) {
  await sock.sendMessage(jid, {
    cards: [
      {
        image: { url: 'https://picsum.photos/seed/nexcar1/512/512' },
        caption: 'Card 1 — image header + URL button.',
        title: 'First',
        nativeFlow: [{ text: '🌐 Visit baileys', url: 'https://example.com' }],
      },
      {
        text: 'Card 2 — text card with the galaxy Flows bar and a copy button.',
        title: 'Second',
        nativeFlow: [
          { galaxyBar: { cta: '✨ Flows bar on a card' } },
          { text: '📋 Copy', copy: 'carousel-copy-test' },
        ],
      },
      {
        image: { url: 'https://picsum.photos/seed/nexcar3/512/512' },
        caption: 'Card 3 — image header + quick reply.',
        title: 'Third',
        nativeFlow: [{ text: '👉 Ping the bot', id: '.ping' }],
      },
    ],
    text: '🎠 *Native proto carousel* — swipeable cards, each with its own media header and buttons.',
    footer: 'baileys • v0.3.18-r14 gem (carouselMessage)',
  }, { quoted });
  return 'native carousel ✓';
}

// ─────────────────────────────────────────────────────────────────────────────
// viewOnce-wrapped interactive card + in-chat HTML cards
// and in-chat HTML cards via GenAIaeacdsnwHtmlPrimitive.
// ─────────────────────────────────────────────────────────────────────────────
/** Logger stub for building content outside a live socket (see messages.js). */
const silentLogger = {
  level: 'silent',
  trace() {},
  debug() {},
  info() {},
  warn() {},
  error() {},
  child() {
    return this;
  },
};

export async function testSecretFlow(sock, jid, quoted) {
  // viewOnce wrapping is the one envelope some clients drop — this is the
  // device check for it. Interactive content is built first, then wrapped.
  const interactive = await generateWAMessageContent(
    {
      text: '🔒 *Secret Flow Card*\n\nviewOnceMessage-wrapped interactiveMessage. Open it once and it is gone.',
      footer: 'baileys • viewOnce-wrapped interactive',
      nativeFlow: [
        { text: '👉 Ping', id: '.ping' },
        { text: '📋 Copy', copy: 'secret-card-test' },
        { galaxyBar: { cta: '✨ Flows bar inside a viewOnce card' } },
      ],
    },
    { logger: silentLogger, upload: async () => ({ mediaUrl: '' }) }
  );

  const message = await generateWAMessageFromContent(jid, buildSecretFlowContent(interactive), {
    userJid: sock.user?.id || '0@s.whatsapp.net',
  });
  await sock.relayMessage(jid, message.message, { messageId: message.key.id });
  return 'secret flow card ✓ (viewOnce + interactive)';
}

// ─── In-chat HTML cards (GenAIaeacdsnwHtmlPrimitive) ───────────────────────
// Payloads are inline and self-contained on purpose: never hot-link a card
// document, whoever controls that URL controls what your users execute.

const HTML_DEMOS = {
  counter: {
    title: 'Tap Counter 🎯',
    html: `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;font-family:system-ui,sans-serif;background:#0b0f1a;color:#f8fafc;display:grid;place-items:center;min-height:100vh}
.b{text-align:center}h1{font-size:56px;margin:0 0 4px}p{color:#94a3b8;margin:0 0 20px}
button{font:inherit;padding:14px 28px;border-radius:14px;border:1px solid #a855f7;background:#a855f7;color:#0b0f1a;font-weight:700}</style>
<h1 id="n">0</h1><p>taps, saved between opens</p><button id="b">Tap me</button>
<script>let n=+(localStorage.getItem('c')||0);const el=document.getElementById('n');el.textContent=n;
document.getElementById('b').onclick=()=>{n++;localStorage.setItem('c',n);el.textContent=n}</script>`,
  },
  calc: {
    title: 'Mini Calculator 🧮',
    html: `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;font-family:ui-monospace,monospace;background:#0b0f1a;color:#f8fafc;padding:16px}
#d{font-size:32px;text-align:right;padding:16px;border:1px solid #1f2937;border-radius:12px;min-height:48px;overflow:auto}
.g{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:12px}
button{font:inherit;font-size:20px;padding:16px 0;border-radius:12px;border:1px solid #1f2937;background:#111827;color:#f8fafc}
.op{color:#06b6d4}.eq{background:#a855f7;color:#0b0f1a;font-weight:700}</style>
<div id="d">0</div><div class="g" id="g"></div>
<script>const g=document.getElementById('g'),d=document.getElementById('d');let e='';
const keys=['C','(',')','/','7','8','9','*','4','5','6','-','1','2','3','+','0','.','⌫','='];
g.innerHTML=keys.map(k=>'<button class="'+(['/','*','-','+'].includes(k)?'op':k==='='?'eq':'')+'">'+k+'</button>').join('');
g.onclick=ev=>{const k=ev.target.textContent;if(k==='C'){e='';d.textContent='0';return}
if(k==='⌫'){e=e.slice(0,-1);d.textContent=e||'0';return}
if(k==='='){try{e=String(eval(e.replace(/[^-()+*/.0-9]/g,''))||0)}catch{e='err'}d.textContent=e;return}
e+=k;d.textContent=e}</script>`,
  },
  monitor: {
    title: 'Host Monitor 📡',
    html: `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;font-family:system-ui,sans-serif;background:#0b0f1a;color:#f8fafc;padding:18px}
h2{margin:0 0 14px;font-size:18px}.r{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #1f2937;font-size:14px}
.r span:first-child{color:#94a3b8}.r span:last-child{font-family:ui-monospace,monospace}</style>
<h2>Snapshot at load</h2><div id="rows"></div>
<script>const rows=%ROWS%;document.getElementById('rows').innerHTML=rows.map(([k,v])=>'<div class="r"><span>'+k+'</span><span>'+v+'</span></div>').join('')</script>`,
  },
};

const renderMonitor = () => {
  const mem = process.memoryUsage();
  const rows = [
    ['Platform', `${process.platform} ${process.arch}`],
    ['Node', process.version],
    ['Heap used', `${(mem.heapUsed / 1024 / 1024).toFixed(1)} MB`],
    ['RSS', `${(mem.rss / 1024 / 1024).toFixed(1)} MB`],
    ['Process uptime', `${Math.floor(process.uptime())}s`],
  ];
  return JSON.stringify(rows);
};

export function testHtmlGame(game) {
  return async (sock, jid, quoted) => {
    const demo = HTML_DEMOS[game];
    if (!demo) throw new Error(`unknown html demo "${game}"`);
    const html = demo.html.replace('%ROWS%', game === 'monitor' ? renderMonitor() : '[]');
    await sendHtmlCard(sock, jid, { html, title: demo.title, quoted });
    return `html card "${game}" ✓`;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// v0.3.18-r18 gem — Lady-Trish/Omegatech VIP rich card: full unified-response
// envelope (messageSecret + forwardedAiBotMessageInfo) with 3PExt widget CTAs.
// ─────────────────────────────────────────────────────────────────────────────
export async function testVipRichCard(sock, jid, quoted) {
  await sendUnifiedRich(sock, jid, {
    disclaimer: 'VIP Rich Card',
    submessages: [{ messageType: 2, messageText: '👑 baileys VIP Rich Card' }],
    sections: [
      singleSection(productItemCard({
        title: '👑 VIP Rich Card!',
        brand: 'baileys',
        price: '✅ Success',
        productUrl: 'https://wa.me/233533416608',
        imageUrl: 'https://picsum.photos/seed/vipcard/600/400',
      })),
      singleSection(markdownText(
        '✅ *Unified Response Envelope Test*\n\n📡 *Layout:* 4 sections (single + hscroll)\n🧩 *Primitives:* product card, markdown, 3PExt widget, pills\n🔐 *Secret:* injected · 🤖 *BotJid:* @bot · 🏷️ *ForwardOrigin:* 4\n\n📌 *Note:* CTA taps show a toast (toast-only theater by design).'
      )),
      hScrollSection([
        extWidget({
          title: '⚡ baileys VIP',
          ctas: [
            { label: 'React Again', toast: 'Send Another Reaction', toolCallId: '00' },
            { label: 'Menu', toast: 'Show Menu', toolCallId: '01' },
            { label: 'Channel', toast: 'Join Channel', toolCallId: '02' },
          ],
        }),
        ...followUpPills(['N', 'E', 'X', 'O', 'R', 'A']),
        markdownText('N\nE\nX\nO\nR\nA'),
        productItemCard({ title: 'baileys Bot', brand: 'baileys', price: 'r18', salePrice: 'Free' }),
      ]),
      singleSection(markdownText(
        '📢 *Join Our Channel:*\nhttps://example.com/channel',
        [{ url: 'https://example.com/channel', title: 'baileys Channel', displayName: '📢 Join Channel' }]
      )),
    ],
    quoted,
  });
  return 'vip rich card ✓ (r18 envelope)';
}
