import { Injectable, Logger } from '@nestjs/common';
import { NormalizedGpsEvent } from '../consumer/gps-processor.service';

export interface GpsWriteResult {
  historyInserted: boolean;
  currentUpdated: boolean;
  canonicalEvent: NormalizedGpsEvent;
  conflict?: boolean;
  reason?: string;
}

export interface GpsTrackingSnapshot {
  driverId: string;
  currentDriverLocation: { lat: number; lng: number } | null;
  lastLocationUpdatedAt: string | null;
  locationClientTimestamp: string | null;
  isLocationStale: boolean | null;
  eventId: string | null;
}

@Injectable()
export class GpsWriterRepository {
  private readonly logger = new Logger(GpsWriterRepository.name);
  private pool: any = null;
  private simulateFailure = false;

  // In-memory backing store for local testing, CI, and fallback when DATABASE_URL is not set
  private readonly historyStore = new Map<string, NormalizedGpsEvent>();
  private readonly currentStore = new Map<string, NormalizedGpsEvent>();

  constructor() {
    if (process.env.DATABASE_URL) {
      try {
        // Dynamically require pg when configured in runtime
        const { Pool } = require('pg');
        this.pool = new Pool({
          connectionString: process.env.DATABASE_URL,
          max: 5,
          connectionTimeoutMillis: 5000,
          statement_timeout: 5000,
        });
        this.pool.on('error', (err: any) => {
          this.logger.error(`PostgreSQL connection error: ${err.message}`);
        });
        this.logger.log('Connected to PostgreSQL for GPS persistence (Week 4)');
      } catch {
        this.logger.warn('PostgreSQL client (pg) not available, using in-memory store');
      }
    }
  }

  setSimulateFailure(value: boolean): void {
    this.simulateFailure = value;
  }

