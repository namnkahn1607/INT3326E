import { Controller, Get, Header, Req } from '@nestjs/common';

import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../auth/enums/user-role.enum';
import { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';

@Controller('admin')
@Roles(UserRole.ADMIN)
export class AdminController {
  @Get('me')
  @Header('Cache-Control', 'no-store')
  me(@Req() request: AuthenticatedRequest) {
    return request.user;
  }
}
