import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';
import { GpsSubscriber } from './consumer/gps.subscriber';

@Module({
  imports: [],
  controllers: [HealthController],
  providers: [GpsSubscriber],
})
export class WorkerModule {}