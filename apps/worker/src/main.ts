import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';

async function bootstrap() {
  const app = await NestFactory.create(WorkerModule);

  const port = process.env.PORT || 8080;
  await app.listen(port);
  console.log(`🚀 GPS Worker service ready on port: ${port}`);
}
bootstrap().catch(err => {
  console.error(err);
  process.exit(1);
});