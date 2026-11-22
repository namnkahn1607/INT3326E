import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { trackingConfig, trackingFixtures, locationState, percentile, runTrackingRead, trackingSummary } from './tracking-read.mjs'

const shipmentId = 'sh_01ARZ3NDEKTSV4RRFFQ69G5FAV', driverId = 'usr_01ARZ3NDEKTSV4RRFFQ69G5FAX'
const now = Date.now(), time = new Date(now).toISOString()
const env = { BASE_URL: 'http://127.0.0.1:3000/v1', TRACKING_FIXTURES_FILE: '/private/fixtures.json' }
const config = () => trackingConfig(env)
const body = (change = {}) => ({ shipmentId, driverId, status: 'PICKED_UP',
  pickupLocation: { lat: 21, lng: 105 }, dropoffLocation: { lat: 21.1, lng: 105.1 },
  currentDriverLocation: { lat: 21.05, lng: 105.05 }, lastLocationUpdatedAt: time,
  locationClientTimestamp: time, isLocationStale: false, eta: null, etaUnavailableReason: 'CONFIG_INVALID',
  expectedDeliveryAt: null, isLate: null, ...change })
const token = (role = 'CUSTOMER', exp = now / 1000 + 3600) => `fixture.${Buffer.from(JSON.stringify({ sub: 'test-user', role, exp })).toString('base64url')}.fixture`

describe('Tracking read workload and honest latency reporting', () => {
  it('uses the LT04 workload and exact 5s/10s rate', () => {
    expect(config()).toMatchObject({ pollers: 500, intervalSeconds: 5, durationSeconds: 600, timeoutMs: 5000 })
    expect(trackingConfig({ ...env, POLL_INTERVAL_SECONDS: '10' }).intervalSeconds).toBe(10)
    expect(() => trackingConfig({ ...env, POLL_INTERVAL_SECONDS: '8' })).toThrow(/5 or 10/)
    expect(() => trackingConfig({ ...env, POLLERS: '0' })).toThrow(/POLLERS/)
  })
  it.each(['https://user:password@example.test/v1', 'https://api.example.test/v1?token=private', 'file:///v1'])('rejects unsafe API bases without echoing %s', base => {
    expect(() => trackingConfig({ ...env, BASE_URL: base })).toThrow(/^BASE_URL must/)
  })
  it('checks fixture scope and expiry without exposing token contents', () => {
    expect(trackingFixtures([{ shipmentId, token: token() }], config(), now)[0].role).toBe('CUSTOMER')
    for (const invalidToken of [token('DRIVER'), token('CUSTOMER', now / 1000 + 20), 'private']) {
      expect(() => trackingFixtures([{ shipmentId, token: invalidToken }], config(), now)).toThrow(/^Tracking fixture 1 must/)
    }
    expect(() => trackingFixtures([], config())).toThrow(/nonempty/)
  })
  it('keeps warmup separate and calculates nearest-rank p95 across raw completions, not averages', () => {
    expect(percentile([1, 2, 3, 4, 500], .95)).toBe(500)
    const rows = [1, 2, 3, 4, 500].map(durationMs => ({ phase: 'measurement', outcome: 'success', completed: true, durationMs, startLatenessMs: 0 }))
    rows.push({ phase: 'warmup', outcome: 'success', completed: true, durationMs: 9999, startLatenessMs: 0 })
    const result = trackingSummary(rows, { ...config(), pollers: 25, durationSeconds: 1, warmupSeconds: 1 })
    expect(result.measurement.p95CompletedMs).toBe(500)
    expect(result.measurement.latencyAndWorkloadPass).toBe(false)
    expect(result.warmup.p95CompletedMs).toBe(9999)
    expect(result.fullLt04Window).toBe(false)
  })
  it('cannot pass a fast p95 when a timeout, invalid response or dropped start exists', () => {
    for (const outcome of ['timeout', 'invalid_response', 'dropped']) {
      const rows = [{ phase: 'measurement', outcome: 'success', completed: true, durationMs: 1, startLatenessMs: 0 },
        { phase: 'measurement', outcome, completed: outcome === 'invalid_response', durationMs: 5000, startLatenessMs: 0 }]
      const result = trackingSummary(rows, { ...config(), pollers: 10, durationSeconds: 1 })
      expect(result.measurement.latencyAndWorkloadPass).toBe(false)
      expect(result.measurement.scheduled).toBe(2)
      expect(result.measurement.started + result.measurement.dropped).toBe(2)
    }
  })
  it('checks fresh, stale, null and hidden SC05 responses including role-safe terminal projection', () => {
    expect(locationState(body(), shipmentId)).toBe('fresh')
    expect(locationState(body({ isLocationStale: true, etaUnavailableReason: 'LOCATION_STALE' }), shipmentId)).toBe('stale')
    const empty = { currentDriverLocation: null, locationClientTimestamp: null, lastLocationUpdatedAt: null, isLocationStale: null }
    expect(locationState(body({ ...empty, etaUnavailableReason: 'LOCATION_MISSING' }), shipmentId)).toBe('missing')
    expect(locationState(body({ ...empty, status: 'DELIVERED', etaUnavailableReason: 'NOT_PICKED_UP' }), shipmentId)).toBe('hidden')
    expect(locationState(body({ status: 'DELIVERED' }), shipmentId)).toBeNull()
    expect(locationState({ shipmentId }, shipmentId)).toBeNull()
    expect(locationState(body({ shipmentId: 'wrong' }), shipmentId)).toBeNull()
  })
})

describe('Tracking sampler over real loopback HTTP (fixture server)', () => {
  let server: Server
  afterEach(async () => { if (server) { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())) } })
  async function listen(status: number, latency = 0) {
    server = createServer((request, response) => {
      expect(request.method).toBe('GET')
      expect(request.url).toBe(`/v1/shipments/${shipmentId}/tracking`)
      const timer = setTimeout(() => { response.writeHead(status, { 'content-type': 'application/json' }); response.end(JSON.stringify(body())) }, latency)
      response.on('close', () => clearTimeout(timer))
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`
  }
  it('keeps complete samples but never serializes token, headers, coordinates or response bodies', async () => {
    const result = await runTrackingRead({ ...config(), baseUrl: await listen(200), pollers: 5, durationSeconds: 1 }, [{ shipmentId, token: 'private-fixture-token' }])
    expect(result.measurement.success).toBe(1)
    const serialized = JSON.stringify(result)
    expect(serialized).not.toContain('private-fixture-token')
    expect(serialized).not.toContain('Authorization')
    expect(serialized).not.toContain('currentDriverLocation')
  })
  it('stops after access denial and preserves incomplete offered load in the result', async () => {
    const result = await runTrackingRead({ ...config(), baseUrl: await listen(403), pollers: 20, durationSeconds: 1 }, [{ shipmentId, token: 'fixture' }])
    expect(result.stoppedForAccessOrFixtureError).toBe(true)
    expect(result.measurement.failed).toBe(1)
    expect(result.measurement.started).toBeLessThan(result.measurement.expected)
    expect(result.measurement.latencyAndWorkloadPass).toBe(false)
  })
  it('counts timeouts instead of omitting them from the denominator', async () => {
    const result = await runTrackingRead({ ...config(), baseUrl: await listen(200, 200), pollers: 5, durationSeconds: 1, timeoutMs: 20 }, [{ shipmentId, token: 'fixture' }])
    expect(result.measurement.timeouts).toBe(1)
    expect(result.measurement.p95CompletedMs).toBeNull()
    expect(result.measurement.latencyAndWorkloadPass).toBe(false)
  })
})
