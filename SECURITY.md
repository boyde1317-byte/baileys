# Security

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.3.18-rc14-sync | ✅ |
| < 0.3.18-rc14-sync | ❌ |

## Known Advisories

### CVE-2026-48063 / GHSA-qvv5-jq5g-4cgg (Critical, CVSS 9.3)

**Affected:** All versions based on WhiskeySockets/Baileys < 7.0.0-rc12

**Impact:** Any baileys session can be sent a malicious `protocolMessage` payload via `placeholderResendMessage` to:
- Trigger fake `messages.upsert` events with spoofed message keys
- Corrupt the app state sync system with fake key shares
- Inject fake history sync / on-demand sync data

**Fix Location:** `lib/Utils/process-message.js` — the `SELF_ONLY_TYPES` guard (lines ~294–308) drops any `HISTORY_SYNC_NOTIFICATION`, `APP_STATE_SYNC_KEY_SHARE`, `LID_MIGRATION_MAPPING_SYNC`, or `PEER_DATA_OPERATION_REQUEST_RESPONSE_MESSAGE` that arrives with `!message.key.fromMe`.

**Reference:** https://github.com/WhiskeySockets/Baileys/security/advisories/GHSA-qvv5-jq5g-4cgg

**Status:** ✅ Patched in this fork.

## Reporting a Vulnerability

If you discover a security issue in this fork, please do NOT open a public issue. Contact the fork maintainer directly.

For upstream Baileys vulnerabilities, report to: https://github.com/WhiskeySockets/Baileys/security/advisories/new

## Dependency Security

The `package.json` contains a `resolutions` block that pins transitive dependencies to fix known vulnerabilities. Do not remove or loosen these pins without running `npm audit` and `npm install` to verify no regressions are introduced.

Run `npm audit` after every dependency change to verify no new vulnerabilities are introduced.
