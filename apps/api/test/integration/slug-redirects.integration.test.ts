import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from './support/test-app.js';
import { startTestDatabase, type TestDatabase } from './support/test-database.js';

/**
 * Issue #87: renaming a product or changing a household slug records the old slug, and
 * `GET /redirects/...` resolves it to the current one so the web can answer the old URL with a
 * permanent redirect. Runs on PostgreSQL and MySQL (`DB_DRIVER`).
 */
describe('Slug redirects after a rename', () => {
  let db: TestDatabase;
  let t: TestApp;
  let owner: { auth: string };
  let other: { auth: string };
  let product: { id: string; version: number; slug: string; traceCode: string };
  let householdVersion: number;

  const renameProduct = async (name: string) => {
    const res = await t.request({
      method: 'PATCH',
      url: `/me/household/products/${product.id}`,
      auth: owner.auth,
      headers: { 'if-match': `"${product.version}"` },
      body: { name },
    });
    expect(res.status).toBe(200);
    product = res.body;
  };

  const changeHouseholdSlug = (slug: string, auth = owner.auth, version = householdVersion) =>
    t.request({
      method: 'PATCH',
      url: '/me/household',
      auth,
      headers: { 'if-match': `"${version}"` },
      body: { slug },
    });

  const redirect = (kind: 'products' | 'households', slug: string) =>
    t.request({ method: 'GET', url: `/redirects/${kind}/${slug}` });

  beforeAll(async () => {
    db = await startTestDatabase();
    await db.migrate();
    t = await startTestApp(db);
    const admin = await t.createUser('ADMIN');
    owner = await t.createUser('BUYER');
    other = await t.createUser('BUYER');
    for (const [user, slug] of [
      [owner, 'gom-doi-ten'],
      [other, 'gom-ben-canh'],
    ] as const) {
      const applied = await t.request({
        method: 'POST',
        url: '/me/household',
        auth: user.auth,
        body: { name: `Hộ ${slug}`, slug, history: 'Ngắn.' },
      });
      const approved = await t.request({
        method: 'POST',
        url: `/admin/households/${applied.body.id}/approve`,
        auth: admin.auth,
        headers: { 'if-match': String(applied.body.version) },
      });
      if (user === owner) householdVersion = approved.body.version;
    }
    const created = await t.request({
      method: 'POST',
      url: '/me/household/products',
      auth: owner.auth,
      body: { name: 'Bình men lam' },
    });
    product = created.body;
    const published = await t.request({
      method: 'POST',
      url: `/products/${product.id}/publish`,
      auth: owner.auth,
      headers: { 'if-match': String(product.version) },
    });
    expect(published.status).toBe(200);
    product = { ...product, version: published.body.version };
  }, 240_000);

  afterAll(async () => {
    await t?.close();
    await db?.stop();
  });

  it('renaming a product moves its slug and the old slug resolves to the new one', async () => {
    const first = product.slug;
    expect(first).toBe(`binh-men-lam-${product.traceCode.toLowerCase()}`);
    await renameProduct('Bình hoa sen');
    expect(product.slug).toBe(`binh-hoa-sen-${product.traceCode.toLowerCase()}`);

    expect((await t.request({ method: 'GET', url: `/products/${first}` })).status).toBe(404);
    const res = await redirect('products', first);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ slug: product.slug });
    expect((await t.request({ method: 'GET', url: `/products/${res.body.slug}` })).status).toBe(
      200,
    );
  });

  it('a chain of renames resolves every old slug straight to the current one', async () => {
    const second = product.slug;
    await renameProduct('Bình hút lộc');
    const firstSlug = `binh-men-lam-${product.traceCode.toLowerCase()}`;
    expect((await redirect('products', firstSlug)).body).toEqual({ slug: product.slug });
    expect((await redirect('products', second)).body).toEqual({ slug: product.slug });
  });

  it('going back to an earlier name makes that slug live again, not a redirect', async () => {
    await renameProduct('Bình men lam');
    expect(product.slug).toBe(`binh-men-lam-${product.traceCode.toLowerCase()}`);
    expect((await redirect('products', product.slug)).status).toBe(404);
    expect((await t.request({ method: 'GET', url: `/products/${product.slug}` })).status).toBe(200);
  });

  it('changing the household slug records the old one; a slug in use or retired is refused', async () => {
    const res = await changeHouseholdSlug('gom-ten-moi');
    expect(res.status).toBe(200);
    expect(res.body.slug).toBe('gom-ten-moi');
    householdVersion = res.body.version;
    expect((await redirect('households', 'gom-doi-ten')).body).toEqual({ slug: 'gom-ten-moi' });
    expect((await t.request({ method: 'GET', url: '/households/gom-ten-moi' })).status).toBe(200);

    // Another household's live slug, and this household's retired one used by someone else.
    expect((await changeHouseholdSlug('gom-ben-canh')).status).toBe(409);
    const neighbour = await t.request({ method: 'GET', url: '/me/household', auth: other.auth });
    expect(
      (await changeHouseholdSlug('gom-doi-ten', other.auth, neighbour.body.version)).status,
    ).toBe(409);
  });

  it('an unknown slug has no redirect', async () => {
    expect((await redirect('products', 'khong-co')).status).toBe(404);
    expect((await redirect('households', 'khong-co')).status).toBe(404);
  });
});
