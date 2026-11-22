import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { performance } from 'node:perf_hooks'

function integer(env, key, fallback, min = 1) {
  const raw = env[key] ?? String(fallback)
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw)) || Number(raw) < min) throw new Error(`${key} is invalid`)
  return Number(raw)
}
export function trackingConfig(env) {
  let url
  try { url = new URL(env.BASE_URL) } catch { throw new Error('BASE_URL must be an HTTP(S) /v1 base') }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || !/^\/v1\/?$/.test(url.pathname))
    throw new Error('BASE_URL must be an HTTP(S) /v1 base without credentials, query or fragment')
  if (!env.TRACKING_FIXTURES_FILE?.trim()) throw new Error('TRACKING_FIXTURES_FILE is required')
  const intervalSeconds = integer(env, 'POLL_INTERVAL_SECONDS', 5)
  if (![5, 10].includes(intervalSeconds)) throw new Error('POLL_INTERVAL_SECONDS must be 5 or 10 (LT04)')
  return { baseUrl: url.href.replace(/\/$/, ''), pollers: integer(env, 'POLLERS', 500), intervalSeconds,
    durationSeconds: integer(env, 'DURATION_SECONDS', 600), warmupSeconds: integer(env, 'WARMUP_SECONDS', 0, 0),
    timeoutMs: integer(env, 'REQUEST_TIMEOUT_MS', 5000), fixtureFile: env.TRACKING_FIXTURES_FILE,
    output: env.SUMMARY_PATH || '.vitest/tracking-read/summary.json', environment: env.TRACKING_ENVIRONMENT || 'unspecified' }
}
export function trackingFixtures(values, config, now = Date.now()) {
  if (!Array.isArray(values) || !values.length) throw new Error('Fixtures must be a nonempty array')
  return values.map((value, index) => {
    const invalid = () => new Error(`Tracking fixture ${index + 1} must have a valid shipmentId and unexpired CUSTOMER/ADMIN ID token`)
    if (!value || !/^sh_[0-7][0-9A-HJKMNP-TV-Z]{25}$/.test(value.shipmentId) || typeof value.token !== 'string') throw invalid()
    let claims
    try { claims = JSON.parse(Buffer.from(value.token.split('.')[1], 'base64url').toString()) } catch { throw invalid() }
    if (value.token.trim() !== value.token || value.token.split('.').length !== 3 || typeof claims.sub !== 'string' || !claims.sub.trim() || !['CUSTOMER', 'ADMIN'].includes(claims.role) ||
      !Number.isFinite(claims.exp) || claims.exp <= now / 1000 + config.warmupSeconds + config.durationSeconds + config.timeoutMs / 1000 + 30) throw invalid()
    return { shipmentId: value.shipmentId, token: value.token, role: claims.role }
  })
}
const coordinate = value => !!value && Number.isFinite(value.lat) && Math.abs(value.lat) <= 90 &&
  Number.isFinite(value.lng) && Math.abs(value.lng) <= 180
const timestamp = value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) &&
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value
export function locationState(value, shipmentId) {
  const keys = ['shipmentId', 'status', 'driverId', 'pickupLocation', 'dropoffLocation', 'currentDriverLocation',
    'lastLocationUpdatedAt', 'locationClientTimestamp', 'isLocationStale', 'eta', 'etaUnavailableReason', 'expectedDeliveryAt', 'isLate']
  if (!value || Object.keys(value).length !== keys.length || !keys.every(key => Object.hasOwn(value, key)) ||
    value.shipmentId !== shipmentId || !['CREATED', 'ASSIGNED', 'PICKED_UP', 'DELIVERED', 'DELIVERY_FAILED'].includes(value.status) ||
    (value.status === 'CREATED') !== (value.driverId === null) ||
    !(value.driverId === null || /^usr_[0-7][0-9A-HJKMNP-TV-Z]{25}$/.test(value.driverId)) ||
    !(value.expectedDeliveryAt === null || timestamp(value.expectedDeliveryAt)) ||
    !(value.isLate === null || typeof value.isLate === 'boolean') ||
    (value.expectedDeliveryAt === null) !== (value.isLate === null) ||
    !coordinate(value.pickupLocation) || !coordinate(value.dropoffLocation)) return null
  const hidden = ['CREATED', 'DELIVERED', 'DELIVERY_FAILED'].includes(value.status)
  const expectedReason = value.status !== 'PICKED_UP' ? 'NOT_PICKED_UP' : value.currentDriverLocation === null ? 'LOCATION_MISSING'
    : value.isLocationStale ? 'LOCATION_STALE' : 'CONFIG_INVALID'
  if (value.eta === null) { if (value.etaUnavailableReason !== expectedReason) return null }
  else if (!value.eta || Object.keys(value.eta).length !== 3 || value.status !== 'PICKED_UP' || value.currentDriverLocation === null || value.isLocationStale !== false ||
    value.etaUnavailableReason !== null || !Number.isFinite(value.eta.distanceMeters) || value.eta.distanceMeters < 0 ||
    !Number.isSafeInteger(value.eta.estimatedSeconds) || value.eta.estimatedSeconds < 0 || !timestamp(value.eta.estimatedArrivalAt)) return null
  if (value.currentDriverLocation === null) {
    if ([value.locationClientTimestamp, value.lastLocationUpdatedAt, value.isLocationStale].some(x => x !== null)) return null
    return hidden ? 'hidden' : 'missing'
  }
  if (hidden || !coordinate(value.currentDriverLocation) || !timestamp(value.locationClientTimestamp) ||
    !timestamp(value.lastLocationUpdatedAt) || Date.parse(value.locationClientTimestamp) > Date.parse(value.lastLocationUpdatedAt) ||
    typeof value.isLocationStale !== 'boolean') return null
  return value.isLocationStale ? 'stale' : 'fresh'
}
export function percentile(values, quantile) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.max(0, Math.ceil(quantile * sorted.length) - 1)]
}
export function trackingSummary(records, config) {
  const summarize = phase => {
    const rows = records.filter(r => r.phase === phase), started = rows.filter(r => r.outcome !== 'dropped')
    const completed = started.filter(r => r.completed), success = rows.filter(r => r.outcome === 'success')
    const duration = phase === 'warmup' ? config.warmupSeconds : config.durationSeconds
    const expected = Math.ceil(duration * config.pollers / config.intervalSeconds)
    const p95 = percentile(completed.map(r => r.durationMs), .95)
    const states = Object.fromEntries(['fresh', 'stale', 'missing', 'hidden'].map(state => [state, success.filter(r => r.locationState === state).length]))
    return { scheduled: rows.length, expected, started: started.length, completed: completed.length, success: success.length,
      failed: started.length - success.length, dropped: rows.length - started.length,
      timeouts: rows.filter(r => r.outcome === 'timeout').length,
      requestRate: duration ? started.length / duration : 0,
      p95CompletedMs: p95, percentileMethod: 'nearest-rank; all completed HTTP responses including errors',
      maxStartLatenessMs: rows.reduce((max, r) => Math.max(max, r.startLatenessMs), 0),
      locationStates: states, latencyTargetMs: 300,
      latencyAndWorkloadPass: expected > 0 && rows.length === expected && success.length === expected && p95 !== null && p95 < 300 }
  }
  return { operation: 'API09 tracking read', target: 'PF SPEC 01 v1.4 NF04 / LT04',
    workload: { pollers: config.pollers, intervalSeconds: config.intervalSeconds, durationSeconds: config.durationSeconds,
      warmupSeconds: config.warmupSeconds, expectedRequestsPerSecond: config.pollers / config.intervalSeconds,
      timeoutMs: config.timeoutMs, model: 'paced arrivals; one in-flight request per logical poller; no catch-up burst' },
    environment: config.environment, warmup: summarize('warmup'), measurement: summarize('measurement'),
    fullLt04Window: config.pollers === 500 && config.durationSeconds >= 600,
    cloudAcceptance: 'Requires the complete LT04 runs at 5s and 10s, deployment/config records and group review; not inferred from a smoke pass.' }
}

