import type { Logger } from '@nestjs/common';

export type DependencyStage =
  | 'auth.verify-token' | 'auth.lookup-user' | 'database.idle' | 'users.lookup'
  | 'shipments.connect' | 'shipments.begin' | 'shipments.idempotency.claim' | 'shipments.clock'
  | 'shipments.idempotency.read' | 'shipments.idempotency.refresh' | 'shipments.build'
  | 'shipments.insert' | 'shipments.event.insert' | 'shipments.notification.insert'
  | 'shipments.idempotency.complete' | 'shipments.commit' | 'shipments.rollback';

// Never log provider messages, details, SQL parameters or arbitrary error codes.
const safeCodes = new Set([
  'DATABASE_URL_MISSING', 'TRACKING_CODE_RETRY_EXHAUSTED',
  '08000', '08001', '08003', '08004', '08006', '08007', '08P01',
  '22001', '22003', '22007', '22008', '22P02', '23502', '23503', '23505', '23514', '25P02',
  '28000', '28P01', '3D000', '3F000', '40001', '40P01', '42501', '42601', '42703', '42804', '42883', '42P01', '42P10',
  '53300', '53400', '55P03', '57014', '57P01', '57P02', '57P03',
  'ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'EAI_AGAIN', 'ETIMEDOUT', 'ENOENT', 'EACCES', 'EPIPE',
  'app/invalid-credential', 'app/invalid-app-options', 'app/network-error', 'app/network-timeout',
  'auth/invalid-credential', 'auth/insufficient-permission', 'auth/internal-error',
  'auth/network-request-failed', 'auth/project-not-found', 'auth/operation-not-allowed', 'auth/too-many-requests',
]);

const driverTimeouts = new Map([
  ['timeout exceeded when trying to connect', 'CONNECTION_TIMEOUT'],
  ['Connection terminated due to connection timeout', 'CONNECTION_TIMEOUT'],
  ['Query read timeout', 'QUERY_TIMEOUT'],
]);

export function logDependencyFailure(logger: Pick<Logger, 'error'>, stage: DependencyStage, error?: unknown): void {
  let code = 'UNKNOWN';
  try {
    const candidate = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
    if (typeof candidate === 'string' && safeCodes.has(candidate)) code = candidate;
    else if (error instanceof Error) code = driverTimeouts.get(error.message) ?? 'UNKNOWN';
  } catch { /* Diagnostic accessors must not replace the original failure. */ }
  try {
    logger.error(JSON.stringify({ event: 'dependency_failure', stage, code }));
  } catch { /* Logging must not interfere with transaction rollback or the public response. */ }
}
