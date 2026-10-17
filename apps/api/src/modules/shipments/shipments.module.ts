import { Module } from '@nestjs/common';

import { ShipmentsController } from './shipments.controller';
import { ShipmentsService } from './shipments.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  controllers: [ShipmentsController],
  providers: [ShipmentsService],
})
export class ShipmentsModule {}
