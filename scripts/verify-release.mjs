#!/usr/bin/env node
/**
 * Offline release verification for this fork.
 *
 * Nothing here touches the network or a WhatsApp session: every message is built
 * through the package's own content pipeline and then protobuf-encoded, and every
 * media URL check stubs `fetch`. That makes it safe to run in CI, before a release,
 * or after a dependency bump.
 *
 *   node scripts/verify-release.mjs          # human-readable
 *   node scripts/verify-release.mjs --json   # machine-readable
 *
 * A non-zero exit means at least one check failed.
 */

import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const pkgRoot = join(here, '..')
const require = createRequire(join(pkgRoot, 'package.json'))

const B = await import(join(pkgRoot, 'lib/index.js'))
const {
	proto,
	generateWAMessageContent,
	prepareRichResponseMessage,
	getContentType,
	downloadContentFromMessage,
	A2UI,
	a2uiColumn,
	a2uiText,
	a2uiDivider,
	a2uiUrlButton,
	a2uiList,
	a2uiIcon,
	a2uiVideo,
	a2uiAudio,
	a2uiTabs,
	a2uiModal,
	a2uiButton,
	a2uiAction,
	a2uiTextField,
	a2uiCheckBox,
	a2uiChoicePicker,
	a2uiSlider,
	a2uiDateTimeInput,
	validateA2uiComponents,
	CATALOG_COMPONENT_NAMES
} = B

const JSON_MODE = process.argv.includes('--json')
const results = []

const silentLogger = {
	level: 'silent',
	child() {
		return this
	},
	trace() {},
	debug() {},
	info() {},
	warn() {},
	error() {}
}

const build = (content) =>
	generateWAMessageContent(content, {
		logger: silentLogger,
		upload: async () => ({}),
		userJid: '99999999999@s.whatsapp.net'
	})

/** Encode through the real protobuf writer: this is where a bad shape blows up. */
const encode = (content) => proto.Message.encode(proto.Message.fromObject(content)).finish()

/**
 * Two ways a content object reaches the wire: either it is the message itself, or it is
 * wrapped in a container (`botForwardedMessage`, `viewOnceMessageV2`, ...). Return the
 * first node that carries `key`.
 */
const findNode = (node, key, depth = 0) => {
	if (!node || typeof node !== 'object' || depth > 6) return undefined
	if (node[key]) return node
	for (const value of Object.values(node)) {
		if (value && typeof value === 'object') {
			const found = findNode(value, key, depth + 1)
			if (found) return found
		}
	}
	return undefined
}

const check = async (name, fn) => {
	try {
		const detail = await fn()
		results.push({ name, status: 'PASS', detail: detail ?? '' })
	} catch (error) {
		results.push({ name, status: 'FAIL', detail: error?.message ?? String(error) })
	}
}

const assert = (condition, message) => {
	if (!condition) throw new Error(message)
}

// ── 1. package + protocol metadata ────────────────────────────────────────────
await check('package version', () => {
	const pkg = require('./package.json')
	assert(pkg.version, 'no version in package.json')
	assert(pkg.type === 'module', `expected ESM package, got type=${pkg.type}`)
	return pkg.version
})

await check('protocol version', () => {
	const version = B.DEFAULT_CONNECTION_CONFIG?.version ?? B.version
	assert(Array.isArray(version) && version.length === 3, `bad version array: ${JSON.stringify(version)}`)
	assert(version[2] > 1043857760, `protocol revision ${version[2]} is not past upstream 7.0.0-rc14 (1043857760)`)
	return version.join('.')
})

await check('rich layer exports', () => {
	const missing = [
		'prepareRichResponseMessage',
		'generateRichMessageContent',
		'buildA2uiSurface',
		'buildRichContextInfo',
		'A2UI_VERSION',
		'a2uiColumn',
		'a2uiUrlButton'
	].filter((key) => !(key in B))
	assert(!missing.length, `missing exports: ${missing.join(', ')}`)
	return `${Object.keys(B).length} exports`
})

