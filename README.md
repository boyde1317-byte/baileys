# baileys

Personal Baileys fork — `@whiskeysockets/baileys` v7.0.0-rc13 TypeScript source with extended message types and community additions ported from [kiuur/baileys](https://github.com/kiuur/baileys).

Used as the engine for [NEXORA-MD](https://github.com/boyde1317-byte/NEXORA-MD).

---

## Install (in your bot)

```json
"dependencies": {
  "baileys": "github:boyde1317-byte/baileys"
}
```

```bash
npm install
# or
pnpm install
```

---

## Extended Functions

These are additions on top of upstream Baileys that this fork provides.

### Check Channel ID

Resolve a WhatsApp Channel invite URL to its display name and JID.

```javascript
const info = await sock.newsletterId('https://whatsapp.com/channel/abc123...')
// { name: 'My Channel', id: '120363..@newsletter' }
```

### Check WhatsApp / Banned Number

Check if a phone number is on WhatsApp and whether it has been banned.

```javascript
const result = await sock.checkWhatsApp('6281234567890')
// {
//   number: '+6281234567890',
//   isBanned: false,
//   isNeedOfficialWa: false,
//   data: undefined
// }
// NOTE: This is a ban-detection probe — it does NOT confirm whether the number
// is registered on WhatsApp. It opens a pairing-code probe and reads ban error
// shapes from the server response. There is no `onWhatsApp` field.

// Banned number example:
// { isBanned: true, isNeedOfficialWa: false, number: '+628...', data: { appeal_token: '...', violation_type: '...' } }

// Number blocked from unofficial clients:
// { isBanned: false, isNeedOfficialWa: true, number: '+628...', data: undefined }
```

---

## Extended `sendMessage` Types

These custom content types are intercepted before the normal Baileys flow.

### Album Message (multiple images / videos)

Send multiple images or videos as a single grouped album.

```javascript
await sock.sendMessage(jid, {
  albumMessage: [
    { image: buffer, caption: 'First photo' },
    { image: { url: 'https://...' }, caption: 'Second photo' },
    { video: buffer, caption: 'A clip' },
  ]
}, { quoted: m })
```

### Event Message

Send a WhatsApp event invitation card.

```javascript
await sock.sendMessage(jid, {
  eventMessage: {
    name: 'Team Meetup',
    description: 'Quarterly all-hands',
    location: {
      degreesLatitude: -6.2,
      degreesLongitude: 106.8,
      name: 'Jakarta'
    },
    joinLink: 'https://call.whatsapp.com/video/abc',
    startTime: '1763019000',   // unix timestamp as string or number
    endTime: '1763026200',
    isCanceled: false,
    extraGuestsAllowed: false
  }
}, { quoted: m })
```

### Group Status Message (Group Story)

Post a story/status inside a group via `groupStatusMessageV2`.

```javascript
// Text
await sock.sendMessage(jid, {
  groupStatusMessage: { text: 'Hello group!' }
})

// Image
await sock.sendMessage(jid, {
  groupStatusMessage: { image: buffer, caption: 'Morning!' }
})

// Raw proto message
await sock.sendMessage(jid, {
  groupStatusMessage: { message: protoMessage }
})
```

### Poll Result Message

Display poll results with vote counts.

```javascript
await sock.sendMessage(jid, {
  pollResultMessage: {
    name: 'Favourite colour',
    pollVotes: [
      { optionName: 'Blue',  optionVoteCount: '42' },
      { optionName: 'Red',   optionVoteCount: '7'  },
    ]
  }
}, { quoted: m })
```

### Request Payment Message

Send a payment request with an optional background and note/sticker.

```javascript
await sock.sendMessage(jid, {
  requestPaymentMessage: {
    currency: 'IDR',
    amount: 10_000_000,       // amount × 1000
    from: m.sender,
    note: 'Invoice #001',     // or pass sticker: proto.IMessage
    background: {
      id: '100',
      placeholderArgb: 0xFF00FFFF,
      textArgb: 0xFFFFFFFF,
      subtextArgb: 0xFFAA00FF,
    },
    expiry: 0,
  }
}, { quoted: m })
```

### Interactive Message (NativeFlow / Buttons)

Send an interactive message with nativeFlow buttons and an optional media header.

```javascript
// Quick-reply buttons
await sock.sendMessage(jid, {
  interactiveMessage: {
    title: 'Pick an option',
    body: 'Choose carefully',
    footer: 'Powered by NEXORA',
    buttons: [
      { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: 'Yes ✅', id: 'yes' }) },
      { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: 'No ❌',  id: 'no'  }) },
    ],
  }
})

// URL button with image header
await sock.sendMessage(jid, {
  interactiveMessage: {
    title: 'Check this out',
    image: { url: 'https://...' },
    buttons: [
      { name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: 'Open link', url: 'https://...' }) },
    ],
  }
})

// Copy code button
await sock.sendMessage(jid, {
  interactiveMessage: {
    title: 'Your OTP',
    body: 'Tap to copy',
    buttons: [
      { name: 'cta_copy', buttonParamsJson: JSON.stringify({ display_text: 'Copy code', copy_code: '123456' }) },
    ],
  }
})
```

**Supported button `name` values:**
| name | description |
|------|-------------|
| `quick_reply` | Tap-to-reply with hidden ID |
| `cta_url` | Open a URL |
| `cta_copy` | Copy text to clipboard |
| `cta_call` | Call a phone number |
| `address_message` | Request user's address |
| `send_location` | Request user's location |

### Product Card

Send a product card wrapped in `viewOnceMessage`.

```javascript
await sock.sendMessage(jid, {
  productMessage: {
    title: 'Sneakers X1',
    description: 'Limited edition drop',
    thumbnail: buffer,          // Buffer or { url: '...' }
    productId: 'sku-001',
    retailerId: 'store-001',
    priceAmount1000: 250_000,   // price × 1000
    currencyCode: 'IDR',
    url: 'https://store.example.com/product/sku-001',
    buttons: [
      { name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: 'Buy now', url: 'https://...' }) },
    ],
  }
})
```

---

## Build

```bash
pnpm build     # compiles TypeScript → dist/ via tsup
pnpm typecheck # type-check without emit
```

---

## Credits

- [WhiskeySockets/Baileys](https://github.com/WhiskeySockets/Baileys) — upstream v7 TypeScript source
- [kiuur/baileys](https://github.com/kiuur/baileys) — extended message type reference implementations
