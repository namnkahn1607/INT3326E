import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ApiExceptionFilter } from '../../common/api-exception.filter';
import { configureApp } from '../../config/app.config';
import { AuthModule } from '../auth/auth.module';
import { TOKEN_VERIFIER } from '../auth/interfaces/token-verifier.interface';
import { FIREBASE_AUTH } from '../auth/providers/firebase-auth.provider';
import { GeocodingModule } from './geocoding.module';
import { GeocodingService, VIETMAP_API_KEY } from './geocoding.service';

describe('Geocoding HTTP integration (mock Firebase and VIETMAP)', () => {
  let app: INestApplication;
  let base: string;
  const service = new GeocodingService('test-key');
  const search = vi.spyOn(service, 'search').mockResolvedValue([]);
  const reverse = vi.spyOn(service, 'reverse').mockResolvedValue(null);
  const place = vi.spyOn(service, 'place').mockResolvedValue({ id: 'auto:test', label: 'Đường Cầu Giấy', point: { lat: 21.03, lng: 105.8 }, address: { street: 'Đường Cầu Giấy', area: 'Hà Nội', regions: ['Hà Nội'] } });
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AuthModule, GeocodingModule] })
      .overrideProvider(FIREBASE_AUTH).useValue({})
      .overrideProvider(TOKEN_VERIFIER).useValue({ verify: async (token: string) => {
        if (!['CUSTOMER', 'ADMIN', 'DRIVER'].includes(token)) throw new Error('invalid token');
        return { uid: 'uid', role: token };
      } })
      .overrideProvider(VIETMAP_API_KEY).useValue('test-key')
      .overrideProvider(GeocodingService).useValue(service).compile();
    app = module.createNestApplication(); configureApp(app);
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.listen(0, '127.0.0.1'); base = await app.getUrl();
  });
  afterAll(async () => { await app?.close(); });
  const post = (path: string, body: unknown, token?: string) => fetch(base + '/v1/geocoding/' + path,
    { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) });

  it('rejects missing and invalid auth before invoking any paid provider operation', async () => {
    expect((await post('search', { query: 'Hà Nội' })).status).toBe(401);
    expect((await post('search', { query: 'Hà Nội' }, 'invalid')).status).toBe(401);
    expect(search).not.toHaveBeenCalled();
  });
  it.each(['CUSTOMER', 'ADMIN', 'DRIVER'])('permits verified %s without requiring a database write/linkage', async role => {
    const response = await post('search', { query: 'Hà Nội' }, role);
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual([]);
    expect(search).toHaveBeenCalledWith('uid', 'Hà Nội');
  });
  it('validates body and rejects actor/private/query fields', async () => {
    expect((await post('reverse', { lat: '21', lng: 105 }, 'CUSTOMER')).status).toBe(400);
    expect((await post('reverse', { lat: 21, lng: 105, notes: 'private' }, 'CUSTOMER')).status).toBe(400);
    expect((await post('place', { reference: '', url: 'https://example.com' }, 'CUSTOMER')).status).toBe(400);
    expect((await post('search?apikey=not-accepted', { query: 'Hà Nội' }, 'CUSTOMER')).status).toBe(400);
    expect(reverse).not.toHaveBeenCalled(); expect(place).not.toHaveBeenCalled();
  });
  it('returns JSON null for no reverse result and resolves selected references', async () => {
    const response = await post('reverse', { lat: 21.03, lng: 105.8 }, 'CUSTOMER');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ result: null });
    expect((await post('place', { reference: 'auto:test' }, 'CUSTOMER')).status).toBe(200);
  });
});
