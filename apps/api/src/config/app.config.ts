import { RequestMethod, type INestApplication } from '@nestjs/common';

export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('v1', {
    exclude: [{ path: 'healthz', method: RequestMethod.GET }],
  });
}
