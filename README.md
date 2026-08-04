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

### Structured Metadata Types

These submessage types use structured metadata objects instead of placeholder
stubs (fixed in commit `9b1f70a`):

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

### Context Info Unification (V1/V2)

`buildRichContextInfo` produces a unified `contextInfo` object used by both V1
and V2 generators — consistent bot JID (`867051314767696@bot`), forwarding
score (1), and `forwardOrigin: 4`. Quoted messages are supported via the
`quoted` parameter.

### Fallback Handling

Unknown submessage types in the `richResponse` array no longer cause proto
serialization errors. The fallback path in `prepareRichResponseMessage` returns
the raw submessage object, and consumers handle graceful degradation to text.

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

The barrel (`src/index.ts`) exports **336 symbols** total.

---

## Other Enhancements (v0.3.18-r1)

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
import { prepareRichResponseMessage, wrapToBotForwardedMessage } from 'baileys';

// Build a rich message with table + code submessages
const richContent = {
  richResponse: [
    { text: 'Here are the results:' },
    { table: { title: 'Stats', rows: [{ items: ['Name', 'Score'] }, { items: ['Alice', '95'] }] } },
    { code: [{ codeContent: 'console.log("hello")' }], language: 'javascript' },
  ],
  footerText: 'Generated by NEXORA-MD',
};

const prepared = prepareRichResponseMessage(richContent, null, {});
const wrapped = wrapToBotForwardedMessage(prepared, sock.user.jid);

await sock.relayMessage(jid, wrapped, {});
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
        // V2: decode base64 unifiedResponse
        const decoded = JSON.parse(
          Buffer.from(rich.unifiedResponse.data, 'base64').toString('utf8')
        );
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
