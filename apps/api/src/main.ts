import 'reflect-metadata';
import { loadEnvFile } from 'node:process';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { configureApp } from './config/app.config';
import { validateEnvironment } from './config/env.validation';

async function bootstrap(): Promise<void> {
  try {
    loadEnvFile();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }

  const { port } = validateEnvironment(process.env);
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  app.enableShutdownHooks();
  await app.listen(port, '0.0.0.0');
}

void bootstrap().catch(() => {
  console.error('API startup failed. Check environment configuration and application logs.');
  process.exitCode = 1;
});
