/**
 * Centralized API client with auth token interceptor and base error handling.
 */
import { readSessionToken } from '../features/auth/session'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/v1'

interface RequestOptions extends RequestInit {
  token?: string | null
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  if (import.meta.env.PROD && !import.meta.env.VITE_API_URL) {
    throw new Error('VITE_API_URL is required for a production build')
  }
  const { token: suppliedToken, headers, ...restOptions } = options
  const token = suppliedToken === undefined ? await readSessionToken() : suppliedToken

  const reqHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string>),
  }

  if (token) {
    reqHeaders['Authorization'] = `Bearer ${token}`
  }

  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`
  const response = await fetch(url, {
    ...restOptions,
    headers: reqHeaders,
  })

  if (!response.ok) {
    let errorBody: unknown
    try {
      errorBody = await response.json()
    } catch {
      errorBody = await response.text()
    }
    throw new Error(
      `API Error [${response.status}] ${response.statusText}: ${JSON.stringify(errorBody)}`
    )
  }

  return response.json() as Promise<T>
}
