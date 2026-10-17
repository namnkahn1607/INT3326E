import { RequestMethod, type INestApplication } from '@nestjs/common';
import { DEFAULT_CORS_ORIGINS } from './env.validation';

export function configureApp(app: INestApplication, corsOrigins = DEFAULT_CORS_ORIGINS): void {
  app.enableCors({
    origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) =>
      callback(null, !!origin && corsOrigins.includes(origin)),
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
  });
  app.setGlobalPrefix('v1', {
    exclude: [{ path: 'healthz', method: RequestMethod.GET }],
  });
}
