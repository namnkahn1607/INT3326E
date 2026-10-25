import { ApiProblem } from '../../../common/api-problem';

export interface Coordinates { lat: number; lng: number }
export interface CreateShipmentDto {
  pickupAddress: string;
  pickupLocation: Coordinates;
  dropoffAddress: string;
  dropoffLocation: Coordinates;
  recipientName: string;
  recipientPhone: string;
  notes: string | null;
  packageDescription: string | null;
  packageWeightKg: number | null;
  expectedDeliveryAt: string | null;
}

export function invalidField(field: string, message: string): never {
  throw new ApiProblem(400, 'VALIDATION_ERROR', 'Invalid request', [{ field, message }]);
}

function object(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalidField(field, 'Must be an object');
  return value as Record<string, unknown>;
}

function text(value: unknown, field: string, min: number, max: number): string {
  if (typeof value !== 'string') invalidField(field, 'Must be a string');
  const normalized = value.trim();
  const length = [...normalized].length;
  if (length < min || length > max) invalidField(field, `Must contain ${min} to ${max} characters after trimming`);
  return normalized;
}

function coordinates(value: unknown, field: string): Coordinates {
  const point = object(value, field);
  if (Object.keys(point).some(key => !['lat', 'lng'].includes(key))) invalidField(field, 'Unknown coordinate field');
  for (const [key, max] of [['lat', 90], ['lng', 180]] as const) {
    if (typeof point[key] !== 'number' || !Number.isFinite(point[key]) || Math.abs(point[key]) > max) {
      invalidField(`${field}.${key}`, `Must be a finite number between -${max} and ${max}`);
    }
  }
  return { lat: point.lat as number, lng: point.lng as number };
}

function timestamp(value: unknown): string {
  const match = typeof value === 'string'
    ? /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d+))?(Z|[+-](\d{2}):(\d{2}))$/.exec(value) : null;
  const wall = match ? `${match[1]}.000Z` : '';
  if (!match || !Number.isFinite(Date.parse(wall)) || new Date(wall).toISOString() !== wall ||
      (match[3] !== 'Z' && (Number(match[4]) > 23 || Number(match[5]) > 59))) {
    invalidField('expectedDeliveryAt', 'Must be a valid ISO 8601 timestamp with a timezone');
  }
  const result = new Date(`${match[1]}.${(match[2] ?? '').padEnd(3, '0').slice(0, 3)}${match[3]}`);
  if (!Number.isFinite(result.getTime()) || !/^\d{4}-/.test(result.toISOString())) {
    invalidField('expectedDeliveryAt', 'Timestamp is outside the supported range');
  }
  return result.toISOString();
}

export function normalizeCreateShipment(value: unknown): CreateShipmentDto {
  const body = object(value, 'body');
  const fields = ['pickupAddress', 'pickupLocation', 'dropoffAddress', 'dropoffLocation',
    'recipientName', 'recipientPhone', 'notes', 'packageDescription', 'packageWeightKg', 'expectedDeliveryAt'];
  if (Object.keys(body).some(key => !fields.includes(key))) invalidField('body', 'Unknown request field');
  const phone = text(body.recipientPhone, 'recipientPhone', 9, 16);
  if (!/^\+?\d{9,15}$/.test(phone)) invalidField('recipientPhone', 'Must contain 9 to 15 digits with an optional leading +');
  const weight = body.packageWeightKg;
  if (weight != null && (typeof weight !== 'number' || !Number.isFinite(weight) || weight <= 0)) {
    invalidField('packageWeightKg', 'Must be a finite positive number');
  }
  // Fixed property order and explicit nulls make semantically equivalent retries share a hash.
  return {
    pickupAddress: text(body.pickupAddress, 'pickupAddress', 5, 255),
    pickupLocation: coordinates(body.pickupLocation, 'pickupLocation'),
    dropoffAddress: text(body.dropoffAddress, 'dropoffAddress', 5, 255),
    dropoffLocation: coordinates(body.dropoffLocation, 'dropoffLocation'),
    recipientName: text(body.recipientName, 'recipientName', 2, 100), recipientPhone: phone,
    notes: body.notes == null ? null : text(body.notes, 'notes', 0, 500),
    packageDescription: body.packageDescription == null ? null : text(body.packageDescription, 'packageDescription', 0, 500),
    packageWeightKg: weight == null ? null : weight as number,
    expectedDeliveryAt: body.expectedDeliveryAt == null ? null : timestamp(body.expectedDeliveryAt),
  };
}

export function parseIdempotencyKey(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new ApiProblem(400, 'IDEMPOTENCY_KEY_MISSING', 'A single UUID v4 Idempotency-Key is required');
  }
  return value.toLowerCase();
}
