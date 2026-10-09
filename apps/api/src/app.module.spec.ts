import 'reflect-metadata';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { AppModule } from './app.module';
import { configureApp } from './config/app.config';
import { AdminController } from './modules/admin/controllers/admin.controller';
import { AdminService } from './modules/admin/services/admin.service';
import { FIREBASE_AUTH } from './modules/auth/providers/firebase-auth.provider';
import { TOKEN_VERIFIER } from './modules/auth/interfaces/token-verifier.interface';
import { ShipmentsController } from './modules/shipments/shipments.controller';
import { ShipmentsService } from './modules/shipments/shipments.service';

describe('Week 1 API integration', () => {
  let app: INestApplication;
  let baseUrl: string;
  const verifyIdToken = vi.fn();

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).overrideProvider(FIREBASE_AUTH).useValue({ verifyIdToken }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
  });

  afterAll(async () => { await app?.close(); });

  it('serves public GET /healthz without invoking Firebase', async () => {
    const response = await fetch(`${baseUrl}/healthz`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok', service: 'api' });
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it('does not prefix the health endpoint or allow POST health probes', async () => {
    expect((await fetch(`${baseUrl}/v1/healthz`)).status).toBe(404);
    expect((await fetch(`${baseUrl}/healthz`, { method: 'POST' })).status).toBe(404);
  });

  it('resolves Shipment, Auth and Admin from the actual root module', () => {
    expect(app.get(ShipmentsController)).toBeInstanceOf(ShipmentsController);
    expect(app.get(ShipmentsService)).toBeInstanceOf(ShipmentsService);
    expect(app.get(AdminController)).toBeInstanceOf(AdminController);
    expect(app.get(AdminService)).toBeInstanceOf(AdminService);
    expect(app.get(TOKEN_VERIFIER)).toBeDefined();
  });

  it('keeps unimplemented business routes unavailable', async () => {
    for (const path of ['/v1/shipments', '/v1/admin', '/v1/locations']) {
      expect((await fetch(`${baseUrl}${path}`)).status).toBe(404);
    }
  });
});
