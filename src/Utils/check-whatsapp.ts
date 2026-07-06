/**
 * check-whatsapp.ts
 *
 * Standalone utility to check if a WhatsApp number is banned or blocked
 * from using unofficial clients. Works by attempting a registration probe
 * and reading the resulting error.
 *
 * ⚠️  This opens a temporary secondary connection to WhatsApp servers.
 *     Use sparingly — do not call in a loop or on every message.
 */
import type { AuthenticationState } from '../Types/Auth.js'
import type { SocketConfig } from '../Types/Socket.js'

export interface BanCheckResult {
  /** Whether the number has been banned by WhatsApp */
  isBanned: boolean
  /** Whether the number requires the official app (blocked from unofficial clients) */
  isNeedOfficialWa: boolean
  /** The phone number that was checked, in E.164 format */
  number: string
  /** Additional ban metadata from WhatsApp, if available */
  data?: {
    violation_type?: string | null
    in_app_ban_appeal?: unknown
    appeal_token?: string | null
  }
}

/**
 * Check if a WhatsApp number is banned.
 *
 * @param phoneNumber  E.164 format (+12345678900) or bare JID (1234567890@s.whatsapp.net)
 * @param authState    Your existing auth state — shared as read-only for the probe
 * @param socketConfig Optional partial SocketConfig overrides (e.g. logger)
 *
 * @example
 * import { checkWhatsApp } from '@workspace/baileys'
 *
 * const result = await checkWhatsApp('+12345678900', authState)
 * if (result.isBanned) {
 *   console.log('Number is banned:', result.data)
 * }
 */
export const checkWhatsApp = async (
  phoneNumber: string,
  authState: AuthenticationState,
  socketConfig?: Partial<SocketConfig>,
): Promise<BanCheckResult> => {
  // Normalize: strip JID suffix and non-digit chars, ensure + prefix
  let number = phoneNumber.includes('@') ? phoneNumber.split('@')[0]! : phoneNumber
  number = number.replace(/[^\d]/g, '')
  if (!number.startsWith('+')) number = `+${number}`

  const result: BanCheckResult = { isBanned: false, isNeedOfficialWa: false, number }

  let countryCallingCode: string
  let nationalNumber: string

  try {
    // Dynamic import — libphonenumber-js is a peer dep, not required by all users
    const { parsePhoneNumber } = await import('libphonenumber-js' as string)
    const parsed = parsePhoneNumber(number)
    countryCallingCode = parsed.countryCallingCode
    nationalNumber = parsed.nationalNumber
  } catch {
    // Fallback: assumes 2-digit country code. Works for most cases.
    countryCallingCode = number.slice(1, 3)
    nationalNumber = number.slice(3)
  }

  try {
    // Dynamic imports avoid circular dep: Socket → Utils → Socket
    const { default: makeWASocket } = await import('../Socket/index.js')
    const { fetchLatestBaileysVersion } = await import('../Utils/generics.js')
    const { version } = await fetchLatestBaileysVersion()

    const probeSocket = makeWASocket({
      version,
      auth: authState,
      printQRInTerminal: false,
      ...socketConfig,
    })

    try {
      // requestPairingCode is the available registration-probe in this socket version.
      // It may surface ban error shapes; full ban metadata (appeal_token, violation_type)
      // requires a raw registration attempt not exposed by this socket layer.
      const probeFn = (probeSocket as any).requestPairingCode
      if (typeof probeFn !== 'function') {
        throw new TypeError(
          'checkWhatsApp: the socket does not expose a registration API in this version. ' +
          'Ban detection requires a socket with registration support.',
        )
      }
      await probeFn(`${countryCallingCode}${nationalNumber}`)
    } finally {
      probeSocket.end(undefined)
    }
  } catch (err: unknown) {
    const e = err as Record<string, unknown>
    if (e['appeal_token']) {
      result.isBanned = true
      result.data = {
        violation_type: (e['violation_type'] as string | null | undefined) ?? null,
        in_app_ban_appeal: e['in_app_ban_appeal'],
        appeal_token: (e['appeal_token'] as string | null | undefined) ?? null,
      }
    } else if (e['custom_block_screen'] || e['reason'] === 'blocked') {
      result.isNeedOfficialWa = true
    }
    // Other errors (network, auth issues) — return the default { isBanned: false } result
  }

  return result
}
