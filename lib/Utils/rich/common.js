/**
 * Rich message utilities: shared types, constants, and imports.
 * Originally authored by itsliaaa (itsliaaa/Baileys). Included with attribution.
 */
export { getRandomValues, randomBytes, randomUUID } from 'crypto';
export { LEXER_REGEX } from '../../Defaults/index.js';
export { LANGUAGE_KEYWORDS } from '../../WABinary/constants.js';
export { CodeHighlightType, RichSubMessageType } from '../../Types/RichType.js';
export { proto } from '../../../WAProto/index.js';
export { unixTimestampSeconds, generateMessageIDV2 } from '../generics.js';

export const NOOP = new Set([]);
