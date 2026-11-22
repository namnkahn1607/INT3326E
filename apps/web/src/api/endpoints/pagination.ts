import { ApiError } from '../client'

export interface CursorPage<T> {
  data: T[]
  pagination: { limit: number; hasMore: boolean; nextCursor: string | null }
}
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)
export const hasExactKeys = (value: Record<string, unknown>, keys: string[]) =>
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))
export const invalidPage = () => new ApiError(0, 'INVALID_RESPONSE')

export function parseCursorPage<T extends { id: string }>(value: unknown, parse: (row: unknown) => T): CursorPage<T> {
  if (!isRecord(value) || !hasExactKeys(value, ['data', 'pagination']) || !Array.isArray(value.data) ||
    !isRecord(value.pagination)) throw invalidPage()
  const page = value.pagination
  if (!hasExactKeys(page, ['limit', 'hasMore', 'nextCursor']) || !Number.isSafeInteger(page.limit) ||
    (page.limit as number) < 1 || (page.limit as number) > 100 || value.data.length > (page.limit as number) ||
    typeof page.hasMore !== 'boolean' || !(page.hasMore
      ? typeof page.nextCursor === 'string' && !!page.nextCursor.trim() && value.data.length > 0
      : page.nextCursor === null)) throw invalidPage()
  const data = value.data.map(parse)
  if (new Set(data.map(row => row.id)).size !== data.length) throw invalidPage()
  return { data, pagination: page as unknown as CursorPage<T>['pagination'] }
}
