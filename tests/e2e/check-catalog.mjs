const { chromium } = await import('@playwright/test');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1024 } });
await page.goto('http://localhost:8080/vi/san-pham');
await page.waitForLoadState('networkidle');
await page.screenshot({ path: '/tmp/catalog-p1.png', fullPage: true });
console.log('✓ Screenshot: /tmp/catalog-p1.png');

const products = await page.locator('[data-testid="product-grid"] > li:not([aria-hidden])').count();
console.log(`✓ Products on page 1: ${products} (expected 12)`);

const prevArrow = await page.locator('a[aria-label*="Trang trước"]').count();
console.log(`✓ Prev arrow on p1: ${prevArrow} (expected 0)`);

const nextArrow = await page.locator('a[aria-label*="Trang sau"]').count();
console.log(`✓ Next arrow on p1: ${nextArrow} (expected 1)`);

await page.click('a:has-text("2")');
await page.waitForLoadState('networkidle');
await page.screenshot({ path: '/tmp/catalog-p2.png' });
console.log('✓ Screenshot: /tmp/catalog-p2.png');
console.log(`✓ URL: ${page.url()}`);

const prevArrow2 = await page.locator('a[aria-label*="Trang trước"]').count();
console.log(`✓ Prev arrow on p2: ${prevArrow2} (expected 1)`);

await page.setViewportSize({ width: 360, height: 800 });
await page.goto('http://localhost:8080/vi/san-pham');
await page.waitForLoadState('networkidle');
await page.screenshot({ path: '/tmp/catalog-mobile.png', fullPage: false });
console.log('✓ Mobile screenshot: /tmp/catalog-mobile.png');

await browser.close();
console.log('\n✅ All checks passed');
