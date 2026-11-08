import { expect, test } from '@playwright/test';

/**
 * GH#316: the home hero shows a turning vase from first paint on every device, and the flat hand-drawn
 * `VaseFigure` never appears there.
 */
const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 800 },
  { name: 'desktop', width: 1440, height: 900 },
] as const;

for (const viewport of VIEWPORTS) {
  test(`hero shows the turning vase on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/vi');
    const hero = page.locator('#home-hero');
    const vase = hero.getByTestId('turning-vase');
    await expect(vase).toBeVisible();

    // The animated layer is present and actually running (CSS animation, no JavaScript needed).
    const spin = vase.locator('.turning-vase-spin');
    await expect(spin).toHaveCount(1);
    const animationName = await spin.evaluate((el) => getComputedStyle(el).animationName);
    expect(animationName).toBe('turning-vase-spin');

    // The flat figure (VaseFigure has no test id; its viewBox is unique) is not in the hero.
    await expect(hero.locator('svg[viewBox="8 6 24 27.6"]')).toHaveCount(0);
  });
}
