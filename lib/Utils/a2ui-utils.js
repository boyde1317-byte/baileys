/**
 * a2ui-utils.js — A2UI v0.9 surfaces for the WhatsApp BloksWidget slot.
 *
 * Fork notes (boyde1317-byte/baileys):
 * - Composes the UI locally and ships it in `InteractiveMessage.bloksWidget`
 *   (proto tag 66, field 8). Nothing here needs a Meta-hosted Flow, a WABA, or
 *   a flow_id: the client parses our JSON and renders real native components.
 * - `Header.bloksWidget` (tag 82, field 10) is the same oneof message and it
 *   REPLACES header media, so a widget card and an image header are mutually
 *   exclusive. Build it with `buildBloksWidget()` and place it where you want.
 * - Exactly one component with id `root`. A2UI validation walks down from it;
 *   a duplicate root makes referenced children unreachable and the widget dies
 *   with A2UIValidationException (seen live on device 2026-10-22).
 * - Proto gate: `bloksWidgetSupport()` reports whether the pinned proto can
 *   build the widget. `buildBloksWidget()` returns undefined rather than
 *   throwing, so an older proto degrades to a plain card instead of no card.
 *
 * Send path: use the `a2ui` content key (handled in ./messages.js), which
 * builds the interactiveMessage envelope for you:
 *
 *   await sock.sendMessage(jid, {
 *     a2ui: {
 *       components: [
 *         a2uiColumn('root', ['title', 'rule', 'body']),
 *         a2uiText('title', 'Ship it', 'h3'),
 *         a2uiDivider('rule'),
 *         a2uiText('body', 'Composed locally, rendered natively.'),
 *       ],
 *       title: 'A2UI',
 *       text: 'fallback body',
 *     }
 *   })
 */
import { randomUUID } from 'crypto';
import { proto } from '../../WAProto/index.js';

export const A2UI_VERSION = 'v0.9';
export const A2UI_BASIC_CATALOG =
  'https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json';
export const A2UI_WIDGET_TYPE = 'im_a2ui';

/** Surface ids are namespaced; the client keys the widget off this string. */
const SURFACE_PREFIX = 'starcore-widget=';

export const a2uiSurfaceId = (uuid) => SURFACE_PREFIX + String(uuid);

// ─── Component builders ──────────────────────────────────────────────────────
// Literal on purpose: an extra key changes what the client renders, so nothing
// is added unless you pass it.

export const a2uiColumn = (id, children) => ({ id, component: 'Column', children: [...children] });
export const a2uiRow = (id, children) => ({ id, component: 'Row', children: [...children] });
export const a2uiCard = (id, child) => ({ id, component: 'Card', child });

export const a2uiText = (id, value, variant) => {
  const node = { id, component: 'Text', text: String(value) };
  if (variant) {
    node.variant = variant;
  }
  return node;
};
export const a2uiDivider = (id) => ({ id, component: 'Divider' });
export const a2uiImage = (id, url, { variant = 'header', fit = 'cover' } = {}) => ({
  id,
  component: 'Image',
  url,
  variant,
  fit,
});

/** Button that opens a URL. `child` is the id of a Text node holding its label. */
export const a2uiUrlButton = (id, child, url, { variant = 'borderless' } = {}) => ({
  id,
  component: 'Button',
  child,
  variant,
  action: { call: 'openUrl', args: { url } },
});

/**
 * Escape hatch for catalog components this file has no builder for
 * (inputs, checkboxes, chips…). Pass the whole node minus `id`.
 */
export const a2uiComponent = (id, component, props = {}) => ({ id, component, ...props });

// ─── Surface ─────────────────────────────────────────────────────────────────

/**
 * Wrap components in the v0.9 createSurface envelope.
 * @param {{uuid?: string, components: object[], surfaceId?: string,
 *          catalogId?: string, version?: string}} input
 */
export const buildA2uiSurface = ({ uuid = randomUUID(), components, surfaceId, catalogId, version } = {}) => {
  if (!Array.isArray(components) || components.length === 0) {
    throw new TypeError('buildA2uiSurface: components must be a non-empty array');
  }
  return {
    version: version || A2UI_VERSION,
    createSurface: {
      surfaceId: surfaceId || a2uiSurfaceId(uuid),
      catalogId: catalogId || A2UI_BASIC_CATALOG,
      components,
    },
  };
};

/**
 * Pre-flight for the failures that otherwise only appear as a server-side
 * A2UIValidationException after the message is already sent.
 * Warn-only by design: the device is the authority.
 * @returns {{ok: boolean, errors: string[]}}
 */
