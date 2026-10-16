export const MAX_GPS_SEQUENCE = 2147483647

export interface GpsLocationRequest {
  lat: number
  lng: number
  seq: number
  clientTimestamp: string
}

export interface GpsTelemetryEvent extends GpsLocationRequest {
  eventId: string
  driverId: string
  receivedAt: string
}

const requestFields = ['lat', 'lng', 'seq', 'clientTimestamp']
const eventFields = [...requestFields, 'eventId', 'driverId', 'receivedAt']

function assertTimestamp(value: unknown, field: string): void {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString() !== value
  ) {
    throw new TypeError(`${field} must be a valid UTC timestamp with milliseconds`)
  }
}

function assertPayload(value: unknown, fields: string[]): asserts value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('GPS payload must be an object')
  }

  const payload = value as Record<string, unknown>
  if (Object.keys(payload).some((field) => !fields.includes(field))) {
    throw new TypeError('GPS payload contains unknown fields')
  }

  for (const [field, limit] of [['lat', 90], ['lng', 180]] as const) {
    const coordinate = payload[field]
    if (typeof coordinate !== 'number' || !Number.isFinite(coordinate) || Math.abs(coordinate) > limit) {
      throw new TypeError(`${field} must be a finite number between -${limit} and ${limit}`)
    }
  }

  if (!Number.isInteger(payload.seq) || (payload.seq as number) < 1 || (payload.seq as number) > MAX_GPS_SEQUENCE) {
    throw new TypeError(`seq must be an integer between 1 and ${MAX_GPS_SEQUENCE}`)
  }
  assertTimestamp(payload.clientTimestamp, 'clientTimestamp')
}

export function assertGpsLocationRequest(value: unknown): asserts value is GpsLocationRequest {
  assertPayload(value, requestFields)
}

export function assertGpsTelemetryEvent(value: unknown): asserts value is GpsTelemetryEvent {
  assertPayload(value, eventFields)
  for (const field of ['eventId', 'driverId']) {
    if (typeof value[field] !== 'string' || !value[field] || value[field].trim() !== value[field]) {
      throw new TypeError(`${field} must be a non-empty identifier without surrounding whitespace`)
    }
  }
  assertTimestamp(value.receivedAt, 'receivedAt')
}
