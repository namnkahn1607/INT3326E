import { invalidField } from '../../shipments/dto/create-shipment.dto';
import { BUSINESS_USER_ID } from '../../shipments/dto/shipment-list-query';

export function parseAssignDriver(body: unknown): string {
  if (!body || typeof body !== 'object' || Array.isArray(body)) invalidField('body', 'Nội dung yêu cầu phải là một object');
  const value = body as Record<string, unknown>;
  if (Object.keys(value).length !== 1 || !Object.hasOwn(value, 'driverId')) {
    invalidField('body', 'Chỉ nhận trường driverId');
  }
  if (typeof value.driverId !== 'string' || !BUSINESS_USER_ID.test(value.driverId)) {
    invalidField('driverId', 'Mã tài xế phải có dạng usr_ULID');
  }
  return value.driverId;
}
