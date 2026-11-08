import { ApiProblem } from '../../../common/api-problem';

export interface GeocodingAddress { street: string; area: string; regions: string[] }
export interface GeocodingResult {
  id: string;
  label: string;
  reference?: string;
  point?: { lat: number; lng: number };
  address: GeocodingAddress;
}

function body(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) {
    throw new ApiProblem(400, 'VALIDATION_ERROR', 'Invalid geocoding request');
  }
  return value as Record<string, unknown>;
}

export function searchInput(value: unknown): string {
  const { query } = body(value, ['query']);
  if (typeof query !== 'string' || query.trim().length < 3 || query.length > 255 || /[\x00-\x1f]/.test(query)) {
    throw new ApiProblem(400, 'VALIDATION_ERROR', 'Invalid address query');
  }
  return query.trim().replace(/\s+/g, ' ');
}

export function reverseInput(value: unknown): { lat: number; lng: number } {
  const { lat, lng } = body(value, ['lat', 'lng']);
  if (typeof lat !== 'number' || !Number.isFinite(lat) || Math.abs(lat) > 90 ||
      typeof lng !== 'number' || !Number.isFinite(lng) || Math.abs(lng) > 180) {
    throw new ApiProblem(400, 'VALIDATION_ERROR', 'Invalid coordinates');
  }
  return { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
}

export function placeInput(value: unknown): string {
  const { reference } = body(value, ['reference']);
  if (typeof reference !== 'string' || !reference.trim() || reference.length > 2048 || /[\x00-\x20]/.test(reference)) {
    throw new ApiProblem(400, 'VALIDATION_ERROR', 'Invalid place reference');
  }
  return reference;
}
