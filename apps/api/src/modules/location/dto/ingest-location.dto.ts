import { ApiProblem } from '../../../common/api-problem';

export interface IngestLocationDto {
  lat: number;
  lng: number;
  clientTimestamp: string;
  sessionId?: string;
  seq?: number;
}

function invalid(field: string, message: string): never {
  throw new ApiProblem(400, 'VALIDATION_ERROR', 'Dữ liệu GPS không hợp lệ', [{ field, message }]);
}

export function normalizeLocation(value: unknown): IngestLocationDto {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid('body', 'Phải là một đối tượng JSON');
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some(key => !['lat', 'lng', 'clientTimestamp', 'seq', 'sessionId'].includes(key))) {
    invalid('body', 'Có trường không được hỗ trợ');
  }
  for (const [field, max] of [['lat', 90], ['lng', 180]] as const) {
    const coordinate = body[field];
    if (typeof coordinate !== 'number' || !Number.isFinite(coordinate) || Math.abs(coordinate) > max) {
      invalid(field, `Phải là số hữu hạn trong khoảng từ -${max} đến ${max}`);
    }
  }
  const match = typeof body.clientTimestamp === 'string'
    ? /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d+))?(Z|[+-](\d{2}):(\d{2}))$/.exec(body.clientTimestamp) : null;
  const wall = match ? `${match[1]}.000Z` : '';
  if (!match || !Number.isFinite(Date.parse(wall)) || new Date(wall).toISOString() !== wall ||
      (match[3] !== 'Z' && (Number(match[4]) > 23 || Number(match[5]) > 59))) {
    invalid('clientTimestamp', 'Phải là thời gian ISO 8601 hợp lệ có múi giờ');
  }
  // Cắt phần nhỏ hơn mili giây trước khi publish để Worker dùng cùng khóa dedupe.
  const timestamp = new Date(`${match[1]}.${(match[2] ?? '').padEnd(3, '0').slice(0, 3)}${match[3]}`);
  if (!Number.isFinite(timestamp.getTime()) || !/^\d{4}-/.test(timestamp.toISOString())) {
    invalid('clientTimestamp', 'Thời gian nằm ngoài phạm vi hỗ trợ');
  }
  if ('seq' in body && (!Number.isInteger(body.seq) || (body.seq as number) < 1 || (body.seq as number) > 2147483647)) {
    invalid('seq', 'Phải là số nguyên từ 1 đến 2147483647');
  }
  if ('sessionId' in body && (typeof body.sessionId !== 'string' ||
      !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(body.sessionId))) {
    invalid('sessionId', 'Phải là UUID');
  }
  return { lat: body.lat as number, lng: body.lng as number, clientTimestamp: timestamp.toISOString(),
    ...('seq' in body ? { seq: body.seq as number } : {}),
    ...('sessionId' in body ? { sessionId: body.sessionId as string } : {}) };
}
