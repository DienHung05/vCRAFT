#!/usr/bin/env node
/**
 * Draws the site's browser and share assets from the brand mark (apps/web/src/app/icon.svg) and the colour
 * tokens of packages/ui, with no photo and nothing downloaded:
 *   apps/web/src/app/favicon.ico                    16/32/48 px PNG frames in one ICO
 *   apps/web/src/app/apple-icon.png                 180 px iOS home-screen icon
 *   apps/web/src/app/[locale]/opengraph-image.png    1200x630 brand card (also twitter-image.png; beside the layout so its metadata does not override them)
 *   apps/web/public/brand/icon-{192,512}.png        web manifest icons
 *   apps/web/public/brand/icon-maskable-512.png     maskable manifest icon (mark inside the safe zone)
 *
 * Run: node scripts/brand/make-site-assets.mjs   (Next picks the files up by its metadata file conventions)
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const require = createRequire(path.join(root, 'apps/worker/package.json'));
const sharp = require('sharp');

const appDir = path.join(root, 'apps/web/src/app');
const brandDir = path.join(root, 'apps/web/public/brand');
fs.mkdirSync(brandDir, { recursive: true });

// Colour tokens (packages/ui/src/tokens/theme.css).
const PAPER = '#f5efe4';
const INK = '#1c1814';
const GLAZE = '#1e3a6e';
const SEAL = '#c2261c';

const mark = fs.readFileSync(path.join(appDir, 'icon.svg'));
const markPng = (size) =>
  sharp(mark, { density: Math.ceil((size / 40) * 72 * 2) })
    .resize(size, size)
    .png()
    .toBuffer();

/** Mark centred on a paper square; `inset` is the share of the side kept free around it. */
async function tile(size, inset) {
  const inner = Math.round(size * (1 - inset * 2));
  return sharp({ create: { width: size, height: size, channels: 4, background: PAPER } })
    .composite([
      {
        input: await markPng(inner),
        left: Math.round((size - inner) / 2),
        top: Math.round((size - inner) / 2),
      },
    ])
    .png()
    .toBuffer();
}

/** ICO container with PNG frames (supported by every current browser). */
function ico(frames) {
  const head = Buffer.alloc(6);
  head.writeUInt16LE(0, 0);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(frames.length, 4);
  let offset = 6 + frames.length * 16;
  const entries = frames.map(({ size, data }) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    return e;
  });
  return Buffer.concat([head, ...entries, ...frames.map((f) => f.data)]);
}

const frames = [];
for (const size of [16, 32, 48])
  frames.push({
    size,
    data: await sharp(await markPng(size))
      .png()
      .toBuffer(),
  });
fs.writeFileSync(path.join(appDir, 'favicon.ico'), ico(frames));

fs.writeFileSync(path.join(appDir, 'apple-icon.png'), await tile(180, 0.12));
fs.writeFileSync(path.join(brandDir, 'icon-192.png'), await tile(192, 0.08));
fs.writeFileSync(path.join(brandDir, 'icon-512.png'), await tile(512, 0.08));
fs.writeFileSync(path.join(brandDir, 'icon-maskable-512.png'), await tile(512, 0.2));

// Brand card for link previews: mark, wordmark, tagline and the blue wave of the seal. Text is drawn with
// system fonts when this script runs; the PNG is committed, so what you see is what ships.
const W = 1200;
const H = 630;
const wave = (y, amp, len, start, end) => {
  let d = `M${start} ${y}`;
  for (let x = start; x < end; x += len) d += ` q${len / 4} ${-amp} ${len / 2} 0 t${len / 2} 0`;
  return d;
};
const card =
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${PAPER}"/>
  <path d="${wave(540, 14, 56, 80, 1120)}" fill="none" stroke="${GLAZE}" stroke-width="5" stroke-linecap="round"/>
  <text x="470" y="290" font-family="Georgia, 'Times New Roman', serif" font-size="150" font-weight="600" fill="${GLAZE}">vCraft</text>
  <text x="474" y="372" font-family="'Helvetica Neue', Arial, sans-serif" font-size="33" fill="${INK}">Tinh hoa làng nghề, muôn phương lan tỏa</text>
  <text x="474" y="430" font-family="'Helvetica Neue', Arial, sans-serif" font-size="28" fill="${INK}" fill-opacity="0.7">Gốm Bát Tràng · truy xuất nguồn gốc</text>
  <rect x="474" y="478" width="86" height="5" rx="2.5" fill="${SEAL}"/>
</svg>`);
const og = await sharp(card)
  .composite([{ input: await markPng(300), left: 110, top: 150 }])
  .png({ compressionLevel: 9 })
  .toBuffer();
const shareDir = path.join(appDir, '[locale]');
fs.writeFileSync(path.join(shareDir, 'opengraph-image.png'), og);
fs.writeFileSync(path.join(shareDir, 'twitter-image.png'), og);
console.log('site assets written');
