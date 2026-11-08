import 'reflect-metadata';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GeocodingService } from './geocoding.service';
import { placeInput, reverseInput, searchInput } from './dto/geocoding.dto';

const key = 'server-only-test-key';
const boundaries = [{ type: 2, full_name: 'Phường Quan Hoa' }, { type: 1, full_name: 'Quận Cầu Giấy' }, { type: 0, full_name: 'Thành phố Hà Nội' }];
const feature = { name: 'Đường Cầu Giấy', display: 'Đường Cầu Giấy, Hà Nội', ref_id: 'auto:example', boundaries };
let service: GeocodingService;
const upstream = vi.fn();
beforeEach(() => { service = new GeocodingService(key); upstream.mockReset(); vi.stubGlobal('fetch', upstream); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe('VIETMAP adapter (mock upstream)', () => {
  it('does not cache a malformed response and allows recovery on the next request', async () => {
    upstream.mockResolvedValueOnce(Response.json({})).mockResolvedValueOnce(Response.json([feature]));
    await expect(service.search('uid', 'Địa điểm')).rejects.toMatchObject({ status: 503 });
    await expect(service.search('uid', 'Địa điểm')).resolves.toHaveLength(1);
    expect(upstream).toHaveBeenCalledTimes(2);
  });
  it('requests legacy format on a fixed provider URL without forwarding Firebase tokens or cookies', async () => {
    upstream.mockResolvedValueOnce(Response.json([{ ...feature, apikey: key, privateDiagnostic: 'secret' }]));
    const result = await service.search('uid', 'Đường Cầu Giấy');
    const [url, options] = upstream.mock.calls[0];
    expect(url.origin + url.pathname).toBe('https://maps.vietmap.vn/api/autocomplete/v4');
    expect(url.searchParams.get('display_type')).toBe('2');
    expect(url.searchParams.get('apikey')).toBe(key);
    expect(Object.keys(options.headers)).toEqual(['Accept']);
    expect(options.credentials).toBe('omit'); expect(options.redirect).toBe('error');
    expect(JSON.stringify(result)).not.toContain(key);
    expect(JSON.stringify(result)).not.toContain('privateDiagnostic');
    expect(result[0].address.regions).toEqual(boundaries.map(item => item.full_name));
    expect(result[0].point).toBeUndefined();
    expect(upstream).toHaveBeenCalledTimes(1);
  });
  it('keeps ward and district names rather than passing incompatible vendor codes to the directory', async () => {
    upstream.mockResolvedValue(Response.json([{ ...feature, lat: 21.03, lng: 105.8 }]));
    expect(await service.reverse('uid', { lat: 21.03, lng: 105.8 })).toMatchObject({ point: { lat: 21.03, lng: 105.8 }, address: { regions: boundaries.map(item => item.full_name) } });
    expect(upstream.mock.calls[0][0].searchParams.get('lat')).toBe('21.030000');
    expect(upstream.mock.calls[0][0].searchParams.get('display_type')).toBe('2');
  });
  it('resolves one selected refid with the old administrative format inherited from search', async () => {
    upstream.mockResolvedValue(Response.json({ lat: 21.03, lng: 105.8, street: 'Đường Cầu Giấy', ward: 'Phường Quan Hoa', district: 'Quận Cầu Giấy', city: 'Thành phố Hà Nội' }));
    const result = await service.place('uid', 'auto:example');
    expect(upstream.mock.calls[0][0].pathname).toBe('/api/place/v4');
    expect(upstream.mock.calls[0][0].searchParams.get('refid')).toBe('auto:example');
    expect(result.address.regions).toEqual(boundaries.map(item => item.full_name));
  });
  it('filters non-Hanoi results and returns null for an empty reverse response', async () => {
    upstream.mockResolvedValueOnce(Response.json([{ ...feature, boundaries: [{ type: 0, full_name: 'Hồ Chí Minh' }] }]));
    expect(await service.search('uid', 'Địa điểm')).toEqual([]);
    upstream.mockResolvedValueOnce(Response.json([]));
    expect(await service.reverse('uid', { lat: 21, lng: 105 })).toBeNull();
  });
  it.each([401, 423, 429, 500])('sanitizes provider HTTP %s without raw diagnostics', async status => {
    upstream.mockResolvedValue(new Response('secret ' + key, { status }));
    try { await service.search('uid', 'Địa điểm'); expect.fail('Expected failure'); }
    catch (error) {
      expect(error).toMatchObject({ status: 503 });
      expect(JSON.stringify(error)).not.toContain(key);
      expect(JSON.stringify(error)).not.toContain('maps.vietmap.vn');
    }
  });
  it('sanitizes network exceptions and invalid JSON or envelopes', async () => {
    upstream.mockRejectedValueOnce(new Error('https://maps.vietmap.vn/?apikey=' + key));
    await expect(service.search('uid', 'Địa điểm')).rejects.toMatchObject({ status: 503 });
    upstream.mockResolvedValueOnce(new Response('invalid json'));
    await expect(service.search('uid', 'Địa điểm')).rejects.toMatchObject({ status: 503 });
    upstream.mockResolvedValueOnce(Response.json({}));
    await expect(service.search('uid', 'Địa điểm')).rejects.toMatchObject({ status: 503 });
  });
  it('fails closed without a key instead of making an anonymous request', async () => {
    await expect(new GeocodingService('').search('uid', 'Địa điểm')).rejects.toMatchObject({ status: 503 });
    expect(upstream).not.toHaveBeenCalled();
  });
  it('sets an eight-second upstream timeout and sanitizes aborts', async () => {
    const signal = new AbortController().signal;
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(signal);
    upstream.mockRejectedValueOnce(new DOMException('Aborted', 'AbortError'));
    await expect(service.search('uid', 'Địa điểm')).rejects.toMatchObject({ status: 503 });
    expect(timeout).toHaveBeenCalledWith(8000);
    expect(upstream.mock.calls[0][1].signal).toBe(signal);
  });
  it('caches and expires successful responses without extra lookups', async () => {
    vi.useFakeTimers(); upstream.mockImplementation(async () => Response.json([feature]));
    await service.search('uid', 'Địa điểm'); await service.search('uid', 'Địa điểm');
    expect(upstream).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(300_001);
    await service.search('uid', 'Địa điểm');
    expect(upstream).toHaveBeenCalledTimes(2);
  });
  it('bounds per-account requests and resets its minute window', async () => {
    vi.useFakeTimers(); upstream.mockImplementation(async () => Response.json([feature]));
    for (let i = 0; i < 30; i++) await service.search('uid', 'Địa điểm');
    await expect(service.search('uid', 'Địa điểm')).rejects.toMatchObject({ status: 429 });
    expect(upstream).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60_000);
    await expect(service.search('uid', 'Địa điểm')).resolves.toHaveLength(1);
  });
  it('bounds concurrent upstream requests even across different users', async () => {
    let finish!: () => void;
    const pending = new Promise<void>(resolve => { finish = resolve; });
    upstream.mockImplementation(async () => { await pending; return Response.json([feature]); });
    const requests = Array.from({ length: 4 }, (_, i) => service.search('uid-' + i, 'Địa điểm ' + i));
    await expect(service.search('other', 'Địa điểm khác')).rejects.toMatchObject({ status: 429 });
    finish(); await Promise.all(requests);
    expect(upstream).toHaveBeenCalledTimes(4);
  });
});

describe('Geocoding validation', () => {
  it('rejects extra/private fields and type coercion before touching the provider', () => {
    for (const value of [null, [], {}, { query: 'ab' }, { query: 'Hà Nội', token: 'private' }, { query: 'x'.repeat(256) }]) {
      expect(() => searchInput(value)).toThrow();
    }
    for (const value of [{ lat: '21', lng: 105 }, { lat: 91, lng: 105 }, { lat: 21, lng: 105, notes: 'private' }]) {
      expect(() => reverseInput(value)).toThrow();
    }
    expect(searchInput({ query: '  Cầu   Giấy ' })).toBe('Cầu Giấy');
    expect(reverseInput({ lat: 21.0300001, lng: 105.8000001 })).toEqual({ lat: 21.03, lng: 105.8 });
    expect(placeInput({ reference: 'auto:abc' })).toBe('auto:abc');
    expect(() => placeInput({ reference: '', url: 'https://example.com' })).toThrow();
  });
});
