import { getBinaryNodeChild, getBinaryNodeChildString, isLidUser, isHostedLidUser, isJidGroup, S_WHATSAPP_NET } from '../WABinary/index.js'
import { extractMessageContent } from './messages.js'

/** How WhatsApp routes a report internally. Override with options.spamFlow on reportSpam(). */
export const SPAM_FLOWS = {
    ACCOUNT_INFO_REPORT: 'account_info_report',
    ACCOUNT_INFO_BLOCK: 'account_info_block',
    GROUP_INFO_REPORT: 'group_info_report',
    CONTACT_INFO_REPORT: 'contact_info_report',
    ONE_TO_ONE_SPAM_BANNER_REPORT: '1_1_spam_banner_report',
    MESSAGE_MENU: 'message_menu',
    OVERFLOW_MENU_REPORT: 'overflow_menu_report',
}

/** Numeric reason codes for the w:report IQ, used by reportUser() and reportMessage(). */
export const REPORT_REASON_CODES = { spam: 1, harassment: 2, impersonation: 3, scam: 4, other: 5 }

const toBuffer = data => {
    if (!data) return null
    if (Buffer.isBuffer(data)) return data
    if (data instanceof Uint8Array) return Buffer.from(data)
    if (typeof data === 'string') return Buffer.from(data, 'base64')
    return null
}

/** Resolves a PN JID to its LID for tag-based spam IQs. Groups and LID JIDs pass through. */
export const resolveReportJid = async (jid, lidMapping) => {
    if (!jid) throw new Error('resolveReportJid: jid required')
    if (isJidGroup(jid) || isLidUser(jid) || isHostedLidUser(jid)) return jid
    const lid = lidMapping?.getLIDForPN ? await lidMapping.getLIDForPN(jid) : null
    return lid ?? jid
}

/** Auto-detects JID type. Returns { reportJid, spamFlow, isGroup }. */
export const resolveReportContext = async (jid, lidMapping) => {
    if (!jid) throw new Error('resolveReportContext: jid required')
    if (isJidGroup(jid)) return { reportJid: jid, spamFlow: SPAM_FLOWS.GROUP_INFO_REPORT, isGroup: true }
    return { reportJid: await resolveReportJid(jid, lidMapping), spamFlow: SPAM_FLOWS.ACCOUNT_INFO_REPORT, isGroup: false }
}

/** Normalizes a raw reporting_tag to a Buffer, or null when invalid/empty. */
export const normalizeReportingTag = tag => {
    const buf = toBuffer(tag)
    return buf?.length ? buf : null
}

/** Extracts plain text from a WAMessage across common message types. */
export const extractMessageText = msg => {
    if (!msg?.message) return ''
    const c = extractMessageContent(msg.message)
    if (!c) return ''
    return c.conversation ?? c.extendedTextMessage?.text ?? c.imageMessage?.caption ?? c.videoMessage?.caption ?? ''
}

/**
 * Extracts { stanzaId, timestamp, reportingTag, reportingToken, tokenVersion, validationPolicy }
 * from a raw incoming binary stanza. Persist the result in a reporting info store so
 * reportSpam() can use the tags later.
 */
export const extractReportingInfoFromStanza = stanza => {
    const reporting = getBinaryNodeChild(stanza, 'reporting')
    if (!reporting) return null
    const tokenNode = getBinaryNodeChild(reporting, 'reporting_token')
    const tagNode = getBinaryNodeChild(reporting, 'reporting_tag') ||
        getBinaryNodeChild(getBinaryNodeChild(reporting, 'reporting_validation'), 'reporting_tag')
    if (!tagNode?.content) return null
    const raw = tagNode.content
    const reportingTag = toBuffer(raw instanceof Uint8Array || Buffer.isBuffer(raw) ? raw : typeof raw === 'string' ? raw : null)
    if (!reportingTag?.length) return null
    const stanzaId = tagNode.attrs?.id || stanza.attrs?.id
    if (!stanzaId) return null
    const tsRaw = tagNode.attrs?.ts_s || stanza.attrs?.t
    return {
        stanzaId,
        timestamp: tsRaw ? Number(tsRaw) : 0,
        reportingTag,
        reportingToken: tokenNode?.content ? toBuffer(tokenNode.content) : null,
        tokenVersion: tokenNode?.attrs?.v ? parseInt(tokenNode.attrs.v) : null,
        validationPolicy: reporting.attrs?.validation_policy || null,
    }
}

