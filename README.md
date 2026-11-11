# baileys — boyde1317-byte fork

Baileys 0.3.18 (multi-device WhatsApp Web) plus a rich message layer: interactive cards,
native-flow buttons, GenAI rich cards, in-chat HTML, and self-hosted A2UI surfaces that
render natively in WhatsApp without a Meta Flow behind them. A device audit kit for all of
it ships in the package.

**Version:** `0.3.18-r19` · **Module:** ESM only, Node >= 20 · **License:** MIT

Install from GitHub (pin a tag, not `main`):

```bash
npm install github:boyde1317-byte/baileys#v0.3.18-r19
```

```js
import makeWASocket, { useMultiFileAuthState, DisconnectReason } from 'baileys';
```

## Connect

```js
import makeWASocket, { useMultiFileAuthState, DisconnectReason, Browsers } from 'baileys';

const { state, saveCreds } = await useMultiFileAuthState('session');
const sock = makeWASocket({ auth: state, browser: Browsers.ubuntu('Chrome') });

sock.ev.on('creds.update', saveCreds);
sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
  if (qr) console.log('scan:', qr);
  if (connection === 'close') {
    const code = lastDisconnect?.error?.output?.statusCode;
    if (code !== DisconnectReason.loggedOut) connect(); // 401 = logged out, do not retry
  }
});
```

`sock.sendMessage(jid, content, options)` covers almost everything below. The content key you
pass decides the message type. `jid` is `1234@s.whatsapp.net`, `123-456@g.us`, or
`123@newsletter`; pass `{ quoted: msg }` in the third argument to reply.

## Sending message types

### Text, edits, reactions

```js
await sock.sendMessage(jid, { text: 'hello' });
await sock.sendMessage(jid, { text: 'with link preview', linkPreview: undefined }); // undefined = auto
await sock.sendMessage(jid, { edit: sent.key, text: 'fixed typo' });
await sock.sendMessage(jid, { react: { text: '👍', key: sent.key } });  // '' removes it
await sock.sendMessage(jid, { delete: sent.key });
await sock.sendMessage(jid, { forward: msg, force: true });
```

### Media

```js
await sock.sendMessage(jid, { image: { url: './art.jpg' }, caption: '*caption*' });
await sock.sendMessage(jid, { video: { url: './clip.mp4' }, caption: 'clip', gifPlayback: true });
await sock.sendMessage(jid, { audio: { url: './voice.ogg' }, mimetype: 'audio/ogg; codecs=opus', ptt: true });
await sock.sendMessage(jid, { document: { url: './file.pdf' }, fileName: 'file.pdf', mimetype: 'application/pdf' });
await sock.sendMessage(jid, { sticker: { url: './st.webp' } });
await sock.sendMessage(jid, { image: { url: './a.jpg' }, viewOnce: true });
await sock.sendMessage(jid, { album: [{ image: { url: './1.jpg' } }, { image: { url: './2.jpg' } }] }); // 2+ items
```

### Buttons and lists

```js
// legacy buttons (buttonsMessage)
await sock.sendMessage(jid, {
  text: 'Pick one', footer: 'footer',
  buttons: [{ id: 'yes', text: 'Yes' }, { url: 'https://example.com', text: 'Site' }]
});

// list message
await sock.sendMessage(jid, {
  text: 'Choose', buttonText: 'Open list',
  sections: [{ title: 'Group', rows: [{ title: 'Row', description: 'desc', id: 'r1' }] }]
});

// hydrated template buttons
await sock.sendMessage(jid, { text: 'Template', templateButtons: [{ url: 'https://example.com', text: 'Go' }] });
```

### Native flow buttons — `nativeFlow`

The modern button format. Give each button a sugar key and the fork builds `name` +
`buttonParamsJson` for you; a literal `{ name, paramsJson }` pair passes through untouched.

```js
await sock.sendMessage(jid, {
  text: 'NEXORA', footer: 'v1.0',
  nativeFlow: [
    { text: 'Open site', url: 'https://example.com' },
    { text: 'Copy code', copy: 'NEXORA-2026' },
    { text: 'Call', call: '+233533416608' },
    { text: 'Menu', sections: [{ title: 'Menu', rows: [{ title: 'Ping', id: 'ping' }] }] }
  ]
});
```

