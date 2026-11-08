import { describe, expect, it } from 'vitest';
import { shipmentIdentifiers } from './shipment-identifiers';

describe('Backend shipment identifiers', () => {
  it('generates independent cryptographic prefixed ULIDs and UTC tracking numbers', () => {
    const now = new Date('2026-10-24T00:00:00.000Z');
    const ids = Array.from({ length: 100 }, () => shipmentIdentifiers(now));
    expect(new Set(ids.map(x => x.id)).size).toBe(100);
    expect(new Set(ids.map(x => x.trackingNumber)).size).toBe(100);
    for (const item of ids) {
      expect(item.id).toMatch(/^sh_[0-7][0-9A-HJKMNP-TV-Z]{25}$/);
      expect(item.trackingNumber).toMatch(/^PF20261024[0-9A-HJKMNP-TV-Z]{6}$/);
    }
  });
});
