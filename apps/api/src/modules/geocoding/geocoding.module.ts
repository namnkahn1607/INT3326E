import { Module } from '@nestjs/common';
import { GeocodingController } from './geocoding.controller';
import { GeocodingService, VIETMAP_API_KEY } from './geocoding.service';

@Module({
  controllers: [GeocodingController],
  providers: [GeocodingService, { provide: VIETMAP_API_KEY, useFactory: () => process.env.VIETMAP_API_KEY?.trim() ?? '' }],
})
export class GeocodingModule {}
