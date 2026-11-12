#!/usr/bin/env node
/**
 * Vẽ cục bộ con dấu của hộ demo "Lò Đức Phát" (packages/database/src/seeders/demo/profile-depth.ts): một dấu đỏ vuông
 * với tên hộ, vẽ bằng SVG, không dùng ảnh của ai nên không cần ghi công bên thứ ba (CC0).
 *
 * Dùng: node scripts/demo/photos/make-household-seal.mjs
 * Ghi vào apps/web/public/images/demo/con-dau-duc-phat-1280.webp (đã commit; chạy lại chỉ khi muốn đổi hình).
 * Cần phông có chữ Việt trong hệ thống (macOS/Linux thông dụng đều có Arial hoặc DejaVu Sans).
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const sharp = createRequire(path.join(root, 'apps/worker/package.json'))('sharp');
const outFile = path.join(root, 'apps/web/public/images/demo/con-dau-duc-phat-1280.webp');

const S = 1280;
const INK = '#b3261e';
const FONT =
  'font-family="\'Times New Roman\', Georgia, \'DejaVu Serif\', serif" font-weight="700"';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  <defs>
    <filter id="ink" x="-5%" y="-5%" width="110%" height="110%">
      <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="11" result="noise"/>
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="9" xChannelSelector="R" yChannelSelector="G" result="wobble"/>
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4" result="grain"/>
      <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.4 1.75" result="holes"/>
      <feComposite in="wobble" in2="holes" operator="in"/>
    </filter>
  </defs>
  <rect width="${S}" height="${S}" fill="#f6f1e6"/>
  <g filter="url(#ink)" fill="none" stroke="${INK}">
    <rect x="190" y="190" width="900" height="900" rx="26" stroke-width="30"/>
    <rect x="248" y="248" width="784" height="784" rx="10" stroke-width="9"/>
    <text x="640" y="560" font-size="250" text-anchor="middle" ${FONT} fill="${INK}" stroke="none">ĐỨC</text>
    <text x="640" y="805" font-size="250" text-anchor="middle" ${FONT} fill="${INK}" stroke="none">PHÁT</text>
    <line x1="330" y1="868" x2="950" y2="868" stroke-width="7"/>
    <text x="640" y="958" font-size="56" text-anchor="middle" ${FONT} fill="${INK}" stroke="none" letter-spacing="5">LÒ GỐM BÁT TRÀNG</text>
  </g>
</svg>`;

fs.mkdirSync(path.dirname(outFile), { recursive: true });
await sharp(Buffer.from(svg)).webp({ quality: 85 }).toFile(outFile);
console.log(`đã ghi ${path.relative(root, outFile)}`);
