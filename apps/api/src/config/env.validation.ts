export interface ApiEnvironment {
  port: number;
}

export function validateEnvironment(env: NodeJS.ProcessEnv): ApiEnvironment {
  const rawPort = env.PORT ?? env.API_PORT ?? '3000';
  if (!/^\d+$/.test(rawPort)) {
    throw new Error('PORT or API_PORT must be an integer between 1 and 65535');
  }

  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT or API_PORT must be an integer between 1 and 65535');
  }

  return { port };
}
