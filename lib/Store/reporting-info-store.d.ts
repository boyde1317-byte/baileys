export interface ReportingInfoEntry {
    stanzaId: string
    timestamp: number
    reportingTag: Uint8Array
    reportingToken?: Uint8Array | null
    tokenVersion?: number | null
    validationPolicy?: string | null
    text?: string
    pushName?: string
    messageType?: string
    fromJid?: string
}
export interface ReportingInfoStore {
    add(jid: string, entry: ReportingInfoEntry): void
    getForJid(jid: string, max?: number): ReportingInfoEntry[]
    clear(jid: string): void
    listJids(): string[]
    size(): number
}
export declare const createReportingInfoStore: () => ReportingInfoStore
