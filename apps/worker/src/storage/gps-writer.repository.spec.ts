import { describe, it, expect, beforeEach } from 'vitest';
import { GpsWriterRepository } from './gps-writer.repository';
import { NormalizedGpsEvent } from '../consumer/gps-processor.service';

describe('GpsWriterRepository', () => {
  let repository: GpsWriterRepository;

  const createEvent = (overrides?: Partial<NormalizedGpsEvent>): NormalizedGpsEvent => ({
    eventId: 'evt_repo_test',
    driverId: 'drv_001',
    latitude: 21.0285,
    longitude: 105.8542,
    lat: 21.0285,
    lng: 105.8542,
    clientTimestamp: 1760800000000,
    clientTimestampIso: new Date(1760800000000).toISOString(),
    receivedAt: new Date(1760800000000).toISOString(),
    receivedAtMs: 1760800000000,
    ...overrides,
  });

  beforeEach(() => {
    repository = new GpsWriterRepository();
    repository.clearStores();
  });

  describe('insertHistory (DATA05 - first-write-wins)', () => {
    it('should insert first instance of event into history', async () => {
      const event = createEvent();
      const inserted = await repository.insertHistory(event);
      expect(inserted).toBe(true);
      expect(await repository.getHistoryCount('drv_001')).toBe(1);
    });

    it('should ignore duplicate event with identical (driverId, clientTimestamp)', async () => {
      const event1 = createEvent({ eventId: 'evt_1', latitude: 21.0285 });
      const event2 = createEvent({ eventId: 'evt_2_duplicate', latitude: 21.0299 }); // different coords on same key

      const firstInsert = await repository.insertHistory(event1);
      const duplicateInsert = await repository.insertHistory(event2);

      expect(firstInsert).toBe(true);
      expect(duplicateInsert).toBe(false);
      expect(await repository.getHistoryCount('drv_001')).toBe(1);
    });
  });

  describe('upsertCurrent (DATA04 - out-of-order handling)', () => {
    it('should update current location when timestamp is newer', async () => {
      const olderEvent = createEvent({ clientTimestamp: 1760800000000 });
      const newerEvent = createEvent({ clientTimestamp: 1760800010000, latitude: 21.03 });

      await repository.upsertCurrent(olderEvent);
      const updated = await repository.upsertCurrent(newerEvent);

      expect(updated).toBe(true);
      const current = await repository.getLatestCurrentLocation('drv_001');
      expect(current?.latitude).toBe(21.03);
      expect(current?.clientTimestamp).toBe(1760800010000);
    });

    it('should reject/ignore current location update when candidate timestamp is older', async () => {
      const newerEvent = createEvent({ clientTimestamp: 1760800050000, latitude: 21.035 });
      const delayedOlderEvent = createEvent({ clientTimestamp: 1760800010000, latitude: 21.0285 });

      await repository.upsertCurrent(newerEvent);
      const updatedOlder = await repository.upsertCurrent(delayedOlderEvent);

      expect(updatedOlder).toBe(false);
      const current = await repository.getLatestCurrentLocation('drv_001');
      expect(current?.clientTimestamp).toBe(1760800050000);
      expect(current?.latitude).toBe(21.035);
    });
  });

  describe('recordGpsEvent with isHistoryOnly flag', () => {
    it('should skip current_locations update if event is flagged history-only (e.g. clock skew)', async () => {
      const initialEvent = createEvent({ clientTimestamp: 1760800000000, latitude: 21.01 });
      await repository.recordGpsEvent(initialEvent, false);

      const historyOnlyEvent = createEvent({ clientTimestamp: 1760800060000, latitude: 21.09 });
      const result = await repository.recordGpsEvent(historyOnlyEvent, true);

      expect(result.historyInserted).toBe(true);
      expect(result.currentUpdated).toBe(false);

      const current = await repository.getLatestCurrentLocation('drv_001');
      expect(current?.latitude).toBe(21.01);
    });
  });
});

