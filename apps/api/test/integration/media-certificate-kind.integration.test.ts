import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from './support/test-app.js';
import { startTestDatabase, type TestDatabase } from './support/test-database.js';

/** Distinct valid bytes per evidence file, so independent cases never share the dedupe key. */
const pdfOf = (seed: string) =>
  Buffer.from(`%PDF-1.4\n% ${seed}\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n`);

const multipart = (auth: string, filename: string, seed = filename) => {
  const boundary = 'vcraftboundary';
  return {
    method: 'POST' as const,
    url: '/api/v1/media?purpose=CERTIFICATE',
    headers: {
      authorization: auth,
      'content-type': `multipart/form-data; boundary=${boundary}`,
    },
    payload: Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: application/pdf\r\n\r\n`,
      ),
      pdfOf(seed),
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]),
  };
};

/**
 * vCRAFT-8my.3 — classified private evidence (FR-MEDIA-04): CERTIFICATE uploads carry a kind, legacy
 * files read UNKNOWN and are upgraded on re-upload of the same bytes, admin review groups by kind,
 * and household/guest access to private evidence stays blocked.
 */
describe('Certificate evidence classification', () => {
  let db: TestDatabase;
  let t: TestApp;
  let admin: { id: string; auth: string };
  let rep: { id: string; auth: string };
  let stranger: { auth: string };
  let household: { id: string };

  beforeAll(async () => {
    db = await startTestDatabase();
    await db.migrate();
    t = await startTestApp(db);
    admin = await t.createUser('ADMIN');
    rep = await t.createUser('BUYER');
    stranger = await t.createUser('BUYER');
    const applied = await t.request({
      method: 'POST',
      url: '/me/household',
      auth: rep.auth,
      body: { name: 'Gốm Phân Loại', slug: 'gom-phan-loai', history: 'Khai báo.' },
    });
    household = applied.body;
  }, 120_000);

  afterAll(async () => {
    await t?.close();
    await db?.stop();
  });

  it('upload stores the picked kind; omitted kind stays UNKNOWN', async () => {
    const idCard = await t.app.inject(multipart(rep.auth, 'cccd.pdf'));
    expect(idCard.statusCode).toBe(202);
    expect(idCard.cookies).toBeDefined();
    const identity = JSON.parse(idCard.body);
    expect(identity.certificateKind).toBe('UNKNOWN');

    const withKind = await t.app.inject({
      ...multipart(rep.auth, 'giay-cu-tru.pdf'),
      url: '/api/v1/media?purpose=CERTIFICATE&kind=RESIDENCE',
    });
    expect(withKind.statusCode).toBe(202);
    expect(JSON.parse(withKind.body).certificateKind).toBe('RESIDENCE');
  });

  it('re-uploading identical bytes upgrades UNKNOWN; a stored known kind wins', async () => {
    const first = await t.app.inject(multipart(rep.auth, 'giay-phep.pdf'));
    expect(first.statusCode).toBe(202);
    const asset = JSON.parse(first.body);
    expect(asset.certificateKind).toBe('UNKNOWN');

    const upgraded = await t.app.inject({
      ...multipart(rep.auth, 'giay-phep.pdf'),
      url: '/api/v1/media?purpose=CERTIFICATE&kind=WORKSHOP',
    });
    expect(upgraded.statusCode).toBe(202);
    const upgradedBody = JSON.parse(upgraded.body);
    expect(upgradedBody.id).toBe(asset.id);
    expect(upgradedBody.certificateKind).toBe('WORKSHOP');

    const again = await t.app.inject({
      ...multipart(rep.auth, 'giay-phep.pdf'),
      url: '/api/v1/media?purpose=CERTIFICATE&kind=IDENTITY',
    });
    expect(again.statusCode).toBe(202);
    expect(JSON.parse(again.body).id).toBe(asset.id);
    expect(JSON.parse(again.body).certificateKind).toBe('WORKSHOP');
  });

  it('an invalid kind query is rejected', async () => {
    const bad = await t.app.inject({
      ...multipart(rep.auth, 'khac.pdf'),
      url: '/api/v1/media?purpose=CERTIFICATE&kind=PASSPORT',
    });
    // ZodValidationPipe maps an unknown enum value to the VALIDATION_FAILED contract (422).
    expect(bad.statusCode).toBe(422);
  });

  it('admin documents group by kind; another household and a buyer cannot read them', async () => {
    const url = `/admin/households/${household.id}/documents`;
    const docs = await t.request({ method: 'GET', url, auth: admin.auth });
    expect(docs.status).toBe(200);
    const kinds = docs.body.data.map((d: { certificateKind: string }) => d.certificateKind).sort();
    expect(kinds).toEqual(['RESIDENCE', 'UNKNOWN', 'WORKSHOP']);
    expect((await t.request({ method: 'GET', url, auth: stranger.auth })).status).toBe(403);

    const otherApplied = await t.request({
      method: 'POST',
      url: '/me/household',
      auth: stranger.auth,
      body: { name: 'Hộ Khác', slug: 'ho-khac', history: '' },
    });
    expect(
      (
        await t.request({
          method: 'GET',
          url: `/admin/households/${otherApplied.body.id}/documents`,
          auth: rep.auth,
        })
      ).status,
    ).toBe(403);
  });

  it('private read-url stays owner-or-admin only, consent still required for the classified path', async () => {
    const docs = await t.request({
      method: 'GET',
      url: `/admin/households/${household.id}/documents`,
      auth: admin.auth,
    });
    const id = docs.body.data[0].id as string;
    expect(
      (await t.request({ method: 'GET', url: `/media/${id}/read-url`, auth: admin.auth })).status,
    ).toBe(200);
    expect(
      (await t.request({ method: 'GET', url: `/media/${id}/read-url`, auth: rep.auth })).status,
    ).toBe(200);
    expect(
      (await t.request({ method: 'GET', url: `/media/${id}/read-url`, auth: stranger.auth }))
        .status,
    ).toBe(404);

    const noConsent = await t.createUser('HOUSEHOLD', { consent: false });
    const denied = await t.app.inject({
      ...multipart(noConsent.auth, 'cccd.pdf'),
      url: '/api/v1/media?purpose=CERTIFICATE&kind=IDENTITY',
    });
    expect(denied.statusCode).toBe(403);
    expect(JSON.parse(denied.body).code).toBe('CONSENT_REQUIRED');
  });
});
