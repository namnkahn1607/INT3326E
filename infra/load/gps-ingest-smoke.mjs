import assert from 'node:assert/strict'
import { execFile, execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

const repo = fileURLToPath(new URL('../../', import.meta.url))
const output = resolve(repo, process.env.K6_SMOKE_OUTPUT || '.vitest/gps-ingest-smoke')
const binary = process.env.K6_BINARY || 'k6'
const tokenFile = resolve(output, 'fixture.tokens.json')
const configFile = resolve(output, 'k6-config.json')
const run = promisify(execFile)
const tokens = [1, 2].map(index => {
  const claims = { sub: `k6-fixture-driver-${index}`, role: 'DRIVER', exp: Math.floor(Date.now() / 1000) + 3600 }
  return ['fixture', Buffer.from(JSON.stringify(claims)).toString('base64url'), 'not-a-real-signature'].join('.')
})
const driverIds = [1, 2].map(index => `usr_${String(index).padStart(26, '0')}`)
const report = { status: 'RUNNING', generatedAt: new Date().toISOString(),
  level: 'real-k6-to-local-Nest-HTTP; Firebase, business-user lookup and PubSub mocked; no Worker/SQL/Cloud', checks: [] }
let app
let mode = 'accepted'
let requests = 0
const events = []

async function runK6(name, duration = 1, extraEnv = {}) {
  const summaryPath = resolve(output, `${name}-summary.json`)
  let result
  try {
    const completed = await run(binary, ['run', '--quiet', '--no-color', '--no-usage-report', '--http-debug-redact',
      '--config', configFile, resolve(repo, 'infra/load/gps-ingest.js')], {
      cwd: repo, timeout: 30_000, maxBuffer: 1024 * 1024,
      env: { ...process.env, BASE_URL: `${await app.getUrl()}/v1`, DRIVERS: '2',
        SEND_INTERVAL_SECONDS: '1', DURATION_SECONDS: String(duration), REQUEST_TIMEOUT_SECONDS: '2',
        DRIVER_TOKENS_FILE: tokenFile, SUMMARY_PATH: summaryPath, ...extraEnv },
      windowsHide: true,
    })
    result = { code: 0, stdout: completed.stdout, stderr: completed.stderr }
  } catch (error) {
    if (typeof error.code !== 'number') throw new Error('Cannot run k6; set K6_BINARY to an installed k6 executable')
    result = { code: error.code, stdout: error.stdout || '', stderr: error.stderr || '' }
  }
  for (const token of tokens) {
    assert.ok(!result.stdout.includes(token) && !result.stderr.includes(token), 'k6 output leaked a fixture token')
  }
  return { ...result, summaryPath }
}

try {
  await mkdir(output, { recursive: true })
  await writeFile(tokenFile, JSON.stringify(tokens))
  await writeFile(configFile, '{}\n')
  report.k6Version = (await run(binary, ['version'], { windowsHide: true })).stdout.trim()
  // This fixture cannot connect to a user database or publish into the project's real topic.
  process.env.DATABASE_URL = ''
  process.env.GCP_PROJECT_ID = 'demo-parcelflow-k6'
  const requireApi = createRequire(resolve(repo, 'apps/api/package.json'))
  requireApi('reflect-metadata')
  const { Test } = requireApi('@nestjs/testing')
  const { AppModule } = requireApi('./dist/app.module.js')
  const { configureApp } = requireApi('./dist/config/app.config.js')
  const { FIREBASE_AUTH } = requireApi('./dist/modules/auth/providers/firebase-auth.provider.js')
  const { TOKEN_VERIFIER } = requireApi('./dist/modules/auth/interfaces/token-verifier.interface.js')
  const { USER_DATABASE } = requireApi('./dist/modules/users/user-database.provider.js')
  const { UsersRepository } = requireApi('./dist/modules/users/users.repository.js')
  const { LocationService } = requireApi('./dist/modules/location/location.service.js')
  const { assertGpsTelemetryEvent } = requireApi('@parcelflow/types')
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(FIREBASE_AUTH).useValue({})
    .overrideProvider(TOKEN_VERIFIER).useValue({ verify: async token => {
      const index = tokens.indexOf(token)
      if (index < 0) throw new Error('Invalid fixture identity')
      return { uid: `k6-fixture-driver-${index + 1}`, role: 'DRIVER' }
    } })
    .overrideProvider(USER_DATABASE).useValue(null)
    .overrideProvider(UsersRepository).useValue({ findByFirebaseUid: async uid => {
      const index = ['k6-fixture-driver-1', 'k6-fixture-driver-2'].indexOf(uid)
      if (mode === 'unlinked' || index < 0) return []
      return [{ id: driverIds[index], firebaseUid: uid, role: 'DRIVER' }]
    } }).compile()
  module.get(LocationService).setTopic({ publishMessage: async ({ data }) => {
    if (mode === 'broker-error') throw new Error('Isolated broker fixture error')
    const event = JSON.parse(data.toString('utf8'))
    assertGpsTelemetryEvent(event)
    events.push(event)
    return `fixture-message-${events.length}`
  } })
  app = module.createNestApplication({ logger: false })
  app.use((request, response, next) => {
    if (request.method === 'POST' && request.path === '/v1/locations') {
      requests++
      if (mode === 'malformed-acceptance') { response.status(202).json({ status: 'OK' }); return }
    }
    next()
  })
  configureApp(app)
  await app.listen(0, '127.0.0.1')

  const success = await runK6('accepted', 3)
  assert.equal(success.code, 0, 'k6 positive smoke must pass')
  const summary = JSON.parse(await readFile(success.summaryPath, 'utf8'))
  const metrics = summary.summary.metrics
  assert.ok(events.length >= 6 && events.length <= 8, 'two Drivers should send about six events over three seconds')
  assert.equal(metrics.gps_accepted.values.count, events.length)
  assert.equal(metrics.gps_rejected.values.count, 0)
  assert.equal(metrics.http_req_failed.values.rate, 0)
  assert.equal(metrics.checks.values.rate, 1)
  assert.equal(metrics.http_reqs.values.count, events.length)
  for (const driverId of driverIds) {
    const samples = events.filter(event => event.driverId === driverId)
    assert.ok(samples.length >= 3)
    assert.deepEqual(samples.map(event => event.seq), samples.map((_, index) => index + 1))
    for (let index = 1; index < samples.length; index++) {
      assert.ok(samples[index].clientTimestamp > samples[index - 1].clientTimestamp)
      assert.ok(Date.parse(samples[index].clientTimestamp) - Date.parse(samples[index - 1].clientTimestamp) >= 800,
        'samples must be paced rather than burst in a tight loop')
    }
  }
  assert.ok(events.every(event => driverIds.includes(event.driverId)), 'API must enrich the mapped business Driver ID')
  assert.ok(!tokens.some(token => JSON.stringify(summary).includes(token)), 'summary must not contain credentials')
  report.checks.push({ name: '2 Drivers, 1s cadence, 3s duration through real API08', status: 'PASS',
    requests, accepted: events.length, driverCounts: driverIds.map(id => events.filter(event => event.driverId === id).length),
    httpLatencyMs: metrics.http_req_duration.values, summary: 'accepted-summary.json' })
  report.eventManifest = events.map(({ eventId, driverId, seq, clientTimestamp }) => ({ eventId, driverId, seq, clientTimestamp }))

  for (const [nextMode, expectedCode] of [['broker-error', 99], ['malformed-acceptance', 99], ['unlinked', 108]]) {
    mode = nextMode
    const before = events.length
    const failure = await runK6(nextMode)
    assert.equal(failure.code, expectedCode, `${nextMode} must make k6 fail`)
    assert.equal(events.length, before, 'negative fixture must not publish accepted GPS events')
    const rejected = JSON.parse(await readFile(failure.summaryPath, 'utf8'))
    assert.equal(rejected.summary.metrics.gps_accepted.values.count, 0)
    assert.ok(rejected.summary.metrics.gps_rejected.values.count > 0)
    report.checks.push({ name: nextMode, status: 'PASS', observedK6Exit: failure.code, summary: `${nextMode}-summary.json` })
  }
  const beforeConfigFailure = requests
  const invalidConfig = await runK6('missing-token-file', 1, { DRIVER_TOKENS_FILE: '' })
  assert.notEqual(invalidConfig.code, 0)
  assert.ok(invalidConfig.stderr.includes('DRIVER_TOKENS_FILE is required'))
  assert.equal(requests, beforeConfigFailure, 'bad init config must send no HTTP requests')
  report.checks.push({ name: 'missing token input fails before HTTP', status: 'PASS', observedK6Exit: invalidConfig.code })
  const files = ['infra/load/gps-ingest.js', 'infra/load/gps-ingest-config.mjs', 'infra/load/gps-ingest-smoke.mjs']
  report.sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8', windowsHide: true }).trim()
  report.uncommittedChanges = !!execFileSync('git', ['status', '--porcelain'], { cwd: repo, encoding: 'utf8', windowsHide: true }).trim()
  report.sourceSha256 = Object.fromEntries(await Promise.all(files.map(async file =>
    [file, createHash('sha256').update(await readFile(resolve(repo, file))).digest('hex')])))
  report.status = 'PASS'
} catch (error) {
  report.status = 'FAIL'
  report.error = error.message
  process.exitCode = 1
} finally {
  try { await app?.close() } finally { await rm(tokenFile, { force: true }) }
  await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(`${report.status}: ${report.checks.length} k6 smoke scenarios; report: ${resolve(output, 'report.json')}`)
  if (report.error) console.error(report.error)
}
