import { readOptions, runSmoke } from './gps-smoke.mjs'

function broker(options = { reverse: false, redeliver: true }) {
  const queued = []
  const messages = new Map()
  const publisher = {
    createTopic: vi.fn(async () => [{}]),
    publish: vi.fn(async ({ messages: published }) => {
      const messageId = String(messages.size + 1)
      const message = { messageId, data: published[0].data }
      messages.set(messageId, message)
      queued.push({ ackId: `ack-${messageId}`, message })
      return [{ messageIds: [messageId] }]
    }),
    deleteTopic: vi.fn(async () => [{}]),
  }
  const subscriber = {
    createSubscription: vi.fn(async () => [{}]),
    pull: vi.fn(async () => [{ receivedMessages: options.reverse ? queued.splice(0).reverse() : queued.splice(0) }]),
    modifyAckDeadline: vi.fn(async ({ ackIds, ackDeadlineSeconds }) => {
      expect(ackDeadlineSeconds).toBe(0)
      const messageId = ackIds[0].replace('ack-', '')
      if (options.redeliver) queued.push({ ackId: `redelivered-${messageId}`, message: messages.get(messageId) })
      return [{}]
    }),
    acknowledge: vi.fn(async () => [{}]),
    deleteSubscription: vi.fn(async () => [{}]),
  }
  return { publisher, subscriber }
}

const config = { mode: 'emulator', projectId: 'parcelflow-dev', timeoutMs: 1000 }

