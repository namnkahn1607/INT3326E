/**
 * Centralized API client with auth token interceptor and base error handling.
 */
import { readSessionToken } from '../features/auth/session'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/v1'

interface RequestOptions extends RequestInit {
  token?: string | null
  timeoutMs?: number
  expectedStatus?: number
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly errors: { field: string; message: string }[]

  constructor(status: number, code: string, errors: { field: string; message: string }[] = []) {
    super('Không hoàn thành được yêu cầu. Vui lòng kiểm tra và thử lại.')
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.errors = errors
  }
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  if (import.meta.env.PROD && !import.meta.env.VITE_API_URL) {
    throw new Error('VITE_API_URL is required for a production build')
  }
  const { token: suppliedToken, headers, signal, timeoutMs = 15_000, expectedStatus, ...restOptions } = options
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
  const token = suppliedToken === undefined ? await readSessionToken() : suppliedToken
  const reqHeaders = new Headers(headers)
  if (restOptions.body !== undefined && !reqHeaders.has('Content-Type')) reqHeaders.set('Content-Type', 'application/json')
  if (token) reqHeaders.set('Authorization', `Bearer ${token}`)
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
  const controller = new AbortController()
  const cancel = () => controller.abort()
  signal?.addEventListener('abort', cancel, { once: true })
  let timedOut = false
  const timer = setTimeout(() => { timedOut = true; controller.abort() }, timeoutMs)
  const base = (import.meta.env.VITE_API_URL || API_BASE_URL).replace(/\/+$/, '')
  const url = `${base}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`
  try {
    const response = await fetch(url, { ...restOptions, headers: reqHeaders, signal: controller.signal })
    if (!response.ok) {
      let body: Record<string, unknown> = {}
      try { body = await response.json() ?? {} } catch { /* Upstream errors may be HTML rather than ProblemDetails. */ }
      const errors = Array.isArray(body.errors) ? body.errors.filter((entry): entry is { field: string; message: string } =>
        !!entry && typeof entry === 'object' && typeof entry.field === 'string' && typeof entry.message === 'string') : []
      throw new ApiError(response.status, typeof body.code === 'string' ? body.code : 'HTTP_ERROR', errors)
    }
    if (expectedStatus !== undefined && response.status !== expectedStatus) throw new ApiError(response.status, 'INVALID_RESPONSE')
    try { return await response.json() as T }
    catch { throw new ApiError(response.status, 'INVALID_RESPONSE') }
  } catch (error) {
    if (timedOut) throw new ApiError(0, 'REQUEST_TIMEOUT')
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    if (error instanceof ApiError) throw error
    throw new ApiError(0, 'NETWORK_ERROR')
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', cancel)
  }
}
