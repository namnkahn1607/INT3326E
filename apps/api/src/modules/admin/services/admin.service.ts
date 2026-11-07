import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { AdminDirectoryRepository, type DirectoryRow, type DriverDirectoryRow } from '../admin-directory.repository';
import type { CustomerSummaryResponse, DirectoryPage, DriverResponse } from '../dto/admin-directory-response.dto';
import { DIRECTORY_USER_ID, encodeDirectoryCursor, type AdminListQuery, type DirectoryScope } from '../dto/admin-list-query';

@Injectable()
export class AdminService {
  constructor(@Inject(AdminDirectoryRepository) private readonly directory: AdminDirectoryRepository) {}

  async listDrivers(query: AdminListQuery): Promise<DirectoryPage<DriverResponse>> {
    const rows = await this.directory.listDrivers(query);
    return this.page(rows, query, 'drivers', (row) => this.driver(row));
  }

  async listCustomers(query: AdminListQuery): Promise<DirectoryPage<CustomerSummaryResponse>> {
    const rows = await this.directory.listCustomers(query);
    return this.page(rows, query, 'customers', ({ id, name, email, phone }) => ({ id, name, email, phone }));
  }

  private driver(row: DriverDirectoryRow): DriverResponse {
    const visible = row.activeShipmentCount > 0 && row.lat !== null && row.lng !== null &&
      row.clientTimestamp !== null && row.receivedAt !== null;
    const age = visible ? row.observedAt.getTime() - row.clientTimestamp!.getTime() : 0;
    return {
      id: row.id, name: row.name, activeShipmentCount: row.activeShipmentCount,
      currentLocation: visible ? { lat: row.lat!, lng: row.lng! } : null,
      lastLocationUpdatedAt: visible ? row.receivedAt!.toISOString() : null,
      locationClientTimestamp: visible ? row.clientTimestamp!.toISOString() : null,
      isLocationStale: visible ? age < 0 || age > 30_000 : null,
    };
  }

  private page<T extends DirectoryRow, R>(rows: T[], query: AdminListQuery,
    scope: DirectoryScope, project: (row: T) => R): DirectoryPage<R> {
    if (rows.some((row) => !DIRECTORY_USER_ID.test(row.id))) throw new ServiceUnavailableException();
    const items = rows.slice(0, query.limit);
    const hasMore = rows.length > query.limit;
    const last = items.at(-1);
    return {
      data: items.map(project),
      pagination: {
        limit: query.limit, hasMore,
        // Preserve SQL microseconds in the opaque cursor; JS Date would lose the tie-break precision.
        nextCursor: hasMore && last
          ? encodeDirectoryCursor(scope, { id: last.id, createdAt: last.cursorCreatedAt }) : null,
      },
    };
  }
}
