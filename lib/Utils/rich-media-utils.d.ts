export function extractProtoImageUrls(message: Record<string, any>): string[];
export function extractDeclarativeImageUrls(content: Record<string, any>): string[];
export function hoistImages(sock: any, jid: string, urls: string[]): Promise<number>;
export function hoistAfterRelay(sock: any, jid: string, message: Record<string, any>): void;
export function rehostRichCardMedia(sock: any, message: Record<string, any>): Promise<number>;

declare const _default: {
    extractProtoImageUrls: typeof extractProtoImageUrls;
    extractDeclarativeImageUrls: typeof extractDeclarativeImageUrls;
    hoistImages: typeof hoistImages;
    hoistAfterRelay: typeof hoistAfterRelay;
    rehostRichCardMedia: typeof rehostRichCardMedia;
};
export default _default;
