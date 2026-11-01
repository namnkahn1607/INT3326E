import { UserRole } from '../../auth/enums/user-role.enum';
import type { BusinessUser } from '../../users/entities/user.entity';
import { invalidField } from './create-shipment.dto';
import { SHIPMENT_STATUSES, type ShipmentStatus } from './shipment-response.dto';

export const SHIPMENT_ID = /^sh_[0-7][0-9A-HJKMNP-TV-Z]{25}$/;
export const BUSINESS_USER_ID = /^usr_[0-7][0-9A-HJKMNP-TV-Z]{25}$/;
const TRACKING_NUMBER = /^PF\d{8}[0-9A-HJKMNP-TV-Z]{6}$/;
const CURSOR_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;

export interface ShipmentCursor { createdAt: string; id: string }
export interface ShipmentListQuery {
  limit: number;
  status: ShipmentStatus | null;
  trackingNumber: string | null;
  after: ShipmentCursor | null;
}

export function parseShipmentId(id: string): string {
  if (!SHIPMENT_ID.test(id)) invalidField('shipmentId', 'Must be a sh_ULID');
  return id;
}

function cursorScope(actor: BusinessUser, query: Pick<ShipmentListQuery, 'status' | 'trackingNumber'>): string {
  return JSON.stringify([actor.role, actor.id, query.status, query.trackingNumber]);
}

export function encodeShipmentCursor(actor: BusinessUser, query: ShipmentListQuery, after: ShipmentCursor): string {
  return Buffer.from(JSON.stringify({ v: 1, scope: cursorScope(actor, query), ...after })).toString('base64url');
}

export function parseShipmentListQuery(raw: Record<string, unknown>, actor: BusinessUser): ShipmentListQuery {
  if (Object.keys(raw).some(key => !['limit', 'cursor', 'status', 'trackingNumber'].includes(key))) {
    invalidField('query', 'Unknown query field');
  }
  let limit = 20;
  if (raw.limit !== undefined) {
    if (typeof raw.limit !== 'string' || !/^[1-9]\d{0,2}$/.test(raw.limit) || Number(raw.limit) > 100) {
      invalidField('limit', 'Must be an integer between 1 and 100');
    }
    limit = Number(raw.limit);
  }
  if (raw.status !== undefined && (typeof raw.status !== 'string' || !SHIPMENT_STATUSES.includes(raw.status as ShipmentStatus))) {
    invalidField('status', 'Unknown shipment status');
  }
  if (raw.trackingNumber !== undefined && (typeof raw.trackingNumber !== 'string' || !TRACKING_NUMBER.test(raw.trackingNumber))) {
    invalidField('trackingNumber', 'Must be an exact tracking number');
  }
  const query: ShipmentListQuery = { limit, status: raw.status as ShipmentStatus ?? null,
    trackingNumber: raw.trackingNumber as string ?? null, after: null };
  if (raw.cursor === undefined) return query;
  try {
    const token = raw.cursor;
    if (typeof token !== 'string' || token.length > 1024 || !/^[A-Za-z0-9_-]+$/.test(token)) throw new Error();
    const bytes = Buffer.from(token, 'base64url');
    if (bytes.toString('base64url') !== token) throw new Error();
    const value = JSON.parse(bytes.toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value) ||
        Object.keys(value).sort().join(',') !== 'createdAt,id,scope,v' ||
        value.v !== 1 || value.scope !== cursorScope(actor, query) ||
        typeof value.id !== 'string' || !SHIPMENT_ID.test(value.id) ||
        typeof value.createdAt !== 'string' || !CURSOR_TIME.test(value.createdAt) || value.createdAt.startsWith('0000')) throw new Error();
    const milliseconds = `${value.createdAt.slice(0, 23)}Z`;
    if (new Date(milliseconds).toISOString() !== milliseconds) throw new Error();
    query.after = { createdAt: value.createdAt, id: value.id };
    return query;
  } catch {
    invalidField('cursor', 'Invalid cursor for this query');
  }
}

// Role scope is always reapplied in SQL; an opaque cursor never grants access.
export function shipmentScope(actor: BusinessUser): [string, string | null] {
  return [actor.role, actor.role === UserRole.ADMIN ? null : actor.id];
}