// ── 2. interactive / nativeFlow ───────────────────────────────────────────────
await check('nativeFlow cta_url', async () => {
	const content = await build({
		text: 'NEXORA',
		footer: 'v1.0',
		nativeFlow: [{ text: 'Open site', url: 'https://example.com' }]
	})
	const type = getContentType(content)
	const buttons = content?.[type]?.nativeFlowMessage?.buttons
	assert(buttons?.length, `no nativeFlow buttons under ${type}`)
	const [button] = buttons
	assert(button.name === 'cta_url', `expected cta_url, got ${button.name}`)
	const params = JSON.parse(button.buttonParamsJson)
	assert(params.merchant_url || params.url, 'cta_url carries no url')
	return `${type} bytes=${encode(content).length}`
})

await check('nativeFlow copy + call', async () => {
	const content = await build({
		text: 'codes',
		nativeFlow: [
			{ text: 'Copy', copy: 'NEXORA-2026' },
			{ text: 'Call', call: '+233533416608' }
		]
	})
	const type = getContentType(content)
	const names = (content?.[type]?.nativeFlowMessage?.buttons ?? []).map((b) => b.name)
	assert(names.includes('cta_copy'), `missing cta_copy: ${names.join(',')}`)
	assert(names.includes('cta_call'), `missing cta_call: ${names.join(',')}`)
	return names.join(',')
})

await check('galaxyBar envelope', async () => {
	const content = await build({
		text: 'Panel',
		footer: 'tap below',
		nativeFlow: [
			{ text: 'Menu', sections: [{ title: 'Menu', rows: [{ title: 'Ping', id: 'ping' }] }] },
			{ galaxyBar: { cta: 'Open panel' } }
		]
	})
	const type = getContentType(content)
	const flow = content?.[type]?.nativeFlowMessage
	assert(flow, `no nativeFlowMessage under ${type}`)
	const galaxy = (flow.buttons ?? []).find((b) => b.name === 'galaxy_message')
	assert(galaxy, `no galaxy_message button (${(flow.buttons ?? []).map((b) => b.name).join(',')})`)
	const params = JSON.parse(galaxy.buttonParamsJson)
	assert(params.flow_id, 'galaxy button has no flow_id')
	assert(params.flow_cta, 'galaxy button has no flow_cta')
	const messageParams = JSON.parse(flow.messageParamsJson || '{}')
	assert(messageParams.limited_time_offer, 'messageParamsJson lost limited_time_offer (bar renders nothing)')
	assert(messageParams.bottom_sheet, 'messageParamsJson lost bottom_sheet (bar renders nothing)')
	assert(messageParams.limited_time_offer.expiration_time, 'limited_time_offer has no expiration_time')
	return `flow_id=${params.flow_id} bytes=${encode(content).length}`
})

// ── 3. A2UI surfaces ──────────────────────────────────────────────────────────
await check('a2ui surface', async () => {
	const content = await build({
		a2ui: {
			title: 'NEXORA',
			text: 'fallback body',
			footer: 'built locally',
			components: [
				a2uiColumn('root', ['heading', 'rule', 'label', 'open']),
				a2uiText('heading', 'Quick facts', 'h3'),
				a2uiDivider('rule'),
				a2uiText('label', 'Open the repo'),
				a2uiUrlButton('open', 'label', 'https://example.com')
			]
		}
	})
	const type = getContentType(content)
	const widget = content?.[type]?.bloksWidget
	assert(widget, `no bloksWidget under ${type}`)
	assert(widget.data, 'bloksWidget has no data')
	const surface = JSON.parse(widget.data)
	const components = surface?.createSurface?.components
	assert(Array.isArray(components) && components.length, 'surface has no components')
	const ids = new Set(components.map((c) => c.id))
	for (const component of components) {
		for (const child of [component.child, ...(component.children ?? [])].filter(Boolean)) {
			assert(ids.has(child), `component ${component.id} points at unknown "${child}"`)
		}
	}
	const referenced = new Set(
		components.flatMap((c) => [c.child, ...(c.children ?? [])]).filter(Boolean)
	)
	const roots = components.filter((c) => !referenced.has(c.id))
	assert(roots.length === 1, `expected exactly one root component, found ${roots.length}`)
	assert(surface.version === B.A2UI_VERSION, `surface version ${surface.version} != ${B.A2UI_VERSION}`)
	return `root=${roots[0].id} components=${components.length} bytes=${encode(content).length}`
})

