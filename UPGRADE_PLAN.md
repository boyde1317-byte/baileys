# Baileys Fork — Update & Upgrade Plan

**Author:** Kestrel (AI agent audit)  
**Date:** 2026-08-14  
**Fork:** boyde1317-byte/baileys @ `0.3.18-rc14-sync`  
**Base:** itsliaaa/Baileys @ 0.3.18-final ← WhiskeySockets/Baileys v7.0.0-rc13/14  
**Commits:** 60 (started 2026-07-06)

---

## 1. Current State Assessment

### What's Working Well ✅

- **Upstream parity**: Fork is synced with WhiskeySockets rc14. Only missing fix (Long type import) was applied in this audit.
- **WA Web version**: `[2, 3000, 1044479778]` — ahead of upstream's `1043857760`.
- **Security**: CVE-2026-48063 (CVSS 9.3, GHSA-qvv5-jq5g-4cgg) is **patched** via the `SELF_ONLY_TYPES` guard in `process-message.js` (lines 280–310). This is actually more comprehensive than upstream's fix — includes documentation, references whatsmeow's architecture, and covers all four self-only protocol message types.
- **Rich message system**: 57 exports across 3,091 lines. Comprehensive V1+V2 generator coverage for all 10 submessage types, combination generators, native flow buttons, and LaTeX rendering.
- **Android browser support**: Already present (`Browsers.android()`, platform detection in `validate-connection.js`).
- **TC token nesting**: Profile picture query fix already present.
- **Security resolutions**: Extensive `resolutions` block in package.json pinning transitive deps for known vuln paths.
- **npm audit**: 0 vulnerabilities found.

### Issues Found ⚠️

| # | Issue | Severity | Effort |
|---|-------|----------|--------|
| 1 | Zero test files — no unit/integration tests at all | High | Medium |
| 2 | 115 TODO/FIXME markers, 13 about LID/PN mapping | Medium | High |
| 3 | `@adiwajshing/keyed-db` (archived) still a dependency | Medium | Low |
| 4 | `rich-message-utils.js` is 3,091 lines in one file | Medium | Medium |
| 5 | No CI/CD pipeline (only stale issue closer) | Medium | Low |
| 6 | `mathjax-node` peer dep is archived (last publish 2022) | Low | Medium |
| 7 | `@hapi/boom` v9 — v10 available with breaking changes | Low | Low |
| 8 | `protobufjs` v7 — v8 available | Low | Low |
| 9 | `link-preview-js` v3 — v4 available | Low | Low |
| 10 | `pino` v9 — v10 available | Low | Low |
| 11 | `@cacheable/node-cache` v1 — v3 available (major) | Low | Medium |
| 12 | No `prepare` script — consumers must `npm install` then `tsc` manually | Low | Low |
| 13 | Package description doesn't mention rich message features | Trivial | Trivial |

---

## 2. Upgrade Plan

### Phase 1: Security Hardening (Priority: Critical)

**Status: Already Done ✅**

The fork already contains the fix for CVE-2026-48063. The `SELF_ONLY_TYPES` set in `lib/Utils/process-message.js` drops any `HISTORY_SYNC_NOTIFICATION`, `APP_STATE_SYNC_KEY_SHARE`, `LID_MIGRATION_MAPPING_SYNC`, or `PEER_DATA_OPERATION_REQUEST_RESPONSE_MESSAGE` that arrives with `!message.key.fromMe`. This blocks all three attack vectors from the advisory:
- Placeholder resend spoofing → blocked (PDO response must be fromMe)
- App state sync corruption → blocked (key share must be fromMe)
- History sync spoofing → blocked (history notification must be fromMe)

**Recommendation going forward:**
- Add a `SECURITY.md` file documenting the advisory and the fix location
- Subscribe to GitHub Security Advisories for the upstream WhiskeySockets/Baileys repo
- Add `npm audit` to CI (when CI is set up in Phase 3)

---

### Phase 2: Dependency Modernization (Priority: High)

