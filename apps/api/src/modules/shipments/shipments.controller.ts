import { Body, Controller, Get, Header, Headers, Inject, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
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

  @Get()
  @Roles(UserRole.CUSTOMER, UserRole.DRIVER, UserRole.ADMIN)
  @Header('Cache-Control', 'no-store')
  list(@Req() request: AuthenticatedRequest, @Query() query: Record<string, unknown>) {
    return this.shipments.list(request.businessUser!, query);
  }

  @Get(':id')
  @Roles(UserRole.CUSTOMER, UserRole.DRIVER, UserRole.ADMIN)
  @Header('Cache-Control', 'no-store')
  detail(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Query() query: Record<string, unknown>) {
    return this.shipments.detail(request.businessUser!, id, query);
  }

  @Post()
  @Roles(UserRole.CUSTOMER)
  create(@Req() request: AuthenticatedRequest, @Body() body: unknown,
    @Headers('idempotency-key') header: unknown, @Query() query: Record<string, unknown>) {
    if (Object.keys(query).length) invalidField('query', 'Query fields are not supported');
    const key = parseIdempotencyKey(header);
    return this.shipments.create(request.businessUser!, normalizeCreateShipment(body), key);
  }
}
