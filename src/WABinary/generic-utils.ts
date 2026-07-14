import { Boom } from '@hapi/boom'
import { randomBytes } from 'crypto'
import { proto } from '../../WAProto/index.js'
import { type BinaryNode } from './types'

// some extra useful utilities

const DECISION_SOURCE_CONTENT: BinaryNode[] = [
	{
		tag: 'decision_source',
		attrs: { value: 'df' }
	}
]

const NATIVE_FLOW_ATTRIBUTE = { type: 'native_flow', v: '1' }

const MIXED_NATIVE_FLOW: BinaryNode = {
	tag: 'interactive',
	attrs: NATIVE_FLOW_ATTRIBUTE,
	content: [
		{
			tag: 'native_flow',
			attrs: { v: '9', name: 'mixed' }
		}
	]
}

const LIST_TYPE_CONTENT: BinaryNode = {
	tag: 'list',
	attrs: { v: '2', type: 'product_list' }
}

/**
 * Builds the `<biz>` binary node that must accompany interactive/button
 * messages (buttons, lists, templates, native-flow interactive messages).
 * Without this node WhatsApp clients will not activate the buttons even
 * though the message content itself is well-formed.
 */
export const getBizBinaryNode = (message: proto.IMessage | null | undefined): BinaryNode => {
	const flowMsg = (message?.interactiveMessage as any)?.nativeFlowMessage
	const firstButtonName = flowMsg?.buttons?.[0]?.name

	const qualityContent: BinaryNode = {
		tag: 'quality_control',
		attrs: {
			decision_id: randomBytes(20).toString('hex'),
			source_type: 'third_party'
		},
		content: DECISION_SOURCE_CONTENT
	}

	const bizAttributes: Record<string, string> = {
		actual_actors: '2',
		host_storage: '2',
		privacy_mode_ts: `${Math.floor(Date.now() / 1_000)}`
	}

	if (firstButtonName === 'review_and_pay' || firstButtonName === 'payment_info') {
		bizAttributes.native_flow_name = firstButtonName === 'review_and_pay' ? 'order_details' : firstButtonName
		return {
			tag: 'biz',
			attrs: bizAttributes,
			content: [qualityContent]
		}
	}

	if (flowMsg || message?.buttonsMessage || message?.templateMessage) {
		return {
			tag: 'biz',
			attrs: bizAttributes,
			content: [MIXED_NATIVE_FLOW, qualityContent]
		}
	}

	if (message?.listMessage) {
		return {
			tag: 'biz',
			attrs: bizAttributes,
			content: [LIST_TYPE_CONTENT, qualityContent]
		}
	}

	return {
		tag: 'biz',
		attrs: bizAttributes,
		content: [qualityContent]
	}
}

const indexCache = new WeakMap<BinaryNode, Map<string, BinaryNode[]>>()

export const getBinaryNodeChildren = (node: BinaryNode | undefined, childTag: string) => {
	if (!node || !Array.isArray(node.content)) return []

	let index = indexCache.get(node)

	// Build the index once per node
	if (!index) {
		index = new Map<string, BinaryNode[]>()

		for (const child of node.content) {
			let arr = index.get(child.tag)
			if (!arr) index.set(child.tag, (arr = []))
			arr.push(child)
		}

		indexCache.set(node, index)
	}

	// Return first matching child
	return index.get(childTag) || []
}

export const getBinaryNodeChild = (node: BinaryNode | undefined, childTag: string) => {
	return getBinaryNodeChildren(node, childTag)[0]
}

export const getAllBinaryNodeChildren = ({ content }: BinaryNode) => {
	if (Array.isArray(content)) {
		return content
	}

	return []
}

export const getBinaryNodeChildBuffer = (node: BinaryNode | undefined, childTag: string) => {
	const child = getBinaryNodeChild(node, childTag)?.content
	if (Buffer.isBuffer(child) || child instanceof Uint8Array) {
		return child
	}
}

export const getBinaryNodeChildString = (node: BinaryNode | undefined, childTag: string) => {
	const child = getBinaryNodeChild(node, childTag)?.content
	if (Buffer.isBuffer(child) || child instanceof Uint8Array) {
		return Buffer.from(child).toString('utf-8')
	} else if (typeof child === 'string') {
		return child
	}
}

export const getBinaryNodeChildUInt = (node: BinaryNode, childTag: string, length: number) => {
	const buff = getBinaryNodeChildBuffer(node, childTag)
	if (buff) {
		return bufferToUInt(buff, length)
	}
}

export const assertNodeErrorFree = (node: BinaryNode) => {
	const errNode = getBinaryNodeChild(node, 'error')
	if (errNode) {
		throw new Boom(errNode.attrs.text || 'Unknown error', { data: +errNode.attrs.code! })
	}
}

export const reduceBinaryNodeToDictionary = (node: BinaryNode, tag: string) => {
	const nodes = getBinaryNodeChildren(node, tag)
	const dict = nodes.reduce(
		(dict, { attrs }) => {
			if (typeof attrs.name === 'string') {
				dict[attrs.name] = attrs.value! || attrs.config_value!
			} else {
				dict[attrs.config_code!] = attrs.value! || attrs.config_value!
			}

			return dict
		},
		{} as { [_: string]: string }
	)
	return dict
}

export const getBinaryNodeMessages = ({ content }: BinaryNode) => {
	const msgs: proto.WebMessageInfo[] = []
	if (Array.isArray(content)) {
		for (const item of content) {
			if (item.tag === 'message') {
				msgs.push(proto.WebMessageInfo.decode(item.content as Buffer).toJSON() as proto.WebMessageInfo)
			}
		}
	}

	return msgs
}

function bufferToUInt(e: Uint8Array | Buffer, t: number) {
	let a = 0
	for (let i = 0; i < t; i++) {
		a = 256 * a + e[i]!
	}

	return a
}

const tabs = (n: number) => '\t'.repeat(n)

export function binaryNodeToString(node: BinaryNode | BinaryNode['content'], i = 0): string {
	if (!node) {
		return node!
	}

	if (typeof node === 'string') {
		return tabs(i) + node
	}

	if (node instanceof Uint8Array) {
		return tabs(i) + Buffer.from(node).toString('hex')
	}

	if (Array.isArray(node)) {
		return node.map(x => tabs(i + 1) + binaryNodeToString(x, i + 1)).join('\n')
	}

	const children = binaryNodeToString(node.content, i + 1)

	const tag = `<${node.tag} ${Object.entries(node.attrs || {})
		.filter(([, v]) => v !== undefined)
		.map(([k, v]) => `${k}='${v}'`)
		.join(' ')}`

	const content: string = children ? `>\n${children}\n${tabs(i)}</${node.tag}>` : '/>'

	return tag + content
}