#### 2.1 Replace `@adiwajshing/keyed-db` (archived)

This package is used only in `lib/Store/make-in-memory-store.js` (line 6, single import). It's archived on npm with no maintainer.

**Options:**
- **A (recommended):** Inline a minimal keyed DB implementation. The store only needs `insert`, `update`, `get`, `fetchAll`, `remove`, `getByRange`, `sortBy`. A simple `Map`-backed implementation would be ~100 lines and removes an external dep entirely.
- **B:** Fork `@adiwajshing/keyed-db` into the repo as `lib/Utils/keyed-db.js` and maintain it locally.
- **C:** Replace with `@whiskeysockets/keyed-db` if one exists (check npm).

#### 2.2 Bump safe minor/patch deps

These are low-risk bumps that should be done together:

| Package | Current | Target | Breaking? | Notes |
|---------|---------|--------|-----------|-------|
| `@hapi/boom` | ^9.1.3 | ^10.0.1 | Yes (ESM-only) | Already ESM-only, should be clean |
| `protobufjs` | ^7.5.6 | ^8.7.2 | Minor API changes | Check `minimal.js` import path |
| `pino` | ^9.6.0 | ^10.3.1 | Yes (logger API) | Test logger usage in `lib/Utils/logger.js` |
| `link-preview-js` | ^3.0.0 | ^4.0.4 | Yes (API rewrite) | Only used in `link-preview.js`, small surface |
| `@cacheable/node-cache` | ^1.4.0 | ^3.0.1 | Major | Used in cache layers, needs testing |
| `better-sqlite3` | ^11.0.0 | ^12.11.1 | Major | Optional peer dep, only affects SQLite auth |
| `audio-decode` | ^2.2.3 | ^3.12.0 | Major | Optional peer dep, only audio messages |
| `mathjax-node` | ^0.5.1 | ^2.1.1 | Major | Archived; see 2.3 below |

**Strategy:** Bump one at a time, verify the build, commit. Start with `@hapi/boom` (most impactful, smallest surface).

#### 2.3 Replace `mathjax-node` (archived)

`mathjax-node` hasn't been published since 2022 and is unmaintained. It's used only in `lib/Utils/rich-message-utils.js` (line 905) for the `defaultRenderLatexToPng` function.

**Options:**
- **A (recommended):** Switch to `mathjax-full` (actively maintained, same upstream project) and adapt the rendering code. The API is different but the math is the same.
- **B:** Switch to `katex` (lighter, server-side rendering via `katex.renderToString` + `puppeteer` screenshot). More deps but more reliable.
- **C:** Make LaTeX rendering fully pluggable — remove the default renderer entirely and require consumers to pass `renderLatexToPng`. Document the expected interface. This removes a dep entirely and pushes the choice downstream.

Option C is cleanest for the fork since it's a personal/NEXORA-MD fork — the consumer can pick their renderer.

---

### Phase 3: Test Infrastructure (Priority: High)

Currently: **zero test files**. This is the biggest risk to the fork's maintainability.

#### 3.1 Set up Vitest

**Why Vitest over Jest:** ESM-native (no `--experimental-vm-modules` hacks), works with `"type": "module"`, fast, zero-config for TypeScript.

```bash
npm install -D vitest
```

Add to `package.json`:
```json
"scripts": {
  "preinstall": "node ./engine-requirements.js",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

#### 3.2 Test priority files (by risk × churn)

| Priority | File | Lines | Why |
|----------|------|-------|-----|
| 1 | `lib/Utils/rich-message-utils.js` | 3,091 | Largest custom code, most likely to break |
| 2 | `lib/Utils/process-message.js` | 748 | Security-critical (SELF_ONLY_TYPES guard) |
| 3 | `lib/Utils/generics.js` | 398 | Core utilities used everywhere |
| 4 | `lib/Utils/decode-wa-message.js` | 316 | Message decoding correctness |
| 5 | `lib/Socket/messages-recv.js` | 1,770 | Largest socket file, message routing |
| 6 | `lib/Utils/messages-media.js` | 840 | Media handling, binary processing |

#### 3.3 Suggested test structure

```
tests/
├── utils/
│   ├── rich-message-utils.test.ts    # Test each generator produces valid proto
│   ├── generics.test.ts              # Test toNumber, delay, etc.
│   └── decode-wa-message.test.ts
├── socket/
│   └── messages-recv.test.ts          # Mock node trees, test routing
└── security/
    └── self-only-types.test.ts        # Test CVE-2026-48063 spoofing is blocked
