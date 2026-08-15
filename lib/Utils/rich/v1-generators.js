/**
 * V1 rich message generators (submessage-based).
 * Originally authored by itsliaaa (itsliaaa/Baileys) + OURIN-baileys. Included with attribution.
 */
import { CodeHighlightType, RichSubMessageType, proto, unixTimestampSeconds, NOOP, generateMessageIDV2 } from './common.js';
import { buildRichContextInfo, buildBotForwardedMessage, EXTENDED_LANGUAGE_KEYWORDS } from './context.js';
import { tokenizeCode } from './core.js';

export const generateTableContent = (title, headers, rows, quoted, options = {}) => {
    const { footer, headerText } = options;
    if (!Array.isArray(rows) || !Array.isArray(headers)) {
        throw new TypeError('generateTableContent: headers and rows must be arrays');
    }
    const tableRows = [
        { items: headers, isHeading: true },
        ...rows.map(row => ({ items: (Array.isArray(row) ? row : [row]).map(String) })),
    ];
    const submessages = [];
    if (headerText) {
        submessages.push({ messageType: 2, messageText: headerText });
    }
    submessages.push({
        messageType: 4,
        tableMetadata: { title, rows: tableRows },
    });
    if (footer) {
        submessages.push({ messageType: 2, messageText: footer });
    }
    const ctxInfo = buildRichContextInfo(quoted);
    return {
        message: buildBotForwardedMessage(submessages, ctxInfo),
        messageId: generateMessageIDV2(),
    };
};

export const generateListContent = (title, items, quoted, options = {}) => {
    const { footer, headerText } = options;
    if (!Array.isArray(items)) {
        throw new TypeError('generateListContent: items must be an array');
    }
    const tableRows = items.map(item => ({
        items: Array.isArray(item) ? item.map(String) : [String(item)],
    }));
    const submessages = [];
    if (headerText) {
        submessages.push({ messageType: 2, messageText: headerText });
    }
    submessages.push({
        messageType: 4,
        tableMetadata: { title, rows: tableRows },
    });
    if (footer) {
        submessages.push({ messageType: 2, messageText: footer });
    }
    const ctxInfo = buildRichContextInfo(quoted);
    return {
        message: buildBotForwardedMessage(submessages, ctxInfo),
        messageId: generateMessageIDV2(),
    };
};

export const generateCodeBlockContent = (code, quoted, options = {}) => {
    const { title, footer, language = 'javascript' } = options;
    const submessages = [];
    if (title) {
        submessages.push({ messageType: 2, messageText: title });
    }
    submessages.push({
        messageType: 5,
        codeMetadata: {
            codeLanguage: language,
            codeBlocks: tokenizeCode(code, language),
        },
    });
    if (footer) {
        submessages.push({ messageType: 2, messageText: footer });
    }
    const ctxInfo = buildRichContextInfo(quoted);
    return {
        message: buildBotForwardedMessage(submessages, ctxInfo),
        messageId: generateMessageIDV2(),
    };
};

export const generateLatexContent = (quoted, options) => {
    const { text, expressions, headerText, footer } = options;
    const submessages = [];
    if (headerText) {
        submessages.push({ messageType: 2, messageText: headerText });
    }
    const latexExpressions = expressions.map(expr => {
        const entry = {
            latexExpression: expr.latexExpression,
            url: expr.url,
            width: expr.width,
            height: expr.height,
        };
        if (expr.fontHeight !== undefined) entry.fontHeight = expr.fontHeight;
        if (expr.imageTopPadding !== undefined) entry.imageTopPadding = expr.imageTopPadding;
        if (expr.imageLeadingPadding !== undefined) entry.imageLeadingPadding = expr.imageLeadingPadding;
        if (expr.imageBottomPadding !== undefined) entry.imageBottomPadding = expr.imageBottomPadding;
        if (expr.imageTrailingPadding !== undefined) entry.imageTrailingPadding = expr.imageTrailingPadding;
        return entry;
    });
    submessages.push({
        messageType: 8,
        latexMetadata: {
            text: text || '',
            expressions: latexExpressions,
        },
    });
    if (footer) {
        submessages.push({ messageType: 2, messageText: footer });
    }
    const ctxInfo = buildRichContextInfo(quoted);
    return {
        message: buildBotForwardedMessage(submessages, ctxInfo),
        messageId: generateMessageIDV2(),
    };
};

// --- LaTeX-to-PNG renderer (pluggable, no default implementation) ---