export async function runTrackingRead(config, fixtures) {
  const records = [], active = new Map()
  const rate = config.pollers / config.intervalSeconds, start = performance.now()
  const warmupSlots = Math.ceil(config.warmupSeconds * rate), total = warmupSlots + Math.ceil(config.durationSeconds * rate)
  let authFailed = false
  async function request(index, record) {
    const fixture = fixtures[index % fixtures.length], controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), config.timeoutMs), began = performance.now()
    try {
      const response = await fetch(`${config.baseUrl}/shipments/${fixture.shipmentId}/tracking`, {
        headers: { Authorization: `Bearer ${fixture.token}` }, signal: controller.signal, redirect: 'error',
      })
      record.status = response.status
      const text = await response.text()
      record.completed = true
      if ([401, 403, 404, 409].includes(response.status)) authFailed = true
      if (response.status !== 200) { record.outcome = 'http_error'; return }
      let body
      try { body = JSON.parse(text) } catch { record.outcome = 'invalid_response'; return }
      record.locationState = locationState(body, fixture.shipmentId)
      record.outcome = record.locationState ? 'success' : 'invalid_response'
    } catch { record.outcome = controller.signal.aborted ? 'timeout' : 'network_error' }
    finally { clearTimeout(timer); record.durationMs = performance.now() - began }
  }
  for (let index = 0; index < total && !authFailed; index++) {
    const due = start + index * 1000 / rate
    const remaining = due - performance.now()
    if (remaining > 0) await new Promise(resolve => setTimeout(resolve, remaining))
    if (authFailed) break
    const poller = index % config.pollers, lateness = Math.max(0, performance.now() - due)
    const record = { index, poller, phase: index < warmupSlots ? 'warmup' : 'measurement',
      startLatenessMs: lateness, completed: false, outcome: 'dropped', status: null, durationMs: null }
    records.push(record)
    // Missed starts are reported, never compressed into a catch-up burst.
    if (active.has(poller) || lateness >= 1000 / rate) continue
    const task = request(poller, record).finally(() => active.delete(poller))
    active.set(poller, task)
  }
  const untilEnd = start + (config.warmupSeconds + config.durationSeconds) * 1000 - performance.now()
  if (!authFailed && untilEnd > 0) await new Promise(resolve => setTimeout(resolve, untilEnd))
  await Promise.all(active.values())
  return { ...trackingSummary(records, config), fixtureCount: fixtures.length, observedElapsedMs: performance.now() - start,
    stoppedForAccessOrFixtureError: authFailed, records }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    const config = trackingConfig(process.env)
    const fixtures = trackingFixtures(JSON.parse(await readFile(config.fixtureFile, 'utf8')), config)
    const result = await runTrackingRead(config, fixtures)
    await mkdir(dirname(config.output), { recursive: true })
    await writeFile(config.output, JSON.stringify(result, null, 2) + '\n')
    console.log(JSON.stringify({ output: config.output, measurement: result.measurement, fullLt04Window: result.fullLt04Window }))
    if (!result.measurement.latencyAndWorkloadPass) process.exitCode = 1
  } catch (error) {
    // Do not echo file contents, tokens, URLs or raw upstream errors.
    console.error(error instanceof SyntaxError ? 'Invalid fixture JSON' : error.message)
    process.exitCode = 1
  }
}
