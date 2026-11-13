import { Module } from '@nestjs/common';
import { GpsSubscriber } from './consumer/gps.subscriber';
import { GpsProcessorService } from './consumer/gps-processor.service';
import { GpsWriterRepository } from './storage/gps-writer.repository';
import { DlqReplayService } from './consumer/dlq-replay.service';
import { HealthController } from './health/health.controller';

@Module({
  imports: [],
  controllers: [HealthController],
  providers: [GpsSubscriber, GpsProcessorService, GpsWriterRepository, DlqReplayService],
  exports: [GpsProcessorService, GpsWriterRepository, DlqReplayService],
})
export class WorkerModule {}

