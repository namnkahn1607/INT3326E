export interface ApiEnvironment {
  port: number;
  corsOrigins: string[];
}

export const DEFAULT_CORS_ORIGINS = [
  'http://localhost:5173', 'http://127.0.0.1:5173', 'https://int3326e.web.app',
];

export function validateFirebaseEnvironment(env: NodeJS.ProcessEnv): void {
  if (!env.FIREBASE_AUTH_EMULATOR_HOST) return;
  const match = /^(localhost|127\.0\.0\.1|\[::1\]):(\d{1,5})$/.exec(env.FIREBASE_AUTH_EMULATOR_HOST);
  if (env.NODE_ENV === 'production' || !env.FIREBASE_PROJECT_ID?.startsWith('demo-') ||
      !match || Number(match[2]) < 1 || Number(match[2]) > 65535) {
    throw new Error('Auth emulator requires a loopback host, demo- project and non-production environment');
  }
}

export function validateEnvironment(env: NodeJS.ProcessEnv): ApiEnvironment {
  validateFirebaseEnvironment(env);
  const rawPort = env.PORT ?? env.API_PORT ?? '3000';
  if (!/^\d+$/.test(rawPort)) {
    throw new Error('PORT or API_PORT must be an integer between 1 and 65535');
  }

  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT or API_PORT must be an integer between 1 and 65535');
  }

  const corsOrigins = env.CORS_ORIGINS === undefined
    ? DEFAULT_CORS_ORIGINS : env.CORS_ORIGINS.split(',').map((origin) => origin.trim());
  for (const origin of corsOrigins) {
    const url = new URL(origin);
    if (url.origin !== origin || !['http:', 'https:'].includes(url.protocol) ||
        url.username || url.password) throw new Error('CORS_ORIGINS must contain exact HTTP(S) origins');
  }
  return { port, corsOrigins };
}
