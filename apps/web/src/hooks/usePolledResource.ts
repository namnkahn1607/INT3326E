import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '../api/client'

interface Result<T> { key: string; data: T | null; error: unknown; refreshing: boolean; updatedAt: number | null }
export function usePolledResource<T>(load: (signal: AbortSignal) => Promise<T>, scope: string | undefined,
  intervalMs = 5000, shouldStop?: (data: T) => boolean) {
  const [revision, setRevision] = useState(0)
  const key = JSON.stringify([scope, revision])
  const [result, setResult] = useState<Result<T>>()
  const refresh = useCallback(() => setRevision(value => value + 1), [])
  useEffect(() => {
    if (scope === undefined) return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    async function read() {
      setResult(previous => ({ key, data: previous?.key === key ? previous.data : null,
        updatedAt: previous?.key === key ? previous.updatedAt : null, error: null, refreshing: true }))
      let stopped: boolean
      try {
        const data = await load(controller.signal)
        if (controller.signal.aborted) return
        stopped = shouldStop?.(data) ?? false
        setResult({ key, data, updatedAt: Date.now(), error: null, refreshing: false })
      } catch (error) {
        if (controller.signal.aborted) return
        stopped = error instanceof ApiError && ([401, 403, 404].includes(error.status) ||
          ['INVALID_RESPONSE', 'INVALID_SHIPMENT_ID', 'USER_NOT_PROVISIONED'].includes(error.code))
        setResult({ key, data: null, updatedAt: null, error, refreshing: false })
      }
      if (!controller.signal.aborted && !stopped) timer = setTimeout(() => void read(), Math.max(5000, intervalMs))
    }
    void read()
    return () => { controller.abort(); clearTimeout(timer) }
  }, [load, scope, key, intervalMs, shouldStop])
  const current = scope !== undefined && result?.key === key ? result : undefined
  return { data: current?.data ?? null, error: current?.error ?? null, loading: scope !== undefined && (!current || (!current.data && current.refreshing)),
    refreshing: current?.refreshing ?? false, updatedAt: current?.updatedAt ?? null, refresh }
}
