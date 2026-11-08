import { describe, expect, it } from 'vitest';
import { normalizeCreateShipment, parseIdempotencyKey } from './create-shipment.dto';

const valid = () => ({ pickupAddress: ' 144 Xuan Thuy ', pickupLocation: { lat: 21, lng: 105 },
  dropoffAddress: '1 Dai Co Viet', dropoffLocation: { lat: 0, lng: 0 },
  recipientName: ' Nguoi nhan ', recipientPhone: '+84900000000' });

describe('Create validation and canonical normalization', () => {
  it('trims text, preserves zero coordinates and canonicalizes absent optional values', () => {
    expect(normalizeCreateShipment(valid())).toMatchObject({ pickupAddress: '144 Xuan Thuy',
      recipientName: 'Nguoi nhan', notes: null, packageDescription: null,
      packageWeightKg: null, expectedDeliveryAt: null, dropoffLocation: { lat: 0, lng: 0 } });
    expect(normalizeCreateShipment({ ...valid(), notes: null })).toEqual(normalizeCreateShipment(valid()));
  });
  it('normalizes offset and truncates fractional seconds, without checking dynamic deadline', () => {
    expect(normalizeCreateShipment({ ...valid(), expectedDeliveryAt: '2020-01-01T11:00:00.123999+07:00' })
      .expectedDeliveryAt).toBe('2020-01-01T04:00:00.123Z');
  });
  it.each([
    null, [], {}, { ...valid(), customerId: 'forged' }, { ...valid(), status: 'CREATED' },
    { ...valid(), pickupAddress: 'abcd' }, { ...valid(), pickupAddress: 'x'.repeat(256) },
    { ...valid(), recipientName: 'x' }, { ...valid(), recipientPhone: '090 123 4567' },
    { ...valid(), pickupLocation: { lat: '21', lng: 105 } },
    { ...valid(), pickupLocation: { lat: NaN, lng: 105 } },
    { ...valid(), pickupLocation: { lat: 91, lng: 105 } },
    { ...valid(), dropoffLocation: { lat: 0, lng: Infinity } },
    { ...valid(), dropoffLocation: { lat: 0, lng: 0, address: 'extra' } },
    { ...valid(), notes: 'x'.repeat(501) }, { ...valid(), packageWeightKg: 0 },
    { ...valid(), packageWeightKg: '2' }, { ...valid(), packageDescription: false },
  ])('rejects invalid/unknown fields %#', body => {
    expect(() => normalizeCreateShipment(body)).toThrow();
  });
  it.each(['2026-02-30T01:00:00Z', '2026-10-01', '2026-10-01T12:00:00',
    '2026-10-01T24:00:00Z', '2026-10-01T12:00:00+24:00'])('rejects invalid timestamp %s', expectedDeliveryAt => {
    expect(() => normalizeCreateShipment({ ...valid(), expectedDeliveryAt })).toThrow();
  });
  it('accepts boundary values and strings after trim', () => {
    expect(normalizeCreateShipment({ ...valid(), pickupAddress: ' xxxxx ', recipientName: 'AB',
      pickupLocation: { lat: -90, lng: 180 }, notes: 'x'.repeat(500), packageWeightKg: 0.01 })).toBeDefined();
  });
  it('normalizes v4 keys; rejects missing, duplicate, other UUID versions and whitespace', () => {
    expect(parseIdempotencyKey('6BA7B810-9DAD-41D1-80B4-00C04FD430C8')).toBe('6ba7b810-9dad-41d1-80b4-00c04fd430c8');
    for (const key of [undefined, [], 'bad', '6ba7b810-9dad-11d1-80b4-00c04fd430c8', ' 6ba7b810-9dad-41d1-80b4-00c04fd430c8']) {
      expect(() => parseIdempotencyKey(key)).toThrow();
    }
  });
});