await check('a2ui catalog components', async () => {
	// Every builder in the v0.9 basic catalog, in one surface: text, icon, media,
	// layout, tabs, a modal and the four input kinds.
	const components = [
		a2uiColumn('root', ['head', 'icon', 'tabs', 'form', 'sheet'], { justify: 'start', align: 'stretch' }),
		a2uiText('head', 'Booking', 'h3'),
		a2uiIcon('icon', 'calendarToday'),
		a2uiVideo('clip', 'https://example.com/clip.mp4'),
		a2uiAudio('voice', 'https://example.com/note.ogg', { description: 'Voice note' }),
		a2uiTabs('tabs', [{ title: 'Details', child: 'details' }, { title: 'More', child: 'more' }]),
		a2uiColumn('details', ['facts', 'rule']),
		a2uiList('facts', ['f1', 'f2'], { listStyle: 'unordered' }),
		a2uiText('f1', 'Two guests'),
		a2uiText('f2', 'Window seat'),
		a2uiColumn('more', ['f3']),
		a2uiText('f3', 'Free cancellation'),
		a2uiDivider('rule', { axis: 'horizontal' }),
		a2uiColumn('form', ['name', 'guests', 'when', 'pick', 'agree', 'goText', 'go']),
		a2uiTextField('name', 'Name', { variant: 'shortText' }),
		a2uiSlider('guests', { label: 'Guests', min: 1, max: 8, value: 2 }),
		a2uiDateTimeInput('when', { value: '2026-11-20', enableDate: true }),
		a2uiChoicePicker('pick', {
			label: 'Seating',
			options: ['Window', 'Patio'],
			value: ['Window'],
			variant: 'mutuallyExclusive',
			displayStyle: 'chips'
		}),
		a2uiCheckBox('agree', 'I agree to the terms', false),
		a2uiButton('go', 'goText', a2uiAction('openUrl', { url: 'https://example.com/book' }), {
			variant: 'primary'
		}),
		a2uiText('goText', 'Book now'),
		a2uiModal('sheet', { trigger: 'icon', content: 'more' })
	]
	const validation = validateA2uiComponents(components)
	assert(validation.ok, `validation rejected the surface: ${validation.errors.join('; ')}`)
	const content = await build({ a2ui: { title: 'Booking', text: 'fallback', components } })
	const type = getContentType(content)
	const widget = content?.[type]?.bloksWidget
	assert(widget, `no bloksWidget under ${type}`)
	const surface = JSON.parse(widget.data)
	assert(surface.createSurface.components.length === components.length, 'component count changed')
	return `${CATALOG_COMPONENT_NAMES.length} catalog names, ${components.length} nodes, bytes=${encode(content).length}`
})

await check('a2ui validation catches gaps', () => {
	const missing = validateA2uiComponents([
		a2uiColumn('root', ['img']),
		{ id: 'img', component: 'Image' },
		{ id: 'x', component: 'Nope' }
	])
	assert(!missing.ok, 'validation passed a surface it should reject')
	assert(
		missing.errors.some((e) => e.includes('"url"')),
		`missing required prop not reported: ${missing.errors.join('; ')}`
	)
	assert(
		missing.errors.some((e) => e.includes('unknown component')),
		`unknown component not reported: ${missing.errors.join('; ')}`
	)
	// false and 0 are legal values: an unchecked box is not a missing prop.
	const ok = validateA2uiComponents([
		a2uiColumn('root', ['c']),
		a2uiCheckBox('c', 'Subscribe', false)
	])
	assert(ok.ok, `unchecked box rejected: ${ok.errors.join('; ')}`)
	return `${missing.errors.length} errors caught, false value accepted`
})