| Sugar key | CTA sent | Notes |
| --- | --- | --- |
| `id` | `quick_reply` | plain reply button |
| `url` | `cta_url` | adds `merchant_url`, `landing_page_url` |
| `copy` | `cta_copy` | `copy_code` |
| `call` | `cta_call` | `phone_number` |
| `sections` | `single_select` | opens a picker |
| `flow` | `flow` | `{ id, token, action, payload }` — needs a real Meta Flow |
| `galaxyBar` | `galaxy_message` | Flows-branded bar, no flow behind it (see below) |
| `location` / `phone` | `cta_request_location` / `cta_request_phone` | asks the user |
| `sendLocation` | `send_location` | |
| `subscribe` / `address` / `openChat` | `cta_subscribe` / `address_message` / `cta_open_chat` | |
| `reminder` / `cancelReminder` | `cta_reminder` / `cta_cancel_reminder` | |
| `signIn` / `signUp` / `signContract` | `cta_sign_in` / `cta_sign_up` / `cta_sign_contract` | |
| `payment` / `completePayment` / `reviewAndPay` / `paymentVerification` | `cta_payment` / `cta_complete_payment` / `cta_review_and_pay` / `cta_payment_verification` | |
| `schedule` / `copyAddress` / `amazonLink` / `deleteMessage` / `targetCta` | `cta_schedule` / `cta_copy_address` / `cta_amazon_link` / `cta_delete_message` / `target` | |
| `{ name, paramsJson }` | your own | raw passthrough, never gated |

Verified CTAs are `quick_reply`, `cta_copy`, `cta_url`, `cta_call`, `single_select`,
`cta_request_location`, `cta_request_phone`, `send_location`, `flow`, `cta_reminder`,
`cta_cancel_reminder`, `address_message`, `galaxy_message`. Anything else throws unless you
pass `experimentalCta: true` (message) or `experimental: true` (button). That gate exists
because an unverified CTA can get the whole message rejected.

**The galaxy bar needs company.** A bare `galaxy_message` renders nothing on device. It needs
`limited_time_offer` + `bottom_sheet` in `messageParamsJson`, and the fork attaches both
automatically whenever a `galaxyBar` button is present. Two stub buttons
(`single_select`, `call_permission_request`) ahead of it widen the button budget:

```js
await sock.sendMessage(jid, {
  text: 'Panel', footer: 'tap below',
  nativeFlow: [
    { text: 'Menu', sections: [{ title: 'Menu', rows: [{ title: 'Ping', id: 'ping' }] }] },
    { galaxyBar: { cta: 'Open panel' } },     // flow_id defaults to '.x7'
    { text: 'Channel', url: 'https://whatsapp.com/channel/...' }
  ]
});
```

### A2UI surfaces — `a2ui`

Composes an A2UI v0.9 surface locally and ships it in `InteractiveMessage.bloksWidget`. The
client renders it as native components (columns, cards, images, buttons), so no Meta-hosted
Flow, no WABA, no `flow_id`. Nothing about this path depends on Meta tooling.

```js
import { a2uiColumn, a2uiCard, a2uiText, a2uiDivider, a2uiImage, a2uiUrlButton } from 'baileys';

await sock.sendMessage(jid, {
  a2ui: {
    title: 'NEXORA',
    subtitle: 'A2UI',
    text: 'fallback body for clients that cannot render the widget',
    footer: 'built locally',
    components: [
      a2uiColumn('root', ['banner', 'facts', 'rule', 'open']),
      a2uiImage('banner', 'https://picsum.photos/800/300'),
      a2uiCard('facts', 'facts_inner'),
      a2uiColumn('facts_inner', ['heading', 'rule']),
      a2uiText('heading', 'Quick facts', 'h3'),
      a2uiDivider('rule'),
      a2uiText('label', 'Open the repo'),
      a2uiUrlButton('open', 'label', 'https://github.com/boyde1317-byte/NEXORA-MD')
    ],
    buttons: [{ text: 'Repo', url: 'https://github.com/boyde1317-byte/NEXORA-MD' }],
    viewOnce: false
  }
});
```

