import { assertGpsLocationRequest } from '../../packages/types/src/gps'
import { createSample, driverForArrival, isAccepted, readConfig, selectTokens } from './gps-ingest-config.mjs'

const env = { BASE_URL: 'http://127.0.0.1:3000/v1/', DRIVER_TOKENS_FILE: '/private/driver-tokens.json' }
const now = Date.parse('2026-11-15T01:00:00.000Z')
const claims = (sub: string, extra = {}) => ({ sub, role: 'DRIVER', exp: now / 1000 + 3600, ...extra })
const decode = (value: string) => JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))
const token = (value: unknown) => `fixture.${Buffer.from(JSON.stringify(value)).toString('base64url')}.fixture`

describe('GPS ingest k6 configuration and contract', () => {
  it('uses a small default workload and explicit API/token input', () => {
    expect(readConfig(env)).toEqual({ profile: null, baseUrl: 'http://127.0.0.1:3000/v1', drivers: 2,
      intervalSeconds: 8, offeredEventsPerMinute: null, warmupSeconds: 0, durationSeconds: 16, timeoutSeconds: 7,
      httpP95LimitMs: null,
      tokenFile: env.DRIVER_TOKENS_FILE, summaryPath: 'gps-ingest-summary.json' })
  })

  it('locks LT01 to 500 Drivers, 62.5/s, 120s of warmup and 600s under NF05', () => {
    const lt01Env = { ...env, GPS_LOAD_PROFILE: 'LT01' }
    expect(readConfig(lt01Env)).toMatchObject({ profile: 'LT01', drivers: 500, offeredEventsPerMinute: 3750,
      warmupSeconds: 120, durationSeconds: 600, httpP95LimitMs: 150, timeoutSeconds: 7 })
    expect(() => readConfig({ ...lt01Env, DURATION_SECONDS: '90' })).toThrow('LT01 requires DURATION_SECONDS=600')
  })

  it('rotates through each Driver once per 500 arrivals, including in the measurement window', () => {
    const measurementStartsAt = 3750 * 2
    const identities = Array.from({ length: 500 }, (_, offset) => driverForArrival(measurementStartsAt + offset, 500))
    expect(new Set(identities.map(({ index }) => index)).size).toBe(500)
    expect(identities.every(({ seq }) => seq === 16)).toBe(true)
    expect(driverForArrival(measurementStartsAt + 500, 500)).toEqual({ index: 0, seq: 17 })
  })

  it('requires all 500 unique Driver tokens with enough lifetime for both LT01 phases', () => {
    const config = readConfig({ ...env, GPS_LOAD_PROFILE: 'LT01' })
    const tokens = Array.from({ length: 500 }, (_, index) => token(claims(`driver-${index}`)))
    expect(selectTokens(tokens, config, decode, now)).toHaveLength(500)
    expect(() => selectTokens(tokens.slice(1), config, decode, now)).toThrow(/at least DRIVERS/)
    tokens[499] = token(claims('driver-499', { exp: now / 1000 + 757 }))
    expect(() => selectTokens(tokens, config, decode, now)).toThrow(/entry 500 expires/)
  })

  it('accepts explicit driver count and fractional send interval', () => {
    expect(readConfig({ ...env, DRIVERS: '3', SEND_INTERVAL_SECONDS: '.5', DURATION_SECONDS: '10', REQUEST_TIMEOUT_SECONDS: '2' }))
      .toMatchObject({ drivers: 3, intervalSeconds: .5, durationSeconds: 10, timeoutSeconds: 2 })
  })

  it('accepts a fixed arrival rate in events per minute', () => {
    expect(readConfig({ ...env, OFFERED_EVENTS_PER_MINUTE: '3750' }).offeredEventsPerMinute).toBe(3750)
  })

  it.each(['', '0', '1.5'])('rejects invalid fixed arrival rates: %s', value => {
    expect(() => readConfig({ ...env, OFFERED_EVENTS_PER_MINUTE: value })).toThrow(/OFFERED_EVENTS_PER_MINUTE/)
  })

  it.each(['', 'https://user:password@example.test/v1', 'ftp://example.test/v1',
    'https://example.test', 'https://example.test/v1?token=secret', 'https://example.test/v1#x',
    'http://localhost:0/v1', 'http://localhost:65536/v1'])('rejects invalid/credential-bearing BASE_URL without echoing it', value => {
    expect(() => readConfig({ ...env, BASE_URL: value })).toThrow(/^BASE_URL must/)
  })

  it('accepts bracketed loopback IPv6 and HTTPS API bases', () => {
    expect(readConfig({ ...env, BASE_URL: 'http://[::1]:3000/v1' }).baseUrl).toBe('http://[::1]:3000/v1')
    expect(readConfig({ ...env, BASE_URL: 'https://api.example.test/v1' }).baseUrl).toBe('https://api.example.test/v1')
  })

  it.each(['0', '-1', '1.5', 'Infinity', '1driver', ' 2', ''])('rejects invalid Driver counts: %s', value => {
    expect(() => readConfig({ ...env, DRIVERS: value })).toThrow(/DRIVERS/)
  })

  it.each(['SEND_INTERVAL_SECONDS', 'DURATION_SECONDS', 'REQUEST_TIMEOUT_SECONDS'])('rejects non-positive %s', name => {
    expect(() => readConfig({ ...env, [name]: '0' })).toThrow(name)
  })

  it('requires readable token input and a nonblank output path', () => {
    expect(() => readConfig({ ...env, DRIVER_TOKENS_FILE: '' })).toThrow(/DRIVER_TOKENS_FILE/)
    expect(() => readConfig({ ...env, SUMMARY_PATH: ' ' })).toThrow(/SUMMARY_PATH/)
    expect(() => readConfig({ ...env, SEND_INTERVAL_SECONDS: '0.0001' })).toThrow(/millisecond/)
  })

  it('selects the first N unique Driver identities and rejects insufficient fixtures', () => {
    const tokens = [token(claims('first')), token(claims('second')), 'unused']
    expect(selectTokens(tokens, readConfig(env), decode, now)).toEqual(tokens.slice(0, 2))
    expect(() => selectTokens(tokens.slice(0, 1), readConfig(env), decode, now)).toThrow(/at least DRIVERS/)
  })

  it('rejects two different tokens for the same account instead of pretending they are two Drivers', () => {
    expect(() => selectTokens([token(claims('same')), token(claims('same', { exp: now / 1000 + 7200 }))],
      readConfig(env), decode, now)).toThrow(/distinct Driver/)
  })

  it.each([claims('wrong-role', { role: 'CUSTOMER' }), claims('', {}), claims('expired', { exp: now / 1000 - 1 }),
    claims('short', { exp: now / 1000 + 53 }), claims('invalid-exp', { exp: 'tomorrow' })])('rejects unsuitable token claims', value => {
    expect(() => selectTokens([token(value), token(claims('second'))], readConfig(env), decode, now)).toThrow(/Driver token entry 1/)
  })

  it('does not expose invalid token content through parse errors', () => {
    for (const value of ['private-token', 'fixture.PRIVATE_PAYLOAD.fixture', null]) {
      expect(() => selectTokens([value, token(claims('second'))], readConfig(env), decode, now))
        .toThrow('Driver token entry 1 is not a JWT')
    }
  })

  it('generates moving, valid API08 bodies without server-owned identity fields', () => {
    const first = createSample(0, 1, now)
    const next = createSample(0, 2, now + 1000)
    expect(first).not.toEqual(next)
    expect(first.lat).not.toBe(next.lat)
    expect(first.clientTimestamp).toBe('2026-11-15T01:00:00.000Z')
    for (const event of [first, next, createSample(9999, 2147483647, now)]) {
      expect(() => assertGpsLocationRequest(event)).not.toThrow()
      expect(Object.keys(event).sort()).toEqual(['clientTimestamp', 'lat', 'lng', 'seq'])
    }
    expect(() => createSample(0, 2147483648, now)).toThrow(/sequence/)
  })

  it.each([200, 201, 400, 401, 503])('does not accept HTTP %s even with a valid-looking body', status => {
    expect(isAccepted(status, { status: 'ACCEPTED', eventId: 'event', receivedAt: '2026-11-15T01:00:00.000Z' })).toBe(false)
  })

  it.each([null, [], {}, { status: 'OK', eventId: 'event', receivedAt: '2026-11-15T01:00:00.000Z' },
    { status: 'ACCEPTED', eventId: '', receivedAt: '2026-11-15T01:00:00.000Z' },
    { status: 'ACCEPTED', eventId: 'event', receivedAt: '2026-02-30T01:00:00.000Z' },
    { status: 'ACCEPTED', eventId: 'event', receivedAt: '2026-11-15T01:00:00Z' }])('rejects malformed 202 bodies', body => {
    expect(isAccepted(202, body)).toBe(false)
  })

  it('accepts only a canonical API08 acceptance response', () => {
    expect(isAccepted(202, { status: 'ACCEPTED', eventId: 'event', receivedAt: '2026-11-15T01:00:00.000Z' })).toBe(true)
  })
})
