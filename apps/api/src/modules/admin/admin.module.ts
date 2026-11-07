import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { AdminDirectoryRepository } from './admin-directory.repository';
import { AdminController } from './controllers/admin.controller';
import { DriversController } from './controllers/drivers.controller';
import { AdminService } from './services/admin.service';

@Module({
  imports: [AuthModule, UsersModule],
  controllers: [AdminController, DriversController],
  providers: [AdminService, AdminDirectoryRepository],
})
export class AdminModule {}