Options: `components` (required), `uuid`, `surfaceId`, `catalogId`, `version`, `title`,
`subtitle`, `text`/`caption`, `footer`, `image`/`video` (header media), `buttons` (same sugar
as `nativeFlow`), `contextInfo`, `viewOnce`, `bloksWidget: false` (send the envelope without
the widget, for A/B-ing), `experimentalCta`.

Three rules the device enforces:

1. **Exactly one `root` component.** Validation walks down from it; a duplicate root makes
   children unreachable and the widget dies with `A2UIValidationException`.
2. **Every `child`/`children` entry must exist** in the component array. Use pre-flight
   `validateA2uiComponents(components)` → `{ ok, errors }`.
3. **`Header.bloksWidget` and header media are mutually exclusive** (same oneof). A widget card
   and an image header cannot ride the same message.

Builders and helpers are exported both flat and as a namespace:

```js
import { A2UI, buildA2uiSurface, buildBloksWidget, bloksWidgetSupport } from 'baileys';

A2UI.supported();                 // does the pinned proto carry BloksWidget?
A2UI.surface({ components });     // { version, createSurface: { surfaceId, catalogId, components } }
A2UI.widget(surface);             // proto BloksWidget (undefined instead of throwing)
A2UI.attach(interactiveMessage, surface);
```

Attaching to a hand-built interactive message works too, `bloksWidget` accepts a finished
widget, a surface, or a bare component array:

```js
await sock.sendMessage(jid, {
  text: 'card', nativeFlow: [{ text: 'Open', url: 'https://example.com' }],
  bloksWidget: [{ id: 'root', component: 'Column', children: ['t'] }, { id: 't', component: 'Text', text: 'hi' }]
});
```

### AI rich responses — `richResponse`

Renders the bot-forwarded AI card (markdown, tables, code, LaTeX, images, reels, widgets).
`unifiedResponse.data` is base64 — that is the working convention, not the raw form.

```js
await sock.sendMessage(jid, {
  richResponse: [
    { text: '## Hello' },
    { code: 'const a = 1;', language: 'javascript' },
    { inlineImage: 'https://picsum.photos/600/300' }
  ],
  text: 'fallback text'
});
```

Available submessage keys: `text`, `code`, `items`, `inlineImage`, `inlineVideo`, `gridImage`,
`latex`, `dynamic`, `table`, `links`, `posts`, `products`, `suggested`. The last four only route
to the rich builder when you pass `rich: true`.

For the full shapes use the generators in `lib/Utils/rich-message-utils.js`. They return
`{ message, messageId }`, ready to relay:

```js
import { generateTableContent, generateCodeBlockContent } from 'baileys';

const { message, messageId } = generateTableContent('Sales', ['#', 'Item'], [['1', 'Tea']]);
await sock.relayMessage(jid, message, { messageId });
```

`generate*` are V1 (submessage-based, embeds a base64 `unifiedResponse`); `generate*V2` are the
Meta AI format and take the compact table string form (`[title, 'a|b', '1|Tea;;2|Cake']`).
`captureUnifiedResponse(msg)` + `generateUnifiedResponseContent(quoted, captured)` round-trip an
existing rich message.

### GenAI cards — `genai-utils`

The `richResponse` path above builds the card for you from submessage keys. When you want
the envelope itself — sections, primitives, proof chain, disclaimer — use `genai-utils`. It
returns content you can relay, or relays it for you.

```js
import { sendUnifiedRich, singleSection, markdownText, hScrollSection, productItemCard,
         extWidget, followUpPills } from 'baileys';

await sendUnifiedRich(sock, jid, {
  disclaimer: 'Stats',                                  // small badge on the card
  submessages: [{ messageType: 2, messageText: 'Status' }],
  sections: [
    singleSection(productItemCard({ title: 'Online', brand: 'Bot', price: '42 ms', imageUrl: 'https://picsum.photos/600' })),
    singleSection(markdownText('**up** since 04:12', [{ url: 'https://example.com', title: 'status page' }])),
    hScrollSection([extWidget({ title: 'Actions', ctas: [{ label: 'Menu', toast: 'Menu' }] }), ...followUpPills(['.ping', '.help'])])
  ],
  quoted
});
```

