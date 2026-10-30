import { describe, it, expect, beforeEach } from 'vitest';
import { GpsProcessorService } from '../consumer/gps-processor.service';
import { GpsWriterRepository } from '../storage/gps-writer.repository';
import { GpsSubscriber } from '../consumer/gps.subscriber';

/**
 * Week 5 Milestone Integration & GPS Correctness Test Suite
 * Covers end-to-end pipeline verification for TV2:
 * - TC04.3: Duplicate & conflict handling (first-write-wins)
 * - TC04.4: Out-of-order & session switching
 * - TC04.5: Clock skew tolerance & boundary conditions
 * - TC04.8: Crash recovery, rollback, and redelivery
 * - TC05.1 - TC05.3: Tracking snapshot, freshness ([0, 30s] vs > 30s), and event correlation
 */
describe('Week 5: End-to-End GPS Pipeline & Correctness Suite', () => {
  let processor: GpsProcessorService;
  let repository: GpsWriterRepository;
  let subscriber: GpsSubscriber;

  // Realistic delivery route coordinates in Hanoi
  const ROUTE_WAYPOINTS = [
    { name: 'Pickup Point (Keangnam)', lat: 21.0167, lng: 105.7836 },
    { name: 'Waypoint 1 (Cau Giay)', lat: 21.0313, lng: 105.7981 },
    { name: 'Waypoint 2 (Kim Ma)', lat: 21.0315, lng: 105.8175 },
    { name: 'Waypoint 3 (Nguyen Thai Hoc)', lat: 21.0298, lng: 105.8352 },
    { name: 'Waypoint 4 (Cua Nam)', lat: 21.0264, lng: 105.8427 },
    { name: 'Delivery Point (Hoan Kiem)', lat: 21.0285, lng: 105.8542 },
  ];

  beforeEach(() => {
    processor = new GpsProcessorService();
    repository = new GpsWriterRepository();
    repository.clearStores();
    subscriber = new GpsSubscriber(processor, repository);
  });

  const makeMockMessage = (payload: Record<string, any>) => {
    let acked = false;
    let nacked = false;
    return {
      id: `msg_${payload.eventId || 'test'}`,
      data: Buffer.from(JSON.stringify(payload), 'utf-8'),
      ack: () => { acked = true; },
      nack: () => { nacked = true; },
      isAcked: () => acked,
      isNacked: () => nacked,
    };
  };

  it('1. should process sequential driver delivery route and update current location accurately', async () => {
    const driverId = 'drv_hanoi_01';
    const baseTime = 1761000000000; // Epoch ms

    for (let i = 0; i < ROUTE_WAYPOINTS.length; i++) {
      const wp = ROUTE_WAYPOINTS[i];
      const timestamp = baseTime + i * 8000; // Emitted every 8 seconds per spec
      const eventId = `evt_seq_${i}`;

      const msg = makeMockMessage({
        eventId,
        driverId,
        latitude: wp.lat,
        longitude: wp.lng,
        clientTimestamp: timestamp,
        receivedAt: new Date(timestamp + 200).toISOString(),
      });

      await subscriber.handleIncomingMessage(msg as any);
      expect(msg.isAcked()).toBe(true);

      const current = await repository.getLatestCurrentLocation(driverId);
      expect(current?.latitude).toBe(wp.lat);
      expect(current?.longitude).toBe(wp.lng);
      expect(current?.clientTimestamp).toBe(timestamp);
      expect(current?.eventId).toBe(eventId);
    }

    expect(await repository.getHistoryCount(driverId)).toBe(ROUTE_WAYPOINTS.length);
  });

  it('2. TC04.4: should maintain maximum eligible clientTimestamp when waypoints arrive out of order', async () => {
    const driverId = 'drv_out_of_order';
    const baseTime = 1761000000000;

    const wp1 = { eventId: 'evt_wp1', driverId, latitude: 21.0167, longitude: 105.7836, clientTimestamp: baseTime, receivedAt: new Date(baseTime + 500).toISOString() };
    const wp2 = { eventId: 'evt_wp2', driverId, latitude: 21.0313, longitude: 105.7981, clientTimestamp: baseTime + 8000, receivedAt: new Date(baseTime + 8500).toISOString() };
    const wp3 = { eventId: 'evt_wp3', driverId, latitude: 21.0315, longitude: 105.8175, clientTimestamp: baseTime + 16000, receivedAt: new Date(baseTime + 16500).toISOString() };
    const wp4 = { eventId: 'evt_wp4', driverId, latitude: 21.0298, longitude: 105.8352, clientTimestamp: baseTime + 24000, receivedAt: new Date(baseTime + 24500).toISOString() };

    // Arrive in scrambled order: WP1 -> WP4 (newest) -> WP2 (delayed) -> WP3 (delayed)
    const msg1 = makeMockMessage(wp1);
    await subscriber.handleIncomingMessage(msg1 as any);
    expect(msg1.isAcked()).toBe(true);

    const msg4 = makeMockMessage(wp4);
    await subscriber.handleIncomingMessage(msg4 as any);
    expect(msg4.isAcked()).toBe(true);
    let current = await repository.getLatestCurrentLocation(driverId);
    expect(current?.clientTimestamp).toBe(wp4.clientTimestamp);
    expect(current?.latitude).toBe(wp4.latitude);

    // Delayed WP2 arrives - history receives it, but current_locations DOES NOT rewind
    const msg2 = makeMockMessage(wp2);
    await subscriber.handleIncomingMessage(msg2 as any);
    expect(msg2.isAcked()).toBe(true);
    current = await repository.getLatestCurrentLocation(driverId);
    expect(current?.clientTimestamp).toBe(wp4.clientTimestamp);
    expect(current?.latitude).toBe(wp4.latitude);

    // Delayed WP3 arrives - history receives it, current remains WP4
    const msg3 = makeMockMessage(wp3);
    await subscriber.handleIncomingMessage(msg3 as any);
    expect(msg3.isAcked()).toBe(true);
    current = await repository.getLatestCurrentLocation(driverId);
    expect(current?.clientTimestamp).toBe(wp4.clientTimestamp);
    expect(current?.latitude).toBe(wp4.latitude);

    // Verify all 4 waypoints are present in history
    expect(await repository.getHistoryCount(driverId)).toBe(4);
  });

  it('3. TC04.3: should enforce first-write-wins when duplicate retry arrives with conflicting coordinates', async () => {
    const driverId = 'drv_dup_test';
    const timestamp = 1761000000000;

    const originalEvent = {
      eventId: 'evt_orig',
      driverId,
      latitude: 21.0285,
      longitude: 105.8542,
      clientTimestamp: timestamp,
      receivedAt: '2026-10-18T14:30:00.000Z',
    };

    const conflictingDuplicate = {
      eventId: 'evt_dup_conflict',
      driverId,
      latitude: 21.0999, // Conflicting coords
      longitude: 105.8999,
      clientTimestamp: timestamp, // Identical timestamp
      receivedAt: '2026-10-18T14:30:02.000Z',
    };

    const msg1 = makeMockMessage(originalEvent);
    await subscriber.handleIncomingMessage(msg1 as any);
    expect(msg1.isAcked()).toBe(true);

    const msg2 = makeMockMessage(conflictingDuplicate);
    await subscriber.handleIncomingMessage(msg2 as any);
    expect(msg2.isAcked()).toBe(true);

    // Exactly one row in history for this timestamp
    expect(await repository.getHistoryCount(driverId)).toBe(1);

    // Current location must retain original coordinates
    const current = await repository.getLatestCurrentLocation(driverId);
    expect(current?.latitude).toBe(21.0285);
    expect(current?.longitude).toBe(105.8542);
    expect(current?.eventId).toBe('evt_orig');
  });

  it('4. TC04.5: should accept clock skew within 60s as history-only, and allow subsequent present sample to update current', async () => {
    const driverId = 'drv_clock_skew';
    const now = 1761000000000;
    const receivedAtIso = new Date(now).toISOString();

    // 1. Initial valid point
    const initial = makeMockMessage({
      eventId: 'evt_initial',
      driverId,
      latitude: 21.01,
      longitude: 105.81,
      clientTimestamp: now,
      receivedAt: receivedAtIso,
    });
    await subscriber.handleIncomingMessage(initial as any);
    expect(initial.isAcked()).toBe(true);

    // 2. Future clock skew within 60s (now + 40s): must be history-only, cannot overwrite current
    const futureSkew = makeMockMessage({
      eventId: 'evt_future_skew',
      driverId,
      latitude: 21.09,
      longitude: 105.89,
      clientTimestamp: now + 40000,
      receivedAt: receivedAtIso,
    });
    await subscriber.handleIncomingMessage(futureSkew as any);
    expect(futureSkew.isAcked()).toBe(true);

    let current = await repository.getLatestCurrentLocation(driverId);
    expect(current?.latitude).toBe(21.01); // Kept initial point

    // 3. New present point (now + 8s, received at now + 8s): updates current properly
    const presentNew = makeMockMessage({
      eventId: 'evt_present_new',
      driverId,
      latitude: 21.02,
      longitude: 105.82,
      clientTimestamp: now + 8000,
      receivedAt: new Date(now + 8000).toISOString(),
    });
    await subscriber.handleIncomingMessage(presentNew as any);
    expect(presentNew.isAcked()).toBe(true);

    current = await repository.getLatestCurrentLocation(driverId);
    expect(current?.latitude).toBe(21.02);
    expect(current?.clientTimestamp).toBe(now + 8000);
  });

  it('5. TC04.8: should rollback and nack on DB failure, and succeed on redelivery', async () => {
    const driverId = 'drv_recovery_test';
    const event = {
      eventId: 'evt_recovery',
      driverId,
      latitude: 21.0285,
      longitude: 105.8542,
      clientTimestamp: 1761000000000,
      receivedAt: '2026-10-18T14:30:00.000Z',
    };

    // Simulate database transaction failure
    repository.setSimulateFailure(true);
    const failedMsg = makeMockMessage(event);

    await expect(subscriber.handleIncomingMessage(failedMsg as any)).rejects.toThrow();
    expect(failedMsg.isAcked()).toBe(false);
    expect(failedMsg.isNacked()).toBe(true);
    expect(await repository.getHistoryCount(driverId)).toBe(0);

    // System recovers - redelivery succeeds
    repository.setSimulateFailure(false);
    const retryMsg = makeMockMessage(event);
    await subscriber.handleIncomingMessage(retryMsg as any);

    expect(retryMsg.isAcked()).toBe(true);
    expect(await repository.getHistoryCount(driverId)).toBe(1);
    const current = await repository.getLatestCurrentLocation(driverId);
    expect(current?.latitude).toBe(21.0285);
  });

  it('6. TC05.1 - TC05.3: should evaluate tracking snapshot and staleness threshold correctly', async () => {
    const driverId = 'drv_tracking_eval';
    const baseTime = 1761000000000;

    // A. Query non-existent driver -> null snapshot
    const emptySnapshot = await repository.getTrackingSnapshot('drv_non_existent', baseTime);
    expect(emptySnapshot.currentDriverLocation).toBeNull();
    expect(emptySnapshot.isLocationStale).toBeNull();
    expect(emptySnapshot.eventId).toBeNull();

    // B. Ingest fresh location (10 seconds old relative to reading time)
    const freshEvent = makeMockMessage({
      eventId: 'evt_fresh_01',
      driverId,
      latitude: 21.0285,
      longitude: 105.8542,
      clientTimestamp: baseTime,
      receivedAt: new Date(baseTime + 100).toISOString(),
    });
    await subscriber.handleIncomingMessage(freshEvent as any);

    // When queried at baseTime + 15s (age = 15s <= 30s) -> isLocationStale = false
    const freshSnapshot = await repository.getTrackingSnapshot(driverId, baseTime + 15000);
    expect(freshSnapshot.currentDriverLocation).toEqual({ lat: 21.0285, lng: 105.8542 });
    expect(freshSnapshot.isLocationStale).toBe(false);
    expect(freshSnapshot.eventId).toBe('evt_fresh_01');

    // When queried at baseTime + 35s (age = 35s > 30s stale threshold) -> isLocationStale = true
    const staleSnapshot = await repository.getTrackingSnapshot(driverId, baseTime + 35000);
    expect(staleSnapshot.currentDriverLocation).toEqual({ lat: 21.0285, lng: 105.8542 });
    expect(staleSnapshot.isLocationStale).toBe(true);
    expect(staleSnapshot.eventId).toBe('evt_fresh_01');
  });
});

