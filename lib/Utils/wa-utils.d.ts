export const WA_JID: '0@s.whatsapp.net';
export const META_AI_JID: string;
export const AI_JIDS: string[];
export const AI_NAMES: Record<string, string>;
export const STATUS_JID: 'status@broadcast';

export function pickAiJid(): string;
export function pickAiContact(): { jid: string; number: string; name: string };

/** Anything usable as `{ quoted: ... }` — a synthetic WAMessage-ish object. */
export type FakeQuote = {
    key: { fromMe: boolean; participant: string; remoteJid: string; id: string };
    message: Record<string, any>;
};

export function buildFakeOrderQuote(opts?: {
    title?: string;
    thumbnail?: Buffer;
    itemCount?: number | string;
    orderId?: string;
    orderTitle?: string;
    sellerJid?: string;
}): FakeQuote;

export function buildFakeContactQuote(opts?: {
    displayName?: string;
    phoneNumber?: string;
    vcard?: string;
    ai?: string;
}): FakeQuote;

export function buildFakeAudioQuote(opts?: { audioMessage?: Record<string, any>; seconds?: number; ptt?: boolean }): FakeQuote;
export function buildFakeLocationQuote(opts?: {
    degreesLatitude?: number;
    degreesLongitude?: number;
    name?: string;
    address?: string;
    jpegThumbnail?: Buffer;
}): FakeQuote;
export function buildFakeLiveLocationQuote(opts?: {
    degreesLatitude?: number;
    degreesLongitude?: number;
    caption?: string;
    sequenceNumber?: number;
}): FakeQuote;
export function buildFakeTextQuote(opts?: { text?: string; title?: string; jpegThumbnail?: Buffer }): FakeQuote;
export function buildFakeDocumentQuote(opts?: {
    title?: string;
    fileName?: string;
    mimetype?: string;
    jpegThumbnail?: Buffer;
}): FakeQuote;
export function buildFakeImageQuote(opts?: {
    url?: string;
    jpegThumbnail?: Buffer;
    viewOnce?: boolean;
    height?: number;
    width?: number;
}): FakeQuote;
export function buildFakeGifQuote(opts?: { caption?: string; jpegThumbnail?: Buffer; seconds?: number; gifPlayback?: boolean }): FakeQuote;
export function buildFakeProductQuote(opts?: {
    title?: string;
    description?: string;
    currencyCode?: string;
    priceAmount1000?: number;
    businessOwnerJid?: string;
    jpegThumbnail?: Buffer;
}): FakeQuote;
export function buildFakeGroupInviteQuote(opts?: {
    groupJid?: string;
    inviteCode?: string;
    groupName?: string;
    caption?: string;
    jpegThumbnail?: Buffer;
}): FakeQuote;
export function buildFakePaymentQuote(opts?: {
    currencyCode?: string;
    amount1000?: number;
    note?: string;
    expiryTimestamp?: number;
}): FakeQuote;
export function buildFakeNewsletterQuote(opts?: { newsletterJid?: string; newsletterName?: string; caption?: string }): FakeQuote;
export function buildRandomFakeQuote(perTypeOpts?: Record<string, any>): FakeQuote;

export function sendFakeQuote(sock: any, jid: string, text: string, fakeText?: string, opts?: Record<string, any>): Promise<any>;
export function replyFakeQuote(m: any, sock: any, text: string, fakeText?: string, opts?: Record<string, any>): Promise<any>;

export type AdReplyOpts = {
    title?: string;
    body?: string;
    description?: string;
    thumbnail?: Buffer;
    thumbnailUrl?: string;
    originalImageUrl?: string;
    sourceUrl?: string;
    sourceId?: string;
    mediaType?: 1 | 2;
    mediaUrl?: string;
    previewType?: string;
    renderLargerThumbnail?: boolean;
    showAdAttribution?: boolean;
    containsAutoReply?: boolean;
    forwardingScore?: number;
    newsletterJid?: string;
    newsletterName?: string;
    mentionedJid?: string[];
};

export function buildAdReplyContext(ad?: AdReplyOpts): Record<string, any>;
export function sendAdReply(sock: any, jid: string, text: string, ad?: AdReplyOpts, opts?: Record<string, any>): Promise<any>;
export function replyAdReply(m: any, sock: any, text: string, ad?: AdReplyOpts, opts?: Record<string, any>): Promise<any>;

export type StatusOpts = {
    statusJidList?: string[];
    backgroundColor?: string;
    font?: 0 | 1 | 2 | 3 | 4 | 5;
    caption?: string;
};

export function sendTextStatus(sock: any, text: string, opts?: StatusOpts): Promise<any>;
export function sendImageStatus(sock: any, image: Buffer | string, opts?: StatusOpts): Promise<any>;
export function sendVideoStatus(sock: any, video: Buffer | string, opts?: StatusOpts): Promise<any>;
export function sendStatus(
    sock: any,
    type?: 'text' | 'image' | 'video',
    content?: string | Buffer,
    opts?: StatusOpts
): Promise<any>;

export function buildMenuBanner(opts?: {
    imgData?: { buffer?: Buffer; source?: string };
    adReply?: Record<string, any>;
    botName?: string;
    totalCommands?: number | string;
    quoted?: any;
}): { quoted: any; contextInfo: { externalAdReply: Record<string, any> } };

export function buildAboutContextInfo(opts?: {
    botName?: string;
    description?: string;
    thumbnail?: Buffer;
    mentionedJid?: string | string[];
}): Record<string, any>;

export function buildAboutButtons(prefix?: string, customButtons?: any[]): any[];
export function resolveThumbnail(imgData?: { buffer?: Buffer; source?: string }, fallback?: string | Buffer): string | Buffer | undefined;
