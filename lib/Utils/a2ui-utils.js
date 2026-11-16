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
// One builder per component in the v0.9 basic catalog
// (https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json).
// Optional props are only written when you pass them: an extra key changes what
// the client renders, so nothing is added by default.

const withOptions = (node, options, keys) => {
  for (const key of keys) {
    const value = options ? options[key] : undefined;
    if (value !== undefined) {
      node[key] = value;
    }
  }
  return node;
};

export const a2uiColumn = (id, children, options) =>
  withOptions({ id, component: 'Column', children: [...children] }, options, ['justify', 'align']);
export const a2uiRow = (id, children, options) =>
  withOptions({ id, component: 'Row', children: [...children] }, options, ['justify', 'align']);
export const a2uiList = (id, children, options) =>
  withOptions({ id, component: 'List', children: [...children] }, options, ['direction', 'align', 'listStyle']);
export const a2uiCard = (id, child) => ({ id, component: 'Card', child });

export const a2uiText = (id, value, variant) => {
  const node = { id, component: 'Text', text: String(value) };
  if (variant) {
    node.variant = variant;
  }
  return node;
};
export const a2uiDivider = (id, options) => withOptions({ id, component: 'Divider' }, options, ['axis']);
export const a2uiImage = (id, url, { variant = 'header', fit = 'cover', description } = {}) =>
  withOptions({ id, component: 'Image', url, variant, fit }, { description }, ['description']);
export const a2uiIcon = (id, name) => ({ id, component: 'Icon', name });
export const a2uiVideo = (id, url) => ({ id, component: 'Video', url });
export const a2uiAudio = (id, url, options) =>
  withOptions({ id, component: 'AudioPlayer', url }, options, ['description']);

/**
 * Tabs take `[{ title, child }]`, where `child` is the id of a component that
 * holds the tab body (usually a Column).
 */
export const a2uiTabs = (id, tabs) => ({
  id,
  component: 'Tabs',
  tabs: (tabs || []).map((tab) => ({ title: String(tab.title), child: tab.child })),
});

/** A modal needs a `trigger` component id and the `content` component id it shows. */
export const a2uiModal = (id, { trigger, content } = {}) => ({ id, component: 'Modal', trigger, content });

/** Generic button action: `{ call, args }`. `openUrl` is the one every client runs. */
export const a2uiAction = (call, args) => (args === undefined ? { call } : { call, args });
export const a2uiOpenUrl = (url) => a2uiAction('openUrl', { url });

/** Button whose label is the `child` component (usually a Text node). */
export const a2uiButton = (id, child, action, { variant = 'default' } = {}) => ({
  id,
  component: 'Button',
  child,
  variant,
  action,
});

/** Button that opens a URL. `child` is the id of a Text node holding its label. */
export const a2uiUrlButton = (id, child, url, { variant = 'borderless' } = {}) =>
  a2uiButton(id, child, a2uiOpenUrl(url), { variant });

// Inputs. These are the reason to keep it a widget: a form inside the chat.
export const a2uiTextField = (id, label, options) =>
  withOptions({ id, component: 'TextField', label: String(label) }, options, [
    'value',
    'variant',
    'validationRegexp',
  ]);
export const a2uiCheckBox = (id, label, value) => ({
  id,
  component: 'CheckBox',
  label: String(label),
  value: Boolean(value),
});
export const a2uiChoicePicker = (id, options) =>
  withOptions(
    {
      id,
      component: 'ChoicePicker',
      options: (options && options.options) || [],
      value: (options && options.value) || [],
    },
    options,
    ['label', 'variant', 'displayStyle', 'filterable']
  );
export const a2uiSlider = (id, options) =>
  withOptions({ id, component: 'Slider' }, options, ['label', 'min', 'max', 'value']);
export const a2uiDateTimeInput = (id, options) =>
  withOptions({ id, component: 'DateTimeInput' }, options, [
    'label',
    'value',
    'enableDate',
    'enableTime',
    'min',
    'max',
  ]);

/**
 * Escape hatch for anything the builders do not cover.
 * Pass the whole node minus `id`.
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
 * Required props per component, straight from the v0.9 basic catalog schema.
 * `undefined` is the only thing rejected, so `false` and `0` are legal values
 * (a CheckBox can be unchecked, a Slider can be at zero).
 */
const CATALOG_COMPONENTS = {
  Text: ['text'],
  Image: ['url'],
  Icon: ['name'],
  Video: ['url'],
  AudioPlayer: ['url'],
  Row: ['children'],
  Column: ['children'],
  List: ['children'],
  Card: ['child'],
  Tabs: ['tabs'],
  Modal: ['trigger', 'content'],
  Divider: [],
  Button: ['child', 'action'],
  TextField: ['label'],
  CheckBox: ['label', 'value'],
  ChoicePicker: ['options', 'value'],
  Slider: ['value', 'max'],
  DateTimeInput: ['value'],
};

/** Component names the v0.9 basic catalog defines. */
export const CATALOG_COMPONENT_NAMES = Object.keys(CATALOG_COMPONENTS);

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
  const roots = components.filter((c) => c && c.id === 'root');
  if (roots.length === 0) {
    errors.push('missing root component');
  }
  if (roots.length > 1) {
    errors.push('multiple root components');
  }
  for (const c of components) {
    if (!c || !c.id) {
      continue;
    }
    const required = CATALOG_COMPONENTS[c.component];
    if (required === undefined) {
      errors.push(`${c.id}: unknown component "${c.component}" (not in the v0.9 basic catalog)`);
    } else {
      for (const key of required) {
        if (c[key] === undefined) {
          errors.push(`${c.id}: ${c.component} needs "${key}"`);
        }
      }
    }
    if (c.child && !ids.has(c.child)) {
      errors.push(`${c.id}.child -> unknown "${c.child}"`);
    }
    for (const kid of c.children || []) {
      if (!ids.has(kid)) {
        errors.push(`${c.id}.children -> unknown "${kid}"`);
      }
    }
    for (const tab of c.tabs || []) {
      if (!ids.has(tab.child)) {
        errors.push(`${c.id}.tabs -> unknown "${tab.child}"`);
      }
    }
    for (const key of ['trigger', 'content']) {
      if (c[key] && !ids.has(c[key])) {
        errors.push(`${c.id}.${key} -> unknown "${c[key]}"`);
      }
    }
    if (c.component === 'Button' && c.action && typeof c.action.call !== 'string') {
      errors.push(`${c.id}: Button action needs a "call" name`);
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
  components: CATALOG_COMPONENT_NAMES,
  surfaceId: a2uiSurfaceId,
  column: a2uiColumn,
  row: a2uiRow,
  list: a2uiList,
  card: a2uiCard,
  text: a2uiText,
  icon: a2uiIcon,
  divider: a2uiDivider,
  image: a2uiImage,
  video: a2uiVideo,
  audio: a2uiAudio,
  tabs: a2uiTabs,
  modal: a2uiModal,
  button: a2uiButton,
  urlButton: a2uiUrlButton,
  textField: a2uiTextField,
  checkBox: a2uiCheckBox,
  choicePicker: a2uiChoicePicker,
  slider: a2uiSlider,
  dateTimeInput: a2uiDateTimeInput,
  action: a2uiAction,
  openUrl: a2uiOpenUrl,
  component: a2uiComponent,
  surface: buildA2uiSurface,
  validate: validateA2uiComponents,
  supported: bloksWidgetSupport,
  widget: buildBloksWidget,
  resolve: resolveBloksWidget,
  attach: attachBloksWidget,
};
