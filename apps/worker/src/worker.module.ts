import { Module } from '@nestjs/common';
import { GpsSubscriber } from './consumer/gps.subscriber';
import { GpsProcessorService } from './consumer/gps-processor.service';
import { GpsWriterRepository } from './storage/gps-writer.repository';
import { HealthController } from './health/health.controller';

@Module({
  imports: [],
  controllers: [HealthController],
  providers: [GpsSubscriber, GpsProcessorService, GpsWriterRepository],
  exports: [GpsProcessorService, GpsWriterRepository],
})
export class WorkerModule {}
