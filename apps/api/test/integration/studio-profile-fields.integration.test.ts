import { AuditLog, MediaAsset } from '@vcraft/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LLM_CLIENT } from '../../src/modules/assistant/infrastructure/llm-client.js';
import { startTestApp, type TestApp } from './support/test-app.js';
import { startTestDatabase, type TestDatabase } from './support/test-database.js';

/**
 * Issue #253 (profile part): live slug check, cover/portrait/seal, craft category, certification date,
 * photo and board verification, gallery order and the story suggestion endpoint.
 */
describe('Studio profile fields (GH#253)', () => {
  let db: TestDatabase;
  let t: TestApp;
  let admin: { id: string; auth: string };
  let owner: { id: string; auth: string };
  let other: { id: string; auth: string };
  let householdId: string;
  let version: number;

  const llm = {
    classify: async () => ({ intent: 'site_help', query: '', tokens: 0 }),
    async *stream() {
      yield {
        type: 'text',
        text: '[[VI]]\nGốm Hồ Sơ làm gốm ba đời.\n[[EN]]\nGốm Hồ Sơ has made pottery ',
      };
      yield { type: 'text', text: 'for three generations.' };
    },
  };

  const patch = (body: object, v = version, auth = owner.auth) =>
    t.request({
      method: 'PATCH',
      url: '/me/household',
      auth,
      headers: { 'if-match': `"${v}"` },
      body,
    });
  const mine = () => t.request({ method: 'GET', url: '/me/household', auth: owner.auth });
  const slugCheck = (slug: string, auth = owner.auth) =>
    t.request({ method: 'GET', url: `/households/slug-availability?slug=${slug}`, auth });

  /** A READY public image owned by `ownerId`, as the media pipeline leaves it. */
  async function readyImage(ownerId: string, tag: string): Promise<string> {
    const sha256 = tag.padEnd(64, '0');
    const em = db.orm.em.fork();
    const asset = em.create(MediaAsset, {
      ownerId,
      purpose: 'PRODUCT',
      visibility: 'PUBLIC',
      status: 'READY',
      mimeType: 'image/webp',
      sizeBytes: 1,
      width: 1280,
      height: 800,
      sha256,
      originalKey: `originals/${tag}`,
      variants: [{ format: 'webp', width: 1280, height: 800, key: `v/${tag}-1280.webp`, bytes: 1 }],
    });
    await em.flush();
    return asset.id;
  }

  beforeAll(async () => {
    db = await startTestDatabase();
    await db.migrate();
    t = await startTestApp(db, (builder) => builder.overrideProvider(LLM_CLIENT).useValue(llm));
    admin = await t.createUser('ADMIN');
    owner = await t.createUser('BUYER');
    other = await t.createUser('BUYER');
    const applied = await t.request({
      method: 'POST',
      url: '/me/household',
      auth: owner.auth,
      body: { name: 'Gốm Hồ Sơ', slug: 'gom-ho-so', history: 'Ngắn.' },
    });
    householdId = applied.body.id;
    const approved = await t.request({
      method: 'POST',
      url: `/admin/households/${householdId}/approve`,
      auth: admin.auth,
      headers: { 'if-match': `"${applied.body.version}"` },
      body: {},
    });
    version = approved.body.version;
    await t.request({
      method: 'POST',
      url: '/me/household',
      auth: other.auth,
      body: { name: 'Gốm Khác', slug: 'gom-khac', history: '' },
    });
  }, 240_000);

  afterAll(async () => {
    await t?.close();
    await db?.stop();
  });

  it('slug availability: free, taken with a suggestion, own address, retired address, bad input', async () => {
    expect((await slugCheck('gom-moi')).body).toEqual({ available: true });
    expect((await slugCheck('gom-khac')).body).toEqual({
      available: false,
      suggestion: 'gom-khac-2',
    });
    // The household's own address is never a conflict with itself.
    expect((await slugCheck('gom-ho-so')).body).toEqual({ available: true });
    // The route is not swallowed by `GET /households/:slug`.
    expect((await t.request({ method: 'GET', url: '/households/gom-ho-so' })).status).toBe(200);
    expect((await slugCheck('Bad Slug!')).status).toBe(422);
    expect(
      (await t.request({ method: 'GET', url: '/households/slug-availability?slug=x' })).status,
    ).toBe(401);

    // An address the household gave up still redirects to it, so another household cannot take it.
    const moved = await patch({ slug: 'gom-ho-so-moi' });
    expect(moved.status).toBe(200);
    version = moved.body.version;
    expect((await slugCheck('gom-ho-so', other.auth)).body).toEqual({
      available: false,
      suggestion: 'gom-ho-so-2',
    });
    // ...while the owner may go back to it.
    expect((await slugCheck('gom-ho-so')).body).toEqual({ available: true });
    // Saving a taken address still fails with the duplicate error.
    const taken = await patch({ slug: 'gom-khac' });
    expect(taken.status).toBe(409);
    expect(taken.body.code).toBe('CONFLICT_DUPLICATE');
    const back = await patch({ slug: 'gom-ho-so' });
    expect(back.status).toBe(200);
    version = back.body.version;
  });

  it('craft category: legacy free text is mapped, a stored category wins, the detail stays', async () => {
    // The approval fixture shortcut stored a category (GH#474); this case starts from legacy text only.
    await db.orm.em
      .fork()
      .getConnection()
      .execute('update household set craft_category = null where id = ?', [householdId]);
    const legacy = await patch({ craft: 'men lam' });
    version = legacy.body.version;
    expect(legacy.body).toMatchObject({ craft: 'men lam', craftCategory: 'MEN' });

    const picked = await patch({ craftCategory: 'NUNG' });
    version = picked.body.version;
    expect(picked.body).toMatchObject({ craft: 'men lam', craftCategory: 'NUNG' });
    const pub = await t.request({ method: 'GET', url: '/households/gom-ho-so' });
    expect(pub.body).toMatchObject({ craft: 'men lam', craftCategory: 'NUNG' });
    const listed = await t.request({ method: 'GET', url: '/households' });
    expect(listed.body.data).toEqual([
      expect.objectContaining({ slug: 'gom-ho-so', craft: 'men lam', craftCategory: 'NUNG' }),
    ]);

    expect((await patch({ craftCategory: 'NOPE' })).status).toBe(422);
    const cleared = await patch({ craftCategory: null });
    version = cleared.body.version;
    expect(cleared.body.craftCategory).toBe('MEN');
  });

  it('cover, portrait and seal: own uploads only, alt text required, shown on the public page', async () => {
    const cover = await readyImage(owner.id, 'c0ver');
    const portrait = await readyImage(owner.id, 'p0rtrait');
    const seal = await readyImage(owner.id, 's3al');
    const foreign = await readyImage(other.id, 'f0reign');

    expect((await patch({ coverPhoto: { mediaId: foreign, alt: 'Cổng xưởng' } })).status).toBe(403);
    expect((await patch({ coverPhoto: { mediaId: cover, alt: 'ab' } })).status).toBe(422);
    expect((await patch({ portraitPhoto: { mediaId: portrait, alt: '' } })).status).toBe(422);

    const saved = await patch({
      coverPhoto: { mediaId: cover, alt: 'Cổng xưởng gốm' },
      portraitPhoto: { mediaId: portrait, alt: 'Bác Hải bên bàn xoay' },
      sealPhoto: { mediaId: seal },
    });
    expect(saved.status).toBe(200);
    version = saved.body.version;
    expect(saved.body.coverPhoto).toMatchObject({ mediaId: cover, alt: 'Cổng xưởng gốm' });
    expect(saved.body.coverPhoto.url).toContain('c0ver');
    expect(saved.body.sealPhoto).toMatchObject({ mediaId: seal, alt: '' });

    const pub = await t.request({ method: 'GET', url: '/households/gom-ho-so' });
    expect(pub.body.banner).toMatchObject({ mediaId: cover, alt: 'Cổng xưởng gốm' });
    expect(pub.body.coverUrl).toBe(pub.body.banner.url);
    expect(pub.body.portrait).toMatchObject({ mediaId: portrait, alt: 'Bác Hải bên bàn xoay' });
    expect(pub.body.seal).toMatchObject({ mediaId: seal });
    // The public page does not carry the private editor fields.
    expect(pub.body.coverPhoto).toBeUndefined();

    const removed = await patch({ sealPhoto: null, portraitPhoto: null });
    version = removed.body.version;
    expect(removed.body.sealPhoto).toBeNull();
    const after = await t.request({ method: 'GET', url: '/households/gom-ho-so' });
    expect(after.body.seal).toBeNull();
    expect(after.body.portrait).toBeNull();
    expect(after.body.banner).toMatchObject({ mediaId: cover });
  });

  it('certifications: date derives the year, legacy year stays, photo is own, only the board verifies', async () => {
    const photo = await readyImage(owner.id, 'cert1');
    const foreign = await readyImage(other.id, 'cert2');
    const noDate = await patch({ certifications: [{ name: 'OCOP', issuer: 'UBND' }] });
    expect(noDate.status).toBe(422);
    const foreignPhoto = await patch({
      certifications: [
        { name: 'OCOP', issuer: 'UBND', year: 2022, photo: { mediaId: foreign, alt: 'Giấy OCOP' } },
      ],
    });
    expect(foreignPhoto.status).toBe(403);

    const saved = await patch({
      certifications: [
        {
          name: 'OCOP 4 sao',
          issuer: 'UBND Hà Nội',
          issuedOn: '2023-06-30',
          year: 1999,
          photo: { mediaId: photo, alt: 'Giấy OCOP 4 sao' },
        },
        { name: 'Làng nghề', issuer: 'Sở Công Thương', year: 2019 },
      ],
    });
    expect(saved.status).toBe(200);
    version = saved.body.version;
    expect(saved.body.certifications).toMatchObject([
      { name: 'OCOP 4 sao', year: 2023, issuedOn: '2023-06-30', verified: false },
      { name: 'Làng nghề', year: 2019, issuedOn: null, photo: null, verified: false },
    ]);
    expect(saved.body.certifications[0].photo).toMatchObject({
      mediaId: photo,
      alt: 'Giấy OCOP 4 sao',
    });

    // The owner cannot verify; a plain admin call needs the version and a real index.
    const verifyUrl = (index: number) =>
      `/admin/households/${householdId}/certifications/${index}/verification`;
    const byOwner = await t.request({
      method: 'PUT',
      url: verifyUrl(0),
      auth: owner.auth,
      headers: { 'if-match': `"${version}"` },
      body: { verified: true },
    });
    expect(byOwner.status).toBe(403);
    const missingIndex = await t.request({
      method: 'PUT',
      url: verifyUrl(7),
      auth: admin.auth,
      headers: { 'if-match': `"${version}"` },
      body: { verified: true },
    });
    expect(missingIndex.status).toBe(404);
    const stale = await t.request({
      method: 'PUT',
      url: verifyUrl(0),
      auth: admin.auth,
      headers: { 'if-match': `"${version - 1}"` },
      body: { verified: true },
    });
    expect(stale.status, JSON.stringify(stale.body)).toBe(409);

    const verified = await t.request({
      method: 'PUT',
      url: verifyUrl(0),
      auth: admin.auth,
      headers: { 'if-match': `"${version}"` },
      body: { verified: true },
    });
    expect(verified.status).toBe(200);
    version = verified.body.version;
    expect(verified.body.certifications.map((c: { verified: boolean }) => c.verified)).toEqual([
      true,
      false,
    ]);
    const pub = await t.request({ method: 'GET', url: '/households/gom-ho-so' });
    expect(pub.body.certifications.map((c: { verified: boolean }) => c.verified)).toEqual([
      true,
      false,
    ]);

    // Saving the same evidence again keeps the mark; changing the issue date drops it.
    const same = await patch({
      certifications: [
        {
          name: 'OCOP 4 sao',
          issuer: 'UBND Hà Nội',
          issuedOn: '2023-06-30',
          photo: { mediaId: photo, alt: 'Giấy OCOP 4 sao' },
        },
        { name: 'Làng nghề', issuer: 'Sở Công Thương', year: 2019 },
      ],
    });
    version = same.body.version;
    expect(same.body.certifications[0].verified).toBe(true);
    const edited = await patch({
      certifications: [
        {
          name: 'OCOP 4 sao',
          issuer: 'UBND Hà Nội',
          issuedOn: '2023-07-01',
          photo: { mediaId: photo, alt: 'Giấy OCOP 4 sao' },
        },
        { name: 'Làng nghề', issuer: 'Sở Công Thương', year: 2019 },
      ],
    });
    version = edited.body.version;
    expect(edited.body.certifications[0].verified).toBe(false);

    // Remove verification is the same action with `verified: false`, and both are audited.
    const marked = await t.request({
      method: 'PUT',
      url: verifyUrl(1),
      auth: admin.auth,
      headers: { 'if-match': `"${version}"` },
      body: { verified: true },
    });
    version = marked.body.version;
    const unmarked = await t.request({
      method: 'PUT',
      url: verifyUrl(1),
      auth: admin.auth,
      headers: { 'if-match': `"${version}"` },
      body: { verified: false },
    });
    expect(unmarked.status).toBe(200);
    version = unmarked.body.version;
    expect(unmarked.body.certifications[1].verified).toBe(false);
    const logs = await db.orm.em.fork().find(AuditLog, { entityId: householdId });
    const actions = logs.map((log) => log.action);
    expect(actions).toContain('household.certification_verify');
    expect(actions).toContain('household.certification_unverify');
    const entry = logs.find((log) => log.action === 'household.certification_verify');
    expect(entry?.actorId).toBe(admin.id);
    expect(entry?.after).toMatchObject({ certification: 'OCOP 4 sao', verified: true });
  });

  it('gallery order is the order the household sends and is kept on read', async () => {
    const photos = ['/images/demo/bia-duc-phat-1280.webp', '/images/demo/other-1280.webp'].map(
      (url, i) => ({ url, alt: `Ảnh xưởng số ${i + 1}` }),
    );
    const first = await patch({ gallery: photos });
    version = first.body.version;
    expect(first.body.gallery.map((g: { alt: string }) => g.alt)).toEqual([
      'Ảnh xưởng số 1',
      'Ảnh xưởng số 2',
    ]);
    const reversed = await patch({ gallery: [...photos].reverse() });
    version = reversed.body.version;
    expect((await mine()).body.gallery.map((g: { alt: string }) => g.alt)).toEqual([
      'Ảnh xưởng số 2',
      'Ảnh xưởng số 1',
    ]);
    const pub = await t.request({ method: 'GET', url: '/households/gom-ho-so' });
    expect(pub.body.gallery.map((g: { alt: string }) => g.alt)).toEqual([
      'Ảnh xưởng số 2',
      'Ảnh xưởng số 1',
    ]);
  });

  it('the story is stored as sent (Markdown subset); a legacy plain story is unchanged', async () => {
    const markdown = 'Men **lam** và *rạn*\n\n- Bình\n- Đĩa\n\n[Xem](https://example.com)';
    const saved = await patch({ history: markdown });
    version = saved.body.version;
    expect(saved.body.history).toBe(markdown);
    const plain = await patch({ history: 'Câu chuyện thường, không định dạng.' });
    version = plain.body.version;
    expect(plain.body.history).toBe('Câu chuyện thường, không định dạng.');
  });

  it('story suggestion: only for the household, returns Vietnamese and English, saves nothing', async () => {
    const before = (await mine()).body;
    const res = await t.request({
      method: 'POST',
      url: '/me/household/story-suggestion',
      auth: owner.auth,
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      vi: 'Gốm Hồ Sơ làm gốm ba đời.',
      en: 'Gốm Hồ Sơ has made pottery for three generations.',
    });
    const after = (await mine()).body;
    expect(after.history).toBe(before.history);
    expect(after.version).toBe(before.version);

    // An account that does not represent a household (and an administrator) is refused.
    expect(
      (await t.request({ method: 'POST', url: '/me/household/story-suggestion', auth: admin.auth }))
        .status,
    ).toBe(403);
    expect(
      (await t.request({ method: 'POST', url: '/me/household/story-suggestion' })).status,
    ).toBe(401);
  });
});
