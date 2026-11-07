import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { PubSub, v1 } from '@google-cloud/pubsub'
import { assertGpsTelemetryEvent } from '../../packages/types/src/gps.ts'

export function readOptions(args, env = process.env) {
  const { values } = parseArgs({ args, options: {
    cloud: { type: 'boolean', default: false },
    project: { type: 'string' },
    'timeout-ms': { type: 'string', default: '30000' },
    output: { type: 'string' },
    help: { type: 'boolean', default: false },
  } })
  if (values.help) return { help: true }
  const timeoutMs = Number(values['timeout-ms'])
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 120000) {
    throw new Error('--timeout-ms must be an integer between 1000 and 120000')
  }
  const emulatorHost = env.PUBSUB_EMULATOR_HOST
  if (values.cloud && emulatorHost) throw new Error('Unset PUBSUB_EMULATOR_HOST before --cloud')
  if (!values.cloud) {
    if (!emulatorHost || !/^(localhost|127\.0\.0\.1|\[::1\]):\d+$/.test(emulatorHost)) {
      throw new Error('Set PUBSUB_EMULATOR_HOST to a loopback host:port, or explicitly use --cloud --project')
    }
  }
  const projectId = values.project || (!values.cloud && (env.PUBSUB_PROJECT_ID || 'parcelflow-dev'))
  if (!projectId || !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId)) {
    throw new Error('A valid project ID is required; cloud mode requires --project explicitly')
  }
  return { projectId, emulatorHost, mode: values.cloud ? 'cloud' : 'emulator', timeoutMs, output: values.output }
}

export async function runSmoke(config, { publisher, subscriber }, log = () => {}) {
  const runId = randomUUID()
  const topic = `projects/${config.projectId}/topics/gps-smoke-${runId}`
  const subscription = `projects/${config.projectId}/subscriptions/gps-smoke-${runId}`
  const report = { runId, mode: config.mode, projectId: config.projectId, emulatorHost: config.emulatorHost,
    topic, subscription, startedAt: new Date().toISOString(), status: 'FAIL', records: [] }
  const record = (action, detail = {}) => {
    const row = { at: new Date().toISOString(), action, ...detail }
    report.records.push(row)
    log(row)
  }
  const rpcOptions = { timeout: Math.min(config.timeoutMs, 5000), retry: null }
  let topicCreated = false
  let subscriptionCreated = false
  try {
    record('start', { mode: config.mode, topic, subscription })
    await publisher.createTopic({ name: topic }, rpcOptions)
    topicCreated = true
    await subscriber.createSubscription({ name: subscription, topic, ackDeadlineSeconds: 10 }, rpcOptions)
    subscriptionCreated = true
    record('resources-created')

    const now = Date.now()
    const current = { eventId: randomUUID(), driverId: `smoke-${runId}`, lat: 21.0285, lng: 105.8542,
      seq: 2, clientTimestamp: new Date(now).toISOString(), receivedAt: new Date(now).toISOString() }
    const older = { ...current, eventId: randomUUID(), seq: 1, clientTimestamp: new Date(now - 8000).toISOString() }
    const restarted = { ...current, eventId: randomUUID(), seq: 1, clientTimestamp: new Date(now + 8000).toISOString() }
    const samples = [current, older, current, restarted]
    const expected = new Map()
    for (const [index, payload] of samples.entries()) {
      assertGpsTelemetryEvent(payload)
      const data = Buffer.from(JSON.stringify(payload), 'utf8')
      const [response] = await publisher.publish({ topic, messages: [{ data }] }, rpcOptions)
      const [messageId] = response.messageIds || []
      assert.ok(messageId && !expected.has(messageId), 'Publish must return a distinct messageId')
      expected.set(messageId, payload)
      record('published', { sample: ['current', 'older', 'duplicate', 'sequence-reset'][index], messageId, payload })
    }

    const nackedId = expected.keys().next().value
    let nacked = false
    let redelivered = false
    const acknowledged = new Set()
    const deadline = Date.now() + config.timeoutMs
    while (acknowledged.size < expected.size || !redelivered) {
      const remaining = deadline - Date.now()
      assert.ok(remaining > 0, `Timed out: ACK ${acknowledged.size}/${expected.size}, redelivery=${redelivered}`)
      let response
      try {
        ;[response] = await subscriber.pull({ subscription, maxMessages: 10 }, {
          ...rpcOptions, timeout: Math.min(remaining, rpcOptions.timeout),
        })
      } catch (error) {
        if (error.code === 4) continue
        throw error
      }
      for (const received of response.receivedMessages || []) {
        const { message, ackId } = received
        assert.ok(ackId && message?.messageId, 'Pull must return ackId and messageId')
        const payload = JSON.parse(Buffer.from(message.data).toString('utf8'))
        assertGpsTelemetryEvent(payload)
        assert.ok(expected.has(message.messageId), 'Received an unexpected messageId')
        assert.deepEqual(payload, expected.get(message.messageId), 'Pub/Sub changed the event payload')
        if (message.messageId === nackedId && !nacked) {
          await subscriber.modifyAckDeadline({ subscription, ackIds: [ackId], ackDeadlineSeconds: 0 }, rpcOptions)
          nacked = true
          record('nacked', { messageId: message.messageId, eventId: payload.eventId })
          continue
        }
        if (message.messageId === nackedId && nacked) redelivered = true
        await subscriber.acknowledge({ subscription, ackIds: [ackId] }, rpcOptions)
        acknowledged.add(message.messageId)
        record('acknowledged', { messageId: message.messageId, eventId: payload.eventId, payload })
      }
      if (!response.receivedMessages?.length) await new Promise((done) => setTimeout(done, 100))
    }
    report.acknowledgedMessages = acknowledged.size
    report.redelivered = redelivered
    report.status = 'PASS'
  } catch (error) {
    report.error = error.message
    record('failed', { error: error.message })
  } finally {
    for (const [created, resource, remove] of [
      [subscriptionCreated, subscription, () => subscriber.deleteSubscription({ subscription }, rpcOptions)],
      [topicCreated, topic, () => publisher.deleteTopic({ topic }, rpcOptions)],
    ]) {
      if (!created) continue
      try {
        await remove()
        record('deleted', { resource })
      } catch (error) {
        report.status = 'FAIL'
        record('cleanup-failed', { resource, error: error.message })
      }
    }
    report.finishedAt = new Date().toISOString()
  }
  return report
}

async function main() {
  const config = readOptions(process.argv.slice(2))
  if (config.help) {
    console.log('npm run test:gps-pubsub -- [--cloud --project PROJECT_ID] [--timeout-ms 30000] [--output report.json]')
    return
  }
  const pubsub = new PubSub({ projectId: config.projectId })
  let publisher
  let subscriber
  let report
  try {
    const clientConfig = await pubsub.getClientConfig()
    publisher = new v1.PublisherClient(clientConfig)
    subscriber = new v1.SubscriberClient(clientConfig)
    report = await runSmoke(config, { publisher, subscriber }, (row) => console.log(JSON.stringify(row)))
  } finally {
    await Promise.all([publisher?.close(), subscriber?.close(), pubsub.close()])
  }
  if (config.output) {
    await mkdir(dirname(resolve(config.output)), { recursive: true })
    await writeFile(config.output, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' })
  }
  console.log(JSON.stringify({ status: report.status, mode: report.mode, runId: report.runId }))
  if (report.status !== 'PASS') process.exitCode = 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}