await check('a2ui namespace parity', () => {
	const missing = [
		'column',
		'row',
		'list',
		'card',
		'text',
		'icon',
		'divider',
		'image',
		'video',
		'audio',
		'tabs',
		'modal',
		'button',
		'urlButton',
		'textField',
		'checkBox',
		'choicePicker',
		'slider',
		'dateTimeInput',
		'action',
		'openUrl',
		'component'
	].filter((key) => typeof A2UI[key] !== 'function')
	assert(!missing.length, `A2UI namespace missing: ${missing.join(', ')}`)
	return `${A2UI.components.length} catalog components exposed`
})

// ── 4. rich response (botForwardedMessage + unifiedResponse) ──────────────────
await check('rich response table', () => {
	const content = prepareRichResponseMessage({
		submessages: [{ type: 'table', title: 'T', headers: ['a', 'b'], rows: [['1', '2']] }]
	})
	assert(content.botForwardedMessage?.message, 'rich response is not wrapped in botForwardedMessage.message')
	const node = findNode(content.botForwardedMessage.message, 'unifiedResponse')
	assert(node, `no unifiedResponse inside ${getContentType(content.botForwardedMessage.message)}`)
	const data = node.unifiedResponse?.data
	assert(data, 'unifiedResponse.data missing (renders a blank card)')
	assert(typeof data === 'string', `unifiedResponse.data should be a base64 string, got ${typeof data}`)
	const decoded = JSON.parse(Buffer.from(data, 'base64').toString('utf8'))
	assert(decoded && typeof decoded === 'object', 'unifiedResponse.data is not base64 JSON')
	return `${getContentType(content.botForwardedMessage.message)} banner=${Boolean(decoded.sections)} bytes=${encode(content).length}`
})

// ── 5. media host fallback (a.whatsapp.net placeholder) ───────────────────────
await check('media placeholder host', async () => {
	const directPath = '/v/t62.15575-24/123_456_n.enc?ccb=11-4'
	const realFetch = globalThis.fetch
	let requested
	globalThis.fetch = async (url) => {
		requested = String(url)
		throw new Error('stop-before-network')
	}
	try {
		const mediaKey = Buffer.alloc(32, 1)
		await downloadContentFromMessage(
			{ mediaKey, directPath, url: `https://a.whatsapp.net${directPath}` },
			'image'
		).catch(() => {})
		assert(requested, 'download never reached fetch')
		assert(
			requested.startsWith('https://mmg.whatsapp.net'),
			`placeholder host was kept: ${requested.slice(0, 60)}`
		)
		requested = undefined
		await downloadContentFromMessage(
			{ mediaKey, directPath, url: `https://media-cdn-1.cdn.whatsapp.net${directPath}` },
			'image'
		).catch(() => {})
		assert(
			requested?.includes('media-cdn-1.cdn.whatsapp.net'),
			`real CDN host was dropped: ${requested}`
		)
		return 'placeholder host redirected to mmg, real CDN host preserved'
	} finally {
		globalThis.fetch = realFetch
	}
})

// ── report ────────────────────────────────────────────────────────────────────
const failed = results.filter((r) => r.status === 'FAIL')

if (JSON_MODE) {
	console.log(JSON.stringify({ results, failed: failed.length }, null, 2))
} else {
	for (const { name, status, detail } of results) {
		console.log(`${status.padEnd(4)}  ${name}${detail ? `  ::  ${detail}` : ''}`)
	}
	console.log(
		failed.length ? `\n${failed.length} of ${results.length} checks failed` : `\nall ${results.length} checks passed`
	)
}

process.exit(failed.length ? 1 : 0)
