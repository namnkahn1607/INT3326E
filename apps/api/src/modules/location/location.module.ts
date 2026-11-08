import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { LocationController } from './location.controller';
import { LocationService } from './location.service';

@Module({
  imports: [UsersModule],
  controllers: [LocationController],
  providers: [LocationService],
  exports: [LocationService],
})
export class LocationModule {}