/**
 * Placeholder LaTeX-to-PNG renderer.
 *
 * LaTeX rendering is fully pluggable — there is no bundled default renderer.
 * Consumers must pass a `renderLatexToPng` function to generateLatexImageContent /
 * generateLatexInlineImageContent / generateLatexImageContentV2.
 *
 * Expected signature:
 *   renderLatexToPng(latex: string, opts?: object) => Promise<{buffer: Buffer, width: number, height: number}>
 *
 * Recommended renderers:
 *   - mathjax-full (actively maintained, same project as the archived mathjax-node)
 *   - katex + puppeteer screenshot
 *   - Any LaTeX-to-PNG library that produces a Buffer
 */
export const defaultRenderLatexToPng = async (latex, opts = {}) => {
    throw new Error(
        'No LaTeX renderer configured. Pass a renderLatexToPng function to generateLatexImageContent.\n' +
        'Example renderers: mathjax-full, katex + puppeteer, or any LaTeX-to-PNG library.\n' +
        'Signature: renderLatexToPng(latex, opts) => Promise<{buffer, width, height}>'
    );
};

export const generateLatexImageContent = async (quoted, options, uploadFn, renderLatexToPng = defaultRenderLatexToPng) => {
    const { text, expressions, headerText, footer } = options;
    const submessages = [];
    if (headerText) {
        submessages.push({ messageType: 2, messageText: headerText });
    }
    const latexExpressions = await Promise.all(
        expressions.map(async (expr) => {
            const { buffer, width, height } = await renderLatexToPng(expr.latexExpression);
            const uploadResult = await uploadFn(buffer, 'image');
            const imageUrl = uploadResult.url || uploadResult.directPath;
            return {
                latexExpression: expr.latexExpression,
                url: imageUrl,
                width,
                height,
            };
        })
    );
    submessages.push({
        messageType: 8,
        latexMetadata: {
            text: text || '',
            expressions: latexExpressions,
        },
    });
    if (footer) {
        submessages.push({ messageType: 2, messageText: footer });
    }
    const ctxInfo = buildRichContextInfo(quoted);
    return {
        message: buildBotForwardedMessage(submessages, ctxInfo),
        messageId: generateMessageIDV2(),
    };
};

export const generateLatexInlineImageContent = async (quoted, options, uploadFn, renderLatexToPng = defaultRenderLatexToPng) => {
    const { text, expressions, headerText, footer } = options;
    const submessages = [];
    if (headerText) {
        submessages.push({ messageType: 2, messageText: headerText });
    }
    if (text) {
        submessages.push({ messageType: 2, messageText: text });
    }
    for (const expr of expressions) {
        const { buffer, width, height } = await renderLatexToPng(expr.latexExpression);
        const uploadResult = await uploadFn(buffer, 'image');
        const imageUrl = uploadResult.url || uploadResult.directPath;
        submessages.push({
            messageType: 3,
            imageMetadata: {
                imageUrl: {
                    imagePreviewUrl: imageUrl,
                    imageHighResUrl: imageUrl,
                },
                imageText: expr.latexExpression,
                alignment: 2,
            },
        });
    }
    if (footer) {
        submessages.push({ messageType: 2, messageText: footer });
    }
    const ctxInfo = buildRichContextInfo(quoted);
    return {
        message: buildBotForwardedMessage(submessages, ctxInfo),
        messageId: generateMessageIDV2(),
    };
};

// --- Capture & relay unified responses ---

export const captureUnifiedResponse = (msg) => {
    const botFwd = msg?.botForwardedMessage?.message;
    if (!botFwd) return null;
    const rich = botFwd.richResponseMessage;
    if (!rich?.unifiedResponse?.data) return null;
    return {
        unifiedResponse: { data: rich.unifiedResponse.data },
        submessages: rich.submessages || [],
        contextInfo: rich.contextInfo || {},
    };
};

export const generateUnifiedResponseContent = (quoted, captured) => {
    const ctxInfo = buildRichContextInfo(quoted);
    return {
        message: buildBotForwardedMessage(captured.submessages, ctxInfo, captured.unifiedResponse),
        messageId: generateMessageIDV2(),
    };
};

export const generateRichMessageContent = (submessages, quoted) => {
    const ctxInfo = buildRichContextInfo(quoted);
    return {
        message: buildBotForwardedMessage(submessages, ctxInfo),
        messageId: generateMessageIDV2(),
    };
};

// --- V2 Tokenizer (improved) ---

const HIGHLIGHT_TYPE_MAP = {
    0: 'DEFAULT',
    1: 'KEYWORD',
    2: 'METHOD',
    3: 'STRING',
    4: 'NUMBER',
    5: 'COMMENT',
};

