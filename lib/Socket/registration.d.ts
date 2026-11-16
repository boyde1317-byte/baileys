import type { SocketConfig } from '../Types/index.js'
export interface RegistrationOptions {
    phoneNumberCountryCode: string
    phoneNumberNationalNumber: string
    phoneNumberMobileCountryCode: string
    phoneNumberMobileNetworkCode?: string
    method?: 'sms' | 'voice' | 'flash' | 'wa_old'
    captcha?: string
}
export declare const makeRegistrationSocket: <T extends Partial<SocketConfig>>(config: T) => {
    register: (code: string) => Promise<{ login: string; status: string }>
    requestRegistrationCode: (options?: RegistrationOptions) => Promise<{ status: string }>
} & Record<string, any>
export declare function getBanDetails(appealToken: string): Promise<unknown>
export declare function registrationParams(params: any): Record<string, any>
export declare function mobileRegisterCode(params: any, fetchOptions?: any): Promise<any>
export declare function mobileRegisterExists(params: any, fetchOptions?: any): Promise<any>
export declare function mobileRegister(params: any, fetchOptions?: any): Promise<any>
export declare function mobileRegisterEncrypt(data: string | Uint8Array): string
export declare function mobileRegisterFetch(path: string, opts?: any): Promise<any>
