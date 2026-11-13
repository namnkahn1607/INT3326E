import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { LocationController } from './location.controller';
import { LocationService } from './location.service';
import { LocationRepository } from './location.repository';

@Module({
  imports: [UsersModule],
  controllers: [LocationController],
  providers: [LocationService, LocationRepository],
  exports: [LocationService, LocationRepository],
})
export class LocationModule {}