Primitives: `productItemCard`, `markdownText` (with citation chips), `extWidget` (CTA rows,
toast-only taps), `followUpPills`, `imaginePrimitive`, `htmlPrimitive`, `rawPrimitive`.
Layouts: `singleSection`, `hScrollSection`, `layout(name, data)`, `section(view_model)`.

Presets:

```js
import { vipCard, sendVipCard, sendHtmlCard, buildSecretFlowContent } from 'baileys';

await sendVipCard(sock, jid, {           // product banner + text + CTA carousel + link
  title: 'Pro', brand: 'Bot', price: '✅ Active', imageUrl, body: '**thanks** for subscribing'
});

await sendHtmlCard(sock, jid, {          // in-chat HTML document, rendered in the webview
  html: '<html><body><h1>hi</h1></body></html>', title: 'Demo'
});
```

`buildUnifiedRichContent(options)` gives you the content object without sending, and
`buildSecretFlowContent(content)` wraps it in `viewOnceMessage` so the card opens once.

Proof chains: `PROOF_CHAINS.omegatech` (default, 161-byte signature) and
`PROOF_CHAINS.nixcode` (`sendHtmlCard` uses it). Both are harvested from cards that render on
device; random bytes get the card masked instead of rendered. Pass `withProofs: false` to send
none, or `setProofChains({ mine: { signature, certificateChain } })` to supply your own.

### Carousels, products, misc

```js
await sock.sendMessage(jid, {
  text: 'picks',
  cards: [{ title: 'Cup', body: 'glass', footer: 'now', nativeFlow: [{ text: 'Open', url: 'https://example.com' }] }]
});

await sock.sendMessage(jid, { poll: { name: 'Tea or coffee?', values: ['Tea', 'Coffee'], selectableCount: 1 } });
await sock.sendMessage(jid, { event: { name: 'Standup', description: 'daily', startDate: new Date(), extraGuestsAllowed: true } });
await sock.sendMessage(jid, { location: { degreesLatitude: 5.6, degreesLongitude: -0.1 } });
await sock.sendMessage(jid, { contacts: { displayName: 'Ama', contacts: [{ vcard: 'BEGIN:VCARD…' }] } });
await sock.sendMessage(jid, { pin: { type: 1, time: 86400, key: sent.key } });
```

Product and shop cards go through `productHeader` (a product message as the interactive
header), `products`, `catalog`, and `orderText`; see `messages.js` for the field lists.

### Fluent builder — `AiRich`

Chain primitives into one card, then send. Same envelope as `genai-utils`, plus markdown link
extraction, tables and code blocks.

```js
import { AiRich } from 'baileys';

await new AiRich(sock)
  .addProduct({ title: 'Ping', brand: 'Host', price: '42 ms', image_url, icon_url })
  .addText('## Latency\n\n> API : **42 ms** — [status](https://example.com)')
  .addTable([['host', 'ms'], ['api', '42']])
  .addTip('linux x64 · Node 22')
  .addSuggest(['.menu', '.ping'])
  .setFooter('built with baileys')
  .send(jid, { quoted });
```

Also `addCode(code, lang)`, `addImage(url)`, `addVideo('url|5')`, `addCarousel(primitives)`,
`addPrimitive(anyPrimitive)`, `addLayout(name, data)`, `setDisclaimer`, `setContextInfo`, and
`build()` when you want the content object to relay yourself.

### Card images that actually show — `rich-media-utils`

Rich cards reference images by URL and the client has to fetch them, which it often does not
(empty image slot in a perfect card). Two opt-out fixes:

```js
import { rehostRichCardMedia, hoistAfterRelay, extractProtoImageUrls } from 'baileys';

await rehostRichCardMedia(sock, content);              // before relay: move images onto WA's CDN
const message = await generateWAMessageFromContent(jid, content, { userJid: sock.user.id });
await sock.relayMessage(jid, message.message, { messageId: message.key.id });
hoistAfterRelay(sock, jid, message.message);           // after relay: also send them as photos
```

