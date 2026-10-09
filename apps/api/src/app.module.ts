import { Module } from '@nestjs/common';

import { HealthController } from './health/health.controller';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { ShipmentsModule } from './modules/shipments/shipments.module';

@Module({
  imports: [AuthModule, AdminModule, ShipmentsModule],
  controllers: [HealthController],
})
export class AppModule {}
