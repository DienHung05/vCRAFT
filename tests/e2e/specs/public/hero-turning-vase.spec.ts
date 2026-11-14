import { expect, type Page, test } from '@playwright/test';

/**
 * GH#316: the home hero shows a turning vase from first paint on devices that cannot run the 3D vase,
 * and the flat hand-drawn `VaseFigure` never appears there. GH#527: where the 3D vase can run, the SVG
 * story never shows; the WebGL vase is the only one (or the SVG comes back if 3D fails to start).
 */
async function expectTurningSvg(page: Page) {
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
}

test('hero shows the turning vase on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/vi');
  await expectTurningSvg(page);
});

test('hero shows the turning vase on desktop with reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/vi');
  await expect(page.locator('html')).not.toHaveAttribute('data-hero-3d');
  await expectTurningSvg(page);
});

test('desktop never shows the SVG story and the 3D vase together', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/vi');
  const hero = page.locator('#home-hero');
  const vase = hero.getByTestId('turning-vase');
  const flagged = await page.locator('html').evaluate((el) => el.hasAttribute('data-hero-3d'));
  if (!flagged) {
    // This browser cannot run 3D: the SVG is the hero, as on phones.
    await expectTurningSvg(page);
    return;
  }
  // Hidden from first paint, before any JavaScript ran.
  await expect(vase).toBeHidden();
  // Then either the 3D vase is drawn, or 3D failed and the SVG came back; never both.
  await expect
    .poll(
      async () => {
        const svgVisible = await vase.isVisible();
        const canvas = hero.getByTestId('hero-vase-3d');
        const canvasShown =
          (await canvas.count()) > 0 &&
          (await canvas.evaluate((el) => getComputedStyle(el).opacity === '1'));
        if (svgVisible && canvasShown) return 'both';
        if (svgVisible) return 'svg';
        if (canvasShown) return '3d';
        return 'pending';
      },
      { timeout: 15_000 },
    )
    .toMatch(/^(svg|3d)$/);
});
