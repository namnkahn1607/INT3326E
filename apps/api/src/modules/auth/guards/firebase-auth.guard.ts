import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PUBLIC_KEY } from '../decorators/public.decorator';

import { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';
import {
  TOKEN_VERIFIER,
  TokenVerifier,
} from '../interfaces/token-verifier.interface';

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(
    @Inject(TOKEN_VERIFIER)
    private readonly tokenVerifier: TokenVerifier,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(), context.getClass(),
    ])) return true;

    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest>();

    const token = this.extractBearerToken(request.headers.authorization);

    try {
      request.user = await this.tokenVerifier.verify(token);
      return true;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw new ServiceUnavailableException('Authentication service temporarily unavailable');
      }
      throw new UnauthorizedException(
        'Invalid or expired authentication token',
      );
    }
  }

  private extractBearerToken(authorization?: string): string {
    if (!authorization) {
      throw new UnauthorizedException(
        'Authentication token is required',
      );
    }

    const [scheme, token, ...extraParts] = authorization
      .trim()
      .split(/\s+/);

    if (
      scheme.toLowerCase() !== 'bearer' ||
      !token ||
      extraParts.length > 0
    ) {
      throw new UnauthorizedException(
        'Authorization header must use Bearer token',
      );
    }

    return token;
  }
}
