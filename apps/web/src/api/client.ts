/**
 * Centralized API client with auth token interceptor and base error handling.
 */
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/v1'

interface RequestOptions extends RequestInit {
  token?: string | null
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { token, headers, ...restOptions } = options

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
