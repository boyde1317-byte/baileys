import { proto } from '../../WAProto/index.js';
import type { Citation, ProofChain, Submessage } from './genai-utils.js';

export class AiRich {
    constructor(client: any, options?: { disclaimer?: string });

    addLayout(name: string, data: Record<string, any> | Record<string, any>[]): this;
    addSection(section: Record<string, any>): this;
    addSubmessage(submessage: Submessage | Submessage[]): this;
    addProduct(product: {
        title: string;
        brand?: string;
        price?: string;
        sale_price?: string;
        product_url?: string;
        image_url?: string;
        icon_url?: string;
        additional_images?: string[];
    }): this;
    addText(text: string, options?: { hyperlink?: boolean; citations?: Citation[]; submessage?: boolean }): this;
    addCode(code: string, language?: string): this;
    addTable(rows: string[][], options?: { title?: string }): this;
    addImage(url: string, options?: { alt_text?: string; prompt?: string }): this;
    addVideo(videoUrl: string | string[], options?: { sourceUrl?: string }): this;
    addTip(text: string): this;
    addSuggest(suggestion: string | string[]): this;
    addCarousel(primitives: Record<string, any> | Record<string, any>[]): this;
    addPrimitive(primitive: Record<string, any>): this;
    setFooter(text: string): this;
    setDisclaimer(text: string): this;
    setContextInfo(info: Record<string, any>): this;

    readonly sections: Record<string, any>[];

    build(options?: {
        quoted?: any;
        withProofs?: boolean | ProofChain | string;
        botJid?: string;
    }): Record<string, any>;

    send(
        jid: string,
        options?: { quoted?: any; withProofs?: boolean | ProofChain | string; botJid?: string }
    ): Promise<proto.WebMessageInfo>;
}

export function aiRich(client: any, options?: { disclaimer?: string }): AiRich;
export default AiRich;
