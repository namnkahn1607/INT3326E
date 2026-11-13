import { BadRequestException } from '@nestjs/common';

export interface NotificationCursor { createdAt: string; id: string }
export interface NotificationQuery { limit: number; after: NotificationCursor | null }

const NOTIFICATION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const CURSOR_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;

// The cursor carries the customer id so a token copied from another account is rejected, never honoured.
const scopeOf = (customerId: string) => `notifications:${customerId}`;

export function encodeNotificationCursor(customerId: string, cursor: NotificationCursor): string {
  return Buffer.from(JSON.stringify({ v: 1, scope: scopeOf(customerId), ...cursor })).toString('base64url');
}

export function parseNotificationQuery(query: Record<string, unknown>, customerId: string): NotificationQuery {
  if (Object.keys(query).some((key) => key !== 'limit' && key !== 'cursor')) throw new BadRequestException();
  let limit = 20;
  if (query.limit !== undefined) {
    if (typeof query.limit !== 'string' || !/^[1-9]\d{0,2}$/.test(query.limit) || Number(query.limit) > 100) {
      throw new BadRequestException();
    }
    limit = Number(query.limit);
  }
  if (query.cursor === undefined) return { limit, after: null };
  const token = query.cursor;
  if (typeof token !== 'string' || token.length > 512 || !/^[A-Za-z0-9_-]+$/.test(token)) throw new BadRequestException();
  try {
    const bytes = Buffer.from(token, 'base64url');
    if (bytes.toString('base64url') !== token) throw new Error();
    const value: unknown = JSON.parse(bytes.toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    const cursor = value as Record<string, unknown>;
    if (Object.keys(cursor).sort().join(',') !== 'createdAt,id,scope,v' || cursor.v !== 1 ||
        cursor.scope !== scopeOf(customerId) ||
        typeof cursor.id !== 'string' || !NOTIFICATION_ID.test(cursor.id) ||
        typeof cursor.createdAt !== 'string' || !CURSOR_TIME.test(cursor.createdAt) ||
        cursor.createdAt.startsWith('0000')) throw new Error();
    const milliseconds = `${cursor.createdAt.slice(0, 23)}Z`;
    if (new Date(milliseconds).toISOString() !== milliseconds) throw new Error();
    return { limit, after: { id: cursor.id, createdAt: cursor.createdAt } };
  } catch {
    throw new BadRequestException();
  }
}
