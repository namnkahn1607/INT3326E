import { readFileSync } from 'node:fs'
import { assertGpsLocationRequest, assertGpsTelemetryEvent, MAX_GPS_SEQUENCE } from './index'

const request = { lat: 21.0285, lng: 105.8542, seq: 1, clientTimestamp: '2026-10-16T10:00:00.000Z' }
const event = { ...request, eventId: 'gps-example-001', driverId: 'demo-driver-1', receivedAt: '2026-10-16T10:00:00.120Z' }

describe('GPS JSON contract', () => {
  it('accepts request/event JSON and boundary coordinates without mutation', () => {
    const value = JSON.parse(JSON.stringify(event))
    assertGpsTelemetryEvent(value)
    expect(value).toEqual(event)
    for (const lat of [-90, 0, 90]) {
      for (const lng of [-180, 0, 180]) {
        assertGpsLocationRequest({ ...request, lat, lng, seq: MAX_GPS_SEQUENCE })
      }
    }
  })

  it.each([null, [], 'gps', 1, {}])('rejects non-payload input: %j', (value) => {
    expect(() => assertGpsLocationRequest(value)).toThrow(TypeError)
  })

  it.each(['lat', 'lng', 'clientTimestamp'])('rejects missing request field %s', (field) => {
    const value = { ...request }
    delete value[field]
    expect(() => assertGpsLocationRequest(value)).toThrow(TypeError)
  })

  it('accepts optional diagnostic fields independently in requests and events', () => {
    const { seq: _seq, ...minimalRequest } = request
    const { seq: _eventSeq, ...minimalEvent } = event
    const sessionId = 'a87402b3-50b5-4c31-a8da-70254a9bdf67'
    for (const metadata of [{}, { seq: 1 }, { sessionId }, { seq: 1, sessionId }]) {
      assertGpsLocationRequest({ ...minimalRequest, ...metadata })
      assertGpsTelemetryEvent({ ...minimalEvent, ...metadata })
    }
  })

  it.each([
    '2026-10-16T10:00:00Z',
    '2026-10-16T17:00:00.000+07:00',
    '2026-10-16T03:00:00.123456-07:00',
    '2024-02-29T00:00:00.1Z',
  ])('accepts timezone-qualified request timestamp without mutating it: %s', (clientTimestamp) => {
    const payload = { ...request, clientTimestamp }
    assertGpsLocationRequest(payload)
    expect(payload.clientTimestamp).toBe(clientTimestamp)
  })

  it.each([
    ['lat', '21'], ['lat', NaN], ['lat', Infinity], ['lat', -90.001], ['lat', 90.001],
    ['lng', null], ['lng', -180.001], ['lng', 180.001],
    ['seq', '1'], ['seq', 0], ['seq', -1], ['seq', 1.5], ['seq', MAX_GPS_SEQUENCE + 1], ['seq', null],
    ['sessionId', 'sess_demo-driver-1'], ['sessionId', ''], ['sessionId', null], ['sessionId', 1],
    ['clientTimestamp', '2026-02-30T10:00:00.000Z'],
    ['clientTimestamp', '2026-02-29T10:00:00.000+07:00'],
    ['clientTimestamp', '2026-10-16T24:00:00Z'],
    ['clientTimestamp', '2026-10-16T10:00:00.000'],
    ['clientTimestamp', '2026-10-16T10:00:00+24:00'],
    ['clientTimestamp', '2026-10-16T10:00:00+07:60'],
    ['clientTimestamp', 'invalid'], ['clientTimestamp', null],
  ])('rejects invalid %s = %j', (field, value) => {
    expect(() => assertGpsLocationRequest({ ...request, [field]: value })).toThrow(TypeError)
  })

  it.each(['driverId', 'role', 'eventId', 'receivedAt', 'unexpected'])('rejects client-supplied %s', (field) => {
    expect(() => assertGpsLocationRequest({ ...request, [field]: 'spoofed' })).toThrow('unknown fields')
  })

  it.each(['eventId', 'driverId', 'receivedAt'])('requires server field %s', (field) => {
    const value = { ...event }
    delete value[field]
    expect(() => assertGpsTelemetryEvent(value)).toThrow(TypeError)
  })

  it.each(['', ' ', ' padded', 'padded ', null, 123])('rejects invalid identifiers: %j', (value) => {
    for (const field of ['eventId', 'driverId']) {
      expect(() => assertGpsTelemetryEvent({ ...event, [field]: value })).toThrow(TypeError)
    }
  })

  it('rejects invalid server timestamps and extra event fields', () => {
    expect(() => assertGpsTelemetryEvent({ ...event, receivedAt: '2026-02-30T00:00:00.000Z' })).toThrow('receivedAt')
    expect(() => assertGpsTelemetryEvent({ ...event, unexpected: 'extra' })).toThrow('unknown fields')
  })

  it.each([
    '2026-10-16T10:00:00Z',
    '2026-10-16T17:00:00.000+07:00',
    '2026-10-16T10:00:00.123456Z',
  ])('requires canonical millisecond UTC timestamps in the internal event: %s', (timestamp) => {
    for (const field of ['clientTimestamp', 'receivedAt']) {
      expect(() => assertGpsTelemetryEvent({ ...event, [field]: timestamp })).toThrow(field)
    }
  })

  it('accepts a lower sequence with a newer timestamp without imposing worker policy', () => {
    assertGpsTelemetryEvent({ ...event, seq: 1, clientTimestamp: '2026-10-16T10:00:08.000Z' })
  })

  it('keeps the OpenAPI request/event schemas aligned with the shared contract', () => {
    const api = JSON.parse(readFileSync('docs/openapi.json', 'utf8'))
    const schemas = api.components.schemas
    expect([...schemas.SubmitLocationRequest.required].sort()).toEqual(['clientTimestamp', 'lat', 'lng'])
    expect([...schemas.GpsTelemetryEvent.required].sort()).toEqual(['clientTimestamp', 'driverId', 'eventId', 'lat', 'lng', 'receivedAt'])
    for (const [name, payload] of [['SubmitLocationRequest', request], ['GpsTelemetryEvent', event]] as const) {
      const schema = schemas[name]
      expect(Object.keys(schema.properties).sort()).toEqual([...Object.keys(payload), 'sessionId'].sort())
      expect(schema.additionalProperties).toBe(false)
      expect(schema.properties.seq.maximum).toBe(MAX_GPS_SEQUENCE)
      expect(schema.properties.sessionId.format).toBe('uuid')
      expect(schema.properties.lat.minimum).toBe(-90)
      expect(schema.properties.lng.maximum).toBe(180)
      assertGpsLocationRequest(schemas.SubmitLocationRequest.example)
      assertGpsTelemetryEvent(schemas.GpsTelemetryEvent.example)
    }
  })
})
