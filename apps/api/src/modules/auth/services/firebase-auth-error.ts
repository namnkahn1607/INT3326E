import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';

const credentialErrors = new Set([
  'auth/argument-error', 'auth/invalid-argument', 'auth/invalid-id-token',
  'auth/id-token-expired', 'auth/id-token-revoked', 'auth/user-disabled',
  'auth/user-not-found', 'auth/tenant-id-mismatch', 'auth/mismatching-tenant-id',
]);

export function firebaseAuthError(error: unknown): UnauthorizedException | ServiceUnavailableException {
  if (error instanceof UnauthorizedException) return error;
  const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
  if (typeof code === 'string' && credentialErrors.has(code)) {
    return new UnauthorizedException('Invalid or expired authentication token');
  }
  return new ServiceUnavailableException('Authentication service temporarily unavailable');
}
