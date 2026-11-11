import { proto } from '../../WAProto/index.js';

export const META_AI_BOT_JID: string;

export type ProofChain = { name?: string; signature: string | Buffer; certificateChain?: (string | Buffer)[] };

export const PROOF_CHAINS: { omegatech: ProofChain; nixcode: ProofChain };
export function setProofChains(chains: Record<string, ProofChain>): Record<string, ProofChain>;

export type Submessage = { messageType?: number; messageText: string };
export type Citation = { url: string; title?: string; displayName?: string };
export type NewsletterRef = { jid: string; serverMessageId?: number; name?: string };

export function productItemCard(options?: {
    title?: string;
    brand?: string;
    price?: string;
    salePrice?: string;
    productUrl?: string;
    imageUrl?: string;
    image?: { url?: string; mime_type?: string };
    additionalImages?: string[];
}): Record<string, any>;

export function markdownText(text: string, citations?: Citation[]): Record<string, any>;
export function followUpPills(pills: string | string[] | Record<string, any>[], type?: string): Record<string, any>[];
export function extWidget(input: {
    title: string;
    subtitle?: string;
    ctas?: { label?: string; state?: string; kind?: string; toolCallId?: string; toast?: string }[];
}): Record<string, any>;
export function htmlPrimitive(payload: string, options?: { sources?: string[] }): Record<string, any>;
export function imaginePrimitive(options?: {
    url?: string;
    mime_type?: string;
    media_type?: string;
    alt_text?: string;
    prompt?: string;
}): Record<string, any>;
export function rawPrimitive<T extends Record<string, any>>(obj: T): T;

export function layout(name: string, data: Record<string, any> | Record<string, any>[]): Record<string, any>;
export function singleSection(primitive: Record<string, any>): Record<string, any>;
export function hScrollSection(primitives: Record<string, any>[]): Record<string, any>;
export function section(view_model: Record<string, any>): Record<string, any>;

export function richContextInfo(
    quoted?: any,
    options?: { botJid?: string; newsletter?: NewsletterRef | null; mentionedJid?: string[] }
): Record<string, any>;

export function buildUnifiedRichContent(options: {
    sections: Record<string, any>[];
    disclaimer?: string;
    submessages?: Submessage[];
    quoted?: any;
    newsletter?: NewsletterRef | null;
    mentionedJid?: string[];
    botJid?: string;
    withProofs?: boolean | ProofChain | keyof typeof PROOF_CHAINS;
    responseId?: string;
    messageSecret?: Buffer;
    messageType?: number;
}): { messageContextInfo: Record<string, any>; botForwardedMessage: Record<string, any> };

export function buildSecretFlowContent(content: Record<string, any>): { viewOnceMessage: { message: Record<string, any> } };

export function sendUnifiedRich(
    sock: any,
    jid: string,
    optionsOrContent?: Record<string, any>,
    extra?: Record<string, any>
): Promise<{ ok: true; key: proto.WebMessageInfo['key']; messageId: string; responseId?: string }>;

export function sendHtmlCard(
    sock: any,
    jid: string,
    options: {
        html: string;
        title?: string;
        sources?: string[];
        quoted?: any;
        withProofs?: boolean | ProofChain | string;
    }
): Promise<{ ok: true; key: proto.WebMessageInfo['key']; messageId: string; responseId?: string }>;

export function vipCard(options?: {
    title?: string;
    brand?: string;
    price?: string;
    salePrice?: string;
    productUrl?: string;
    imageUrl?: string;
    statusText?: string;
    body?: string;
    bodyCitations?: Citation[];
    widget?: Parameters<typeof extWidget>[0] | null;
    pills?: string[];
    gallery?: Record<string, any>[];
    channelText?: string;
    channelUrl?: string;
    disclaimer?: string;
    submessage?: string;
    quoted?: any;
    withProofs?: boolean | ProofChain | string;
}): Record<string, any>;

export function sendVipCard(
    sock: any,
    jid: string,
    options?: Parameters<typeof vipCard>[0]
): Promise<{ ok: true; key: proto.WebMessageInfo['key']; messageId: string; responseId?: string }>;
