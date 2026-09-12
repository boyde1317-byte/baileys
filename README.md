# baileys — boyde1317-byte fork

> WhatsApp Multi-Device library for Node.js — maintained fork for [NEXORA-MD](https://github.com/boyde1317-byte/NEXORA-MD).

[![GitHub stars](https://img.shields.io/github/stars/boyde1317-byte/baileys?style=for-the-badge&logo=github)](https://github.com/boyde1317-byte/baileys)
[![License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&labelColor=green&logoColor=white&style=for-the-badge)](https://nodejs.org)
[![ESM](https://img.shields.io/badge/ESM-only-yellow?logo=javascript&logoColor=black&style=for-the-badge)](#)

---

## About

This is the Baileys fork used internally by **NEXORA-MD**. It is based on
[itsliaaa/Baileys](https://github.com/itsliaaa/Baileys) @ `0.3.18-final` with
extensive rich-message generation, consumption, and proto-level enhancements.

---

## Rich Message System

The headline feature of this fork is a complete **rich message generation and
consumption pipeline** that mirrors what Meta AI sends natively in WhatsApp.

### Submessage Types (V1 — submessage-based)

All 10 `RichSubMessageType` values are fully implemented in
`prepareRichResponseMessage`:

| Type ID | Enum | Generator | Description |
|---------|------|-----------|-------------|
| 1 | `GRID_IMAGE` | `generateGridImageContent` | Image gallery grid with main image + thumbnail URLs |
| 2 | `TEXT` | (inline) | Plain text submessage |
| 3 | `INLINE_IMAGE` | `generateInlineImageWithTableContent` | Inline image with optional table overlay |
| 4 | `TABLE` | `generateTableContent` | Aligned-column table bubble |
| 5 | `CODE` | `generateCodeBlockContent` | Syntax-highlighted code block |
| 6 | `DYNAMIC` | `generateDynamicContent` | Animated GIF/image content |
| 7 | `MAP` | `generateMapContent` | Location card with annotations |
| 8 | `LATEX` | `generateLatexContent` | LaTeX expression rendering |
| 9 | `CONTENT_ITEMS` | `generateReelContent` / `generateInlineVideoWithStatsContent` | Video carousel / reel items |

### V2 Generators (base64 unifiedResponse — Meta AI format)

V2 generators produce the `unifiedResponse.data` base64-encoded JSON format
that Meta AI clients use natively. Each V2 generator has a corresponding V1
generator for backward compatibility.

> **v0.3.18-r4:** the **V1 path base64-encodes too** — both paths now share
> one encoding helper, `encodeUnifiedResponseData(payload)`, matching the
> convention used by NIXCODE and `ourin-baileys`. Previously the V1 path sent
> a raw JSON buffer, which can render blank on some clients.

| V2 Generator | V1 Counterpart | UX Primitive |
|-------------|----------------|-------------|
| `generateTableContentV2` | `generateTableContent` | `GenAITableUXPrimitive` |
| `generateCodeBlockContentV2` | `generateCodeBlockContent` | `GenAICodeBlockUXPrimitive` |
| `generateListContentV2` | `generateListContent` | `GenAITableUXPrimitive` (single-column) |
| `generateLinkContentV2` | `generateLinkContent` | `GenAILinkCollectionUXPrimitive` |
| `generateMapContentV2` | `generateMapContent` | `GenAIAirichMapUXPrimitive` |
| `generateReelContentV2` | `generateReelContent` | `GenAIContentItemsUXPrimitive` |
| `generateInlineImageWithTableContentV2` | `generateInlineImageWithTableContent` | `GenAIInlineImageWithTableUXPrimitive` |
| `generateInlineVideoWithStatsContentV2` | `generateInlineVideoWithStatsContent` | `GenAIInlineVideoWithStatsUXPrimitive` |
| `generateLatexImageContentV2` | `generateLatexImageContent` | `GenAILatexImageUXPrimitive` |

### New Submessage Combinations (v0.3.18-r3)

These combinations produce **visible native UI** when sent — each pairs two
or more submessage types in a single `richResponseMessage` so WhatsApp
renders them as a unified card:

| Combination | V1 Generator | V2 Generator | Renders As |
|-------------|-------------|-------------|------------|
| Code + Table | `generateCodeWithTable` | `generateCodeWithTableV2` | Syntax-highlighted code → data table below |
| Map + Table | `generateMapWithTable` | `generateMapWithTableV2` | Interactive map preview → stats table below |
| Text + Inline Image | `generateTextWithInlineImage` | `generateTextWithInlineImageV2` | Markdown text → inline image below |
| Multiple Inline Images | `generateMultiInlineImages` | `generateMultiInlineImagesV2` | Stacked images with captions |
| Grid Image + Table | `generateGridImageWithTable` | `generateGridImageWithTableV2` | Image gallery grid → data table below |
| Dynamic + Table | `generateDynamicWithTable` | `generateDynamicWithTableV2` | Animated GIF/image → data table below |

All existing single-type generators (`generateTableContent`, `generateCodeBlockContent`,
`generateMapContent`, etc.) also render natively — the combinations above are new
multi-type pairings that were not previously available.

### Native Flow Button Types (v0.3.18-r3)

Added 14 new native flow button types for latest WhatsApp features:

> **Experimental gating (v0.3.18-r4):** the CTA names below are **not
> verified** against current WhatsApp clients — unverified names can get the
> whole message rejected or render dead buttons. Sending one without opting
> in now throws a `400` error. Opt in per-message with
> `experimentalCta: true`, or per-button with `experimental: true`.
>
> Never gated: the well-known CTAs (`quick_reply`, `cta_copy`, `cta_url`,
> `cta_call`, `single_select`, `cta_request_location`, `cta_request_phone`,
> `send_location`, `flow`, `cta_reminder`, `cta_cancel_reminder`,
> `address_message`) and the raw `{ name, paramsJson }` passthrough.

| Button Type | Property | Description |
|------------|----------|-------------|
| `address_message` | `address` | Share address form — name matches NIXCODE 4.5 (proven); `cta_address` is not a verified name |
| `cta_sign_in` | `signIn` | Sign-in with token |
| `cta_sign_contract` | `signContract` | Sign contract with token |
| `cta_complete_payment` | `completePayment` | Complete payment with token |
| `cta_review_and_pay` | `reviewAndPay` | Review order & pay |
| `cta_sign_up` | `signUp` | Sign up with token |
| `cta_reminder` | `reminder` | Set reminder |
| `cta_open_chat` | `openChat` | Open chat with target JID |
| `cta_schedule` | `schedule` | Schedule event |
| `cta_copy_address` | `copyAddress` | Copy address to clipboard |
| `cta_amazon_link` | `amazonLink` | Open Amazon product link |
| `cta_delete_message` | `deleteMessage` | Delete message with key |
| `cta_payment` | `payment` | Direct payment with amount/currency |
| `cta_payment_verification` | `paymentVerification` | Verify payment status |
| `target` | `targetCta` | Generic target CTA |

### Bug Fixes (v0.3.18-r3)

| Fix | Description |
|-----|-------------|
| **TABLE typename** | Fixed `GenATableUXPrimitive` → `GenAITableUXPrimitive` (6 instances) — was missing the 'I' in 'GenAI', preventing native table rendering |
| **nativeFlowMessage messageVersion** | Added `messageVersion: 4` to `prepareNativeFlowButtons` return (was undefined) |
| **carousel messageVersion** | Bumped from `1` to `3` for latest carousel features |
| **carouselCardType** | Now defaults to `HSCROLL_CARDS` instead of `UNKNOWN`, with `carouselCardType` override support |
| **Text-only carousel cards** | Removed mandatory media requirement — text-only cards now valid |
| **flow_message_version** | Updated from `3` to `4` (latest WhatsApp Flows API version) |
| **V2 richResponseMessage messageVersion** | Added `messageVersion: 2` to `buildV2Content` and V2 link generators |
| **V1 prepareRichResponseMessage messageVersion** | Added `messageVersion: 1` for proper proto serialization |
| **buildBotForwardedMessage messageVersion** | Added `messageVersion: 1` for consistency |
| **V2 buildV2ContextInfo forwardingScore** | Fixed from `2` to `1` to match V1 behavior |
| **V1 buildRichContextInfo forwardingScore** | Fixed from `3` to `1` for consistency |
| **V2 deviceListMetadata** | Replaced empty stub object with `undefined` to prevent proto serialization issues |
| **botMessageSharingInfo** | Fixed to include `botEntryPointOrigin: 1` alongside `forwardingScore` |
| **bloksWidget support** | Added `bloksWidget` to interactive messages for Meta AI Bloks components |

### Content Routing (v0.3.18-r4)

`generateWAMessageContent` routes to the rich response builder when the
message contains any specific rich key: `code`, `links`, `table`, `latex`,
`richResponse`, `inlineImage`, `gridImage`, `inlineVideo`, `dynamic`.

The generic keys — `items`, `posts`, `products`, `suggested` — can collide
with other content types, so they only route to the rich builder when the
message explicitly opts in with `rich: true`:

```js
// plain content key, NOT routed (previously hijacked)
await sock.sendMessage(jid, { products: shopData }); // ❌

// explicit opt-in
await sock.sendMessage(jid, { rich: true, products: shopData }); // ✅
```

### Hardening (v0.3.18-r4)

| Fix | Description |
|-----|-------------|
| **base64 unifiedResponse (V1+V2)** | Both paths now base64-encode `unifiedResponse.data` via shared `encodeUnifiedResponseData` — raw JSON buffers can render blank (matches NIXCODE / ourin-baileys) |
| **`code` without `language`** | Fixed `TypeError: Assignment to constant variable` (`language ||=` on a destructured const) |
| **LaTeX text dropped** | `text`/`contentText` were never passed through — `latexMetadata.text` was always `undefined` |
| **Quoted/reply support** | `prepareRichResponseMessage` now honors `quoted` on the content object |
| **Donation citation fallbacks** | Removed hardcoded `For Donation via Saweria` / `Donation` defaults in `links` citations |
| **Ragged table rows** | Rows are padded to equal width (NIXCODE / ourin-baileys behavior) — uneven rows render blank cells |
| **One AI bot JID** | Single `AI_BOT_JID` constant shared by the V1/V2 context builders |
| **Button mapper dedup** | The ~350-line button mapping that existed twice (`prepareNativeFlowButtons` + legacy `buttons` path) is now one shared `mapButtonToNativeFlow` (−427 lines); both paths stay in sync automatically |
| **Experimental CTA gating** | Unverified CTAs require explicit opt-in (`experimentalCta` / `experimental`) |
| **Generic key routing** | `items`/`posts`/`products`/`suggested` only route to the rich builder with `rich: true` |
| **`sendGroupStatus` statusSourceType** | Was checked at the wrong nesting level — never matched, so `statusSourceType` was never set |
| **`address` CTA name** | `button.address` now emits `address_message` (NIXCODE 4.5's proven name) instead of the unverified `cta_address` — moved out of the experimental set |
| **`tip` metadata text** | New `tip` key (top-level or `richResponse` entry) renders as `GenAIMetadataTextPrimitive` (NIXCODE's `addTip`) — closes the last gap in the proven Moonson facebook.js combo |

### Structured Metadata Types

These submessage types use structured metadata objects instead of placeholder
stubs (fixed in commit `9b1f70a`). Remember the `rich: true` opt-in from
[Content Routing](#content-routing-v0318-r4) above:

| Key | Shape | Usage |
|-----|-------|-------|
| `products` | `{ title, items: [{ title, price, ... }] }` | Product carousel metadata |
| `posts` | `{ items: [{ title, url, ... }] }` | Social post metadata |
| `suggested` | `{ items: [{ title, text, ... }] }` | Suggested prompt metadata |

### LaTeX Image Rendering

`generateLatexImageContent` and `generateLatexInlineImageContent` accept an
optional `renderLatexToPng` callback. If omitted, the fork uses
`defaultRenderLatexToPng` which lazy-loads `mathjax-node`:

```js
import { generateLatexImageContent } from 'baileys';

// Uses defaultRenderLatexToPng (requires mathjax-node installed)
const content = generateLatexImageContent({
  latexExpression: 'E = mc^2',
  // renderLatexToPng: customRenderer  // optional override
});
```

> `mathjax-node` is an optional peer dependency. Install it with
> `npm install mathjax-node` to enable default LaTeX-to-PNG rendering.

### Tip / Metadata Text (GenAIMetadataTextPrimitive)

The small hint line under rich content (NIXCODE's `addTip`) — available as a
top-level `tip` key or a `richResponse` entry. It renders as
`GenAIMetadataTextPrimitive` in the V2 layout, not as regular markdown text:

```js
// The proven Moonson facebook.js combo, in fork API:
await sock.sendMessage(jid, {
  richResponse: [
    { gridImage: 'https://example.com/thumb.jpg' },
    { inlineVideo: { videoUrl: 'https://example.com/v.mp4', title: 'Facebook Video' } },
    { text: '» Title: Facebook Video\n» Link: https://example.com' },
    { tip: 'Tap the video to play' },
  ],
  footerText: '© Moonson Aizen',
  quoted: repliedMessage,
});
```

### Proven vs Experimental Reference

Judged against what actually ships in the wild — **Moonson** (production
usage), **NIXCODE 4.5** (builder surface), and **itsliaaa/Baileys**
(library support) — not what merely compiles.

**Proven native flow CTAs** (NIXCODE emits these, clients render them):
`quick_reply`, `cta_url`, `cta_copy`, `cta_call`, `single_select`,
`cta_reminder`, `cta_cancel_reminder`, `send_location`, `address_message`,
`flow` (official WhatsApp Flows API). All wrapped in the `native_flow`
tag `name: 'mixed'` v9 envelope.

**Proven V2 GenAI primitives** (NIXCODE 4.5 surface): markdown text (with
inline hyperlink/citation/LaTeX items), code block, table, sources row, grid
image, video/reel, product card, post, metadata text (tip), follow-up
suggestion pills.

**Proven V1 submessages** (itsliaaa support + ecosystem usage — TEXT, CODE,
TABLE, LATEX, GRID_IMAGE, CONTENT_ITEMS strongest; INLINE_IMAGE, DYNAMIC,
MAP supported but with thinner in-the-wild evidence).

**Experimental** — the 13 remaining fork CTAs (`cta_sign_in`,
`cta_sign_contract`, `cta_complete_payment`, `cta_review_and_pay`,
`cta_sign_up`, `cta_open_chat`, `cta_schedule`, `cta_copy_address`,
`cta_amazon_link`, `cta_delete_message`, `cta_payment`,
`cta_payment_verification`, `target`). No reference implementation ships
them; they stay gated behind `experimentalCta`.

### Context Info Unification (V1/V2)

`buildRichContextInfo` produces a unified `contextInfo` object used by both V1
and V2 generators — one shared `AI_BOT_JID` constant (`867051314767696@bot`),
forwarding score (1), and `forwardOrigin: 4`. Quoted messages are supported
via the `quoted` parameter — and since **v0.3.18-r4** you can pass `quoted`
directly on the content object handed to `prepareRichResponseMessage` /
`sendMessage`, so rich messages can reply to other messages.

### Error Handling (v0.3.18-r4)

Unknown entries in the `richResponse` array now **throw a descriptive
`Error`** listing the supported keys, instead of being silently skipped —
silent drops are a nightmare to debug in production. Pre-formed submessages
(`{ messageType, messageText }` or `{ messageType, *Metadata }`) still pass
through unchanged for advanced usage:

```js
prepareRichResponseMessage({ richResponse: [{ nope: true }] }); // throws
prepareRichResponseMessage({ richResponse: [{ messageType: 2, messageText: 'ok' }] }); // passes through
```

---

## Exported API

All standard Baileys exports plus the following fork-specific additions:

```js
// Rich message generators (V1)
import {
  prepareRichResponseMessage,
  generateTableContent,
  generateCodeBlockContent,
  generateListContent,
  generateLinkContent,
  generateMapContent,
  generateReelContent,
  generateReelWithStatsContent,
  generateInlineImageWithTableContent,
  generateInlineVideoWithStatsContent,
  generateGridImageContent,
  generateDynamicContent,
  generateLatexContent,
  generateLatexImageContent,
  generateLatexInlineImageContent,
} from 'baileys';

// Rich message generators (V2 — base64 unifiedResponse)
import {
  generateTableContentV2,
  generateCodeBlockContentV2,
  generateListContentV2,
  generateLinkContentV2,
  generateMapContentV2,
  generateReelContentV2,
  generateInlineImageWithTableContentV2,
  generateInlineVideoWithStatsContentV2,
  generateLatexImageContentV2,
} from 'baileys';

// Types and utilities
import {
  RichSubMessageType,        // enum: GRID_IMAGE=1, TEXT=2, ... CONTENT_ITEMS=9
  buildRichContextInfo,      // unified contextInfo builder (V1/V2)
  encodeUnifiedResponseData, // base64-encodes a unified payload (shared V1/V2)
  defaultRenderLatexToPng,    // mathjax-node-based LaTeX->PNG renderer
  wrapToBotForwardedMessage,  // wraps rich content in botForwardedMessage envelope
} from 'baileys';

// Standard Baileys exports
import makeWASocket                       from 'baileys';
import { useMultiFileAuthState }          from 'baileys';
import { makeCacheableSignalKeyStore }    from 'baileys';
import { fetchLatestBaileysVersion }      from 'baileys';
import { DisconnectReason }               from 'baileys';
import { generateWAMessageFromContent }   from 'baileys';
import { generateWAMessage }              from 'baileys';
import { generateMessageID }              from 'baileys';
import { downloadMediaMessage }           from 'baileys';
import { proto }                           from 'baileys';
import { jidDecode, jidNormalizedUser }   from 'baileys';
import { getContentType, normalizeMessageContent } from 'baileys';
```

The barrel (`src/index.ts`) exports **349 symbols** total.

---

## Other Enhancements (v0.3.18-r2)

| Enhancement | Description |
|-------------|-------------|
| **New native flow button types** | Added `cta_request_location`, `cta_request_phone`, `flow` (WhatsApp Flows), `send_location`, `cta_subscribe`, and arbitrary `name` + `paramsJson` passthrough for future button types. |
| **Convenience button properties on `buttons`** | The legacy `buttons` message path now supports the same convenience properties (`copy`, `url`, `call`, `location`, `phone`, `flow`) as `nativeFlow`, with icon support. |
| **Carousel cards without buttons** | Carousel cards no longer require `nativeFlow` buttons — text/image-only cards are now valid. Also added `buttons` as an alias for `nativeFlow` on cards. |
| **V2 rich response botMetadata** | `buildV2Content` now includes `botMetadata.verificationMetadata` proofs, matching V1 behavior for proper native UI rendering. |
| **V2 bot JID consistency** | Fixed V2 `buildV2ContextInfo` to use the same bot JID (`867051314767696@bot`) as V1, preventing rendering inconsistencies. |
| **V2 unifiedResponse encoding** | Fixed base64 string encoding to raw `Buffer` bytes in `generateLinkContent`, `generateLinkContentV2`, and `buildV2Content` — proto `bytes` fields should not be base64 strings. |
| **V2 messageType enum** | `buildV2Content` now uses `proto.AIRichResponseMessageType.AI_RICH_RESPONSE_TYPE_STANDARD` instead of hardcoded `1`. |
| **Missing V2 generator: LaTeX inline image** | Added `generateLatexInlineImageContentV2` — V1 had it, V2 was missing it. |
| **Complete V2 d.ts exports** | `rich-message-utils.d.ts` now exports all V2 generators including `generateListContentV2`, `generateReelContentV2`, `generateReelWithStatsV2`, `generateInlineImageWithTableV2`, `generateMapContentV2`, `generateInlineVideoWithStatsV2`, `generateGridImageContentV2`, `generateDynamicContentV2`, `generateLatexContentV2`, `generateLatexImageContentV2`, `generateLatexInlineImageContentV2`, `buildV2ContextInfo`, `buildV2Content`, and `defaultRenderLatexToPng`. |

### Previous (v0.3.18-r1)



| Enhancement | Description |
|-------------|-------------|
| **NativeFlow header with `text` body** | `nativeFlow` messages now set `header` (image + title + subtitle) even when `text` is used instead of `caption`. |
| **Carousel card header with `text` body** | Same fix for carousel cards. |
| **`contextInfo` on interactive messages** | Both `nativeFlow` and `carousel` accept a top-level `contextInfo` property. |
| **Enhanced `externalAdReply`** | Accepts `sourceUrl` alias for `url`, respects `thumbnailUrl`, supports `originalImageUrl` and `showAdAttribution`. |
| **Button text aliases** | All button types accept `display_text` and `label` as aliases for `text` / `buttonText`. |
| **Rich table improvements** | `title \|\| headerText` fallback, non-array item wrapping, `richResponse` array row normalization. |

### Inherited from `itsliaaa/Baileys 0.3.18-final`:

- ✅ Newsletter media upload fix
- ✅ Interactive message support (`interactiveMessage`, `nativeFlowMessage`)
- ✅ Album / carousel sends
- ✅ `messageContextInfo.messageSecret` auto-injection
- ✅ Stable release tag
- ✅ `whatsapp-rust-bridge 0.5.5`
- ✅ Pre-compiled `lib/` output — no build step required

---

## Security Audit

Every file has been audited for shell injection, dynamic code execution,
external data exfiltration, credential forwarding, obfuscated payloads, and
periodic polling to external servers.

**Result: clean.** All network code paths target WhatsApp's own servers
(`web.whatsapp.com`, `*.whatsapp.net`). All suspicious-looking identifiers
have been renamed or annotated for clarity.

---

## Installation

**For NEXORA-MD** (already configured in `package.json`):

```json
"baileys": "github:boyde1317-byte/baileys"
```

```bash
npm install
```

**Direct install:**

```bash
npm install github:boyde1317-byte/baileys
```

> **Node ≥ 20 required.** The `engine-requirements.js` preinstall script enforces this.

---

## Usage

```js
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion
} from 'baileys';

const { state, saveCreds } = await useMultiFileAuthState('./session');
const { version } = await fetchLatestBaileysVersion();

const sock = makeWASocket({
  version,
  auth: {
    creds: state.creds,
    keys: makeCacheableSignalKeyStore(state.keys)
  },
  printQRInTerminal: true
});

sock.ev.on('creds.update', saveCreds);
sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
  if (connection === 'close') {
    const shouldReconnect =
      lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
    if (shouldReconnect) connectToWhatsApp();
  }
});
```

### Sending Rich Messages

```js
// sendMessage routes rich keys automatically — no manual wrapping needed:
await sock.sendMessage(jid, {
  headerText: 'Results',
  table: [['Name', 'Score'], ['Alice', '95']],
  code: 'console.log("hello")',
  footerText: 'Generated by NEXORA-MD',
  quoted: repliedMessage,   // v0.3.18-r4: rich messages can reply
});

// Array form via richResponse:
await sock.sendMessage(jid, {
  richResponse: [
    { text: 'Here are the results:' },
    { table: { title: 'Stats', rows: [{ items: ['Name', 'Score'] }, { items: ['Alice', '95'] }] } },
  ],
  footerText: 'Generated by NEXORA-MD',
});

// Generic keys need the explicit opt-in (see Content Routing):
await sock.sendMessage(jid, { rich: true, products: { title: 'Shop', items: [...] } });
```

### Consuming Rich Messages

```js
// Incoming botForwardedMessage with richResponseMessage
sock.ev.on('messages.upsert', async ({ messages }) => {
  for (const m of messages) {
    const type = Object.keys(m.message || {})[0];
    if (type === 'botForwardedMessage') {
      const botFwd = m.message.botForwardedMessage;
      const rich = botFwd.message?.richResponseMessage;

      if (rich?.submessages) {
        // V1: iterate submessages
        for (const sub of rich.submessages) {
          console.log(sub.messageType, sub.messageText || sub.tableMetadata?.title);
        }
      }

      if (rich?.unifiedResponse?.data) {
        // V1 and V2 both base64-encode: data is bytes of a base64 string
        const base64 = Buffer.from(rich.unifiedResponse.data).toString('utf8');
        const decoded = JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
        console.log(decoded.sections);
      }
    }
  }
});
```

---

## Module Format

ESM only (`"type": "module"`). All imports use explicit `.js` extensions.

If you hit a `ERR_PACKAGE_PATH_NOT_EXPORTED` from `libsignal`, run:

```bash
node scripts/patch-libsignal.js
```

NEXORA-MD runs this automatically via the `postinstall` hook.

---

## Upstream

Based on [itsliaaa/Baileys](https://github.com/itsliaaa/Baileys) which is itself
a fork of the original [WhiskeySockets/Baileys](https://github.com/WhiskeySockets/Baileys).
The V2 rich message generators are ported from `ourin-baileys` (npm), and the
base64 `unifiedResponse` convention and table normalization follow NIXCODE.
Rich message utilities retain their original attribution notes.
