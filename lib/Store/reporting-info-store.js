/**
 * Per-JID store of WhatsApp `reporting_tag` metadata captured from incoming stanzas.
 * Reporting tags are forwardable only from the original stanza, so they must be
 * persisted when a message arrives, not when a report is later requested.
 */
export const createReportingInfoStore = () => {
    const byJid = new Map()
    const normalizeKey = jid => (jid || '').toLowerCase()
    return {
        add(jid, entry) {
            const key = normalizeKey(jid)
            if (!key || !entry?.stanzaId || !entry?.reportingTag?.length) return
            const list = byJid.get(key) || []
            const idx = list.findIndex(e => e.stanzaId === entry.stanzaId)
            if (idx >= 0) list[idx] = entry
            else list.push(entry)
            list.sort((a, b) => b.timestamp - a.timestamp)
            byJid.set(key, list)
        },
        getForJid(jid, max = 5) {
            return (byJid.get(normalizeKey(jid)) || []).slice(0, max)
        },
        clear(jid) {
            byJid.delete(normalizeKey(jid))
        },
        listJids() {
            return [...byJid.keys()]
        },
        size() {
            let n = 0
            for (const list of byJid.values()) n += list.length
            return n
        }
    }
}
