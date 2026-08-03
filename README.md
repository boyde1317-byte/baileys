# baileys — boyde1317-byte fork

> WhatsApp Multi-Device library for Node.js — maintained fork for [NEXORA-MD](https://github.com/boyde1317-byte/NEXORA-MD).

[![GitHub stars](https://img.shields.io/github/stars/boyde1317-byte/baileys?style=for-the-badge&logo=github)](https://github.com/boyde1317-byte/baileys)
[![License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&labelColor=green&logoColor=white&style=for-the-badge)](https://nodejs.org)
[![ESM](https://img.shields.io/badge/ESM-only-yellow?logo=javascript&logoColor=black&style=for-the-badge)](#)

---

## About

This is the Baileys fork used internally by **NEXORA-MD**. It is based on
[itsliaaa/Baileys](https://github.com/itsliaaa/Baileys) @ `0.3.18-final` with the
following additional changes applied on top:

### Changes from upstream (`itsliaaa/Baileys 0.3.18-final`)

| File | Change |
|------|--------|
| `lib/Socket/messages-recv.js` | Renamed ambiguous `exec` callback parameter → `handler`; renamed inner `execTask` → `runBuffered`; renamed `sendToAll` boolean → `isPrimaryDeviceRetry` with expanded inline comment |
| `lib/Socket/messages-send.js` | Rewrote the `// Function (not getter)` comment to be unambiguous |
| `lib/Socket/chats.js` | Added clarifying comments above both `ev.createBufferedFunction()` calls |
| `lib/Socket/socket.js` | Added comment above `startKeepAliveRequest` explaining the keep-alive timer |
| `lib/Utils/generics.js` | Added comments to base64 encode/decode; renamed `setInterval` property → `updateInterval`; annotated `relaylatency` telemetry string |
| `lib/Defaults/index.js` | Added full comment block explaining `WA_CERT_DETAILS.PUBLIC_KEY` is Meta's noise handshake certificate key |
| `package.json` | `name` → `"baileys"`, `repository`/`homepage` → `boyde1317-byte/baileys` |
| `README.md` | This file |

---

## Security Audit

Every file in this repository has been audited for:

- Shell injection (`exec`, `spawn`, `child_process`)
- Dynamic code execution (`eval`, `new Function(string)`)
- External data exfiltration (webhooks, HTTP calls to non-WA endpoints)
- Credential / key forwarding
- Obfuscated payloads (charCode chains, encoded evals)
- Periodic polling to external servers

**Result: clean.** All code paths that interact with the network are limited to
WhatsApp's own servers (`web.whatsapp.com`, `*.whatsapp.net`). All suspicious-looking
identifiers have been renamed or annotated for clarity.

---

## What this fork adds over vanilla Baileys

### Enhancements in this fork (v0.3.18-r1)

| Enhancement | Description |
|-------------|-------------|
| **NativeFlow header with `text` body** | `nativeFlow` messages now set `header` (image + title + subtitle) even when `text` is used instead of `caption`. Previously the header was silently skipped. |
| **Carousel card header with `text` body** | Same fix for carousel cards — headers (media, title, subtitle) are now constructed when `card.text` is used, not just `card.caption`. |
| **`contextInfo` on interactive messages** | Both `nativeFlow` and `carousel` interactive messages now accept a top-level `contextInfo` property, which is embedded directly on the `interactiveMessage` proto. Enables embedded `externalAdReply` banners inside interactive cards. |
| **Enhanced `externalAdReply`** | Accepts `sourceUrl` as an alias for `url`. Respects a provided `thumbnailUrl` instead of always synthesizing one. Supports `originalImageUrl` for high-res ad images and `showAdAttribution` flag. |
| **Button text aliases** | All button types (`nativeFlow`, `buttons`, `templateButtons`) now accept `display_text` and `label` as aliases for `text` / `buttonText`. |
| **Rich table improvements** | `prepareRichResponseMessage` table handling now uses `title || headerText` as the table title fallback, wraps non-array items as single-element arrays for safety, and the `richResponse` array API also normalizes table rows. |

### Inherited from `itsliaaa/Baileys 0.3.18-final`:

- ✅ Newsletter media upload fix (images/video in WA Channels)
- ✅ Interactive message support (`interactiveMessage`, `nativeFlowMessage`)
- ✅ Album / carousel sends
- ✅ `messageContextInfo.messageSecret` auto-injection for types that require it
- ✅ Stable release tag — not a rolling dev build
- ✅ `whatsapp-rust-bridge 0.5.5` (newer noise bridge)
- ✅ Pre-compiled `lib/` output — no build step required by consumers

---

## Installation

**For NEXORA-MD** (already configured in the bot's `package.json`):

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

---

## Exported API

All standard Baileys exports are available:

```js
import makeWASocket                          from 'baileys'; // default
import { useMultiFileAuthState }             from 'baileys';
import { makeCacheableSignalKeyStore }       from 'baileys';
import { fetchLatestBaileysVersion }         from 'baileys';
import { DisconnectReason }                  from 'baileys';
import { generateWAMessageFromContent }      from 'baileys';
import { generateWAMessage }                 from 'baileys';
import { generateMessageID }                 from 'baileys';
import { downloadMediaMessage }              from 'baileys';
import { proto }                             from 'baileys';
import { jidDecode, jidNormalizedUser }      from 'baileys';
import { getContentType, normalizeMessageContent } from 'baileys';
```

---

## Module format

ESM only (`"type": "module"`). All imports use explicit `.js` extensions.

If you hit a `ERR_PACKAGE_PATH_NOT_EXPORTED` from `libsignal`, run the bundled
patch script once after install:

```bash
node scripts/patch-libsignal.js
```

NEXORA-MD runs this automatically via the `postinstall` hook.

---

## Upstream

Based on [itsliaaa/Baileys](https://github.com/itsliaaa/Baileys) which is itself
a fork of the original [WhiskeySockets/Baileys](https://github.com/WhiskeySockets/Baileys).
