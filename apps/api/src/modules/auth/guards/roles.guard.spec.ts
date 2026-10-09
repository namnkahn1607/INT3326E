import 'reflect-metadata';
import { ForbiddenException, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';

import { Roles } from '../decorators/roles.decorator';
import { UserRole } from '../enums/user-role.enum';
import type { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';
import { RolesGuard } from './roles.guard';

function fixture(role?: UserRole, required?: UserRole[]) {
  class Controller {}
  const handler = () => undefined;
  if (required) Roles(...required)(handler);
  const request: AuthenticatedRequest = {
    headers: {},
    user: role ? { uid: 'test-user', role } : undefined,
  };
  const context = {
    getHandler: () => handler,
    getClass: () => Controller,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { guard: new RolesGuard(new Reflector()), context, Controller, handler };
}

describe('RolesGuard', () => {
  it.each(Object.values(UserRole))('allows the required role %s', (role) => {
    const { guard, context } = fixture(role, [role]);
    expect(guard.canActivate(context)).toBe(true);
  });

  it.each([UserRole.CUSTOMER, UserRole.DRIVER])('denies %s on dispatcher operations', (role) => {
    const { guard, context } = fixture(role, [UserRole.DISPATCHER]);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('requires an authenticated user when a role is declared', () => {
    const { guard, context } = fixture(undefined, [UserRole.DISPATCHER]);
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('leaves authentication to FirebaseAuthGuard when no role is declared', () => {
    const { guard, context } = fixture();
    expect(guard.canActivate(context)).toBe(true);
  });

  it('uses controller roles when the handler has no override', () => {
    const { guard, context, Controller } = fixture(UserRole.DRIVER);
    Roles(UserRole.DISPATCHER)(Controller);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('allows handler roles to override controller roles', () => {
    const { guard, context, Controller } = fixture(UserRole.DRIVER, [UserRole.DRIVER]);
    Roles(UserRole.DISPATCHER)(Controller);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows either role declared on a shared operation', () => {
    const { guard, context } = fixture(UserRole.DRIVER, [UserRole.DRIVER, UserRole.DISPATCHER]);
    expect(guard.canActivate(context)).toBe(true);
  });
});
