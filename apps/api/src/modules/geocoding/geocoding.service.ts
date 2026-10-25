import { Inject, Injectable } from '@nestjs/common';
import { ApiProblem } from '../../common/api-problem';
import type { GeocodingResult } from './dto/geocoding.dto';

export const VIETMAP_API_KEY = Symbol('VIETMAP_API_KEY');
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const hanoi = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/^thanh pho\s+/, '').trim() === 'ha noi';
const unavailable = () => new ApiProblem(503, 'GEOCODING_UNAVAILABLE', 'Dịch vụ địa chỉ tạm thời chưa sẵn sàng.');

@Injectable()
export class GeocodingService {
  private readonly cache = new Map<string, { expires: number; value: unknown }>();
  private readonly limits = new Map<string, number>();
  private windowStart = Date.now();
  private total = 0;
  private active = 0;

  constructor(@Inject(VIETMAP_API_KEY) private readonly apiKey: string) {}

  private admit(uid: string): void {
    if (!this.apiKey) throw unavailable();
    if (Date.now() - this.windowStart >= 60_000) {
      this.windowStart = Date.now(); this.limits.clear(); this.total = 0;
    }
    const count = this.limits.get(uid) ?? 0;
    // Bound both per-account usage and total exposure of the shared demo key per instance.
    if (count >= 30 || this.total >= 300 || this.active >= 4) {
      throw new ApiProblem(429, 'RATE_LIMIT_EXCEEDED', 'Đã đạt giới hạn tra địa chỉ. Vui lòng thử lại sau.');
    }
    this.limits.set(uid, count + 1); this.total++;
  }

  private async request(operation: 'autocomplete' | 'reverse' | 'place', params: Record<string, string>): Promise<unknown> {
    const key = operation + ':' + JSON.stringify(params);
    const saved = this.cache.get(key);
    if (saved && saved.expires > Date.now()) return saved.value;
    const url = new URL('https://maps.vietmap.vn/api/' + operation + '/v4');
    url.search = new URLSearchParams({ ...params, apikey: this.apiKey }).toString();
    this.active++;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(8000), redirect: 'error',
        credentials: 'omit', headers: { Accept: 'application/json' } });
      if (!response.ok) throw unavailable();
      const value: unknown = await response.json();
      if (operation === 'place' ? !object(value) : !Array.isArray(value)) throw unavailable();
      if (this.cache.size >= 300) this.cache.delete(this.cache.keys().next().value!);
      this.cache.set(key, { expires: Date.now() + 300_000, value });
      return value;
    } catch {
      // Never propagate upstream URLs, response bodies or exception causes containing credentials.
      throw unavailable();
    } finally { this.active--; }
  }

  private map(value: unknown): GeocodingResult | null {
    if (!object(value)) return null;
    const boundaries = Array.isArray(value.boundaries) ? value.boundaries.filter(object) : [];
    const regions = boundaries.map(item => text(item.full_name)).filter(Boolean);
    const city = boundaries.find(item => item.type === 0);
    if (!hanoi(text(city?.full_name))) return null;
    const street = text(value.name);
    const label = text(value.display) || [street, ...regions].filter(Boolean).join(', ');
    if (!label) return null;
    const reference = text(value.ref_id);
    const result: GeocodingResult = { id: reference || label, label,
      address: { street, area: regions.join(', '), regions }, ...(reference ? { reference } : {}) };
    if (typeof value.lat === 'number' && Number.isFinite(value.lat) && Math.abs(value.lat) <= 90 &&
        typeof value.lng === 'number' && Number.isFinite(value.lng) && Math.abs(value.lng) <= 180) {
      result.point = { lat: value.lat, lng: value.lng };
    }
    return result;
  }

  async search(uid: string, query: string): Promise<GeocodingResult[]> {
    this.admit(uid);
    const value = await this.request('autocomplete', { text: query, focus: '21.0369,105.7906', display_type: '2' });
    if (!Array.isArray(value)) throw unavailable();
    return value.map(item => this.map(item)).filter((item): item is GeocodingResult => !!item && !!item.reference).slice(0, 5);
  }

  async reverse(uid: string, point: { lat: number; lng: number }): Promise<GeocodingResult | null> {
    this.admit(uid);
    const value = await this.request('reverse', { lat: point.lat.toFixed(6), lng: point.lng.toFixed(6), display_type: '2' });
    if (!Array.isArray(value)) throw unavailable();
    return value.map(item => this.map(item)).find(item => !!item?.point) ?? null;
  }

  async place(uid: string, reference: string): Promise<GeocodingResult> {
    this.admit(uid);
    const value = await this.request('place', { refid: reference });
    if (!object(value)) throw unavailable();
    const point = typeof value.lat === 'number' && Number.isFinite(value.lat) && Math.abs(value.lat) <= 90 &&
      typeof value.lng === 'number' && Number.isFinite(value.lng) && Math.abs(value.lng) <= 180 ? { lat: value.lat, lng: value.lng } : null;
    if (!point || !hanoi(text(value.city))) throw unavailable();
    const regions = [text(value.ward), text(value.district), text(value.city)].filter(Boolean);
    const street = text(value.street) || text(value.name) || text(value.address);
    return { id: reference, reference, label: text(value.display) || [street, ...regions].filter(Boolean).join(', '),
      point, address: { street, area: regions.join(', '), regions } };
  }
}