/** Builds <message> child nodes for a spam_list IQ. Throws when nothing survives filtering. */
export const buildSpamReportMessageNodes = (messages, logger) => {
    const ts = () => Math.floor(Date.now() / 1000)
    const nodes = messages.slice(0, 5).reduce((acc, m) => {
        const reportingTag = normalizeReportingTag(m.reportingTag)
        if (!reportingTag) {
            logger?.warn?.({ stanzaId: m.stanzaId }, 'buildSpamReportMessageNodes: skipping — missing reportingTag')
            return acc
        }
        const t = String(m.timestamp || ts())
        acc.push({
            tag: 'message',
            attrs: { t, id: m.stanzaId, reported_push_name: m.pushName || '', type: m.messageType || 'text', from: m.fromJid },
            content: [
                { tag: 'raw', attrs: { local_message_type: '0', v: '2' }, content: m.text != null ? String(m.text) : '' },
                { tag: 'reporting', attrs: {}, content: [{ tag: 'reporting_validation', attrs: {}, content: [{ tag: 'reporting_tag', attrs: { id: m.stanzaId, ts_s: t }, content: reportingTag }] }] },
            ],
        })
        return acc
    }, [])
    if (!nodes.length) {
        logger?.error?.({}, 'buildSpamReportMessageNodes: all messages filtered — none had a valid reportingTag')
        throw new Error('reportSpam: no valid messages with reportingTag after filtering')
    }
    return nodes
}

/** Builds the xmlns="spam" IQ for tag-based reporting, used by reportSpam(). */
export const buildSpamReportIq = (jid, messages, spamFlow = SPAM_FLOWS.ACCOUNT_INFO_REPORT, logger) => {
    if (!messages?.length) {
        logger?.error?.({ jid, spamFlow }, 'buildSpamReportIq: called with empty messages array')
        throw new Error('reportSpam: at least one message with reporting_tag required')
    }
    return {
        tag: 'iq',
        attrs: { type: 'set', xmlns: 'spam', to: S_WHATSAPP_NET },
        content: [{ tag: 'spam_list', attrs: { jid, spam_flow: spamFlow }, content: buildSpamReportMessageNodes(messages, logger) }],
    }
}

/** Builds the simpler xmlns="spam" <report> node, used by reportContact() and reportGroup(). */
export const buildSimpleReportNode = (jid, messageKeys) => ({
    tag: 'report',
    attrs: { jid, type: 'spam' },
    content: (messageKeys || []).map(key => ({ tag: 'message', attrs: { id: key.id || key, ...(key.fromMe ? {} : { from: jid }) } })),
})

/** Parses the IQ result node from any spam report query. */
export const parseSpamReportResponse = result => {
    if (!result) return { success: false, error: 'empty response' }
    if (result.attrs?.type === 'error') {
        const errNode = getBinaryNodeChild(result, 'error')
        const code = errNode?.attrs?.code
        const text = errNode?.content?.toString?.() || errNode?.attrs?.text
        return { success: false, error: `spam IQ error${code ? ` ${code}` : ''}${text ? `: ${text}` : ''}` }
    }
    const reportNode = getBinaryNodeChild(result, 'report')
    const reportId = reportNode?.attrs?.id || getBinaryNodeChildString(reportNode, 'id')
    if (reportId) return { success: true, reportId: String(reportId) }
    if (result.attrs?.type === 'result') return { success: true }
    return { success: false, error: 'unexpected spam IQ response' }
}
