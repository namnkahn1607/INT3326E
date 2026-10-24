import { Controller, Get, Header, Inject, Query, Req, UseGuards } from '@nestjs/common';

import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../auth/enums/user-role.enum';
import { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import { BusinessUserGuard } from '../../users/business-user.guard';
import { parseAdminListQuery } from '../dto/admin-list-query';
import { AdminService } from '../services/admin.service';

@Controller('admin')
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(@Inject(AdminService) private readonly admin: AdminService) {}

  @Get('me')
  @Header('Cache-Control', 'no-store')
  me(@Req() request: AuthenticatedRequest) {
    return request.user;
  }

  @Get('customers')
  @UseGuards(BusinessUserGuard)
  @Header('Cache-Control', 'no-store')
  customers(@Query() query: Record<string, unknown>) {
    return this.admin.listCustomers(parseAdminListQuery(query, 'customers'));
  }
}
