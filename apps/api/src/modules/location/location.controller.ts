import { Controller, Post, Body, Header, HttpCode, HttpStatus, Inject, Req, UseGuards } from '@nestjs/common';
import { LocationService, type AsyncAcceptedResponse } from './location.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/enums/user-role.enum';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { BusinessUserGuard } from '../users/business-user.guard';

@Controller('locations')
@Roles(UserRole.DRIVER)
@UseGuards(BusinessUserGuard)
export class LocationController {
  constructor(@Inject(LocationService) private readonly locationService: LocationService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @Header('Cache-Control', 'no-store')
  async ingestLocation(
    @Body() dto: unknown,
    @Req() req: AuthenticatedRequest,
  ): Promise<AsyncAcceptedResponse> {
    // UID Firebase không thay thế mã Driver đã được ánh xạ trong hệ thống.
    return this.locationService.ingestLocation(dto, req.businessUser!.id);
  }
}
