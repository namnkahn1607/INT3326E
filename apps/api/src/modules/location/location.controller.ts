import { Controller, Post, Body, HttpCode, HttpStatus, Req, UseGuards } from '@nestjs/common';
import { LocationService, AsyncAcceptedResponse } from './location.service';
import { IngestLocationDto } from './dto/ingest-location.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/enums/user-role.enum';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';

@Controller(['locations', 'location'])
export class LocationController {
  constructor(private readonly locationService: LocationService) {}

  /**
   * API08: POST /v1/locations (and POST /v1/location)
   * Role: DRIVER only. Returns 202 Accepted upon broker confirmation.
   */
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @Roles(UserRole.DRIVER)
  async ingestLocation(
    @Body() dto: IngestLocationDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<AsyncAcceptedResponse> {
    const authenticatedDriverId = req?.businessUser?.id || req?.user?.uid;
    return this.locationService.ingestLocation(dto, authenticatedDriverId);
  }
}

