import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MikroORM } from '@mikro-orm/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import {
  AppUser,
  Artisan,
  ConsentRecord,
  FieldCipher,
  Household,
  MediaAsset,
  Workshop,
} from '@vcraft/database';
import { type AccountRole, CONSENT_PURPOSES, PRIVACY_POLICY_VERSION } from '@vcraft/domain';
import { LocalObjectStorage } from '@vcraft/storage';
import { AppModule } from '../../../src/app.module.js';
import { AuthAdmin, IdentityExistsError } from '../../../src/common/auth/auth-admin.js';
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
 * `method=<amr>` the Supabase session claims behind sign-in history (GH#83); `verified=no` an address
 * Supabase has not confirmed; `email=<address>` overrides the default `<sub>@test.local` address.
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
      email: options.get('email') ?? `${match[1]}@test.local`,
      emailVerified: options.get('verified') !== 'no',
      aal: options.get('aal') === 'aal1' ? 'aal1' : 'aal2',
      ...(consent && { consentPolicyVersion: consent }),
      ...(session && { sessionId: session }),
      ...(method && { method }),
    } satisfies VerifiedIdentity;
  }
}

/**
 * Stands in for Supabase Auth admin: records every call, can be told to fail. Never touches a real project.
 * `bannedIds` is the set of identities currently banned, as Supabase would hold it.
 */
export class FakeAuthAdmin extends AuthAdmin {
  readonly deleted: string[] = [];
  readonly bannedIds = new Set<string>();
  readonly invites: { email: string; role: AccountRole }[] = [];
  readonly signedOutOthers: string[] = [];
  /** Addresses that already have a confirmed Supabase account. */
  readonly existingEmails = new Set<string>();
  failWith: Error | null = null;

  async deleteUser(id: string): Promise<void> {
    if (this.failWith) throw this.failWith;
    this.deleted.push(id);
  }

  async banUser(id: string): Promise<void> {
    if (this.failWith) throw this.failWith;
    this.bannedIds.add(id);
  }

  async unbanUser(id: string): Promise<void> {
    if (this.failWith) throw this.failWith;
    this.bannedIds.delete(id);
  }

  async inviteUserByEmail(email: string, role: AccountRole): Promise<void> {
    if (this.failWith) throw this.failWith;
    if (this.existingEmails.has(email)) throw new IdentityExistsError(email);
    this.invites.push({ email, role });
  }

  async signOutOthers(accessToken: string): Promise<void> {
    if (this.failWith) throw this.failWith;
    this.signedOutOthers.push(accessToken);
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
  /**
   * Sends one request. Fixtures create a household with `POST /me/household` and approve it right away;
   * an application is now a draft until the representative submits it, and approval needs a workshop and a
   * document. So, unless `strict` is set, a `POST /admin/households/:id/approve` first completes the
   * application in the database (submitted, one workshop and one document when missing) without bumping its
   * version. The tests of those rules themselves send `strict` requests.
   */
  /** Fixture shortcut: submit a household's application (adds a workshop and a document when missing). */
  completeApplication: (householdId: string, options?: { withDocument?: boolean }) => Promise<void>;
  request: (opts: {
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    url: string;
    auth?: string;
    body?: unknown;
    headers?: Record<string, string>;
    /**
     * Skip the fixture shortcut described at {@link TestApp.request}: the request reaches the API as sent.
     * Tests of the submit and approval completeness rules set it.
     */
    strict?: boolean;
    // biome-ignore lint/suspicious/noExplicitAny: test đọc JSON tùy dạng, kiểm bằng expect
  }) => Promise<{ status: number; body: any; headers: Record<string, unknown> }>;
  close: () => Promise<void>;
}

/** Fixture shortcut: makes a household's application complete and submitted, leaving its version alone. */
async function completeApplication(
  db: TestDatabase,
  householdId: string,
  options: { withDocument?: boolean } = {},
): Promise<void> {
  const em = db.orm.em.fork();
  const household = await em.findOne(Household, householdId);
  if (!household) return;
  if ((await em.count(Workshop, { household })) === 0) {
    em.create(Workshop, { household, name: 'Xưởng thử', address: 'Bát Tràng, Gia Lâm, Hà Nội' });
  }
  const ownerId = household.representative.id;
  if (
    options.withDocument !== false &&
    (await em.count(MediaAsset, { ownerId, purpose: 'CERTIFICATE' })) === 0
  ) {
    em.create(MediaAsset, {
      ownerId,
      purpose: 'CERTIFICATE',
      visibility: 'PRIVATE',
      status: 'READY',
      mimeType: 'application/pdf',
      sizeBytes: 3,
      sha256: 'c'.repeat(64),
      originalKey: `originals/${ownerId}/${crypto.randomUUID()}`,
    });
  }
  // Approval also needs a story, a craft and an artisan (GH#474); tests of that rule send `strict` requests.
  if ((await em.count(Artisan, { household })) === 0) {
    em.create(Artisan, { household, name: 'Nghệ nhân thử' });
  }
  await em.flush();
  // Raw SQL: an ORM update would bump the optimistic-lock version the tests still hold.
  if (household.history.trim() === '') {
    await em
      .getConnection()
      .execute("update household set history = 'Câu chuyện của hộ.' where id = ?", [householdId]);
  }
  if (!household.craftCategory && !household.craft?.trim()) {
    await em
      .getConnection()
      .execute("update household set craft_category = 'GOM_SU' where id = ?", [householdId]);
  }
  if (household.status === 'DRAFT') {
    // Raw SQL: an ORM update would bump the optimistic-lock version the tests still hold.
    await em
      .getConnection()
      .execute("update household set status = 'PENDING_REVIEW' where id = ?", [householdId]);
  }
}

/** `configure` adds overrides of its own, e.g. a fake chat model for the assistant tests. */
export async function startTestApp(
  db: TestDatabase,
  configure: (builder: TestingModuleBuilder) => TestingModuleBuilder = (builder) => builder,
): Promise<TestApp> {
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
  const moduleRef = await configure(Test.createTestingModule({ imports: [AppModule] }))
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
    completeApplication: (householdId, options) => completeApplication(db, householdId, options),
    async request({ method, url, auth, body, headers, strict }) {
      const approving = /^\/admin\/households\/([0-9a-f-]{36})\/approve$/.exec(url);
      if (approving && method === 'POST' && !strict) {
        await completeApplication(db, approving[1] as string);
      }
      const res = await app.inject({
        method,
        url: `/api/v1${url}`,
        headers: { ...(auth && { authorization: auth }), ...headers },
        ...(body !== undefined && { payload: body as object }),
      });
      return {
        status: res.statusCode,
        body: res.body ? JSON.parse(res.body) : undefined,
        headers: res.headers,
      };
    },
    close: async () => {
      await app.close();
      await rm(storageDir, { recursive: true, force: true });
    },
  };
}
