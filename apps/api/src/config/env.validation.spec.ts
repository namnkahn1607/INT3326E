import { describe, expect, it } from 'vitest';

import { validateEnvironment } from './env.validation';

describe('API port configuration', () => {
  it('uses the local default and API_PORT fallback', () => {
    expect(validateEnvironment({}).port).toBe(3000);
    expect(validateEnvironment({ API_PORT: '3001' }).port).toBe(3001);
  });

  it('gives Cloud Run PORT precedence over API_PORT', () => {
    expect(validateEnvironment({ PORT: '8080', API_PORT: '3000' }).port).toBe(8080);
  });

  it.each(['', '0', '-1', '65536', 'NaN', '8080junk', '3.5'])(
    'rejects invalid PORT %j before starting the server',
    (port) => {
      expect(() => validateEnvironment({ PORT: port })).toThrow('PORT or API_PORT');
    },
  );
});
