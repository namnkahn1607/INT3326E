import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../../app.module';
import { configureApp } from '../../config/app.config';
import { UserRole } from '../auth/enums/user-role.enum';
import { FIREBASE_AUTH } from '../auth/providers/firebase-auth.provider';
import { USER_DATABASE } from '../users/user-database.provider';
import type { DriverDirectoryRow } from './admin-directory.repository';
import { AdminDirectoryRepository } from './admin-directory.repository';
import { encodeDirectoryCursor } from './dto/admin-list-query';

const id = (n: number) => `usr_${String(n).padStart(26, '0')}`;
const driver = (n: number): DriverDirectoryRow => ({
  id: id(n), name: `Driver ${n}`, cursorCreatedAt: '2026-10-23T10:00:00.123456Z',
  activeShipmentCount: 1, lat: 0, lng: 0,
  clientTimestamp: new Date('2026-10-23T10:00:00.000Z'),
  receivedAt: new Date('2026-10-23T10:00:01.000Z'),
  observedAt: new Date('2026-10-23T10:00:30.000Z'),
});

describe('Admin directory (real Nest HTTP, mock Firebase/SQL)', () => {
  let app: INestApplication;
  let base: string;
  const verifyIdToken = vi.fn();
  const getUser = vi.fn();
  const query = vi.fn();
  const headers = { Authorization: 'Bearer signed-test-token' };
  let linkage: unknown[];
  let rows: unknown[];

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(FIREBASE_AUTH).useValue({ verifyIdToken, getUser })
      .overrideProvider(USER_DATABASE).useValue({ query, end: vi.fn() }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    base = `${await app.getUrl()}/v1`;
  });

  beforeEach(() => {
    verifyIdToken.mockReset().mockResolvedValue({ uid: 'admin-firebase', role: UserRole.ADMIN });
    getUser.mockReset().mockResolvedValue({ disabled: false, customClaims: { role: UserRole.ADMIN } });
    linkage = [{ id: id(1), firebaseUid: 'admin-firebase', role: UserRole.ADMIN }];
    rows = [];
    query.mockReset().mockImplementation(async (sql: string) => ({
      rows: sql.includes('WHERE "firebaseUid" = $1') ? linkage : rows,
    }));
  });

  afterAll(async () => { await app?.close(); });

  it.each(['/drivers', '/admin/customers'])('requires authentication on %s before reading SQL', async (path) => {
    const response = await fetch(`${base}${path}`);
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(query).not.toHaveBeenCalled();
  });

  it.each([
    ['/drivers', UserRole.CUSTOMER], ['/drivers', UserRole.DRIVER],
    ['/admin/customers', UserRole.CUSTOMER], ['/admin/customers', UserRole.DRIVER],
  ])('rejects %s for role %s before reading SQL', async (path, role) => {
    verifyIdToken.mockResolvedValue({ uid: 'other-user', role });
    getUser.mockResolvedValue({ disabled: false, customClaims: { role } });
    const response = await fetch(`${base}${path}`, { headers });
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: 'FORBIDDEN_RESOURCE' });
    expect(query).not.toHaveBeenCalled();
  });

  it.each([{ records: [] }, { records: [{ id: id(1), firebaseUid: 'admin-firebase', role: UserRole.CUSTOMER }] }])(
    'rejects missing/inconsistent business linkage without listing users %j', async ({ records }) => {
      linkage = records;
      const response = await fetch(`${base}/drivers`, { headers });
      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ code: 'USER_NOT_PROVISIONED' });
      expect(query).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['/drivers', '/admin/customers'])('returns the SC01 empty envelope for %s', async (path) => {
    const response = await fetch(`${base}${path}`, { headers });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ data: [], pagination: { limit: 20, hasMore: false, nextCursor: null } });
  });

  it('returns a scoped cursor and never exposes the lookahead row, UID or email in DriverResponse', async () => {
    rows = [driver(3), { ...driver(2), email: 'private@example.com', firebaseUid: 'private-uid' }, driver(1)];
    const response = await fetch(`${base}/drivers?limit=2`, { headers });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.map((user: { id: string }) => user.id)).toEqual([id(3), id(2)]);
    expect(body.pagination).toEqual({ limit: 2, hasMore: true,
      nextCursor: encodeDirectoryCursor('drivers', { id: id(2), createdAt: driver(2).cursorCreatedAt }) });
    expect(JSON.stringify(body)).not.toMatch(/private|firebaseUid|observedAt|cursorCreatedAt|total|onlineFlag/);
    expect(query.mock.calls[1][1]).toEqual([UserRole.DRIVER, null, null, 3]);
    expect(query).toHaveBeenCalledTimes(2);
  });

  it.each([
    [0, false], [30_000, false], [30_001, true], [-1, true],
  ])('classifies GPS age %i ms as stale=%s and keeps valid zero coordinates', async (age, stale) => {
    const row = driver(2);
    row.observedAt = new Date(row.clientTimestamp!.getTime() + age);
    rows = [row];
    const response = await fetch(`${base}/drivers`, { headers });
    expect((await response.json()).data[0]).toEqual({
      id: row.id, name: row.name, activeShipmentCount: 1, currentLocation: { lat: 0, lng: 0 },
      lastLocationUpdatedAt: row.receivedAt!.toISOString(),
      locationClientTimestamp: row.clientTimestamp!.toISOString(), isLocationStale: stale,
    });
  });

  it.each(['inactive', 'missing'])('returns all location fields as null when %s', async (condition) => {
    rows = [{ ...driver(2), ...(condition === 'inactive' ? { activeShipmentCount: 0 } : { lat: null, lng: null }) }];
    const response = await fetch(`${base}/drivers`, { headers });
    expect((await response.json()).data[0]).toMatchObject({
      currentLocation: null, lastLocationUpdatedAt: null, locationClientTimestamp: null, isLocationStale: null,
    });
  });

  it('projects only Customer summary fields and fixes the SQL role to CUSTOMER', async () => {
    rows = [{ id: id(2), name: 'Customer', email: 'customer@example.com', phone: null,
      cursorCreatedAt: driver(2).cursorCreatedAt, firebaseUid: 'hidden', role: UserRole.CUSTOMER }];
    const response = await fetch(`${base}/admin/customers?limit=1`, { headers });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: [{ id: id(2), name: 'Customer', email: 'customer@example.com', phone: null }],
      pagination: { limit: 1, hasMore: false, nextCursor: null },
    });
    expect(query.mock.calls[1][1]).toEqual([UserRole.CUSTOMER, null, null, 2]);
  });

  it('binds the decoded cursor as SQL parameters', async () => {
    const cursor = encodeDirectoryCursor('drivers', { id: id(3), createdAt: driver(3).cursorCreatedAt });
    const response = await fetch(`${base}/drivers?cursor=${cursor}`, { headers });
    expect(response.status).toBe(200);
    expect(query.mock.calls[1][1]).toEqual([UserRole.DRIVER, driver(3).cursorCreatedAt, id(3), 21]);
    expect(query.mock.calls[1][0]).not.toContain(id(3));
  });

  it.each(['/drivers', '/admin/customers'])('rejects legacy identifiers instead of returning an unusable cursor on %s', async (path) => {
    rows = [{ ...driver(2), id: 'legacy-uuid', email: 'customer@example.com', phone: null }];
    const response = await fetch(`${base}${path}`, { headers });
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
  });

  it.each(['/drivers?role=CUSTOMER', '/admin/customers?limit=101', '/drivers?limit=1&limit=2',
    '/drivers?cursor=broken', '/drivers?limit=2&uid=another'])('rejects invalid query %s before listing', async (path) => {
    const response = await fetch(`${base}${path}`, { headers });
    expect(response.status).toBe(400);
    expect(response.headers.get('content-type')).toContain('application/problem+json');
    expect(await response.json()).toMatchObject({ code: 'VALIDATION_ERROR', instance: path.split('?')[0].replace(/^/, '/v1') });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('reports directory SQL failure as a sanitized 503 instead of an empty success', async () => {
    query.mockImplementation(async (sql: string) => {
      if (sql.includes('WHERE "firebaseUid" = $1')) return { rows: linkage };
      throw new Error('password=secret postgres://internal-host');
    });
    const response = await fetch(`${base}/drivers?cursor=not-in-response`, { headers });
    expect(response.status).toBe(400);
    const failure = await fetch(`${base}/drivers`, { headers });
    expect(failure.status).toBe(503);
    const body = await failure.json();
    expect(body).toMatchObject({ code: 'SERVICE_UNAVAILABLE', instance: '/v1/drivers' });
    expect(JSON.stringify(body)).not.toMatch(/secret|postgres|internal-host/);
  });

  it('keeps /admin/me independent of the SQL business link', async () => {
    linkage = [];
    const response = await fetch(`${base}/admin/me`, { headers });
    expect(response.status).toBe(200);
    expect(query).not.toHaveBeenCalled();
  });

  it('has no HTTP account creation or role-assignment operation', async () => {
    expect((await fetch(`${base}/admin/customers`, { method: 'POST', headers })).status).toBe(404);
    expect((await fetch(`${base}/drivers/${id(2)}`, { method: 'PATCH', headers })).status).toBe(404);
  });
});

describe('Admin directory database configuration', () => {
  it.each(['listDrivers', 'listCustomers'] as const)('fails closed without a pool: %s', async (method) => {
    await expect(new AdminDirectoryRepository(null)[method]({ limit: 20, after: null }))
      .rejects.toMatchObject({ status: 503 });
  });
});
