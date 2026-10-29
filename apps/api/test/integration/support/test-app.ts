import { MikroORM } from '@mikro-orm/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AppUser } from '@vcraft/database';
import type { AccountRole } from '@vcraft/domain';
import { AppModule } from '../../../src/app.module.js';
import {
  IdentityVerifier,
  InvalidTokenError,
  type VerifiedIdentity,
} from '../../../src/common/auth/identity-verifier.js';
import type { TestDatabase } from './test-database.js';

/**
 * Thay Supabase bằng token giả `Bearer test:<sub>` để test không cần project thật.
 * Tài khoản phải có sẵn trong `app_user` (xem {@link TestApp.createUser}) hoặc sẽ được tạo lười vai trò BUYER.
 */
class FakeIdentityVerifier extends IdentityVerifier {
  async verify(headers: Readonly<Record<string, string | string[] | undefined>>) {
    const auth = headers.authorization;
    if (typeof auth !== 'string') return null;
    const match = /^Bearer test:([0-9a-f-]{36})$/.exec(auth);
    if (!match?.[1]) throw new InvalidTokenError('bad test token');
    return { sub: match[1], email: `${match[1]}@test.local` } satisfies VerifiedIdentity;
  }
}

export interface TestApp {
  app: NestFastifyApplication;
  /** Tạo tài khoản với vai trò cho trước; trả header Authorization dùng cho request. */
  createUser: (role: AccountRole) => Promise<{ id: string; auth: string }>;
  request: (opts: {
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    url: string;
    auth?: string;
    body?: unknown;
    headers?: Record<string, string>;
    // biome-ignore lint/suspicious/noExplicitAny: test đọc JSON tùy dạng, kiểm bằng expect
  }) => Promise<{ status: number; body: any }>;
  close: () => Promise<void>;
}

export async function startTestApp(db: TestDatabase): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MikroORM)
    .useValue(db.orm)
    .overrideProvider(IdentityVerifier)
    .useClass(FakeIdentityVerifier)
    .compile();
  const app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
  app.setGlobalPrefix('api/v1');
  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  return {
    app,
    async createUser(role) {
      const em = db.orm.em.fork();
      const user = em.create(AppUser, {
        id: crypto.randomUUID(),
        email: `${crypto.randomUUID()}@test.local`,
        role,
      });
      await em.flush();
      return { id: user.id, auth: `Bearer test:${user.id}` };
    },
    async request({ method, url, auth, body, headers }) {
      const res = await app.inject({
        method,
        url: `/api/v1${url}`,
        headers: { ...(auth && { authorization: auth }), ...headers },
        ...(body !== undefined && { payload: body as object }),
      });
      return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : undefined };
    },
    close: () => app.close(),
  };
}
