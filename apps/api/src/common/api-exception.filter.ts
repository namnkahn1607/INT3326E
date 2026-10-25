import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
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
  catch(error: unknown, host: ArgumentsHost): void {
    const status = error instanceof HttpException ? error.getStatus() : 500;
    let fieldErrors: { field: string; message: string }[] | undefined;
    let [code, title] = errors[status] ?? ['INTERNAL_SERVER_ERROR', 'Internal server error'];
    if (error instanceof ApiProblem) {
      ({ code, title, errors: fieldErrors } = error.getResponse() as { code: string; title: string; errors?: { field: string; message: string }[] });
    }
    const http = host.switchToHttp();
    const request = http.getRequest<{ originalUrl?: string; url?: string }>();
    const response = http.getResponse<{
      status(value: number): { type(value: string): { json(value: unknown): void } };
    }>();
    response.status(status).type('application/problem+json').json({
      type: 'about:blank', title, status, code,
      instance: (request.originalUrl ?? request.url ?? '/').split('?')[0],
      timestamp: new Date().toISOString(),
      ...(fieldErrors ? { errors: fieldErrors } : {}),
    });
  }
}
