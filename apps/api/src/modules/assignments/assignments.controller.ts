import { Body, Controller, Header, HttpCode, Inject, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/enums/user-role.enum';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { BusinessUserGuard } from '../users/business-user.guard';
import { AssignmentsService } from './assignments.service';

@Controller('shipments')
@Roles(UserRole.ADMIN)
@UseGuards(BusinessUserGuard)
export class AssignmentsController {
  constructor(@Inject(AssignmentsService) private readonly assignments: AssignmentsService) {}

  @Post(':id/assign')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  assign(@Req() request: AuthenticatedRequest, @Param('id') id: string,
    @Body() body: unknown, @Query() query: Record<string, unknown>) {
    return this.assignments.assign(request.businessUser!, id, body, query);
  }
}
