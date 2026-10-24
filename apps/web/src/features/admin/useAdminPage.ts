import { useEffect, useState } from 'react'

interface Page<T> { data: T[]; pagination: { limit: number; hasMore: boolean; nextCursor: string | null } }

export function useAdminPage<T>(load: (cursor: string | undefined, signal: AbortSignal) => Promise<Page<T>>, scope: string) {
  const [paging, setPaging] = useState<{ scope: string; cursors: (string | undefined)[] }>({ scope, cursors: [undefined] })
  const cursors = paging.scope === scope ? paging.cursors : [undefined]
  const [revision, setRevision] = useState(0)
  const cursor = cursors.at(-1)
  const key = JSON.stringify([scope, cursor, revision])
  const [result, setResult] = useState<{ key: string; page?: Page<T>; error?: unknown }>()
  useEffect(() => {
    const controller = new AbortController()
    load(cursor, controller.signal).then(page => {
      if (!controller.signal.aborted) setResult({ key, page })
    }).catch(error => { if (!controller.signal.aborted) setResult({ key, error }) })
    return () => controller.abort()
  }, [load, cursor, key])
  const current = result?.key === key ? result : undefined
  const page = current?.page
  return {
    key, page, error: current?.error, loading: !current, number: cursors.length,
    refresh: () => setRevision(value => value + 1),
    previous: () => { if (cursors.length > 1) setPaging({ scope, cursors: cursors.slice(0, -1) }) },
    next: () => { if (page?.pagination.hasMore && page.pagination.nextCursor) setPaging({ scope, cursors: [...cursors, page.pagination.nextCursor] }) },
  }
}