  /**
   * DATA05: location_history
   * Unique constraint: (driverId, clientTimestamp)
   * Invariant: First-write-wins (ON CONFLICT DO NOTHING)
   */
  async insertHistory(event: NormalizedGpsEvent): Promise<{ inserted: boolean; canonical: NormalizedGpsEvent; conflict: boolean }> {
    const key = `${event.driverId}:${event.clientTimestamp}`;
    const existing = this.historyStore.get(key);
    if (existing) {
      const conflict = existing.lat !== event.lat || existing.lng !== event.lng;
      if (conflict) {
        this.logger.warn(
          `[Duplicate Conflict] Conflicting payload for driver ${event.driverId} at timestamp ${event.clientTimestamp}: retained canonical (${existing.lat}, ${existing.lng}) vs rejected incoming (${event.lat}, ${event.lng})`,
        );
      } else {
        this.logger.debug(`[Dedupe] Duplicate GPS history entry ignored for key ${key}`);
      }
      return { inserted: false, canonical: existing, conflict };
    }

    this.historyStore.set(key, event);
    return { inserted: true, canonical: event, conflict: false };
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
   * 2. If eligible and not history-only, conditionally updates current_locations using the CANONICAL event.
   * 3. Executes within a database transaction when connected to PostgreSQL.
   */
  async recordGpsEvent(event: NormalizedGpsEvent, isHistoryOnly = false): Promise<GpsWriteResult> {
    if (this.simulateFailure) {
      throw new Error('Simulated database transaction failure (TC04.8 test hook)');
    }

    if (this.pool) {
      return this.recordGpsEventSql(event, isHistoryOnly);
    }

    return this.recordGpsEventMemory(event, isHistoryOnly);
  }

  private async recordGpsEventMemory(event: NormalizedGpsEvent, isHistoryOnly = false): Promise<GpsWriteResult> {
    const { inserted: historyInserted, canonical, conflict } = await this.insertHistory(event);
    let currentUpdated = false;

    if (!isHistoryOnly) {
      currentUpdated = await this.upsertCurrent(canonical);
    } else {
      this.logger.debug(
        `[Clock Skew Tolerance] Event ${canonical.eventId} marked history-only; current_locations update skipped`,
      );
    }

    return {
      historyInserted,
      currentUpdated,
      canonicalEvent: canonical,
      conflict,
      reason: isHistoryOnly ? 'history-only (clock skew)' : undefined,
    };
  }

  private async recordGpsEventSql(event: NormalizedGpsEvent, isHistoryOnly = false): Promise<GpsWriteResult> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const clientTimestampDate = new Date(event.clientTimestamp);
      const receivedAtDate = new Date(event.receivedAtMs || event.receivedAt);

      // Step 1: First-write-wins insert into location_history
      const historyInsertQuery = `
        INSERT INTO location_history (
          driver_id, lat, lng, client_timestamp, received_at, event_id, session_id, seq, persisted_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, NOW()
        )
        ON CONFLICT (driver_id, client_timestamp) DO NOTHING
        RETURNING id, driver_id, lat, lng, client_timestamp, received_at, event_id, session_id, seq;
      `;
      const insertRes = await client.query(historyInsertQuery, [
        event.driverId,
        event.lat,
        event.lng,
        clientTimestampDate,
        receivedAtDate,
        event.eventId,
        event.sessionId ?? null,
        event.seq ?? null,
      ]);

      let canonical: NormalizedGpsEvent;
      let historyInserted = false;
      let conflict = false;

      if (insertRes.rows.length > 0) {
        historyInserted = true;
        canonical = event;
      } else {
        // Fetch canonical row
        const fetchCanonicalQuery = `
          SELECT driver_id, lat, lng, client_timestamp, received_at, event_id, session_id, seq
          FROM location_history
          WHERE driver_id = $1 AND client_timestamp = $2
          LIMIT 1;
        `;
        const canonicalRes = await client.query(fetchCanonicalQuery, [event.driverId, clientTimestampDate]);
        if (canonicalRes.rows.length > 0) {
          const row = canonicalRes.rows[0];
          canonical = {
            eventId: row.event_id,
            driverId: row.driver_id,
            latitude: Number(row.lat),
            longitude: Number(row.lng),
            lat: Number(row.lat),
            lng: Number(row.lng),
            clientTimestamp: new Date(row.client_timestamp).getTime(),
            clientTimestampIso: new Date(row.client_timestamp).toISOString(),
            receivedAt: new Date(row.received_at).toISOString(),
            receivedAtMs: new Date(row.received_at).getTime(),
            sessionId: row.session_id,
            seq: row.seq,
          };
          if (canonical.lat !== event.lat || canonical.lng !== event.lng) {
            conflict = true;
            this.logger.warn(
              `[Duplicate Conflict] Conflicting payload for driver ${event.driverId} at timestamp ${event.clientTimestamp}: retained canonical (${canonical.lat}, ${canonical.lng}) vs rejected incoming (${event.lat}, ${event.lng})`,
            );
          } else {
            this.logger.debug(`[Dedupe] Duplicate GPS history entry ignored for key ${event.driverId}:${event.clientTimestamp}`);
          }
        } else {
          canonical = event;
        }
      }

      // Step 2: Conditional upsert to current_locations using canonical row
      let currentUpdated = false;
      if (!isHistoryOnly) {
        const upsertCurrentQuery = `
          INSERT INTO current_locations (
            driver_id, lat, lng, client_timestamp, received_at, event_id, session_id, seq, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, NOW()
          )
          ON CONFLICT (driver_id) DO UPDATE SET
            lat = EXCLUDED.lat,
            lng = EXCLUDED.lng,
            client_timestamp = EXCLUDED.client_timestamp,
            received_at = EXCLUDED.received_at,
            event_id = EXCLUDED.event_id,
            session_id = EXCLUDED.session_id,
            seq = EXCLUDED.seq,
            updated_at = NOW()
          WHERE EXCLUDED.client_timestamp > current_locations.client_timestamp
          RETURNING driver_id;
        `;
        const currentRes = await client.query(upsertCurrentQuery, [
          canonical.driverId,
          canonical.lat,
          canonical.lng,
          new Date(canonical.clientTimestamp),
          new Date(canonical.receivedAtMs || canonical.receivedAt),
          canonical.eventId,
          canonical.sessionId ?? null,
          canonical.seq ?? null,
        ]);
        currentUpdated = currentRes.rows.length > 0;
      } else {
        this.logger.debug(
          `[Clock Skew Tolerance] Event ${canonical.eventId} marked history-only; current_locations update skipped`,
        );
      }

      await client.query('COMMIT');

      return {
        historyInserted,
        currentUpdated,
        canonicalEvent: canonical,
        conflict,
        reason: isHistoryOnly ? 'history-only (clock skew)' : undefined,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getLatestCurrentLocation(driverId: string): Promise<NormalizedGpsEvent | null> {
    if (this.pool) {
      try {
        const res = await this.pool.query(
          `SELECT driver_id, lat, lng, client_timestamp, received_at, event_id, session_id, seq
           FROM current_locations WHERE driver_id = $1 LIMIT 1`,
          [driverId],
        );
        if (res.rows.length === 0) return null;
        const row = res.rows[0];
        return {
          eventId: row.event_id,
          driverId: row.driver_id,
          latitude: Number(row.lat),
          longitude: Number(row.lng),
          lat: Number(row.lat),
          lng: Number(row.lng),
          clientTimestamp: new Date(row.client_timestamp).getTime(),
          clientTimestampIso: new Date(row.client_timestamp).toISOString(),
          receivedAt: new Date(row.received_at).toISOString(),
          receivedAtMs: new Date(row.received_at).getTime(),
          sessionId: row.session_id,
          seq: row.seq,
        };
      } catch (err: any) {
        this.logger.error(`Error querying current_locations: ${err.message}`);
      }
    }
    return this.currentStore.get(driverId) ?? null;
  }

  /**
   * Evaluates tracking snapshot and freshness per Section 6 & TC05.1-TC05.3
   * Stale threshold: 30s. If age in [0, 30s] -> isLocationStale = false; if > 30s -> true; missing -> null
   */
  async getTrackingSnapshot(driverId: string, referenceTimeMs: number = Date.now()): Promise<GpsTrackingSnapshot> {
    const current = await this.getLatestCurrentLocation(driverId);
    if (!current) {
      return {
        driverId,
        currentDriverLocation: null,
        lastLocationUpdatedAt: null,
        locationClientTimestamp: null,
        isLocationStale: null,
        eventId: null,
      };
    }

    const STALE_THRESHOLD_MS = 30000;
    const sampleAgeMs = referenceTimeMs - current.clientTimestamp;
    const isLocationStale = sampleAgeMs < 0 || sampleAgeMs > STALE_THRESHOLD_MS;

    return {
      driverId,
      currentDriverLocation: { lat: current.lat, lng: current.lng },
      lastLocationUpdatedAt: current.receivedAt,
      locationClientTimestamp: current.clientTimestampIso,
      isLocationStale,
      eventId: current.eventId,
    };
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
    this.historyStore.clear();
    this.currentStore.clear();
  }
}

