import { Controller, Get, type INestApplication } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import { PROBLEM_CONTENT_TYPE } from '@vcraft/contracts';
import { afterEach, describe, expect, it } from 'vitest';
import { ProblemDetailsFilter } from '../filters/problem-details.filter';
import { ClientThrottlerGuard, trackerOf } from './client-throttler.guard';
import {
  DEFAULT_RATE_LIMIT_PER_MINUTE,
  type RateLimitConfig,
  rateLimitConfig,
  throttlerOptions,
} from './rate-limit.config';

@Controller('health')
class HealthStub {
  @Get()
  live() {
    return { status: 'ok' };
  }

  @Get('ready')
  ready() {
    return { status: 'ok' };
  }
}

@Controller('products')
class ProductsStub {
  @Get()
  list() {
    return [];
  }
}

async function startApp(config: RateLimitConfig): Promise<NestFastifyApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [ThrottlerModule.forRoot(throttlerOptions(config))],
    controllers: [HealthStub, ProductsStub],
    providers: [
      { provide: APP_FILTER, useClass: ProblemDetailsFilter },
      { provide: APP_GUARD, useClass: ClientThrottlerGuard },
    ],
  }).compile();
  const app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
  app.setGlobalPrefix('api/v1');
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}

describe('rateLimitConfig', () => {
  it('is on with a generous default limit', () => {
    expect(rateLimitConfig({})).toEqual({
      enabled: true,
      perMinute: DEFAULT_RATE_LIMIT_PER_MINUTE,
    });
    expect(DEFAULT_RATE_LIMIT_PER_MINUTE).toBeGreaterThanOrEqual(600);
  });

  it('reads the limit and the off switch from the environment', () => {
    expect(rateLimitConfig({ API_RATE_LIMIT_PER_MINUTE: '120' }).perMinute).toBe(120);
    expect(rateLimitConfig({ API_RATE_LIMIT_ENABLED: 'false' }).enabled).toBe(false);
    expect(rateLimitConfig({ API_RATE_LIMIT_ENABLED: 'true' }).enabled).toBe(true);
  });

  it('falls back to the default for an unusable limit', () => {
    for (const raw of ['', 'abc', '0', '-5', '1.5']) {
      expect(rateLimitConfig({ API_RATE_LIMIT_PER_MINUTE: raw }).perMinute).toBe(
        DEFAULT_RATE_LIMIT_PER_MINUTE,
      );
    }
  });
});

describe('global rate limit', () => {
  let app: INestApplication | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('answers 429 problem+json with Retry-After once the limit is spent', async () => {
    const fastify = await startApp({ enabled: true, perMinute: 3 });
    app = fastify;
    const get = () => fastify.inject({ method: 'GET', url: '/api/v1/products?limit=1' });

    for (let i = 0; i < 3; i++) expect((await get()).statusCode).toBe(200);
    const limited = await get();

    expect(limited.statusCode).toBe(429);
    expect(limited.headers['content-type']).toContain(PROBLEM_CONTENT_TYPE);
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
    expect(limited.json()).toMatchObject({
      status: 429,
      code: 'RATE_LIMITED',
      instance: '/api/v1/products?limit=1',
    });
  });

  it('never limits the health probes', async () => {
    const fastify = await startApp({ enabled: true, perMinute: 1 });
    app = fastify;

    for (let i = 0; i < 5; i++) {
      expect((await fastify.inject({ method: 'GET', url: '/api/v1/health' })).statusCode).toBe(200);
      expect(
        (await fastify.inject({ method: 'GET', url: '/api/v1/health/ready' })).statusCode,
      ).toBe(200);
    }
    // The probes do not spend the budget of real routes either.
    expect((await fastify.inject({ method: 'GET', url: '/api/v1/products' })).statusCode).toBe(200);
    expect((await fastify.inject({ method: 'GET', url: '/api/v1/products' })).statusCode).toBe(429);
  });

  it('can be switched off', async () => {
    const fastify = await startApp({ enabled: false, perMinute: 1 });
    app = fastify;

    for (let i = 0; i < 5; i++) {
      expect((await fastify.inject({ method: 'GET', url: '/api/v1/products' })).statusCode).toBe(
        200,
      );
    }
  });
});

describe('trackerOf', () => {
  it('counts a bearer caller by a hash of its token, not by the shared server IP', () => {
    const a = trackerOf({ ip: '10.0.0.1', headers: { authorization: 'Bearer token-a' } });
    const b = trackerOf({ ip: '10.0.0.1', headers: { authorization: 'Bearer token-b' } });
    expect(a).toMatch(/^token:[0-9a-f]{32}$/);
    expect(a).not.toBe(b);
    expect(a).not.toContain('token-a');
  });

  it('counts an anonymous caller by IP', () => {
    expect(trackerOf({ ip: '203.0.113.7', headers: {} })).toBe('ip:203.0.113.7');
  });
});
