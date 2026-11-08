import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { WorkerModule } from '../src/worker.module';

describe('GET /healthz (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // Prevent real Pub/Sub connection in tests
    process.env.PUBSUB_EMULATOR_HOST = 'localhost:8085';

    const module = await Test.createTestingModule({
      imports: [WorkerModule],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return 200', () => {
    return request(app.getHttpServer())
      .get('/healthz')
      .expect(200)
      .expect({ status: 'ok' });
  });
});

