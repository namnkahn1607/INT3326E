export const MAX_GPS_ACCURACY_METERS = 100
export const MAX_GPS_SAMPLE_AGE_MS = 30_000
export const MAX_GPS_FUTURE_SKEW_MS = 60_000

export function isGpsTimestampInWindow(timestamp: number, maxAgeMs: number): boolean {
  const age = Date.now() - timestamp
  return Number.isFinite(timestamp) && age <= maxAgeMs && age >= -MAX_GPS_FUTURE_SKEW_MS
}
