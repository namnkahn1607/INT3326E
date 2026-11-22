import assert from 'node:assert/strict'
import { randomUUID, createHash } from 'node:crypto'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { runTrackingRead } from './tracking-read.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))
const output = fileURLToPath(new URL('../../.vitest/tracking-read-smoke/', import.meta.url))
// Reuse the isolated Nest/PGlite fixture, not any database configured on Cloud.
process.chdir(fileURLToPath(new URL('../../apps/web/', import.meta.url)))
const { startServer, userId } = await import('../../apps/web/integration/server.mjs')
const server = await startServer()
async function post(path, actor, body, expected = 200) {
  const response = await fetch(server.base + path, { method: 'POST', headers: {
    Authorization: `Bearer ${actor}`, 'Content-Type': 'application/json', 'Idempotency-Key': randomUUID(),
  }, body: JSON.stringify(body) })
  assert.equal(response.status, expected)
  return response.json()
}
const scenarios = []
try {
  const order = await post('/shipments', 'customer', {
    pickupAddress: 'Local tracking test pickup', pickupLocation: { lat: 21.037, lng: 105.783 },
    dropoffAddress: 'Local tracking test dropoff', dropoffLocation: { lat: 21.008, lng: 105.842 },
    recipientName: 'Test fixture', recipientPhone: '0900000000',
  }, 201)
  await post(`/shipments/${order.id}/assign`, 'admin', { driverId: userId(3) })
  await post(`/shipments/${order.id}/pickup`, 'driver1', {})
  for (const scenario of [
    { name: 'fresh-5s', intervalSeconds: 5, state: 'fresh' },
    { name: 'fresh-10s', intervalSeconds: 10, state: 'fresh' },
    { name: 'stale-5s', intervalSeconds: 5, state: 'stale' },
    { name: 'missing-5s', intervalSeconds: 5, state: 'missing' },
    { name: 'ownership-403', intervalSeconds: 5, state: 'fresh', forbidden: true },
  ]) {
    await server.query('DELETE FROM current_locations')
    if (scenario.state !== 'missing') await server.query(`INSERT INTO current_locations
      ("driverId",lat,lng,"clientTimestamp","receivedAt") VALUES ($1,21.0285,105.8048,
      CURRENT_TIMESTAMP - $2::interval, CURRENT_TIMESTAMP)`, [userId(3), scenario.state === 'stale' ? '45 seconds' : '1 second'])
    const config = { baseUrl: server.base, pollers: 10, intervalSeconds: scenario.intervalSeconds,
      durationSeconds: 2, warmupSeconds: scenario.forbidden ? 0 : 1, timeoutMs: 5000,
      environment: 'local Nest HTTP + PGlite; Firebase mocked; no Worker/PubSub/Cloud' }
    const fixtures = scenario.forbidden ? [{ shipmentId: order.id, token: 'other' }]
      : [{ shipmentId: order.id, token: 'customer' }, { shipmentId: order.id, token: 'admin' }]
    const result = await runTrackingRead(config, fixtures)
    if (scenario.forbidden) {
      assert.equal(result.stoppedForAccessOrFixtureError, true)
      assert.equal(result.measurement.success, 0)
      assert.equal(result.measurement.latencyAndWorkloadPass, false)
    } else {
      assert.equal(result.measurement.failed, 0)
      assert.equal(result.measurement.dropped, 0)
      assert.equal(result.measurement.locationStates[scenario.state], result.measurement.expected)
      assert.equal(result.measurement.success, result.measurement.expected)
    }
    scenarios.push({ name: scenario.name, ...result })
    console.log(JSON.stringify({ scenario: scenario.name, ...result.measurement }))
  }
  const sourceSha256 = createHash('sha256').update(await readFile(root + 'infra/load/tracking-read.mjs')).digest('hex')
  await mkdir(output, { recursive: true })
  await writeFile(output + 'report.json', JSON.stringify({ checkedAt: new Date().toISOString(), sourceSha256,
    environment: 'Local Nest HTTP + PGlite with Firebase mock; not NF04/LT04 Cloud acceptance',
    scenarios, fullLt04Executed: false }, null, 2) + '\n')
  console.log('Tracking smoke: 5/5 scenarios; report .vitest/tracking-read-smoke/report.json')
} finally { await server.close() }
