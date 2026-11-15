import { Controller, Get, Header, Inject, Query, Req, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/enums/user-role.enum';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { BusinessUserGuard } from '../users/business-user.guard';
import { parseNotificationQuery } from './dto/notification-query';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@Roles(UserRole.CUSTOMER)
@UseGuards(BusinessUserGuard)
export class NotificationsController {
  constructor(@Inject(NotificationsService) private readonly notifications: NotificationsService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  list(@Req() request: AuthenticatedRequest, @Query() query: Record<string, unknown>) {
    // The customer id comes from the verified business user, never from the query.
    const customerId = request.businessUser!.id;
    return this.notifications.list(customerId, parseNotificationQuery(query, customerId));
  }
}
