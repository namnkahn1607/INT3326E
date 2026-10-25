import { Body, Controller, Headers, Inject, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/enums/user-role.enum';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { BusinessUserGuard } from '../users/business-user.guard';
import { invalidField, normalizeCreateShipment, parseIdempotencyKey } from './dto/create-shipment.dto';
import { ShipmentsService } from './shipments.service';

@Controller('shipments')
@UseGuards(BusinessUserGuard)
export class ShipmentsController {
  constructor(@Inject(ShipmentsService) private readonly shipments: ShipmentsService) {}

  @Post()
  @Roles(UserRole.CUSTOMER)
  create(@Req() request: AuthenticatedRequest, @Body() body: unknown,
    @Headers('idempotency-key') header: unknown, @Query() query: Record<string, unknown>) {
    if (Object.keys(query).length) invalidField('query', 'Query fields are not supported');
    const key = parseIdempotencyKey(header);
    return this.shipments.create(request.businessUser!, normalizeCreateShipment(body), key);
  }
}