export const validateA2uiComponents = (components) => {
  if (!Array.isArray(components) || components.length === 0) {
    return { ok: false, errors: ['no components'] };
  }
  const errors = [];
  const ids = new Set();
  const dupes = new Set();
  for (const c of components) {
    if (!c || !c.id) {
      errors.push('component without id');
      continue;
    }
    if (ids.has(c.id)) {
      dupes.add(c.id);
    }
    ids.add(c.id);
  }
  if (dupes.size) {
    errors.push('duplicate id(s): ' + [...dupes].join(', '));
  }
  const roots = components.filter(c => c && c.id === 'root');
  if (roots.length === 0) {
    errors.push('missing root component');
  }
  if (roots.length > 1) {
    errors.push('multiple root components');
  }
  for (const c of components) {
    if (c && c.child && !ids.has(c.child)) {
      errors.push(`${c.id}.child -> unknown "${c.child}"`);
    }
    for (const kid of (c && c.children) || []) {
      if (!ids.has(kid)) {
        errors.push(`${c.id}.children -> unknown "${kid}"`);
      }
    }
  }
  return { ok: errors.length === 0, errors };
};

// ─── Proto gate ──────────────────────────────────────────────────────────────

let _support;

/** True when the pinned proto can build a BloksWidget. Cached. */
export const bloksWidgetSupport = () => {
  if (_support !== undefined) {
    return _support;
  }
  try {
    _support = typeof proto?.Message?.InteractiveMessage?.BloksWidget?.create === 'function';
  }
  catch {
    _support = false;
  }
  return _support;
};

/**
 * Build the proto object for a widget slot.
 * @param {object} surface  output of buildA2uiSurface
 * @param {{uuid?: string, type?: string, warn?: boolean}} [options]
 * @returns {object|undefined}
 */
export const buildBloksWidget = (surface, { uuid, type = A2UI_WIDGET_TYPE, warn = true } = {}) => {
  if (!bloksWidgetSupport()) {
    if (warn) {
      console.warn('[baileys] proto has no InteractiveMessage.BloksWidget — a2ui widget skipped');
    }
    return undefined;
  }
  const id = uuid || surface?.createSurface?.surfaceId?.replace(SURFACE_PREFIX, '') || randomUUID();
  const check = validateA2uiComponents(surface?.createSurface?.components);
  if (!check.ok && warn) {
    console.warn('[baileys] a2ui surface may be rejected by validation: ' + check.errors.join('; '));
  }
  try {
    return proto.Message.InteractiveMessage.BloksWidget.create({
      uuid: id,
      type,
      data: JSON.stringify(surface),
    });
  }
  catch (err) {
    if (warn) {
      console.warn('[baileys] BloksWidget.create failed: ' + err.message);
    }
    return undefined;
  }
};

/**
 * Attach an A2UI widget to an interactiveMessage object (mutates and returns).
 * Safe to call with a surface that the proto cannot carry: the message is
 * returned unchanged.
 */
export const attachBloksWidget = (interactiveMessage, surface, options = {}) => {
  const widget = buildBloksWidget(surface, options);
  if (widget) {
    interactiveMessage.bloksWidget = widget;
  }
  return interactiveMessage;
};

/**
 * Accept whatever a caller puts in `bloksWidget` and return a proto
 * BloksWidget or undefined:
 *   - undefined / null            -> undefined
 *   - { createSurface: {...} }    -> built into a widget (A2UI surface)
 *   - [components]                -> wrapped into a surface, then built
 *   - anything else               -> passed through as a finished widget
 */
export const resolveBloksWidget = (input, options = {}) => {
  if (input === undefined || input === null || input === false) {
    return undefined;
  }
  if (Array.isArray(input)) {
    return buildBloksWidget(buildA2uiSurface({ uuid: options.uuid, components: input }), options);
  }
  if (input.createSurface) {
    return buildBloksWidget(input, options);
  }
  return input;
};

/** Namespace export for `import { A2UI } from 'baileys'`. */
export const A2UI = {
  VERSION: A2UI_VERSION,
  CATALOG: A2UI_BASIC_CATALOG,
  WIDGET_TYPE: A2UI_WIDGET_TYPE,
  surfaceId: a2uiSurfaceId,
  column: a2uiColumn,
  row: a2uiRow,
  card: a2uiCard,
  text: a2uiText,
  divider: a2uiDivider,
  image: a2uiImage,
  urlButton: a2uiUrlButton,
  component: a2uiComponent,
  surface: buildA2uiSurface,
  validate: validateA2uiComponents,
  supported: bloksWidgetSupport,
  widget: buildBloksWidget,
  resolve: resolveBloksWidget,
  attach: attachBloksWidget,
};
