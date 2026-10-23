import { Module } from '@nestjs/common';
import { BusinessUserGuard } from './business-user.guard';
import { userDatabaseProvider } from './user-database.provider';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

@Module({
  providers: [userDatabaseProvider, UsersRepository, UsersService, BusinessUserGuard],
  exports: [UsersService, BusinessUserGuard],
})
export class UsersModule {}
