import http from 'k6/http'
import { check, sleep } from 'k6'
import exec from 'k6/execution'
import encoding from 'k6/encoding'
import { SharedArray } from 'k6/data'
import { Counter } from 'k6/metrics'
import { createSample, driverForArrival, isAccepted, readConfig, selectTokens } from './gps-ingest-config.mjs'

const config = readConfig(__ENV)
const tokens = new SharedArray('Driver tokens', () => {
  let values
  try { values = JSON.parse(open(config.tokenFile)) }
  catch { throw new Error('Cannot read DRIVER_TOKENS_FILE as a JSON array') }
  return selectTokens(values, config, value => JSON.parse(encoding.b64decode(value, 'rawurl', 's')))
})
const offered = new Counter('gps_offered')
const accepted = new Counter('gps_accepted')
const rejected = new Counter('gps_rejected')
const failureReasons = ['transport', 'invalid_202', 'http_4xx', 'http_5xx', 'other_http']
const measured = config.warmupSeconds > 0
const measuredTags = measured ? '{phase:measure}' : ''
const latencyMetric = `http_req_duration${measuredTags}`
const rejectionMetric = (reason, phase = '') => `gps_rejected{${phase ? 'phase:measure,' : ''}reason:${reason}}`
const fixedRate = config.offeredEventsPerMinute !== null
const workload = fixedRate ? {
  executor: 'constant-arrival-rate',
  rate: config.offeredEventsPerMinute,
  timeUnit: '1m',
  preAllocatedVUs: config.drivers,
} : { executor: 'constant-vus', vus: config.drivers }
let lastTimestamp = 0

http.setResponseCallback(http.expectedStatuses(202))

export const options = {
  scenarios: {
    gps: { ...workload, duration: `${config.warmupSeconds + config.durationSeconds}s`,
      gracefulStop: `${config.timeoutSeconds + 1}s` },
  },
  thresholds: {
    http_req_failed: ['rate==0'], checks: ['rate==1'], gps_accepted: ['count>0'],
    ...Object.fromEntries(failureReasons.map(reason => [rejectionMetric(reason), ['count==0']])),
    ...(fixedRate ? { dropped_iterations: ['count==0'] } : {}),
    ...(measured ? {
      [`gps_offered${measuredTags}`]: ['count>0'],
      [`gps_accepted${measuredTags}`]: ['count>0'],
      [`gps_rejected${measuredTags}`]: ['count==0'],
      ...Object.fromEntries(failureReasons.map(reason => [rejectionMetric(reason, measuredTags), ['count==0']])),
    } : {}),
    ...(config.httpP95LimitMs !== null ? { [latencyMetric]: [`p(95)<${config.httpP95LimitMs}`] }
      : measured ? { [latencyMetric]: ['p(95)>=0'] } : {}),
  },
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(95)', 'p(99)'],
}

export default function () {
  const started = Date.now()
  const tags = measured ? { phase: started - exec.scenario.startTime < config.warmupSeconds * 1000
    ? 'warmup' : 'measure' } : {}
  // Arrival-rate VU reuse does not guarantee that all Driver identities send GPS.
  const { index, seq } = config.profile === 'LT01' ? driverForArrival(exec.scenario.iterationInTest, tokens.length)
    : { index: exec.vu.idInTest - 1, seq: exec.vu.iterationInScenario + 1 }
  if (index >= tokens.length) exec.test.abort('VU count exceeds configured Driver tokens; use DRIVERS instead of --vus')
  // Millisecond deduplication keys must increase even if two samples share a clock tick.
  lastTimestamp = Math.max(started, lastTimestamp + 1)
  const payload = createSample(index, seq, lastTimestamp)
  offered.add(1, tags)
  const response = http.post(`${config.baseUrl}/locations`, JSON.stringify(payload), {
    headers: { Authorization: `Bearer ${tokens[index]}`, 'Content-Type': 'application/json' },
    timeout: `${config.timeoutSeconds}s`, redirects: 0, tags: { ...tags, name: 'POST /v1/locations' },
  })
  let body
  try { body = response.json() } catch { body = null }
  const valid = isAccepted(response.status, body)
  check(response, { 'API08 returns valid 202 acceptance': () => valid })
  accepted.add(valid ? 1 : 0, tags)
  rejected.add(valid ? 0 : 1, valid ? tags : { ...tags, reason: failureReason(response.status) })
  if (response.status === 401 || response.status === 403 || response.status === 409) {
    exec.test.abort('Driver authentication/linkage failed; fix the selected test accounts')
  }
  if (!fixedRate) {
    const remaining = config.intervalSeconds - (Date.now() - started) / 1000
    if (remaining > 0) sleep(remaining)
  }
}

function failureReason(status) {
  if (!status) return 'transport'
  if (status === 202) return 'invalid_202'
  if (status >= 500) return 'http_5xx'
  if (status >= 400) return 'http_4xx'
  return 'other_http'
}

function readResults(data, duration, phase = '') {
  const count = metric => data.metrics[metric]?.values?.count ?? 0
  const offeredCount = count(`gps_offered${phase}`)
  const acceptedCount = count(`gps_accepted${phase}`)
  const rejectedCount = count(`gps_rejected${phase}`)
  return {
    offered: offeredCount,
    accepted: acceptedCount,
    errors: rejectedCount,
    errorsByReason: Object.fromEntries(failureReasons.map(reason => [reason, count(rejectionMetric(reason, phase))])),
    incomplete: offeredCount - acceptedCount - rejectedCount,
    offeredPerSecond: duration > 0 ? offeredCount / duration : null,
    acceptedPerSecond: duration > 0 ? acceptedCount / duration : null,
    httpP95Ms: offeredCount > 0 ? data.metrics[`http_req_duration${phase}`]?.values?.['p(95)'] ?? null : null,
  }
}

export function handleSummary(data) {
  const duration = data.state.testRunDurationMs / 1000
  const dropped = fixedRate ? data.metrics.dropped_iterations?.values?.count ?? 0 : null
  const results = {
    ...readResults(data, duration),
    droppedIterations: dropped,
    elapsedSeconds: duration,
  }
  const measurementSeconds = Math.max(0, Math.min(config.durationSeconds, duration - config.warmupSeconds))
  const measuredResults = measured ? readResults(data, measurementSeconds, measuredTags) : null
  const report = {
    generatedAt: new Date().toISOString(), measurement: 'HTTP ingest only; Worker/SQL and end-to-end latency are not measured',
    workload: { profile: config.profile, baseUrl: config.baseUrl, drivers: config.drivers,
      intervalSeconds: fixedRate ? null : config.intervalSeconds, warmupSeconds: config.warmupSeconds,
      durationSeconds: config.durationSeconds, timeoutSeconds: config.timeoutSeconds, httpP95LimitMs: config.httpP95LimitMs,
      nominalEventsPerSecond: fixedRate ? config.offeredEventsPerMinute / 60 : config.drivers / config.intervalSeconds,
      model: workload.executor },
    results,
    measuredResults,
    summary: data,
  }
  const displayed = measuredResults ?? results
  return {
    [config.summaryPath]: JSON.stringify(report, null, 2) + '\n',
    stdout: `GPS HTTP ingest${measured ? ' (measurement window)' : ''}: ` +
      `${displayed.offered} offered, ${displayed.accepted} accepted, ${displayed.errors} errors, ` +
      `${displayed.incomplete} incomplete, ${dropped ?? 'n/a'} dropped overall, ` +
      `p95 ${displayed.httpP95Ms?.toFixed(2) ?? 'n/a'} ms\nJSON summary: ${config.summaryPath}\n`,
  }
}
