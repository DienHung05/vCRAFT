// GH#301 measurement helpers: spacing truth from the live DOM (no guessing from screenshots).

import { chromium } from '@playwright/test';
import { PUBLIC_ROUTES } from './public-routes.mjs';

const base = 'http://localhost:3000';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });

const PAGES = PUBLIC_ROUTES.map((r) => r.path);

for (const path of PAGES) {
  await p.goto(base + path, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
  const m = await p.evaluate(() => {
    const footer = document.querySelector('footer');
    const main = document.querySelector('main');
    const lastMain = main?.lastElementChild;
    const fRect = footer?.getBoundingClientRect();
    const lRect = lastMain?.getBoundingClientRect();
    // Last section's own bottom padding
    const lastPad = lastMain ? getComputedStyle(lastMain).paddingBottom : null;
    return {
      path: location.pathname,
      pageHeight: document.body.scrollHeight,
      footerGap: fRect && lRect ? Math.round(fRect.top - lRect.bottom) : null,
      lastSectionPadBottom: lastPad,
    };
  });
  console.log(JSON.stringify(m));
}
await b.close();
