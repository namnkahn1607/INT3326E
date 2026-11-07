import type { UserProfile } from './context'

export const ROLE_HOME = { CUSTOMER: '/customer', DRIVER: '/driver', ADMIN: '/admin' } as const

export function isRole(value: unknown): value is UserProfile['role'] {
  return typeof value === 'string' && Object.hasOwn(ROLE_HOME, value)
}

export function parseAccount(value: unknown): UserProfile {
  if (!value || typeof value !== 'object') throw new Error('Thông tin tài khoản không hợp lệ.')
  const account = value as Record<string, unknown>
  if (typeof account.uid !== 'string' || !account.uid || !isRole(account.role) ||
      (account.email !== undefined && typeof account.email !== 'string')) {
    throw new Error('Tài khoản chưa được cấp quyền hợp lệ. Liên hệ người quản trị.')
  }
  return { id: account.uid, email: account.email as string ?? '', role: account.role,
    displayName: account.email as string ?? account.uid }
}

type TokenReader = () => Promise<string | null>
let tokenReader: TokenReader = async () => null

export function setTokenReader(reader: TokenReader) { tokenReader = reader }
export function readSessionToken() { return tokenReader() }
