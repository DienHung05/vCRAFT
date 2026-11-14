import { expect, test } from '@playwright/test';

/**
 * GH#529 (ADR-0028): the first catalog row must be in the first HTML flush, not in a streamed
 * `<div hidden id="S:...">` chunk, so the browser discovers the LCP picture while parsing the document.
 */
test('the first product cards are in the initial HTML, not in a streamed chunk', async ({
  request,
}) => {
  const res = await request.get('/vi/san-pham');
  expect(res.ok()).toBe(true);
  const html = await res.text();

  const grid = html.indexOf('data-testid="product-grid"');
  expect(grid, 'the grid is server-rendered').toBeGreaterThan(-1);
  const firstCard = html.indexOf('<li', grid);
  expect(firstCard, 'the grid has a first card').toBeGreaterThan(-1);

  // A streamed Suspense chunk would open with `<div hidden id="S:0">` before the swapped-in content,
  // and the old loading.tsx drew skeleton cards first.
  const before = html.slice(0, firstCard);
  expect(before).not.toContain('<div hidden id="S:');
  expect(before).not.toContain('data-testid="product-skeleton"');

  // When the first card has a cover picture, it loads with high priority, and when that picture has
  // API variants it is also preloaded from the head. Seeded e2e products may have no picture at all.
  const cardEnd = html.indexOf('</li>', firstCard);
  const card = html.slice(firstCard, cardEnd);
  const img = card.match(/<img\b[^>]*>/i)?.[0];
  if (img) {
    expect(img).toMatch(/\bfetchpriority="high"/i);
    // Bundled demo photos (`/images/demo/…`) are not preloaded; only API media variants are.
    if (/\bsrcset=/i.test(card) && !card.includes('/images/demo/')) {
      const head = html.slice(0, html.indexOf('</head>'));
      const imagePreloads = (head.match(/<link\b[^>]*>/gi) ?? []).filter(
        (tag) =>
          /\brel="preload"/i.test(tag) &&
          /\bas="image"/i.test(tag) &&
          /\bfetchpriority="high"/i.test(tag),
      );
      expect(imagePreloads.length).toBeGreaterThan(0);
    }
  }
});