```

**First test to write:** `self-only-types.test.ts` — verify that a `PEER_DATA_OPERATION_REQUEST_RESPONSE_MESSAGE` with `fromMe: false` is dropped. This locks in the security fix as a regression test.

---

### Phase 4: Code Organization (Priority: Medium)

#### 4.1 Split `rich-message-utils.js`

3,091 lines and 57 exports in one file is unmaintainable. Split by concern:

```
lib/Utils/rich/
├── index.js                    # Re-exports everything (backward compat)
├── tokenizers.js                # tokenizeCode, tokenizeCodeV2
├── context-info.js              # buildRichContextInfo, buildV2ContextInfo
├── v1-generators.js             # All generate*Content (V1) functions
├── v2-generators.js             # All generate*ContentV2 functions
├── combinations.js              # generateCodeWithTable, generateMapWithTable, etc.
├── builders.js                  # prepareRichResponseMessage, buildV2Content, buildBotForwardedMessage
├── latex.js                     # defaultRenderLatexToPng, LaTeX generators
├── metadata.js                  # captureUnifiedResponse, toTableMetadataV2, etc.
└── constants.js                 # EXTENDED_LANGUAGE_KEYWORDS, bot metadata helpers
```

`lib/Utils/index.js` already exports from `rich-message-utils.js` — change to `export * from './rich/index.js'` and all consumers are unaffected.

#### 4.2 Extract `rich-message-utils` as a separate optional package

If NEXORA-MD is the only consumer, this is overkill. But if you ever want to share the rich message system with other bots:

```
packages/
├── baileys/                     # Core library (as-is minus rich messages)
└── baileys-rich-messages/       # Rich message system as standalone
```

This would let other bots use the rich message generators without pulling in the full WhatsApp socket library. Monorepo with `pnpm` workspaces.

**Recommendation:** Don't do this yet. Split into `lib/Utils/rich/` first (4.1). Extract as a package only if you have a second consumer.

---

### Phase 5: LID/PN Mapping Resolution (Priority: Medium)

13 TODOs about LID/PN mapping are scattered across:
- `lib/Socket/messages-recv.js` (6 TODOs)
- `lib/Socket/messages-send.js` (4 TODOs)
- `lib/Socket/groups.js` (2 TODOs)
- `lib/Socket/communities.js` (2 TODOs)

The signal repository already has a `lidMapping` interface (`storeLIDPNMappings`, used in history sync processing at `process-message.js:329`). The TODOs are about **using** this mapping at the right points, not about the storage.

**Plan:**
1. Audit each TODO and classify: "blocker for LID groups" vs "cosmetic improvement"
2. The critical path is `messages-send.js:205` (`LID MAP this stuff`) — this affects sending to LID-addressed groups
3. Implement a `resolveLidToPn(lid)` helper that queries `signalRepository.lidMapping`
4. Wire it into the sender key resolution path and group participant resolution
5. Add tests that send to LID-addressed groups with and without mapping data

---

### Phase 6: CI/CD Pipeline (Priority: Medium)

#### 6.1 GitHub Actions: Build + Test

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [20, 22]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
      - run: npm ci
      - run: npm test
      - run: npm audit --audit-level=high
```

#### 6.2 GitHub Actions: WA Version Bump (Automated)

The WA Web version (`[2, 3000, 1044479778]` in `lib/Defaults/index.js`) goes stale and causes "outdated client" disconnects. Automate the bump:

