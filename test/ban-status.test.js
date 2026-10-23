import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildBanStatusResults, normalizeBanCheckNumbers } from '../lib/Utils/ban-status.js';

describe('normalizeBanCheckNumbers', () => {
    it('reduces every accepted format to bare digits', () => {
        const { numbers, skippedLids } = normalizeBanCheckNumbers([
            '+2348012345678',
            '234 801 234 5679',
            '2348012345678@s.whatsapp.net',
            '2348012345678:12@s.whatsapp.net'
        ]);
        assert.deepEqual(numbers, ['2348012345678', '2348012345679', '2348012345678', '2348012345678']);
        assert.deepEqual(skippedLids, []);
    });
    it('drops inputs that hold no number at all', () => {
        const { numbers, skippedLids } = normalizeBanCheckNumbers(['', '+', 'not-a-number', undefined]);
        assert.deepEqual(numbers, []);
        assert.deepEqual(skippedLids, []);
    });
    it('skips LIDs and keeps checking the rest', () => {
        const { numbers, skippedLids } = normalizeBanCheckNumbers(['123456789:4@lid', '2348012345678']);
        assert.deepEqual(numbers, ['2348012345678']);
        assert.deepEqual(skippedLids, ['123456789:4@lid']);
    });
});

describe('buildBanStatusResults', () => {
    it('clears the numbers that resolve and flags the rest, in the order asked', () => {
        const found = [{ jid: '2348012345678@s.whatsapp.net', contact: 'in' }];
        assert.deepEqual(buildBanStatusResults(['2348012345678', '2348012345679'], found), [
            { jid: '2348012345678@s.whatsapp.net', exists: true, banned: false },
            { jid: '2348012345679@s.whatsapp.net', exists: false, banned: true }
        ]);
    });
    it('matches a response jid that carries a device suffix', () => {
        assert.deepEqual(buildBanStatusResults(['2348012345678'], [{ jid: '2348012345678:3@s.whatsapp.net' }]), [
            { jid: '2348012345678@s.whatsapp.net', exists: true, banned: false }
        ]);
    });
    it('flags every number when nothing resolves', () => {
        assert.deepEqual(buildBanStatusResults(['2348012345679'], []), [
            { jid: '2348012345679@s.whatsapp.net', exists: false, banned: true }
        ]);
    });
});
