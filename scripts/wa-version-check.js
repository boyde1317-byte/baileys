#!/usr/bin/env node
/**
 * Checks the latest WhatsApp Web version from WhatsApp's version endpoint
 * and updates lib/Defaults/index.js if a newer version is available.
 *
 * Usage:
 *   node scripts/wa-version-check.js          # check and update
 *   node scripts/wa-version-check.js --check   # check only, don't write
 *
 * Exit codes:
 *   0 — version is current or was updated
 *   1 — fetch error
 *   2 — parse error
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DEFAULTS_PATH = resolve(ROOT, 'lib/Defaults/index.js');

async function fetchLatestVersion() {
    try {
        const res = await fetch('https://web.whatsapp.com/check-update?version=2.3000.0&platform=web', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                'Accept': 'application/json'
            }
        });
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }
        const text = await res.text();

        // WhatsApp returns JSON with a "currentVersion" field like "2.2413.51"
        try {
            const json = JSON.parse(text);
            if (json.currentVersion) {
                const parts = json.currentVersion.split('.').map(Number);
                if (parts.length >= 3 && parts.every(n => !isNaN(n))) {
                    return parts;
                }
            }
            // Some responses may use a "version" array
            if (Array.isArray(json.version) && json.version.length >= 3) {
                return json.version.map(Number);
            }
        } catch {
            // not JSON — try comma-separated "2,3000,1044479778"
        }

        // fallback: comma-separated
        const parts = text.trim().split(',').map(Number);
        if (parts.length >= 3 && parts.every(n => !isNaN(n))) {
            return parts;
        }

        throw new Error(`Could not parse version from response: ${text.slice(0, 200)}`);
    } catch (err) {
        console.error(`Error fetching WA version: ${err.message}`);
        process.exit(1);
    }
}

function getCurrentVersion() {
    const content = readFileSync(DEFAULTS_PATH, 'utf-8');
    const match = content.match(/const version = \[(\d+),\s*(\d+),\s*(\d+)\]/);
    if (!match) {
        console.error('Could not find version in lib/Defaults/index.js');
        process.exit(2);
    }
    return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
}

function updateVersion(newVersion) {
    const content = readFileSync(DEFAULTS_PATH, 'utf-8');
    const now = new Date().toISOString().slice(0, 7); // YYYY-MM
    const newComment = `// Updated to the latest stable WA Web release (${newVersion.join('.')}, ${now}).\n// Keeping this current reduces the risk of protocol-mismatch disconnects and\n// "your WhatsApp is outdated" session invalidation events.`;
    // Replace the version array
    let updated = content.replace(
        /const version = \[\d+,\s*\d+,\s*\d+\]/,
        `const version = [${newVersion.join(', ')}]`
    );
    // Replace the comment block above it
    updated = updated.replace(
        /\/\/ ── WhatsApp Web protocol version[^\n]*\n\/\/ Updated to the latest stable WA Web release[^\n]*\n\/\/ Keeping this current[^\n]*\n\/\/ "your WhatsApp is outdated"[^\n]*\n/,
        `// ── WhatsApp Web protocol version ────────────────────────────────────────────\n${newComment}\n`
    );
    writeFileSync(DEFAULTS_PATH, updated, 'utf-8');
}

async function main() {
    const checkOnly = process.argv.includes('--check');
    const current = getCurrentVersion();
    console.log(`Current version: ${current.join('.')}`);

    const latest = await fetchLatestVersion();
    console.log(`Latest version:  ${latest.join('.')}`);

    const currentStr = current.join('.');
    const latestStr = latest.join('.');

    if (currentStr === latestStr) {
        console.log('Version is already up to date.');
        process.exit(0);
    }

    // Compare: only update if latest is newer
    const isNewer =
        latest[0] > current[0] ||
        (latest[0] === current[0] && latest[1] > current[1]) ||
        (latest[0] === current[0] && latest[1] === current[1] && latest[2] > current[2]);

    if (!isNewer) {
        console.log('Current version is newer than or equal to fetched version. No update needed.');
        process.exit(0);
    }

    if (checkOnly) {
        console.log(`New version available: ${latestStr} (current: ${currentStr})`);
        console.log('Run without --check to update.');
        process.exit(0);
    }

    updateVersion(latest);
    console.log(`Updated version to ${latestStr}`);

    // Output for GitHub Actions
    if (process.env.GITHUB_ACTIONS) {
        const fs = await import('fs');
        const ghEnvPath = process.env.GITHUB_ENV;
        if (ghEnvPath) {
            fs.appendFileSync(ghEnvPath, `NEW_VERSION=${latestStr}\nOLD_VERSION=${currentStr}\n`);
        }
    }
}

main().catch(err => {
    console.error('Unexpected error:', err);
    process.exit(1);
});
