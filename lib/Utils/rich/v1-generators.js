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

// --- Default LaTeX-to-PNG renderer (lazy-loads mathjax-node) ---

let _mathjaxInstance = null;

/**
 * Default LaTeX-to-PNG renderer using mathjax-node.
 *
 * Lazily loads mathjax-node on first call to avoid forcing the dependency
 * on consumers who don't need LaTeX rendering. Returns a PNG buffer
 * plus dimensions for the expression.
 *
 * @param {string} latex — The LaTeX expression (without $$ delimiters)
 * @param {object} [opts] — { scale=2, fontColor='#ffffff', backgroundColor='transparent' }
 * @returns {Promise<{buffer: Buffer, width: number, height: number}>}
 */
export const defaultRenderLatexToPng = async (latex, opts = {}) => {
    const {
        scale = 2,
        fontColor = '#ffffff',
        backgroundColor = 'transparent',
    } = opts;

    if (!_mathjaxInstance) {
        try {
            _mathjaxInstance = (await import('mathjax-node')).default || (await import('mathjax-node'));
            _mathjaxInstance.start();
        } catch (err) {
            throw new Error(
                'defaultRenderLatexToPng requires mathjax-node. Install it with: npm install mathjax-node\n' +
                'Or pass a custom renderLatexToPng function to generateLatexImageContent.'
            );
        }
    }

    const result = await _mathjaxInstance.typeset({
        math: latex,
        format: 'TeX',
        svg: false,
        png: true,
        scale,
        font_color: fontColor,
        background: backgroundColor,
    });

    if (!result?.png) {
        throw new Error('mathjax-node did not produce a PNG for: ' + latex);
    }

    // mathjax-node returns base64 data URI for png
    const base64 = result.png.replace(/^data:image\/png;base64,/, '');
    const buffer = Buffer.from(base64, 'base64');

    // Dimensions from SVG metadata (mathjax-node fills these even when png=true)
    const width = Math.ceil((result.width || 0) * scale);
    const height = Math.ceil((result.height || 0) * scale);

    return { buffer, width, height };
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

