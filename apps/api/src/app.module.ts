import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ApiExceptionFilter } from './common/api-exception.filter';

import { HealthController } from './health/health.controller';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { GeocodingModule } from './modules/geocoding/geocoding.module';
import { ShipmentsModule } from './modules/shipments/shipments.module';

@Module({
  imports: [AuthModule, AdminModule, ShipmentsModule, GeocodingModule],
  controllers: [HealthController],
  providers: [{ provide: APP_FILTER, useClass: ApiExceptionFilter }],
})
export class AppModule {}
