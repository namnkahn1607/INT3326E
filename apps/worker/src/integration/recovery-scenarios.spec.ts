import { describe, it, expect, beforeEach } from 'vitest';
import { GpsProcessorService } from '../consumer/gps-processor.service';
import { GpsWriterRepository } from '../storage/gps-writer.repository';
import { GpsSubscriber } from '../consumer/gps.subscriber';
import { DlqReplayService } from '../consumer/dlq-replay.service';

/**
 * Week 8 Milestone: Recovery Scenarios & ACK Invariant Test Suite
 * Covers REC02-REC05 per Section IV & Section VII.9 of ParcelFlow spec:
 * - REC02: SQL transient failure -> Rollback, NACK, no ACK before commit; retry succeeds on recovery.
 * - REC03: Crash before commit -> Rollback cleanly; subsequent delivery succeeds.
 * - REC04: Crash after commit before ACK -> Redelivery does not duplicate history or move current backwards.
 * - REC05: Poison/invalid message -> Error classified, doesn't crash worker or block subsequent events.
 * - DLQ Replay Runbook: Preserves original identity & timestamps, deduplicates cleanly.
 */
describe('Week 8: Recovery Scenarios & ACK Invariant (REC02 - REC05)', () => {
  let processor: GpsProcessorService;
  let repository: GpsWriterRepository;
  let subscriber: GpsSubscriber;
  let dlqReplay: DlqReplayService;

  beforeEach(() => {
    processor = new GpsProcessorService();
    repository = new GpsWriterRepository();
    subscriber = new GpsSubscriber(processor, repository);
    dlqReplay = new DlqReplayService(processor, repository);
  });

  const createMockMessage = (payload: any, id: string = 'msg_rec_001') => {
    let acked = false;
    let nacked = false;
    return {
      id,
      data: Buffer.from(typeof payload === 'string' ? payload : JSON.stringify(payload), 'utf-8'),
      ack: () => {
        acked = true;
      },
      nack: () => {
        nacked = true;
      },
      isAcked: () => acked,
      isNacked: () => nacked,
    };
  };

  it('REC02: Database transient failure - must NOT ACK before commit, must NACK on failure, and succeed after recovery', async () => {
    const driverId = 'drv_rec02';
    const clientTimestamp = 1761000000000;
    const receivedAt = new Date(clientTimestamp).toISOString();

    const payload = {
      eventId: 'evt_rec02_fail',
      driverId,
      lat: 21.0285,
      lng: 105.8542,
      clientTimestamp,
      receivedAt,
    };

    // 1. Trigger controlled DB failure
    repository.setSimulateFailure(true);
    const failMsg = createMockMessage(payload, 'msg_rec02_attempt1');

    await expect(subscriber.handleIncomingMessage(failMsg)).rejects.toThrow();

    // Invariant verification: MUST NOT ACK before commit; MUST NACK
    expect(failMsg.isAcked()).toBe(false);
    expect(failMsg.isNacked()).toBe(true);

    // Verify DB remains clean (no partial uncommitted writes)
    expect(await repository.getHistoryCount(driverId)).toBe(0);
    expect(await repository.getLatestCurrentLocation(driverId)).toBeNull();

    // 2. DB recovers -> retry same message
    repository.setSimulateFailure(false);
    const retryMsg = createMockMessage(payload, 'msg_rec02_attempt2');

    await subscriber.handleIncomingMessage(retryMsg);

    // Invariant verification: ACKed only after successful commit
    expect(retryMsg.isAcked()).toBe(true);
    expect(retryMsg.isNacked()).toBe(false);

    expect(await repository.getHistoryCount(driverId)).toBe(1);
    const current = await repository.getLatestCurrentLocation(driverId);
    expect(current).not.toBeNull();
    expect(current!.eventId).toBe('evt_rec02_fail');
  });

  it('REC03: Crash before commit - rolls back cleanly so subsequent redelivery succeeds without collision', async () => {
    const driverId = 'drv_rec03';
    const clientTimestamp = 1761000010000;
    const receivedAt = new Date(clientTimestamp).toISOString();

    const payload = {
      eventId: 'evt_rec03',
      driverId,
      lat: 21.0312,
      lng: 105.8421,
      clientTimestamp,
      receivedAt,
    };

    // Simulate crash before commit
    repository.setSimulateFailure(true);
    const crashMsg = createMockMessage(payload, 'msg_rec03_crash');
    await expect(subscriber.handleIncomingMessage(crashMsg)).rejects.toThrow();
    expect(crashMsg.isAcked()).toBe(false);

    // Redelivered message after restart
    repository.setSimulateFailure(false);
    const redeliveredMsg = createMockMessage(payload, 'msg_rec03_redelivered');
    await subscriber.handleIncomingMessage(redeliveredMsg);

    expect(redeliveredMsg.isAcked()).toBe(true);
    expect(await repository.getHistoryCount(driverId)).toBe(1);
    const current = await repository.getLatestCurrentLocation(driverId);
    expect(current!.lat).toBe(21.0312);
  });

  it('REC04: Crash after commit before ACK - redelivery must not duplicate history or move current backwards', async () => {
    const driverId = 'drv_rec04';
    const t1 = 1761000000000;
    const t2 = 1761000008000;

    const payload1 = {
      eventId: 'evt_rec04_1',
      driverId,
      lat: 21.01,
      lng: 105.81,
      clientTimestamp: t1,
      receivedAt: new Date(t1).toISOString(),
    };

    // 1. Initial message committed
    const msg1 = createMockMessage(payload1, 'msg_rec04_orig');
    await subscriber.handleIncomingMessage(msg1);
    expect(msg1.isAcked()).toBe(true);

    // 2. A newer event arrives and commits
    const payload2 = {
      eventId: 'evt_rec04_2',
      driverId,
      lat: 21.02,
      lng: 105.82,
      clientTimestamp: t2,
      receivedAt: new Date(t2).toISOString(),
    };
    const msg2 = createMockMessage(payload2, 'msg_rec04_new');
    await subscriber.handleIncomingMessage(msg2);
    expect(msg2.isAcked()).toBe(true);

    const currentBeforeRedelivery = await repository.getLatestCurrentLocation(driverId);
    expect(currentBeforeRedelivery!.clientTimestamp).toBe(t2);
    expect(await repository.getHistoryCount(driverId)).toBe(2);

    // 3. Crash after commit simulated: Pub/Sub redelivers message 1 (with different coordinates or same)
    const redeliveredMsg1 = createMockMessage(
      { ...payload1, lat: 21.0999, lng: 105.8999 }, // Conflicting coordinates on duplicate timestamp
      'msg_rec04_redelivered',
    );
    await subscriber.handleIncomingMessage(redeliveredMsg1);

    // Invariant: Must ACK successfully
    expect(redeliveredMsg1.isAcked()).toBe(true);

    // Invariant: History must NOT increase (remains 2 rows)
    expect(await repository.getHistoryCount(driverId)).toBe(2);

    // Invariant: Current location must NOT move backwards to t1
    const currentAfterRedelivery = await repository.getLatestCurrentLocation(driverId);
    expect(currentAfterRedelivery!.clientTimestamp).toBe(t2);
    expect(currentAfterRedelivery!.lat).toBe(21.02);
  });

  it('REC05: Poison/invalid messages - classified error, ACKed to prevent tight loops, subsequent events processed', async () => {
    // 1. Malformed JSON message
    const malformedMsg = createMockMessage('{"broken_json', 'msg_poison_1');
    await subscriber.handleIncomingMessage(malformedMsg);
    expect(malformedMsg.isAcked()).toBe(true); // ACKed to prevent retry tight-loop

    // 2. Out-of-range coordinates
    const invalidCoordsMsg = createMockMessage(
      {
        eventId: 'evt_poison_coords',
        driverId: 'drv_poison',
        lat: 999.0, // Invalid lat > 90
        lng: 105.8,
        clientTimestamp: Date.now(),
        receivedAt: new Date().toISOString(),
      },
      'msg_poison_2',
    );
    await subscriber.handleIncomingMessage(invalidCoordsMsg);
    expect(invalidCoordsMsg.isAcked()).toBe(true);

    // 3. Extreme future clock skew (> 60s)
    const now = Date.now();
    const extremeSkewMsg = createMockMessage(
      {
        eventId: 'evt_poison_skew',
        driverId: 'drv_poison',
        lat: 21.0,
        lng: 105.8,
        clientTimestamp: now + 120000, // +120s > 60s
        receivedAt: new Date(now).toISOString(),
      },
      'msg_poison_3',
    );
    await subscriber.handleIncomingMessage(extremeSkewMsg);
    expect(extremeSkewMsg.isAcked()).toBe(true);

    // 4. Verify valid event immediately processed afterwards without interference
    const validMsg = createMockMessage(
      {
        eventId: 'evt_valid_after_poison',
        driverId: 'drv_good',
        lat: 21.0285,
        lng: 105.8542,
        clientTimestamp: now,
        receivedAt: new Date(now).toISOString(),
      },
      'msg_valid_after_poison',
    );
    await subscriber.handleIncomingMessage(validMsg);
    expect(validMsg.isAcked()).toBe(true);

    const current = await repository.getLatestCurrentLocation('drv_good');
    expect(current).not.toBeNull();
    expect(current!.eventId).toBe('evt_valid_after_poison');
  });

  it('DLQ Replay Runbook: preserves original event identity & timestamps, and rejects unrecoverable poison messages', async () => {
    const tOriginal = 1761000000000;
    const rOriginal = new Date(tOriginal + 500).toISOString(); // clientTimestamp <= receivedAt (eligible for current)

    const deadLetterBatch = [
      // 1. Valid event that was delayed / dead-lettered
      {
        id: 'dlq_msg_01',
        data: {
          eventId: 'evt_dlq_valid_01',
          driverId: 'drv_dlq_01',
          lat: 21.0285,
          lng: 105.8542,
          clientTimestamp: tOriginal,
          receivedAt: rOriginal,
        },
      },
      // 2. Duplicate of an already stored event
      {
        id: 'dlq_msg_02',
        data: {
          eventId: 'evt_dlq_dup_02',
          driverId: 'drv_dlq_01',
          lat: 21.0999, // Conflicting coords
          lng: 105.8999,
          clientTimestamp: tOriginal, // Same timestamp
          receivedAt: rOriginal,
        },
      },
      // 3. Permanent poison message (invalid lat)
      {
        id: 'dlq_msg_03',
        data: {
          eventId: 'evt_dlq_poison_03',
          driverId: 'drv_dlq_02',
          lat: -120.0, // Invalid
          lng: 105.8,
          clientTimestamp: tOriginal,
          receivedAt: rOriginal,
        },
      },
      // 4. Clock skew exceeded message (>60s)
      {
        id: 'dlq_msg_04',
        data: {
          eventId: 'evt_dlq_skew_04',
          driverId: 'drv_dlq_03',
          lat: 21.0,
          lng: 105.8,
          clientTimestamp: tOriginal + 90000,
          receivedAt: new Date(tOriginal).toISOString(),
        },
      },
    ];

    const summary = await dlqReplay.replayBatch(deadLetterBatch);

    expect(summary.totalProcessed).toBe(4);
    expect(summary.replayedCount).toBe(1);
    expect(summary.skippedDuplicateCount).toBe(1);
    expect(summary.poisonRejectedCount).toBe(1);
    expect(summary.clockSkewRejectedCount).toBe(1);

    // Verify original eventId, clientTimestamp and receivedAt are strictly preserved
    const replayed = summary.results[0];
    expect(replayed.status).toBe('REPLAYED');
    expect(replayed.originalEventId).toBe('evt_dlq_valid_01');
    expect(replayed.clientTimestampIso).toBe(new Date(tOriginal).toISOString());
    expect(replayed.receivedAtIso).toBe(rOriginal);

    const saved = await repository.getLatestCurrentLocation('drv_dlq_01');
    expect(saved).not.toBeNull();
    expect(saved!.lat).toBe(21.0285);
    expect(saved!.eventId).toBe('evt_dlq_valid_01');
  });
});
