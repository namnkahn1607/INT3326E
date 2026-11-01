import { invalidField } from '../../shipments/dto/create-shipment.dto';
import { BUSINESS_USER_ID } from '../../shipments/dto/shipment-list-query';

export function parseAssignDriver(body: unknown): string {
  if (!body || typeof body !== 'object' || Array.isArray(body)) invalidField('body', 'Must be an object');
  const value = body as Record<string, unknown>;
  if (Object.keys(value).length !== 1 || !Object.hasOwn(value, 'driverId')) {
    invalidField('body', 'Only driverId is accepted');
  }
  if (typeof value.driverId !== 'string' || !BUSINESS_USER_ID.test(value.driverId)) {
    invalidField('driverId', 'Must be a usr_ULID');
  }
  return value.driverId;
}
