# v0.3.18-r4 Device Test Checklist

Run these on a **real device** before calling r4 proven. Order matters — test in this priority.

> The live behaviour of every item changed in commit `682c667`. If something
> rendered before r4 but not after, the change is suspect — report it.

---

## 1. V1 base64 encoding (highest risk)

`prepareRichResponseMessage` now base64-encodes `unifiedResponse.data` in the
V1 path too (previously a raw JSON buffer). Send one of each V1 type and
confirm the bubble **renders instead of showing blank**:

- [ ] `table`
- [ ] `code`
- [ ] `latex`
- [ ] `links`
- [ ] `inlineImage`
- [ ] `gridImage`
- [ ] `dynamic`
- [ ] `map`
- [ ] V2 spot-checks: `generateTableContentV2`, `generateReelContentV2`

## 1b. The proven Moonson combo (facebook.js card)

- [ ] `gridImage` + `inlineVideo` + `text` + `tip` + `footerText` + `quoted`
      in one message — image gallery, tappable video, markdown, small hint
      line under the content, footer, reply preview

## 1c. NIXCODE-parity extras

- [ ] `sources` entry → sources strip renders (favicon + name, tappable)
- [ ] `suggested` entry → tappable follow-up **pills**, not a plain text list
- [ ] `cancelReminder` button → renders as a Cancel Reminder CTA

## 1d. primitiveStyle A/B (nixcode vs default)

Send the same card twice — once with `primitiveStyle: 'nixcode'`, once
without — and compare on the same device:

- [ ] `gridImage` (nixcode): each image renders from its own
      `GenAIImaginePrimitive` section
- [ ] `inlineVideo` (nixcode): video plays inline via the ANIMATE section
      (pass `duration`)
- [ ] `products` (nixcode): product card with brand/price
- [ ] `posts` (nixcode): post card with username/likes/comments
- [ ] Whichever style renders best on device becomes the default before
      the next tag

## 2. Quoted / reply support

- [ ] Send a rich message with `quoted` set to a real message
- [ ] Reply preview shows above the rich bubble
- [ ] Tapping the preview scrolls to the quoted message

## 3. Routing change (BREAKING — audit your commands)

- [ ] `{ items: ... }` alone → now throws `Invalid media type` (expected)
- [ ] Any command sending bare `items` / `posts` / `products` / `suggested`
      must add `rich: true`
- [ ] Same content with `rich: true` → renders correctly

## 4. Buttons

- [ ] Known CTAs (`quick_reply`, `cta_url`, `cta_copy`, `cta_call`,
      `single_select`) render, are tappable, and responses carry the right `id`
- [ ] `cta_subscribe` **without** opt-in → throws the 400 "experimental" error
      (that is success — gating works)
- [ ] `cta_subscribe` **with** `experimentalCta: true` → sends; check on
      device whether it renders a live button or a dead one. If dead, remove
      it from the command list (or keep it opt-in only)
- [ ] Legacy `{ buttons: [{ id }] }` → still renders as a classic quick reply,
      not native flow

## 5. Small fixes to eyeball

- [ ] Ragged table row — `{ table: [['a','b','c'],['1','2']] }` → short row
      padded, no broken cells
- [ ] `links` with no `title`/`displayName` → citations empty; **no**
      "Saweria" / "Donation" text anywhere
- [ ] `{ code: 'x = 1' }` with no `language` → renders as JavaScript, no crash
- [ ] `sendGroupStatus` with an image → `statusSourceType` actually set
      (was checked at the wrong nesting level and never matched before r4)

## 6. Consumption side

If NEXORA-MD reads rich messages (e.g. `captureUnifiedResponse`):

- [ ] Incoming Meta AI messages still decode. The data is bytes of a base64
      string — decode is `bytes → utf8 string → base64-decode → JSON` (see
      the fixed example in `README.md` → *Consuming Rich Messages*)

---

Checked by: ____________________  Date: __________  Device: __________

---

# Device Audit — 2026-09-12 (.testrich all, fork r4, real device)

## Rendered natively ✅
Table generators (V1+V2), code blocks (JS/Python/Go, V1+V2), list generators,
table metadata parser, tokenizer tests, link content + citations, search
citations, suggestion pills, code+table combos, map+table tables,
text-only cards, V1 raw submessage assembly. **Tables render from submessage
metadata alone** (no unifiedResponse needed).

## Broken ❌ → fixed in commit 5d754de
Every media type painted as an empty gray box (tap → nothing): inline images,
grid galleries, multi-image stacks, text+image combos, GIFs, reels,
inline video, maps. Both V1 and V2.

**Root causes:** (1) V1 generators never embedded `unifiedResponse.data`
— clients require view models for media (and `captureUnifiedResponse`
returned null on generator-built messages). (2) V2 embedded only
liaaa-family UX primitives (`GenAIImageUX`, `GenAIGridImageUX`,
`GenAIContentItemsUX`, `GenAIDynamicUX`) — none render from bots. The
device-proven shape is NIXCODE/Moonson's `GenAIImaginePrimitive`, now
reachable via `primitiveStyle: 'nixcode'` in all V1 and V2 generators.

## Experimental ⚠️
- **Maps** — no proven primitive exists (Moonson/NIXCODE ship no map card).
  Renders caption-only. Test kit labels these EXPERIMENTAL.
- **LaTeX→PNG** — needs `mathjax-node` installed; otherwise falls back to
  the instructional text message (by design).

## Re-test after 5d754de (before tagging r5)
- [ ] `.testrich all` — inline image + table (V1 label), inline image
      preview + stats table (V2): images actually paint
- [ ] V1 Grid Image gallery + thumbnails
- [ ] V1/V2 Multi-Image Gallery
- [ ] V1/V2 Text+Image Combo
- [ ] V1/V2 Grid+Table Combo — image above the table
- [ ] V1/V2 Dynamic (GIF) — animates
- [ ] V1/V2 Dynamic+Table Combo
- [ ] Reel Content carousel + Reel+Stats (video thumbnails paint)
- [ ] Inline Video + Stats (V1 label) / Inline Video+Table (V2)
- [ ] Capture & Relay round-trip — now finds unifiedResponse.data
- [ ] Regression: V1/V2 tables, code, links, LaTeX text-mode still render
