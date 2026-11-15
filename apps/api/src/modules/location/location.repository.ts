import { Injectable, Logger } from '@nestjs/common';

export interface DriverCurrentLocationRecord {
  driverId: string;
  lat: number;
  lng: number;
  clientTimestamp: Date;
  receivedAt: Date;
  eventId: string;
  sessionId?: string | null;
  seq?: number | null;
}

@Injectable()
export class LocationRepository {
  private readonly logger = new Logger(LocationRepository.name);
  private pool: any = null;
  private readonly memoryStore = new Map<string, DriverCurrentLocationRecord>();

  constructor() {
    if (process.env.DATABASE_URL) {
      try {
        const { Pool } = require('pg');
        this.pool = new Pool({
          connectionString: process.env.DATABASE_URL,
          max: 5,
          connectionTimeoutMillis: 5000,
          statement_timeout: 5000,
        });
      } catch {
        this.logger.warn('PostgreSQL client (pg) not available in LocationRepository, using memory fallback');
      }
    }
  }

  setMemoryRecord(record: DriverCurrentLocationRecord): void {
    this.memoryStore.set(record.driverId, record);
  }

  async getDriverCurrentLocation(driverId: string): Promise<DriverCurrentLocationRecord | null> {
    if (this.pool) {
      try {
        const res = await this.pool.query(
          `SELECT "driverId", lat, lng, "clientTimestamp", "receivedAt", "eventId", "sessionId", seq
           FROM current_locations WHERE "driverId" = $1 LIMIT 1`,
          [driverId],
        );
        if (res.rows.length === 0) return null;
        const row = res.rows[0];
        return {
          driverId: row.driverId ?? row.driver_id,
          lat: Number(row.lat),
          lng: Number(row.lng),
          clientTimestamp: new Date(row.clientTimestamp ?? row.client_timestamp),
          receivedAt: new Date(row.receivedAt ?? row.received_at),
          eventId: row.eventId ?? row.event_id,
          sessionId: row.sessionId ?? row.session_id,
          seq: row.seq,
        };
      } catch (err: any) {
        this.logger.error(`Error querying current_locations for driver ${driverId}: ${err.message}`);
      }
    }
    return this.memoryStore.get(driverId) ?? null;
  }


  clearMemory(): void {
    this.memoryStore.clear();
  }
}

