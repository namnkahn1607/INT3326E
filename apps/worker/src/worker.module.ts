import { Module } from '@nestjs/common';
import { GpsSubscriber } from './consumer/gps.subscriber';

@Module({
  imports: [],
  controllers: [],
  providers: [GpsSubscriber],
})
export class WorkerModule {}