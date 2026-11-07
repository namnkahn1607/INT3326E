import { HttpException, Logger, NotFoundException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiExceptionFilter } from './api-exception.filter';
import { ApiProblem } from './api-problem';

function run(error: unknown) {
  const json = vi.fn();
  const response = { status: vi.fn((_value: number) => ({ type: vi.fn(() => ({ json })) })) };
  const host = { switchToHttp: () => ({
    getRequest: () => ({ method: 'GET', originalUrl: '/v1/drivers?cursor=secret' }),
    getResponse: () => response,
  }) };
  new ApiExceptionFilter().catch(error, host as never);
  return { status: response.status.mock.calls[0][0], body: json.mock.calls[0][0] };
}

describe('ApiExceptionFilter logging', () => {
  afterEach(() => vi.restoreAllMocks());

  it('logs only the error name, method and path for an unhandled error, and still returns 500', () => {
    const spy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { status, body } = run(new TypeError('password=hunter2 SELECT * FROM users'));
    expect(status).toBe(500);
    expect(body).toMatchObject({ code: 'INTERNAL_SERVER_ERROR', instance: '/v1/drivers' });
    expect(spy).toHaveBeenCalledTimes(1);
    const line = String(spy.mock.calls[0][0]);
    expect(JSON.parse(line)).toEqual({ event: 'unhandled_exception', name: 'TypeError', method: 'GET', path: '/v1/drivers' });
    expect(line).not.toMatch(/hunter2|SELECT|secret/);
  });

  it('does not log expected HTTP errors', () => {
    const spy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    expect(run(new NotFoundException()).status).toBe(404);
    expect(run(new ApiProblem(409, 'USER_NOT_PROVISIONED', 'x')).status).toBe(409);
    expect(run(new HttpException('x', 503)).status).toBe(503);
    expect(spy).not.toHaveBeenCalled();
  });

  it('survives a logger failure and a thrown non-Error value', () => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => { throw new Error('log down'); });
    expect(run('boom').status).toBe(500);
  });
});
