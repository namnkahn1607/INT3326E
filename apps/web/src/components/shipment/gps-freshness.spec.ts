import { describe, expect, it } from 'vitest'
import { gpsFreshness } from './gps-freshness'

const point = { lat: 0, lng: 0 }, timestamp = '2026-10-30T03:00:00.000Z', start = Date.parse(timestamp)
describe('GPS age from sample timestamp', () => {
  it.each([0, 30_000])('includes boundary %sms', age => expect(gpsFreshness(point, timestamp, false, start + age)).toBe('fresh'))
  it.each([-1, 30_001])('marks future/old age %sms stale', age => expect(gpsFreshness(point, timestamp, false, start + age)).toBe('stale'))
  it('never overrides server stale and never invents a missing location', () => {
    expect(gpsFreshness(point, timestamp, true, start)).toBe('stale')
    expect(gpsFreshness(null, null, null, start)).toBe('missing')
    expect(gpsFreshness(point, 'invalid', false, start)).toBe('stale')
  })
})
