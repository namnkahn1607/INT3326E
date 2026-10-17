import { Controller, UseGuards } from '@nestjs/common';
import { BusinessUserGuard } from '../users/business-user.guard';

@Controller('shipments')
@UseGuards(BusinessUserGuard)
export class ShipmentsController {}
