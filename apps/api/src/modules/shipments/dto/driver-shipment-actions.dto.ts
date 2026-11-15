import { invalidField } from './create-shipment.dto';

export function parsePickupShipment(body: unknown): void {
  if (body === undefined) return;
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length > 0) {
    invalidField('body', 'Yêu cầu lấy hàng không nhận dữ liệu trong body');
  }
}

export function parseDeliverShipment(body: unknown): string | null {
  if (body === undefined) return null;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    invalidField('body', 'Nội dung yêu cầu phải là một object');
  }
  const value = body as Record<string, unknown>;
  if (Object.keys(value).some(key => key !== 'proofOfDeliveryNotes')) {
    invalidField('body', 'Chỉ nhận trường proofOfDeliveryNotes tùy chọn');
  }
  if (value.proofOfDeliveryNotes === undefined || value.proofOfDeliveryNotes === null) return null;
  if (typeof value.proofOfDeliveryNotes !== 'string') {
    invalidField('proofOfDeliveryNotes', 'Ghi chú giao hàng phải là chuỗi ký tự');
  }
  const normalized = value.proofOfDeliveryNotes.trim();
  if (Array.from(normalized).length > 255) {
    invalidField('proofOfDeliveryNotes', 'Ghi chú giao hàng tối đa 255 ký tự');
  }
  return normalized.length === 0 ? null : normalized;
}
