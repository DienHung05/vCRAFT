import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MikroORM } from '@mikro-orm/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AppUser, ConsentRecord, FieldCipher } from '@vcraft/database';
import { type AccountRole, CONSENT_PURPOSES, PRIVACY_POLICY_VERSION } from '@vcraft/domain';
import { LocalObjectStorage } from '@vcraft/storage';
import { AppModule } from '../../../src/app.module.js';
import { AuthAdmin } from '../../../src/common/auth/auth-admin.js';
import {
  IdentityVerifier,
  InvalidTokenError,
  type VerifiedIdentity,
} from '../../../src/common/auth/identity-verifier.js';
import { configureHttp } from '../../../src/configure-http.js';
import { OBJECT_STORAGE } from '../../../src/infrastructure/storage/storage.module.js';
import type { TestDatabase } from './test-database.js';

/**
 * Thay Supabase bằng token giả `Bearer test:<sub>` để test không cần project thật.
 * Tài khoản phải có sẵn trong `app_user` (xem {@link TestApp.createUser}) hoặc sẽ được tạo lười vai trò BUYER.
 * Options follow as `|key=value`: `consent=<version>` mimics the sign-up form's metadata; `aal=aal1` a
 * session without the second factor (the default is `aal2`, so admin tests pass MFA); `session=<id>` and
 * `method=<amr>` the Supabase session claims behind sign-in history (GH#83).
 */
class FakeIdentityVerifier extends IdentityVerifier {
  async verify(headers: Readonly<Record<string, string | string[] | undefined>>) {
    const auth = headers.authorization;
    if (typeof auth !== 'string') return null;
    const match = /^Bearer test:([0-9a-f-]{36})((?:\|[a-z]+=\S+?)*)$/.exec(auth);
    if (!match?.[1]) throw new InvalidTokenError('bad test token');
    const options = new Map(
      (match[2] ?? '')
        .split('|')
        .filter(Boolean)
        .map((pair) => pair.split('=') as [string, string]),
    );
    const consent = options.get('consent');
    const session = options.get('session');
    const method = options.get('method');
    return {
      sub: match[1],
      email: `${match[1]}@test.local`,
      emailVerified: true,
      aal: options.get('aal') === 'aal1' ? 'aal1' : 'aal2',
      ...(consent && { consentPolicyVersion: consent }),
      ...(session && { sessionId: session }),
      ...(method && { method }),
    } satisfies VerifiedIdentity;
  }
}

/** Stands in for Supabase Auth admin: records deletions, can be told to fail. Never touches a real project. */
export class FakeAuthAdmin extends AuthAdmin {
  readonly deleted: string[] = [];
  failWith: Error | null = null;
  async deleteUser(id: string): Promise<void> {
    if (this.failWith) throw this.failWith;
    this.deleted.push(id);
  }
}

/** Throwaway key for tests; the value means nothing outside this process. */
export const TEST_FIELD_KEYS = 'v1:dGVzdC1maWVsZC1rZXktMDEyMzQ1Njc4OWFiY2RlZmc=';

export interface TestApp {
  app: NestFastifyApplication;
  /** Object storage trên thư mục tạm (ADR-14 `STORAGE_DRIVER=local`), xóa khi `close()`. */
  storage: LocalObjectStorage;
  /** The cipher the app uses, for tests that read or seal encrypted columns. */
  cipher: FieldCipher;
  /** Fake for the Supabase Auth admin API used by account deletion. */
  authAdmin: FakeAuthAdmin;
  /**
   * Tạo tài khoản với vai trò cho trước; trả header Authorization dùng cho request.
   * Mặc định tài khoản đã đồng ý mọi mục đích của chính sách hiện hành (như sau khi tick các ô đồng ý);
   * truyền `{ consent: false }` để tạo tài khoản chưa đồng ý gì.
   */
  createUser: (
    role: AccountRole,
    options?: { consent?: boolean },
  ) => Promise<{ id: string; auth: string; email: string }>;
  request: (opts: {
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    url: string;
    auth?: string;
    body?: unknown;
    headers?: Record<string, string>;
    // biome-ignore lint/suspicious/noExplicitAny: test đọc JSON tùy dạng, kiểm bằng expect
  }) => Promise<{ status: number; body: any }>;
  close: () => Promise<void>;
}

export async function startTestApp(db: TestDatabase): Promise<TestApp> {
  const storageDir = await mkdtemp(join(tmpdir(), 'vcraft-api-storage-'));
  const storage = new LocalObjectStorage({
    publicDir: join(storageDir, 'public'),
    privateDir: join(storageDir, 'private'),
    publicBaseUrl: 'http://localhost:8080/media',
    signedBaseUrl: 'http://localhost:8080/api/v1/media/files',
    signingKey: 'integration-test-signing-key',
  });
  const authAdmin = new FakeAuthAdmin();
  const cipher = new FieldCipher(TEST_FIELD_KEYS);
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(OBJECT_STORAGE)
    .useValue(storage)
    .overrideProvider(MikroORM)
    .useValue(db.orm)
    .overrideProvider(IdentityVerifier)
    .useClass(FakeIdentityVerifier)
    .overrideProvider(FieldCipher)
    .useValue(cipher)
    .overrideProvider(AuthAdmin)
    .useValue(authAdmin)
    .compile();
  const app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
  await configureHttp(app);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  return {
    app,
    storage,
    authAdmin,
    cipher,
    async createUser(role, options) {
      const em = db.orm.em.fork();
      const user = em.create(AppUser, {
        id: crypto.randomUUID(),
        email: `${crypto.randomUUID()}@test.local`,
        role,
      });
      if (options?.consent !== false) {
        for (const purpose of CONSENT_PURPOSES) {
          em.create(ConsentRecord, {
            userId: user.id,
            purpose,
            policyVersion: PRIVACY_POLICY_VERSION,
          });
        }
      }
      await em.flush();
      return { id: user.id, auth: `Bearer test:${user.id}`, email: user.email };
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
    close: async () => {
      await app.close();
      await rm(storageDir, { recursive: true, force: true });
    },
  };
}
