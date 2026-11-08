import { Module } from '@nestjs/common';

import { ShipmentsController } from './shipments.controller';
import { ShipmentsService, shipmentIdempotencyTtlProvider } from './shipments.service';
import { ShipmentsRepository } from './shipments.repository';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  controllers: [ShipmentsController],
  providers: [ShipmentsService, ShipmentsRepository, shipmentIdempotencyTtlProvider],
})
export class ShipmentsModule {}
