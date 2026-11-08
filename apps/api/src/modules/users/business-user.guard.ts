import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { UsersService } from './users.service';

@Injectable()
export class BusinessUserGuard implements CanActivate {
  constructor(@Inject(UsersService) private readonly users: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) throw new UnauthorizedException();
    request.businessUser = await this.users.requireBusinessUser(request.user);
    return true;
  }
}