describe('GPS Pub/Sub smoke runner (SDK mock only)', () => {
  it('publishes duplicate/older/reset samples, validates delivery, NACKs once and ACKs redelivery', async () => {
    const sdk = broker()
    const report = await runSmoke(config, sdk)
    expect(report).toMatchObject({ status: 'PASS', acknowledgedMessages: 4, redelivered: true })
    expect(report.topic).toMatch(/^projects\/parcelflow-dev\/topics\/gps-smoke-/)
    expect(sdk.subscriber.createSubscription.mock.invocationCallOrder[0]).toBeLessThan(sdk.publisher.publish.mock.invocationCallOrder[0])
    const payloads = report.records.filter((row) => row.action === 'published').map((row) => row.payload)
    expect(payloads[0]).toEqual(payloads[2])
    expect(payloads[1].clientTimestamp < payloads[0].clientTimestamp).toBe(true)
    expect(payloads[3].seq).toBe(1)
    expect(payloads[3].clientTimestamp > payloads[0].clientTimestamp).toBe(true)
    expect(sdk.subscriber.modifyAckDeadline).toHaveBeenCalledTimes(1)
    expect(sdk.subscriber.acknowledge).toHaveBeenCalledTimes(4)
    expect(sdk.subscriber.deleteSubscription).toHaveBeenCalledWith({ subscription: report.subscription }, expect.anything())
    expect(sdk.publisher.deleteTopic).toHaveBeenCalledWith({ topic: report.topic }, expect.anything())
  })

  it.each(['malformed JSON', 'changed coordinates', 'unknown message ID'])('fails before ACK for %s', async (problem) => {
    const sdk = broker()
    sdk.subscriber.pull.mockImplementationOnce(async () => [{ receivedMessages: [{ ackId: 'a', message: {
      messageId: problem === 'unknown message ID' ? 'unknown' : '1',
      data: Buffer.from(problem === 'malformed JSON' ? '{' : JSON.stringify({
        eventId: 'changed', driverId: 'driver', lat: 0, lng: 0, seq: 1,
        clientTimestamp: '2026-10-16T00:00:00.000Z', receivedAt: '2026-10-16T00:00:00.000Z',
      })),
    } }] }])
    const report = await runSmoke(config, sdk)
    expect(report.status).toBe('FAIL')
    expect(sdk.subscriber.acknowledge).not.toHaveBeenCalled()
    expect(sdk.subscriber.deleteSubscription).toHaveBeenCalledTimes(1)
    expect(sdk.publisher.deleteTopic).toHaveBeenCalledTimes(1)
  })

  it('matches payloads by message ID when the broker delivers in reverse order', async () => {
    const report = await runSmoke(config, broker({ reverse: true, redeliver: true }))
    expect(report).toMatchObject({ status: 'PASS', acknowledgedMessages: 4, redelivered: true })
    expect(report.records.find((row) => row.action === 'acknowledged').messageId).toBe('4')
  })

  it('fails if the NACKed message is never redelivered even after the others are ACKed', async () => {
    vi.useFakeTimers()
    try {
      const sdk = broker({ reverse: false, redeliver: false })
      const pending = runSmoke(config, sdk)
      await vi.advanceTimersByTimeAsync(1100)
      expect(await pending).toMatchObject({ status: 'FAIL', error: expect.stringContaining('ACK 3/4, redelivery=false') })
      expect(sdk.subscriber.acknowledge).toHaveBeenCalledTimes(3)
    } finally {
      vi.useRealTimers()
    }
  })

  it('times out rather than accepting missing messages as success', async () => {
    vi.useFakeTimers()
    try {
      const sdk = broker()
      sdk.subscriber.pull.mockImplementation(async () => [{ receivedMessages: [] }])
      const pending = runSmoke(config, sdk)
      await vi.advanceTimersByTimeAsync(1100)
      const report = await pending
      expect(report).toMatchObject({ status: 'FAIL', error: expect.stringContaining('Timed out') })
      expect(sdk.subscriber.deleteSubscription).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('propagates a broker error and cleans resources after publish failure', async () => {
    const sdk = broker()
    sdk.publisher.publish.mockRejectedValueOnce(new Error('permission denied'))
    expect(await runSmoke(config, sdk)).toMatchObject({ status: 'FAIL', error: 'permission denied' })
    expect(sdk.subscriber.deleteSubscription).toHaveBeenCalledTimes(1)
    expect(sdk.publisher.deleteTopic).toHaveBeenCalledTimes(1)
  })

  it('does not delete resources it did not create', async () => {
    const sdk = broker()
    sdk.publisher.createTopic.mockRejectedValueOnce(new Error('already exists'))
    expect((await runSmoke(config, sdk)).status).toBe('FAIL')
    expect(sdk.publisher.deleteTopic).not.toHaveBeenCalled()
    expect(sdk.subscriber.deleteSubscription).not.toHaveBeenCalled()
  })

  it('deletes only the topic when subscription creation fails', async () => {
    const sdk = broker()
    sdk.subscriber.createSubscription.mockRejectedValueOnce(new Error('permission denied'))
    expect((await runSmoke(config, sdk)).status).toBe('FAIL')
    expect(sdk.publisher.deleteTopic).toHaveBeenCalledTimes(1)
    expect(sdk.subscriber.deleteSubscription).not.toHaveBeenCalled()
  })

  it('fails and reports the exact resource if cleanup fails', async () => {
    const sdk = broker()
    sdk.subscriber.deleteSubscription.mockRejectedValueOnce(new Error('cleanup denied'))
    const report = await runSmoke(config, sdk)
    expect(report.status).toBe('FAIL')
    expect(report.records).toContainEqual(expect.objectContaining({ action: 'cleanup-failed', resource: report.subscription }))
    expect(sdk.publisher.deleteTopic).toHaveBeenCalledTimes(1)
  })
})

describe('GPS smoke CLI configuration', () => {
  it('requires explicit cloud selection and project, and rejects mixed modes', () => {
    expect(() => readOptions([], {})).toThrow('PUBSUB_EMULATOR_HOST')
    expect(() => readOptions(['--cloud'], {})).toThrow('--project')
    expect(() => readOptions(['--cloud', '--project', 'int3326e'], { PUBSUB_EMULATOR_HOST: 'localhost:8085' })).toThrow('Unset')
    expect(readOptions(['--cloud', '--project', 'int3326e'], {})).toMatchObject({ mode: 'cloud', projectId: 'int3326e' })
  })

  it('accepts only loopback emulator hosts and bounded timeouts', () => {
    expect(readOptions([], { PUBSUB_EMULATOR_HOST: '127.0.0.1:8085' })).toMatchObject({ ...config, timeoutMs: 30000 })
    expect(() => readOptions([], { PUBSUB_EMULATOR_HOST: 'remote.example:8085' })).toThrow('loopback')
    expect(() => readOptions(['--timeout-ms', '0'], {})).toThrow('timeout-ms')
    expect(() => readOptions(['--timeout-ms', 'NaN'], {})).toThrow('timeout-ms')
  })
})
