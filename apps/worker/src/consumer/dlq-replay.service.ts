import { Injectable, Logger } from '@nestjs/common';
import { GpsProcessorService, NormalizedGpsEvent } from './gps-processor.service';
import { GpsWriterRepository, GpsWriteResult } from '../storage/gps-writer.repository';

export type DlqReplayStatus =
  | 'REPLAYED'
  | 'SKIPPED_DUPLICATE'
  | 'REJECTED_POISON_PAYLOAD'
  | 'REJECTED_CLOCK_SKEW'
  | 'TRANSIENT_DB_ERROR';

export interface DlqReplayResult {
  messageId: string;
  status: DlqReplayStatus;
  originalEventId?: string;
  driverId?: string;
  clientTimestampIso?: string;
  receivedAtIso?: string;
  error?: string;
  writeResult?: GpsWriteResult;
}

export interface DlqBatchSummary {
  totalProcessed: number;
  replayedCount: number;
  skippedDuplicateCount: number;
  poisonRejectedCount: number;
  clockSkewRejectedCount: number;
  transientErrorCount: number;
  results: DlqReplayResult[];
}

/**
 * DLQ Replay Service per Week 8 Runbook Requirements:
 * - Preserves original identity (eventId, driverId) and exact original timestamps (clientTimestamp, receivedAt).
 * - Distinguishes between permanent poison messages (invalid schema/coords) and transient DB failures.
 * - Enforces first-write-wins deduplication during replay.
 */
@Injectable()
export class DlqReplayService {
  private readonly logger = new Logger(DlqReplayService.name);

  constructor(
    private readonly processor: GpsProcessorService,
    private readonly repository: GpsWriterRepository,
  ) {}

  async replayMessage(message: { id: string; data: string | Buffer | object }): Promise<DlqReplayResult> {
    const rawData =
      typeof message.data === 'string'
        ? message.data
        : Buffer.isBuffer(message.data)
          ? message.data.toString('utf-8')
          : JSON.stringify(message.data);

    const parseResult = this.processor.processMessage(rawData);

    switch (parseResult.type) {
      case 'HELLO_WORLD':
        return {
          messageId: message.id,
          status: 'SKIPPED_DUPLICATE',
          error: 'Probe message (Hello World) ignored in replay',
        };

      case 'INVALID_PAYLOAD':
        this.logger.warn(`[DLQ Replay Poison] Message ${message.id} contains malformed/invalid payload: ${parseResult.error}`);
        return {
          messageId: message.id,
          status: 'REJECTED_POISON_PAYLOAD',
          error: parseResult.error,
        };

      case 'CLOCK_SKEW_EXCEEDED':
        this.logger.warn(`[DLQ Replay Skew] Message ${message.id} exceeds clock skew tolerance: ${parseResult.error}`);
        return {
          messageId: message.id,
          status: 'REJECTED_CLOCK_SKEW',
          error: parseResult.error,
        };

      case 'VALID_GPS': {
        const { event, isHistoryOnly } = parseResult;
        try {
          // Invariant: original eventId and receivedAt are retained directly from event
          const writeResult = await this.repository.recordGpsEvent(event, isHistoryOnly);

          const status: DlqReplayStatus = writeResult.historyInserted
            ? 'REPLAYED'
            : 'SKIPPED_DUPLICATE';

          return {
            messageId: message.id,
            status,
            originalEventId: event.eventId,
            driverId: event.driverId,
            clientTimestampIso: event.clientTimestampIso,
            receivedAtIso: event.receivedAt,
            writeResult,
          };
        } catch (error: any) {
          this.logger.error(`[DLQ Replay Transient Failure] Message ${message.id} failed DB write: ${error.message}`);
          return {
            messageId: message.id,
            status: 'TRANSIENT_DB_ERROR',
            originalEventId: event.eventId,
            driverId: event.driverId,
            error: error.message,
          };
        }
      }
    }
  }

  async replayBatch(messages: Array<{ id: string; data: string | Buffer | object }>): Promise<DlqBatchSummary> {
    const summary: DlqBatchSummary = {
      totalProcessed: messages.length,
      replayedCount: 0,
      skippedDuplicateCount: 0,
      poisonRejectedCount: 0,
      clockSkewRejectedCount: 0,
      transientErrorCount: 0,
      results: [],
    };

    for (const msg of messages) {
      const res = await this.replayMessage(msg);
      summary.results.push(res);
      switch (res.status) {
        case 'REPLAYED':
          summary.replayedCount++;
          break;
        case 'SKIPPED_DUPLICATE':
          summary.skippedDuplicateCount++;
          break;
        case 'REJECTED_POISON_PAYLOAD':
          summary.poisonRejectedCount++;
          break;
        case 'REJECTED_CLOCK_SKEW':
          summary.clockSkewRejectedCount++;
          break;
        case 'TRANSIENT_DB_ERROR':
          summary.transientErrorCount++;
          break;
      }
    }

    return summary;
  }
}

