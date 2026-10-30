import type { Coordinates } from '../../types/shipment-api'

export function gpsFreshness(location: Coordinates | null, timestamp: string | null, stale: boolean | null, now: number) {
  if (!location || !timestamp) return 'missing' as const
  const age = now - Date.parse(timestamp)
  return stale || !Number.isFinite(age) || age < 0 || age > 30_000 ? 'stale' as const : 'fresh' as const
}
