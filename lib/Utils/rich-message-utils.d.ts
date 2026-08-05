export function tokenizeCode(code: any, language?: string): {
    highlightType: any;
    codeContent: string | undefined;
}[];
export function toUnified(submessages: any, uuid: any): {
    response_id: any;
    sections: any;
};
export function prepareRichResponseMessage(content: any): {
    messageContextInfo: {
        botMetadata: {
            verificationMetadata: {
                proofs: {
                    certificateChain: Uint8Array<ArrayBuffer>[];
                    version: number;
                    useCase: number;
                    signature: Uint8Array<ArrayBuffer>;
                }[];
            };
        };
    };
    botForwardedMessage: {
        message: {
            richResponseMessage: any;
        };
    };
};
export function botMetadataSignature(): Uint8Array<ArrayBuffer>;
export function botMetadataCertificate(length?: number): Uint8Array<ArrayBuffer>;
export function wrapToBotForwardedMessage(richResponseMessage: any): {
    messageContextInfo: {
        botMetadata: {
            verificationMetadata: {
                proofs: {
                    certificateChain: Uint8Array<ArrayBuffer>[];
                    version: number;
                    useCase: number;
                    signature: Uint8Array<ArrayBuffer>;
                }[];
            };
        };
    };
    botForwardedMessage: {
        message: {
            richResponseMessage: any;
        };
    };
};

export function buildRichContextInfo(quoted: any, options?: any): any;
export function buildV2ContextInfo(quoted: any, options?: any): any;
export function buildV2Content(sections: any, ctxInfo: any): any;
export function buildBotForwardedMessage(submessages: any, contextInfo: any, unifiedResponse?: any): any;
export function generateTableContent(title: any, headers: any, rows: any, quoted: any, options?: any): any;
export function generateListContent(title: any, items: any, quoted: any, options?: any): any;
export function generateCodeBlockContent(code: any, quoted: any, options?: any): any;
export function generateLatexContent(quoted: any, options: any): any;
export function generateLatexImageContent(quoted: any, options: any, uploadFn: any, renderLatexToPng?: any): Promise<any>;
export function generateLatexInlineImageContent(quoted: any, options: any, uploadFn: any, renderLatexToPng?: any): Promise<any>;
export function captureUnifiedResponse(msg: any): any;
export function generateUnifiedResponseContent(quoted: any, captured: any): any;
export function generateRichMessageContent(submessages: any, quoted: any): any;
export function defaultRenderLatexToPng(latex: string, opts?: any): Promise<{ buffer: Buffer; width: number; height: number }>;
export function tokenizeCodeV2(code: any, language?: string): any;
export function toTableMetadataV2(arr: any): any;
export function generateTableContentV2(table: any, quoted: any, options?: any): any;
export function generateCodeBlockContentV2(code: any, quoted: any, options?: any): any;
export function generateListContentV2(title: any, items: any, quoted: any, options?: any): any;
export function generateLinkContent(text: any, links: any, quoted: any, options?: any): any;
export function generateLinkContentV2(text: any, links: any, quoted: any, options?: any): any;
export function generateReelContent(reels: any, quoted: any, options?: any): any;
export function generateReelWithStats(params: any, quoted: any, options?: any): any;
export function generateInlineImageWithTable(params: any, quoted: any, options?: any): any;
export function generateMapContent(params: any, quoted: any, options?: any): any;
export function generateInlineVideoWithStats(params: any, quoted: any, options?: any): any;
export function generateReelContentV2(reels: any, quoted: any, options?: any): any;
export function generateReelWithStatsV2(params: any, quoted: any, options?: any): any;
export function generateInlineImageWithTableV2(params: any, quoted: any, options?: any): any;
export function generateMapContentV2(params: any, quoted: any, options?: any): any;
export function generateInlineVideoWithStatsV2(params: any, quoted: any, options?: any): any;
export function generateGridImageContent(gridImage: any, quoted: any, options?: any): any;
export function generateGridImageContentV2(gridImage: any, quoted: any, options?: any): any;
export function generateDynamicContent(dynamic: any, quoted: any, options?: any): any;
export function generateDynamicContentV2(dynamic: any, quoted: any, options?: any): any;
export function generateLatexContentV2(quoted: any, options?: any): any;
export function generateLatexImageContentV2(quoted: any, options: any, uploadFn: any, renderLatexToPng?: any): Promise<any>;
export function generateLatexInlineImageContentV2(quoted: any, options: any, uploadFn: any, renderLatexToPng?: any): Promise<any>;

//# sourceMappingURL=rich-message-utils.d.ts.map

// New submessage combination generators (V1)
export function generateCodeWithTable(params: any, quoted: any, options?: any): any;
export function generateMapWithTable(params: any, quoted: any, options?: any): any;
export function generateTextWithInlineImage(text: any, image: any, quoted: any, options?: any): any;
export function generateMultiInlineImages(images: any, quoted: any, options?: any): any;
export function generateGridImageWithTable(params: any, quoted: any, options?: any): any;
export function generateDynamicWithTable(params: any, quoted: any, options?: any): any;

// New submessage combination generators (V2)
export function generateCodeWithTableV2(params: any, quoted: any, options?: any): any;
export function generateMapWithTableV2(params: any, quoted: any, options?: any): any;
export function generateTextWithInlineImageV2(text: any, image: any, quoted: any, options?: any): any;
export function generateMultiInlineImagesV2(images: any, quoted: any, options?: any): any;
export function generateGridImageWithTableV2(params: any, quoted: any, options?: any): any;
export function generateDynamicWithTableV2(params: any, quoted: any, options?: any): any;
