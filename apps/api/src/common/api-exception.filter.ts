import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { ApiProblem } from './api-problem';

const errors: Record<number, [string, string]> = {
  400: ['VALIDATION_ERROR', 'Invalid request'],
  401: ['UNAUTHENTICATED', 'Authentication required'],
  403: ['FORBIDDEN_RESOURCE', 'Access denied'],
  404: ['RESOURCE_NOT_FOUND', 'Resource not found'],
  409: ['INVALID_STATE_TRANSITION', 'Conflict'],
  429: ['RATE_LIMIT_EXCEEDED', 'Too many requests'],
  503: ['SERVICE_UNAVAILABLE', 'Service temporarily unavailable'],
};

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(error: unknown, host: ArgumentsHost): void {
    const status = error instanceof HttpException ? error.getStatus() : 500;
    let fieldErrors: { field: string; message: string }[] | undefined;
    let [code, title] = errors[status] ?? ['INTERNAL_SERVER_ERROR', 'Internal server error'];
    if (error instanceof ApiProblem) {
      ({ code, title, errors: fieldErrors } = error.getResponse() as { code: string; title: string; errors?: { field: string; message: string }[] });
    }
    const http = host.switchToHttp();
    const request = http.getRequest<{ method?: string; originalUrl?: string; url?: string }>();
    const response = http.getResponse<{
      status(value: number): { type(value: string): { json(value: unknown): void } };
    }>();
    const instance = (request.originalUrl ?? request.url ?? '/').split('?')[0];
    if (!(error instanceof HttpException)) this.logUnhandled(error, request.method, instance);
    response.status(status).type('application/problem+json').json({
      type: 'about:blank', title, status, code,
      instance,
      timestamp: new Date().toISOString(),
      ...(fieldErrors ? { errors: fieldErrors } : {}),
    });
  }

  // Same rule as dependency diagnostics: no message, stack or query string, which may carry SQL or secrets.
  private logUnhandled(error: unknown, method: string | undefined, path: string): void {
    try {
      const name = error instanceof Error && /^[A-Za-z0-9_]{1,64}$/.test(error.name) ? error.name : 'NonError';
      this.logger.error(JSON.stringify({ event: 'unhandled_exception', name, method: method ?? 'UNKNOWN', path }));
    } catch { /* Logging must not replace the public response. */ }
  }
}
