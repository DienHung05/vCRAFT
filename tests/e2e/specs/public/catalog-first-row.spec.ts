import { expect, test } from '@playwright/test';

/**
 * GH#529 (ADR-0028): the first catalog row must be in the first HTML flush, not in a streamed
 * `<div hidden id="S:...">` chunk, so the browser discovers the LCP picture while parsing the document.
 */
test('the first product card picture is in the initial HTML and preloaded in the head', async ({
  request,
}) => {
  const res = await request.get('/vi/san-pham');
  expect(res.ok()).toBe(true);
  const html = await res.text();

  const grid = html.indexOf('data-testid="product-grid"');
  expect(grid).toBeGreaterThan(-1);
  const firstImg = html.slice(grid).search(/<img\b[^>]*fetchpriority="high"/i);
  expect(firstImg).toBeGreaterThan(-1);
  const imgAt = grid + firstImg;

  // A streamed Suspense chunk would open with `<div hidden id="S:0">` before the swapped-in content.
  expect(html.slice(0, imgAt)).not.toContain('<div hidden id="S:');
  expect(html.slice(0, imgAt)).not.toContain('data-testid="product-skeleton"');

  const head = html.slice(0, html.indexOf('</head>'));
  const imagePreloads = (head.match(/<link\b[^>]*>/gi) ?? []).filter(
    (tag) =>
      /\brel="preload"/i.test(tag) &&
      /\bas="image"/i.test(tag) &&
      /\bfetchpriority="high"/i.test(tag),
  );
  expect(imagePreloads.length).toBeGreaterThan(0);
});
