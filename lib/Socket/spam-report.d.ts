import type { WAMessageKey } from '../Types/index.js'
export interface SpamFlowMap {
    ACCOUNT_INFO_REPORT: 'account_info_report'
    ACCOUNT_INFO_BLOCK: 'account_info_block'
    GROUP_INFO_REPORT: 'group_info_report'
    CONTACT_INFO_REPORT: 'contact_info_report'
    ONE_TO_ONE_SPAM_BANNER_REPORT: '1_1_spam_banner_report'
    MESSAGE_MENU: 'message_menu'
    OVERFLOW_MENU_REPORT: 'overflow_menu_report'
}
export type ReportReason = 'spam' | 'harassment' | 'impersonation' | 'scam' | 'other'
export interface SpamReportResult { success: boolean; reportId?: string; error?: string; messageCount?: number }
export declare const makeSpamReportSocket: (sock: any, config: any) => {
    reportSpam: (jid: string, options?: { spamFlow?: string; messages?: any[]; maxMessages?: number }) => Promise<SpamReportResult>
    reportContact: (jid: string, messageKeys?: (WAMessageKey | string)[]) => Promise<SpamReportResult>
    reportGroup: (jid: string, messageKeys?: (WAMessageKey | string)[]) => Promise<SpamReportResult>
    reportUser: (jid: string, reason?: ReportReason, waitForAckMs?: number) => Promise<boolean>
    reportMessage: (jid: string, messageId: string, reason?: ReportReason, participantJid?: string, waitForAckMs?: number) => Promise<boolean>
}
