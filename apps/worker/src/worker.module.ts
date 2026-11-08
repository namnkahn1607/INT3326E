import { Module } from '@nestjs/common';
import { GpsSubscriber } from './consumer/gps.subscriber';
import { HealthController } from './health/health.controller';

@Module({
  imports: [],
  controllers: [HealthController],
  providers: [GpsSubscriber],
})
export class WorkerModule {}