- **Cron workflow** that scrapes `https://web.whatsapp.com` to extract the current version from the JS bundle
- Compares against the version in `lib/Defaults/index.js`
- If newer, opens a PR with the updated version
- This eliminates manual version tracking and reduces protocol-mismatch disconnects

Alternative: use the `whatsapp-web.js` community's version endpoint if one exists.

---

### Phase 7: Developer Experience (Priority: Low)

#### 7.1 Add `prepare` script

Consumers currently have to manually compile. Add:

```json
"scripts": {
  "preinstall": "node ./engine-requirements.js",
  "prepare": "tsc",
  "test": "vitest run"
}
```

This auto-compiles on `npm install` from git.

#### 7.2 TypeScript strict mode

The `.d.ts` files are generated, but enabling `strict: true` in a `tsconfig.json` would catch type errors at the source level. This is a bigger lift since the source is compiled JS (not TS source), so it only helps if you have TS source somewhere.

#### 7.3 Update package description

Current: `"Enhanced Baileys v7 with fixes for newsletter media uploads, plus support for interactive messages, albums, and additional message types."`

Suggested: `"Enhanced Baileys v7 fork for NEXORA-MD — WhatsApp multi-device library with rich Meta AI message types (tables, code blocks, maps, reels, LaTeX), native flow buttons, and protocol-level fixes."`

---

## 3. Implementation Order

| Step | Phase | Est. Effort | Dependency |
|------|-------|-------------|------------|
| 1 | Add `SECURITY.md` | 30 min | None |
| 2 | Write security regression test | 1 hour | Phase 3 setup |
| 3 | Set up Vitest + first test | 2 hours | None |
| 4 | Replace `@adiwajshing/keyed-db` | 2 hours | None |
| 5 | Split `rich-message-utils.js` | 4 hours | None |
| 6 | CI pipeline (build + test) | 1 hour | Step 3 |
| 7 | Bump `@hapi/boom` → v10 | 1 hour | None |
| 8 | Make LaTeX pluggable (remove mathjax-node default) | 2 hours | None |
| 9 | Bump remaining deps | 3 hours | Step 7 |
| 10 | LID/PN mapping implementation | 8 hours | Phase 5 analysis |
| 11 | WA version auto-bump workflow | 4 hours | Step 6 |
| 12 | Add tests for rich-message-utils | 4 hours | Step 3, 5 |

**Total estimated effort: ~28 hours of focused work.**

---

## 4. What NOT to Do

- **Don't merge upstream's `libsignal` migration.** Upstream is planning to move away from `libsignal` to their own Rust-based equivalent due to GPLv3 licensing concerns. Your fork is MIT-licensed. Wait for upstream to ship this migration before following — it's a large change with crypto implications.

- **Don't upgrade to `protobufjs` v8 without testing WAProto generation.** The `WAProto/index.js` file (115,856 lines) is generated by protobufjs. A major version bump could change the generated output format. Test by regenerating and diffing.

- **Don't extract rich messages as a separate package yet.** Only NEXORA-MD uses this fork. Splitting into `lib/Utils/rich/` directory is sufficient. Package extraction adds monorepo overhead with no benefit until there's a second consumer.

- **Don't touch the `resolutions` block in package.json without full `npm install` testing.** Those pins exist to fix specific transitive dependency vulnerabilities. Removing or loosening them could reintroduce security holes.

---

## 5. Security Audit Summary

| CVE/Advisory | CVSS | Patched? | Fix Location |
|--------------|------|----------|--------------|
| CVE-2026-48063 (GHSA-qvv5-jq5g-4cgg) | 9.3 Critical | ✅ Yes | `lib/Utils/process-message.js:294-308` — `SELF_ONLY_TYPES` guard drops non-self protocol messages |
| npm audit (transitive) | — | ✅ Yes | `package.json` `resolutions` block pins all known vulnerable transitive deps |

No unpatched security issues found.
