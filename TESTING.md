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
