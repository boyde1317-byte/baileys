import { isLidUser, jidEncode } from '../WABinary/index.js';
/**
 * Reduces the numbers handed to checkBanStatus to bare digits.
 * Inputs that hold no number at all are dropped; LIDs cannot be queried by phone,
 * so they are reported back separately for the caller to warn about.
 */
export const normalizeBanCheckNumbers = inputs => {
    const numbers = [];
    const skippedLids = [];
    for (const input of inputs) {
        if (isLidUser(`${input}`)) {
            skippedLids.push(`${input}`);
            continue;
        }
        const number = `${input}`.replace('+', '').split('@')[0]?.split(':')[0]?.replace(/\D/g, '');
        if (number) {
            numbers.push(number);
        }
    }
    return { numbers, skippedLids };
};
/**
 * Maps the numbers that were asked about onto the usync contact result, one verdict per number.
 *
 * WhatsApp exposes no ban flag for an account you are not logged in as: a banned number is
 * deregistered, so it stops resolving in exactly the same way as a deleted or a never-registered
 * one. Hence the verdict is reachability — does the number still resolve.
 */
export const buildBanStatusResults = (numbers, found) => {
    const resolvable = new Set(found.map(({ jid }) => `${jid}`.split('@')[0]?.split(':')[0]));
    return numbers.map(number => {
        const exists = resolvable.has(number);
        return { jid: jidEncode(number, 's.whatsapp.net'), exists, banned: !exists };
    });
};
