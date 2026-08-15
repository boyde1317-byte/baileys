# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in this fork, please **do not** open a public issue. Instead, open a private security advisory on GitHub:

1. Go to the **Security** tab of this repository
2. Click **Advisories** → **New draft security advisory**
3. Include a description, reproduction steps, and impact assessment

You can also email security concerns to the fork maintainer directly.

## Known Vulnerabilities & Fixes

### CVE-2026-48063 (GHSA-qvv5-jq5g-4cgg)

- **CVSS:** 9.3 (Critical)
- **Affected:** All Baileys forks prior to this patch
- **Status:** ✅ Patched

**Description:** WhatsApp protocol messages of type `HISTORY_SYNC_NOTIFICATION`, `APP_STATE_SYNC_KEY_SHARE`, `LID_MIGRATION_MAPPING_SYNC`, and `PEER_DATA_OPERATION_REQUEST_RESPONSE_MESSAGE` were processed regardless of sender identity. A malicious contact could spoof these messages to:
- Trigger fake history sync (injecting fabricated messages)
- Corrupt app state sync keys
- Hijack LID migration mappings
- Abuse placeholder resend to inject arbitrary content

**Fix Location:** `lib/Utils/process-message.js` — the `SELF_ONLY_TYPES` guard (lines ~280–310) drops any of the four protocol message types when `message.key.fromMe` is `false`. This ensures only the user's own device can send these critical protocol messages.

**Verification:** Run `npm test` — the security regression test suite (`tests/security/self-only-types.test.js`) verifies that spoofed protocol messages are dropped.

## Supply Chain Security

- `npm audit` is run in CI on every push and PR
- Transitive dependency versions are pinned in `package.json` `resolutions` block to prevent known vulnerable packages from being installed
- No runtime dependencies on archived packages (`@adiwajshing/keyed-db` replaced with local implementation)

## Security Best Practices for Consumers

1. **Always validate `fromMe`** on protocol messages before acting on them
2. **Never disable** the `SELF_ONLY_TYPES` guard
3. **Keep the WA version current** — stale versions increase the risk of protocol-mismatch issues. Use `npm run version:check` to verify, or enable the auto-bump workflow
4. **Use signed sessions** — never store auth credentials in plaintext without encryption
5. **Rate-limit outbound messages** — WhatsApp may ban accounts that send messages too quickly
