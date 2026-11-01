import { ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { ProblemDetailsFilter } from './problem-details.filter';

describe('ProblemDetailsFilter: database unavailable', () => {
  const filter = new ProblemDetailsFilter();

  it.each([
    new Error('timeout exceeded when trying to connect'),
    new Error('Connection terminated unexpectedly'),
    Object.assign(new Error('x'), { code: 'ECONNRESET' }),
  ])('answers 503 SERVICE_UNAVAILABLE for %s instead of a 500', (error) => {
    expect(filter.toProblem(error)).toMatchObject({
      status: 503,
      code: 'SERVICE_UNAVAILABLE',
    });
  });

  it('keeps unknown errors as 500 INTERNAL_ERROR', () => {
    expect(filter.toProblem(new Error('boom'))).toMatchObject({
      status: 500,
      code: 'INTERNAL_ERROR',
    });
  });

  it('maps a 503 HttpException to SERVICE_UNAVAILABLE', () => {
    expect(filter.toProblem(new ServiceUnavailableException())).toMatchObject({
      status: 503,
      code: 'SERVICE_UNAVAILABLE',
    });
  });

  it('tells the client when to retry', () => {
    const headers: Record<string, string> = {};
    let sent: unknown;
    const reply = {
      header(name: string, value: string) {
        headers[name] = value;
        return reply;
      },
      status: () => reply,
      send: (body: unknown) => {
        sent = body;
      },
    };
    const host = {
      switchToHttp: () => ({ getResponse: () => reply, getRequest: () => ({ url: '/api/v1/x' }) }),
    };
    filter.catch(new Error('timeout exceeded when trying to connect'), host as never);
    expect(headers['retry-after']).toBe('2');
    expect(headers['content-type']).toBe('application/problem+json');
    expect(sent).toMatchObject({ code: 'SERVICE_UNAVAILABLE', instance: '/api/v1/x' });
  });
});
