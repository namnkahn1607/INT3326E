import { describe, it, expect, beforeEach } from 'vitest';
import { GpsProcessorService } from '../consumer/gps-processor.service';
import { GpsWriterRepository } from '../storage/gps-writer.repository';
import { GpsSubscriber } from '../consumer/gps.subscriber';

/**
 * Week 9 Milestone: Worker Throughput, Backlog Drain & Manifest Integrity (LT01-LT06 & REC01)
 * Per Section IV & VII.10 of ParcelFlow specification:
 * - LT01/LT02: Measure worker processing throughput under baseline (62.5 event/s) and peak (300 event/s).
 * - REC01: Backlog drain verification. With B = 3,750 events accumulated during 60s outage,
 *   measure processing rate mu > 125 event/s, proving drain time T_drain < 60s.
 * - LT06: Manifest integrity check: 100% of accepted events persisted without loss,
 *   duplicates resolved first-write-wins, and current_locations accurately reflects max eligible timestamp.
 */
describe('Week 9: Worker Throughput, Backlog Drain & Integrity (LT01 - LT06 & REC01)', () => {
  let processor: GpsProcessorService;
  let repository: GpsWriterRepository;
  let subscriber: GpsSubscriber;

  beforeEach(() => {
    processor = new GpsProcessorService();
    repository = new GpsWriterRepository();
    subscriber = new GpsSubscriber(processor, repository);
  });

  const createMockMessage = (payload: any, id: string) => {
    let acked = false;
    return {
      id,
      data: Buffer.from(JSON.stringify(payload), 'utf-8'),
      ack: () => {
        acked = true;
      },
      nack: () => {},
      isAcked: () => acked,
    };
  };

  it('LT01/LT02 & REC01: Worker backlog drain performance exceeds 125 events/sec (target T_drain < 60s for 3,750 backlog)', async () => {
    const BACKLOG_SIZE = 3750; // Spec B = 3,750 events (60s x 62.5 event/s)
    const baseTime = 1761000000000;
    const DRIVER_COUNT = 500;

    // Generate manifest of 3,750 backlog events across 500 simulated drivers
    const messages = [];
    for (let i = 0; i < BACKLOG_SIZE; i++) {
      const driverIndex = i % DRIVER_COUNT;
      const driverId = `drv_load_${String(driverIndex).padStart(4, '0')}`;
      const clientTimestamp = baseTime + Math.floor(i / DRIVER_COUNT) * 8000;
      const receivedAt = new Date(clientTimestamp).toISOString();

      messages.push(
        createMockMessage(
          {
            eventId: `evt_load_${i}`,
            driverId,
            lat: 21.02 + (driverIndex * 0.0001),
            lng: 105.80 + (driverIndex * 0.0001),
            clientTimestamp,
            receivedAt,
          },
          `msg_load_${i}`,
        ),
      );
    }

    // Measure start time
    const startTime = performance.now();

    // Drain backlog through subscriber
    for (const msg of messages) {
      await subscriber.handleIncomingMessage(msg);
    }

    const durationMs = performance.now() - startTime;
    const durationSeconds = durationMs / 1000;
    const throughput = BACKLOG_SIZE / durationSeconds;

    console.log(
      `[REC01 Drain Benchmark] Processed ${BACKLOG_SIZE} events in ${durationMs.toFixed(2)}ms -> Throughput: ${throughput.toFixed(2)} events/s`,
    );

    // Invariant: all messages ACKed
    const allAcked = messages.every((m) => m.isAcked());
    expect(allAcked).toBe(true);

    // Capacity target: mu must exceed 125 event/s to satisfy T_drain < 60s under baseline arrival
    expect(throughput).toBeGreaterThan(125);

    // All events accounted for in history
    const historyCount = await repository.getHistoryCount();
    expect(historyCount).toBe(BACKLOG_SIZE);
  });

  it('LT06: Manifest Integrity Verification - preserves 100% accepted events, resolves duplicates, and maintains max timestamp', async () => {
    const DRIVER_COUNT = 10;
    const SAMPLES_PER_DRIVER = 20;
    const baseTime = 1761000000000;

    interface ManifestEntry {
      eventId: string;
      driverId: string;
      lat: number;
      lng: number;
      clientTimestamp: number;
      receivedAt: string;
      isDuplicate?: boolean;
    }

    const manifest: ManifestEntry[] = [];
    const expectedMaxTimestamps = new Map<string, number>();

    for (let d = 0; d < DRIVER_COUNT; d++) {
      const driverId = `drv_integ_${d}`;
      let maxT = 0;

      for (let s = 0; s < SAMPLES_PER_DRIVER; s++) {
        const clientTimestamp = baseTime + s * 8000;
        if (clientTimestamp > maxT) {
          maxT = clientTimestamp;
        }

        manifest.push({
          eventId: `evt_${driverId}_${s}`,
          driverId,
          lat: 21.0 + d * 0.01 + s * 0.001,
          lng: 105.8 + d * 0.01 + s * 0.001,
          clientTimestamp,
          receivedAt: new Date(clientTimestamp).toISOString(),
        });

        // Add an intentional duplicate sample for odd sequences
        if (s % 3 === 0) {
          manifest.push({
            eventId: `evt_${driverId}_${s}_dup`,
            driverId,
            lat: 21.9999, // Conflicting coords
            lng: 105.9999,
            clientTimestamp, // Same timestamp
            receivedAt: new Date(clientTimestamp).toISOString(),
            isDuplicate: true,
          });
        }
      }

      expectedMaxTimestamps.set(driverId, maxT);
    }

    // Shuffle manifest to simulate out-of-order network arrival
    const shuffled = [...manifest].sort(() => Math.random() - 0.5);

    const latencies: number[] = [];
    for (const entry of shuffled) {
      const msg = createMockMessage(entry, `msg_${entry.eventId}`);
      const tStart = performance.now();
      await subscriber.handleIncomingMessage(msg);
      latencies.push(performance.now() - tStart);
      expect(msg.isAcked()).toBe(true);
    }

    // Latency calculations
    latencies.sort((a, b) => a - b);
    const p50 = latencies[Math.floor(latencies.length * 0.5)];
    const p95 = latencies[Math.floor(latencies.length * 0.95)];
    console.log(
      `[LT06 Integrity Benchmark] Processed ${shuffled.length} manifest items. Latency: p50 = ${p50.toFixed(3)}ms, p95 = ${p95.toFixed(3)}ms`,
    );

    // 1. History count: all unique (driverId, clientTimestamp) keys must be persisted (duplicates must not inflate count)
    const expectedUniqueHistory = DRIVER_COUNT * SAMPLES_PER_DRIVER;
    const actualHistory = await repository.getHistoryCount();
    expect(actualHistory).toBe(expectedUniqueHistory);

    // 2. Current location check for every driver: must exactly match max timestamp and canonical coords
    for (let d = 0; d < DRIVER_COUNT; d++) {
      const driverId = `drv_integ_${d}`;
      const current = await repository.getLatestCurrentLocation(driverId);
      expect(current).not.toBeNull();
      expect(current!.clientTimestamp).toBe(expectedMaxTimestamps.get(driverId));

      // Invariant: coordinates must NOT be the duplicate coordinates (first-write-wins was preserved)
      expect(current!.lat).not.toBe(21.9999);
    }
  });
});

