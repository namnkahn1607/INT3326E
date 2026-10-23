import { Injectable, Logger } from '@nestjs/common';
import { NormalizedGpsEvent } from '../consumer/gps-processor.service';

export interface GpsWriteResult {
  historyInserted: boolean;
  currentUpdated: boolean;
  reason?: string;
}

@Injectable()
export class GpsWriterRepository {
  private readonly logger = new Logger(GpsWriterRepository.name);

  // In-memory backing store for Week 3 contract validation and test execution
  // In Week 4, this repository connects directly to PostgreSQL / Prisma
  private readonly historyStore = new Map<string, NormalizedGpsEvent>();
  private readonly currentStore = new Map<string, NormalizedGpsEvent>();

  /**
   * DATA05: location_history
   * Unique constraint: (driverId, clientTimestamp)
   * Invariant: First-write-wins (ON CONFLICT DO NOTHING)
   */
  async insertHistory(event: NormalizedGpsEvent): Promise<boolean> {
    const key = `${event.driverId}:${event.clientTimestamp}`;
    if (this.historyStore.has(key)) {
      this.logger.debug(`[Dedupe] Duplicate GPS history entry ignored for key ${key}`);
      return false;
    }

    this.historyStore.set(key, event);
    return true;
  }

  /**
   * DATA04: current_locations
   * Unique PK: driverId
   * Invariant: Conditional update ONLY IF candidate.clientTimestamp > stored.clientTimestamp
   */
  async upsertCurrent(event: NormalizedGpsEvent): Promise<boolean> {
    const existing = this.currentStore.get(event.driverId);
    if (!existing || event.clientTimestamp > existing.clientTimestamp) {
      this.currentStore.set(event.driverId, event);
      return true;
    }

    this.logger.debug(
      `[Out-Of-Order] Current location update skipped for ${event.driverId}: candidate timestamp (${event.clientTimestamp}) <= current (${existing.clientTimestamp})`,
    );
    return false;
  }

  /**
   * Orchestrates GPS write pipeline per D02 & D08:
   * 1. Inserts into location_history (first-write-wins).
   * 2. If eligible and not history-only, conditionally updates current_locations.
   */
  async recordGpsEvent(event: NormalizedGpsEvent, isHistoryOnly = false): Promise<GpsWriteResult> {
    const historyInserted = await this.insertHistory(event);
    let currentUpdated = false;

    if (!isHistoryOnly) {
      currentUpdated = await this.upsertCurrent(event);
    } else {
      this.logger.debug(
        `[Clock Skew Tolerance] Event ${event.eventId} marked history-only; current_locations update skipped`,
      );
    }

    return {
      historyInserted,
      currentUpdated,
      reason: isHistoryOnly ? 'history-only (clock skew)' : undefined,
    };
  }

  async getLatestCurrentLocation(driverId: string): Promise<NormalizedGpsEvent | null> {
    return this.currentStore.get(driverId) ?? null;
  }

  async getHistoryCount(driverId?: string): Promise<number> {
    if (!driverId) return this.historyStore.size;
    let count = 0;
    for (const event of this.historyStore.values()) {
      if (event.driverId === driverId) count++;
    }
    return count;
  }

  clearStores(): void {
    this.historyStore.clear;
    this.historyStore.clear();
    this.currentStore.clear();
  }
}

