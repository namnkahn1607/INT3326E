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
      const res = await repository.insertHistory(event);
      expect(res.inserted).toBe(true);
      expect(res.conflict).toBe(false);
      expect(await repository.getHistoryCount('drv_001')).toBe(1);
    });

    it('should ignore duplicate event with identical (driverId, clientTimestamp)', async () => {
      const event1 = createEvent({ eventId: 'evt_1', latitude: 21.0285, lat: 21.0285 });
      const event2 = createEvent({ eventId: 'evt_2_duplicate', latitude: 21.0299, lat: 21.0299 }); // different coords on same key

      const firstInsert = await repository.insertHistory(event1);
      const duplicateInsert = await repository.insertHistory(event2);

      expect(firstInsert.inserted).toBe(true);
      expect(duplicateInsert.inserted).toBe(false);
      expect(duplicateInsert.conflict).toBe(true);
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

  describe('Week 4 Invariants & Test Cases (TC04.3, TC04.4, TC04.5)', () => {
    it('TC04.3: should retain first-write canonical coords and report conflict when duplicate arrives with different coords', async () => {
      const event1 = createEvent({
        eventId: 'evt_first',
        latitude: 21.0285,
        longitude: 105.8542,
        lat: 21.0285,
        lng: 105.8542,
        clientTimestamp: 1760800000000,
      });
      const event2 = createEvent({
        eventId: 'evt_dup_diff_coords',
        latitude: 21.0999,
        longitude: 105.8999,
        lat: 21.0999,
        lng: 105.8999,
        clientTimestamp: 1760800000000,
      });

      const res1 = await repository.recordGpsEvent(event1, false);
      expect(res1.historyInserted).toBe(true);
      expect(res1.currentUpdated).toBe(true);
      expect(res1.canonicalEvent.latitude).toBe(21.0285);

      const res2 = await repository.recordGpsEvent(event2, false);
      expect(res2.historyInserted).toBe(false);
      expect(res2.conflict).toBe(true);
      expect(res2.canonicalEvent.latitude).toBe(21.0285);

      // Current location MUST retain canonical row from first-write
      const current = await repository.getLatestCurrentLocation('drv_001');
      expect(current?.latitude).toBe(21.0285);
      expect(current?.longitude).toBe(105.8542);
      expect(await repository.getHistoryCount('drv_001')).toBe(1);
    });

    it('TC04.4: current location preserves max clientTimestamp and never rewinds due to late arrival or session switch', async () => {
      const session1Newer = createEvent({
        eventId: 'evt_s1',
        sessionId: 'sess-001',
        seq: 10,
        clientTimestamp: 1760800050000,
        latitude: 21.05,
        lat: 21.05,
      });
      const session2Older = createEvent({
        eventId: 'evt_s2',
        sessionId: 'sess-002',
        seq: 1,
        clientTimestamp: 1760800020000,
        latitude: 21.02,
        lat: 21.02,
      });

      await repository.recordGpsEvent(session1Newer, false);
      const delayedRes = await repository.recordGpsEvent(session2Older, false);

      expect(delayedRes.historyInserted).toBe(true);
      expect(delayedRes.currentUpdated).toBe(false);

      const current = await repository.getLatestCurrentLocation('drv_001');
      expect(current?.clientTimestamp).toBe(1760800050000);
      expect(current?.latitude).toBe(21.05);
      expect(current?.sessionId).toBe('sess-001');
      expect(await repository.getHistoryCount('drv_001')).toBe(2);
    });

    it('TC04.5: should skip current_locations update if event is flagged history-only (clock skew)', async () => {
      const initialEvent = createEvent({ clientTimestamp: 1760800000000, latitude: 21.01, lat: 21.01 });
      await repository.recordGpsEvent(initialEvent, false);

      const historyOnlyEvent = createEvent({ clientTimestamp: 1760800060000, latitude: 21.09, lat: 21.09 });
      const result = await repository.recordGpsEvent(historyOnlyEvent, true);

      expect(result.historyInserted).toBe(true);
      expect(result.currentUpdated).toBe(false);

      const current = await repository.getLatestCurrentLocation('drv_001');
      expect(current?.latitude).toBe(21.01);
    });
  });
});

