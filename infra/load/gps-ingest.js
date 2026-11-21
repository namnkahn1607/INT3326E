import http from 'k6/http'
import { check, sleep } from 'k6'
import exec from 'k6/execution'
import encoding from 'k6/encoding'
import { SharedArray } from 'k6/data'
import { Counter } from 'k6/metrics'
import { createSample, isAccepted, readConfig, selectTokens } from './gps-ingest-config.mjs'

const config = readConfig(__ENV)
const tokens = new SharedArray('Driver tokens', () => {
  let values
  try { values = JSON.parse(open(config.tokenFile)) }
  catch { throw new Error('Cannot read DRIVER_TOKENS_FILE as a JSON array') }
  return selectTokens(values, config, value => JSON.parse(encoding.b64decode(value, 'rawurl', 's')))
})
const accepted = new Counter('gps_accepted')
const rejected = new Counter('gps_rejected')
let lastTimestamp = 0

http.setResponseCallback(http.expectedStatuses(202))

export const options = {
  scenarios: {
    gps: { executor: 'constant-vus', vus: config.drivers, duration: `${config.durationSeconds}s`,
      gracefulStop: `${config.timeoutSeconds + 1}s` },
  },
  thresholds: {
    http_req_failed: ['rate==0'], checks: ['rate==1'], gps_accepted: ['count>0'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(95)', 'p(99)'],
}

export default function () {
  const index = exec.vu.idInTest - 1
  if (index >= tokens.length) exec.test.abort('VU count exceeds configured Driver tokens; use DRIVERS instead of --vus')
  const started = Date.now()
  // Millisecond deduplication keys must increase even if two samples share a clock tick.
  lastTimestamp = Math.max(started, lastTimestamp + 1)
  const payload = createSample(index, exec.vu.iterationInScenario + 1, lastTimestamp)
  const response = http.post(`${config.baseUrl}/locations`, JSON.stringify(payload), {
    headers: { Authorization: `Bearer ${tokens[index]}`, 'Content-Type': 'application/json' },
    timeout: `${config.timeoutSeconds}s`, redirects: 0, tags: { name: 'POST /v1/locations' },
  })
  let body
  try { body = response.json() } catch { body = null }
  const valid = isAccepted(response.status, body)
  check(response, { 'API08 returns valid 202 acceptance': () => valid })
  accepted.add(valid ? 1 : 0)
  rejected.add(valid ? 0 : 1)
  if (response.status === 401 || response.status === 403 || response.status === 409) {
    exec.test.abort('Driver authentication/linkage failed; fix the selected test accounts')
  }
  // This is a closed workload: slow HTTP lowers the achieved rate instead of adding overlapping sends.
  const remaining = config.intervalSeconds - (Date.now() - started) / 1000
  if (remaining > 0) sleep(remaining)
}

export function handleSummary(data) {
  const report = {
    generatedAt: new Date().toISOString(), measurement: 'HTTP ingest only; Worker/SQL and end-to-end latency are not measured',
    workload: { baseUrl: config.baseUrl, drivers: config.drivers, intervalSeconds: config.intervalSeconds,
      durationSeconds: config.durationSeconds, timeoutSeconds: config.timeoutSeconds,
      nominalEventsPerSecond: config.drivers / config.intervalSeconds, model: 'constant-vus with pacing; achieved rate may be lower' },
    summary: data,
  }
  return { [config.summaryPath]: JSON.stringify(report, null, 2) + '\n',
    stdout: `GPS HTTP ingest finished. JSON summary: ${config.summaryPath}\n` }
}
