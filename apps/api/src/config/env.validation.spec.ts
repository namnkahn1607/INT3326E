import { describe, expect, it } from 'vitest';

import { validateEnvironment, validateFirebaseEnvironment } from './env.validation';

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

describe('Firebase emulator and CORS boundaries', () => {
  it('accepts only isolated local demo auth emulation', () => {
    expect(() => validateFirebaseEnvironment({ FIREBASE_PROJECT_ID: 'demo-parcelflow', FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099' })).not.toThrow();
    for (const env of [
      { FIREBASE_PROJECT_ID: 'int3326e', FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099' },
      { FIREBASE_PROJECT_ID: 'demo-parcelflow', FIREBASE_AUTH_EMULATOR_HOST: 'remote.example:9099' },
      { FIREBASE_PROJECT_ID: 'demo-parcelflow', FIREBASE_AUTH_EMULATOR_HOST: 'localhost:0' },
      { FIREBASE_PROJECT_ID: 'demo-parcelflow', FIREBASE_AUTH_EMULATOR_HOST: 'localhost:9099', NODE_ENV: 'production' },
    ]) expect(() => validateFirebaseEnvironment(env)).toThrow('emulator');
  });
  it('uses exact configurable CORS origins', () => {
    expect(validateEnvironment({ CORS_ORIGINS: 'https://int3326e.web.app,http://localhost:5173' }).corsOrigins).toHaveLength(2);
    for (const origin of ['*', '', 'https://example.test/path', 'https://user:pass@example.test']) {
      expect(() => validateEnvironment({ CORS_ORIGINS: origin })).toThrow();
    }
  });
});
