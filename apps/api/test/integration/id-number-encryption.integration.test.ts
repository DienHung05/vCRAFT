import { DataExportSchema } from '@vcraft/contracts';
import {
  AuditLog,
  FIELD_CONTEXTS,
  FieldCipher,
  Household,
  rotateFieldEncryption,
} from '@vcraft/database';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { startTestApp, TEST_FIELD_KEYS, type TestApp } from './support/test-app.js';
import { startTestDatabase, type TestDatabase } from './support/test-database.js';

const ID = '079203004567';
const MASKED = '••••••••4567';
const OTHER_ID = '001099112233';

/**
 * vCRAFT-83g.33 (NFR-SEC-03, NFR-SEC-06): the representative's citizen ID number is stored only as
 * AES-256-GCM ciphertext, shown masked to its owner, in full to an admin on request (audited) and in the
 * owner's export, never on public or buyer endpoints, never in logs or audit entries, erased on deletion.
 */
describe('Citizen ID number encryption', () => {
  let db: TestDatabase;
  let t: TestApp;
  let admin: { id: string; auth: string };
  let rep: { id: string; auth: string; email: string };
  let householdId: string;
  const slug = 'ho-cccd';

  const rawIdColumn = async (id: string) => {
    const rows = (await db.orm.em
      .getConnection()
      .execute('select id_number_enc from household where id = ?', [id])) as {
      id_number_enc: string | null;
    }[];
    return rows[0]?.id_number_enc ?? null;
  };

  /** Everything the process writes to stdout/stderr while `run` executes. */
  async function captureOutput(run: () => Promise<void>): Promise<string> {
    const chunks: string[] = [];
    const keep = (chunk: unknown) => {
      chunks.push(String(chunk));
      return true;
    };
    const out = vi.spyOn(process.stdout, 'write').mockImplementation(keep);
    const err = vi.spyOn(process.stderr, 'write').mockImplementation(keep);
    try {
      await run();
    } finally {
      out.mockRestore();
      err.mockRestore();
    }
    return chunks.join('');
  }

  beforeAll(async () => {
    db = await startTestDatabase();
    await db.migrate();
    t = await startTestApp(db);
    admin = await t.createUser('ADMIN');
    rep = await t.createUser('BUYER');
    const applied = await t.request({
      method: 'POST',
      url: '/me/household',
      auth: rep.auth,
      body: { name: 'Hộ có CCCD', slug, history: '', idNumber: ID },
    });
    expect(applied.status).toBe(201);
    householdId = applied.body.id;
    await t.request({
      method: 'POST',
      url: `/admin/households/${householdId}/approve`,
      auth: admin.auth,
      headers: { 'if-match': `"${applied.body.version}"` },
    });
  }, 240_000);

  afterAll(async () => {
    await t?.close();
    await db?.stop();
  });

  it('stores ciphertext in the raw row: versioned AES-GCM format, no plaintext, decryptable with the key', async () => {
    const stored = await rawIdColumn(householdId);
    expect(stored).toMatch(/^v1:[\w-]{16}:[\w-]{22}:[\w-]+$/);
    expect(stored).not.toContain(ID);
    expect(
      new FieldCipher(TEST_FIELD_KEYS).decrypt(stored as string, FIELD_CONTEXTS.householdIdNumber),
    ).toBe(ID);
    // Two households with the same number do not share ciphertext (random IV).
    const twin = await t.createUser('BUYER');
    const applied = await t.request({
      method: 'POST',
      url: '/me/household',
      auth: twin.auth,
      body: { name: 'Hộ trùng số', slug: 'ho-trung-so', idNumber: ID },
    });
    expect(await rawIdColumn(applied.body.id)).not.toBe(stored);
  });

  it('validates the number: exactly 12 digits, and the error never echoes the input', async () => {
    const user = await t.createUser('BUYER');
    for (const bad of ['12345678901', '1234567890123', '07920300456a', '079 203 004 567']) {
      const res = await t.request({
        method: 'POST',
        url: '/me/household',
        auth: user.auth,
        body: { name: 'Sai CCCD', slug: 'sai-cccd', idNumber: bad },
      });
      expect(res.status, bad).toBe(422);
      expect(res.body.errors[0].path).toBe('idNumber');
      expect(JSON.stringify(res.body)).not.toContain(bad);
    }
    expect(await db.orm.em.fork().count(Household, { slug: 'sai-cccd' })).toBe(0);
  });

  it('shows the owner only the masked number, and lets them replace it', async () => {
    const mine = await t.request({ method: 'GET', url: '/me/household', auth: rep.auth });
    expect(mine.body.idNumberMasked).toBe(MASKED);
    expect(JSON.stringify(mine.body)).not.toContain(ID);

    const replaced = await t.request({
      method: 'PUT',
      url: '/me/household/id-number',
      auth: rep.auth,
      body: { idNumber: OTHER_ID },
    });
    expect(replaced.status).toBe(200);
    expect(replaced.body.idNumberMasked).toBe('••••••••2233');
    expect(JSON.stringify(replaced.body)).not.toContain(OTHER_ID);
    expect(await rawIdColumn(householdId)).not.toContain(OTHER_ID);

    const invalid = await t.request({
      method: 'PUT',
      url: '/me/household/id-number',
      auth: rep.auth,
      body: { idNumber: 'abc' },
    });
    expect(invalid.status).toBe(422);
    // Put the original back for the tests below.
    await t.request({
      method: 'PUT',
      url: '/me/household/id-number',
      auth: rep.auth,
      body: { idNumber: ID },
    });
  });

  it('never appears on public, buyer or other households’ endpoints', async () => {
    const buyer = await t.createUser('BUYER');
    const stranger = await t.createUser('BUYER');
    await t.request({
      method: 'POST',
      url: '/me/household',
      auth: stranger.auth,
      body: { name: 'Hộ khác', slug: 'ho-khac-cccd' },
    });
    const responses = await Promise.all([
      t.request({ method: 'GET', url: `/households/${slug}` }),
      t.request({ method: 'GET', url: '/households' }),
      t.request({ method: 'GET', url: '/products' }),
      t.request({ method: 'GET', url: '/map/workshops' }),
      t.request({ method: 'GET', url: `/households/${slug}`, auth: buyer.auth }),
      t.request({ method: 'GET', url: '/me/household', auth: stranger.auth }),
      t.request({ method: 'GET', url: '/me', auth: buyer.auth }),
      t.request({ method: 'GET', url: '/me/data-export', auth: buyer.auth }),
    ]);
    for (const res of responses) {
      expect(res.status).toBeLessThan(500);
      const text = JSON.stringify(res.body);
      expect(text).not.toContain(ID);
      expect(text).not.toContain('v1:'); // no ciphertext either
    }
    expect(responses[0]?.body).not.toHaveProperty('idNumberMasked');
  });

  it('refuses the reveal endpoint to everyone but an admin', async () => {
    const url = `/admin/households/${householdId}/id-number`;
    expect((await t.request({ method: 'GET', url })).status).toBe(401);
    expect((await t.request({ method: 'GET', url, auth: rep.auth })).status).toBe(403);
    const buyer = await t.createUser('BUYER');
    expect((await t.request({ method: 'GET', url, auth: buyer.auth })).status).toBe(403);
  });

  it('gives an admin the masked number on the detail, the full one only on reveal, and audits the reveal', async () => {
    const detail = await t.request({
      method: 'GET',
      url: `/admin/households/${householdId}`,
      auth: admin.auth,
    });
    expect(detail.body.idNumberMasked).toBe(MASKED);
    expect(JSON.stringify(detail.body)).not.toContain(ID);

    const before = await db.orm.em.fork().count(AuditLog, { action: 'household.reveal_id_number' });
    const reveal = await t.request({
      method: 'GET',
      url: `/admin/households/${householdId}/id-number`,
      auth: admin.auth,
    });
    expect(reveal.status).toBe(200);
    expect(reveal.body).toEqual({ idNumber: ID });
    expect(
      reveal.body &&
        (
          await t.request({
            method: 'GET',
            url: '/admin/households/00000000-0000-4000-8000-000000000000/id-number',
            auth: admin.auth,
          })
        ).status,
    ).toBe(404);

    const entries = await db.orm.em.fork().find(AuditLog, { action: 'household.reveal_id_number' });
    expect(entries).toHaveLength(before + 1);
    expect(entries.at(-1)).toMatchObject({
      actorId: admin.id,
      entity: 'household',
      entityId: householdId,
    });

    // The audit screen lists the reveal; nothing in it carries the number.
    const log = await t.request({ method: 'GET', url: '/admin/audit-log', auth: admin.auth });
    expect(JSON.stringify(log.body)).toContain('household.reveal_id_number');
    expect(JSON.stringify(log.body)).not.toContain(ID);
  });

  it('household without a number: masked is null and reveal returns null', async () => {
    const user = await t.createUser('BUYER');
    const applied = await t.request({
      method: 'POST',
      url: '/me/household',
      auth: user.auth,
      body: { name: 'Hộ chưa có số', slug: 'ho-chua-co-so' },
    });
    expect(applied.body.idNumberMasked).toBeNull();
    expect(await rawIdColumn(applied.body.id)).toBeNull();
    const reveal = await t.request({
      method: 'GET',
      url: `/admin/households/${applied.body.id}/id-number`,
      auth: admin.auth,
    });
    expect(reveal.body).toEqual({ idNumber: null });
  });

  it('includes the number, decrypted, in the owner’s data export only', async () => {
    const res = await t.request({ method: 'GET', url: '/me/data-export', auth: rep.auth });
    const doc = DataExportSchema.parse(res.body);
    expect(doc.household?.profile.idNumber).toBe(ID);
    expect(JSON.stringify(res.body)).not.toContain('v1:');
  });

  it('keeps the plaintext out of logs, error details and audit entries', async () => {
    const { Logger } = await import('@nestjs/common');
    const logged: string[] = [];
    const spies = (['log', 'error', 'warn', 'debug', 'verbose'] as const).map((level) =>
      vi.spyOn(Logger.prototype, level).mockImplementation((...args: unknown[]) => {
        logged.push(args.map(String).join(' '));
      }),
    );
    const noisy = await captureOutput(async () => {
      const user = await t.createUser('BUYER');
      const bodies: unknown[] = [];
      // Success, validation failure, owner read, admin reveal, export.
      bodies.push(
        (
          await t.request({
            method: 'POST',
            url: '/me/household',
            auth: user.auth,
            body: { name: 'Hộ nhật ký', slug: 'ho-nhat-ky', idNumber: OTHER_ID },
          })
        ).body,
        (
          await t.request({
            method: 'PUT',
            url: '/me/household/id-number',
            auth: user.auth,
            body: { idNumber: `${OTHER_ID}9` },
          })
        ).body,
        (await t.request({ method: 'GET', url: '/me/household', auth: user.auth })).body,
      );
      // The owner's export is the one place the number is returned in the clear; it must still not be logged.
      expect(
        (await t.request({ method: 'GET', url: '/me/data-export', auth: user.auth })).status,
      ).toBe(200);
      // A failure inside the server: a stored value that no longer authenticates.
      const em = db.orm.em.fork();
      const household = await em.findOneOrFail(Household, { slug: 'ho-nhat-ky' });
      const intact = household.idNumberEnc as string;
      household.idNumberEnc = `${intact.slice(0, -2)}AA`;
      await em.flush();
      const broken = await t.request({ method: 'GET', url: '/me/household', auth: user.auth });
      expect(broken.status).toBe(500);
      bodies.push(broken.body);
      household.idNumberEnc = intact;
      await em.flush();
      for (const body of bodies)
        expect(JSON.stringify(body ?? '')).not.toContain(OTHER_ID.slice(0, 8));
    });
    for (const spy of spies) spy.mockRestore();

    expect(logged.join('\n')).toContain('failed authentication'); // the failure was logged ...
    for (const text of [logged.join('\n'), noisy]) {
      expect(text).not.toContain(OTHER_ID); // ... without the number,
      expect(text).not.toContain(ID);
      expect(text).not.toContain(`${OTHER_ID}9`);
    }
    // Audit entries of the whole run.
    const audit = JSON.stringify(await db.orm.em.fork().find(AuditLog, {}));
    expect(audit).not.toContain(ID);
    expect(audit).not.toContain(OTHER_ID);
  });

  it('re-seals with a new key on rotation and still opens with the old one in the list', async () => {
    const em = db.orm.em.fork();
    const rotating = new FieldCipher(
      `v2:${Buffer.alloc(32, 7).toString('base64')},${TEST_FIELD_KEYS}`,
    );
    const first = await rotateFieldEncryption(em, rotating);
    expect(first.rotated).toBeGreaterThan(0);
    const stored = (await rawIdColumn(householdId)) as string;
    expect(stored.startsWith('v2:')).toBe(true);
    expect(rotating.decrypt(stored, FIELD_CONTEXTS.householdIdNumber)).toBe(ID);
    const second = await rotateFieldEncryption(db.orm.em.fork(), rotating);
    expect(second.rotated).toBe(0);
  });

  it('erases the number when the account is deleted', async () => {
    const user = await t.createUser('BUYER');
    const applied = await t.request({
      method: 'POST',
      url: '/me/household',
      auth: user.auth,
      body: { name: 'Hộ sẽ xóa', slug: 'ho-se-xoa', idNumber: OTHER_ID },
    });
    expect(await rawIdColumn(applied.body.id)).not.toBeNull();
    const res = await t.request({
      method: 'DELETE',
      url: '/me',
      auth: user.auth,
      body: { confirmation: user.email },
    });
    expect(res.status).toBe(204);
    expect(await rawIdColumn(applied.body.id)).toBeNull();
  });
});