Rehosting is the primary fix (`REHOST_RICH_MEDIA=0` disables). Hoisting is the fallback
(`RICH_MEDIA_HOIST=0` disables) and re-encodes with `sharp` when it is installed. Both are
safe to call on every rich message: no images means no work, and they never throw.

### Device audit kit — `rich-test-kit`

54 callable tests, one per message type this package can build. Each one sends a real message
through the socket you pass in, so wiring an owner command is the whole integration:

```js
import { RICH_TESTS, runRichTest, runAllRichTests } from 'baileys';

await runRichTest(sock, jid, 'vipcard');        // one type, by id
await runAllRichTests(sock, jid, quoted);       // every type, spaced 500 ms apart
RICH_TESTS.map(t => `${t.group}/${t.id}: ${t.label}`);  // the catalogue
```

Groups: V1 and V2 generators, links, reels, location, images, grid/dynamic, LaTeX images, all
the V1/V2 combinations, `galaxy`, `carousel`, `secret`, `html*`, `vipcard`, `blokssurface`,
and the `AiRich` combos (`msping`, `msfb`). Photo/video URLs point at placeholders, and the
HTML tests ship their own inline documents rather than vendored payloads.

Every test encodes offline against a stub socket too, which is how this list stays honest:

```js
// no socket, no phone: prove a type builds
const content = new AiRich(sock).addText('hi').build();
```

## Receiving

```js
sock.ev.on('messages.upsert', async ({ messages, type }) => {
  if (type !== 'notify') return;
  const m = messages[0];
  const msg = m.message?.viewOnceMessageV2?.message
    ?? m.message?.ephemeralMessage?.message
    ?? m.message?.documentWithCaptionMessage?.message
    ?? m.message;                                   // unwrap containers first

  const text = msg?.conversation ?? msg?.extendedTextMessage?.text;
  const flow = msg?.interactiveResponseMessage?.nativeFlowResponseMessage;  // list/flow/galaxy answers
  const reply = msg?.buttonsResponseMessage?.selectedButtonId;
  console.log({ text, reply, flow: flow && JSON.parse(flow.paramsJson || '{}') });
});
```

`normalizeMessageContent()` from the package does the same unwrapping.

## Things that cost time

- `unifiedResponse.data` must be **base64**. The raw form renders blank cards.
- Random bytes in `verificationMetadata` get the AI card masked; a harvested proof chain
  renders. Do not "clean up" a working chain.
- Never pass `quoted` into a relayed rich message twice — the generators already embed
  `contextInfo`, and a duplicate at the wrong level makes WhatsApp drop native rendering.
- A header image given as a URL can silently fail to load on the client. Upload it to the WA
  CDN first (`sock.waUploadToServer`) and use the returned path.
- `proto.Message.InteractiveMessage.BloksWidget` exists in this fork (field 8; `Header` field
  10). `bloksWidgetSupport()` answers it at runtime, and `buildBloksWidget()` warns instead of
  skipping quietly, so a missing widget never masquerades as a render bug.
- This repo ships compiled `lib/` only, no TypeScript source. Hand-edit the `.js` and the
  matching `.d.ts` together.

## Module format and credits

ESM only (`"type": "module"`), Node >= 20. Peer dependencies (`sharp`/`jimp`, `link-preview-js`,
`audio-decode`, `better-sqlite3`, `mathjax-node`) are optional and only needed by the features
that use them.

Fork of [WhiskeySockets/Baileys](https://github.com/WhiskeySockets/Baileys). The rich message
layer builds on work by Lia (elaiana), whose note in `lib/Utils/rich-message-utils.js` must be
kept. The GenAI envelope follows cards harvested from the Omegatech and Moongod/Paxley bots;
the audit kit comes from the NEXORA-MD harness. The NIXCODE `AIRich` chain is not vendored
here — `ai-rich-builder.js` re-implements the same wire shape, because that library's licence
forbids standalone redistribution. MIT licensed.
