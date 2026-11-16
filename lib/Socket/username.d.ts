export interface UsernameCheck {
    available: boolean
    username: string
    session_id: string
    suggestions?: string[]
    rejectionReasons?: string[]
    suggestionsEligible?: boolean
}
export interface ContactUsername { id: string; username?: string; contact?: boolean }
export declare const makeUsernameSocket: (config: any) => {
    checkUsername: (username: string, includeSuggestions?: boolean, sessionId?: string) => Promise<UsernameCheck>
    checkUsernameMulti: (usernames: string[]) => Promise<any>
    setUsername: (username: string, options?: { source?: string; sessionId?: string; pin?: string }) => Promise<any>
    checkAndSetUsername: (username: string) => Promise<any>
    deleteUsername: () => Promise<any>
    getMyUsername: () => Promise<string | null>
    getUsernameRecommendations: (source?: string | null) => Promise<any>
    setUsernamePin: (pin?: string | null) => Promise<any>
    findUserByUsername: (username: string, pin?: string) => Promise<{ jid: string; contact: boolean } | null>
    fetchContactUsernames: (...jids: string[]) => Promise<ContactUsername[]>
}
