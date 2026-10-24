import { Controller, Get, Header, Inject, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../auth/enums/user-role.enum';
import { BusinessUserGuard } from '../../users/business-user.guard';
import { parseAdminListQuery } from '../dto/admin-list-query';
import { AdminService } from '../services/admin.service';

@Controller('drivers')
@Roles(UserRole.ADMIN)
@UseGuards(BusinessUserGuard)
export class DriversController {
  constructor(@Inject(AdminService) private readonly admin: AdminService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  list(@Query() query: Record<string, unknown>) {
    return this.admin.listDrivers(parseAdminListQuery(query, 'drivers'));
  }
}
