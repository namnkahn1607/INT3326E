import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { Pool } from 'pg';
import { UserRole } from '../auth/enums/user-role.enum';
import { USER_DATABASE } from '../users/user-database.provider';
import type { AdminListQuery } from './dto/admin-list-query';

export interface DirectoryRow {
  id: string;
  name: string;
  cursorCreatedAt: string;
}

export interface DriverDirectoryRow extends DirectoryRow {
  activeShipmentCount: number;
  lat: number | null;
  lng: number | null;
  receivedAt: Date | null;
  clientTimestamp: Date | null;
  observedAt: Date;
}

export interface CustomerDirectoryRow extends DirectoryRow {
  email: string;
  phone: string | null;
}

@Injectable()
export class AdminDirectoryRepository {
  constructor(@Inject(USER_DATABASE) private readonly pool: Pool | null) {}

  async listDrivers(query: AdminListQuery): Promise<DriverDirectoryRow[]> {
    if (!this.pool) throw new ServiceUnavailableException();
    try {
      // One statement keeps assignment counts and GPS visibility in the same snapshot.
      const result = await this.pool.query<DriverDirectoryRow>(`
        WITH page AS (
          SELECT id, name, "createdAt"
          FROM users
          WHERE role = $1
            AND ($2::timestamptz IS NULL OR ("createdAt", id) < ($2::timestamptz, $3::text))
          ORDER BY "createdAt" DESC, id DESC
          LIMIT $4
        ), active AS (
          SELECT s."driverId", count(*)::integer AS count
          FROM shipments s JOIN page p ON p.id = s."driverId"
          WHERE s.status IN ('ASSIGNED', 'PICKED_UP')
          GROUP BY s."driverId"
        )
        SELECT p.id, p.name,
          to_char(p."createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "cursorCreatedAt",
          coalesce(a.count, 0) AS "activeShipmentCount",
          c.lat, c.lng, c."receivedAt", c."clientTimestamp",
          statement_timestamp() AS "observedAt"
        FROM page p
        LEFT JOIN active a ON a."driverId" = p.id
        LEFT JOIN current_locations c ON c."driverId" = p.id AND coalesce(a.count, 0) > 0
        ORDER BY p."createdAt" DESC, p.id DESC
      `, [UserRole.DRIVER, query.after?.createdAt ?? null, query.after?.id ?? null, query.limit + 1]);
      return result.rows;
    } catch {
      throw new ServiceUnavailableException();
    }
  }

  async listCustomers(query: AdminListQuery): Promise<CustomerDirectoryRow[]> {
    if (!this.pool) throw new ServiceUnavailableException();
    try {
      const result = await this.pool.query<CustomerDirectoryRow>(`
        SELECT id, name, email, phone,
          to_char("createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "cursorCreatedAt"
        FROM users
        WHERE role = $1
          AND ($2::timestamptz IS NULL OR ("createdAt", id) < ($2::timestamptz, $3::text))
        ORDER BY "createdAt" DESC, id DESC
        LIMIT $4
      `, [UserRole.CUSTOMER, query.after?.createdAt ?? null, query.after?.id ?? null, query.limit + 1]);
      return result.rows;
    } catch {
      throw new ServiceUnavailableException();
    }
  }
}
