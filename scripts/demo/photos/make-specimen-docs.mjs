#!/usr/bin/env node
/**
 * Vẽ cục bộ ba giấy tờ xác minh MẪU cho hộ chờ duyệt "Gốm Bảo Châu" (packages/database/src/seeders/demo/verification-docs.ts):
 * toàn số liệu và tên giả, đóng dấu chéo "MẪU – KHÔNG CÓ GIÁ TRỊ". Không dùng giấy tờ thật của bất kỳ ai.
 *
 * Dùng: node scripts/demo/photos/make-specimen-docs.mjs
 * Ghi vào scripts/demo/photos/specimen-docs/<id>.png (đã commit; chạy lại chỉ khi muốn đổi hình).
 * Cần phông có chữ Việt trong hệ thống (macOS/Linux thông dụng đều có Arial hoặc DejaVu Sans).
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const sharp = createRequire(path.join(root, 'apps/worker/package.json'))('sharp');
const outDir = path.join(here, 'specimen-docs');
fs.mkdirSync(outDir, { recursive: true });

const W = 1200;
const H = 800;
const FONT = 'font-family="Arial, \'DejaVu Sans\', Helvetica, sans-serif"';
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

const text = (x, y, size, content, extra = '') =>
  `<text x="${x}" y="${y}" font-size="${size}" ${FONT} fill="#2b2b2b" ${extra}>${esc(content)}</text>`;
const line = (x1, y1, x2, y2) =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#b9b4aa" stroke-width="2"/>`;

/** Dấu chéo to, hai dải lặp để không thể cắt ra dùng như giấy thật. */
const stamp = `
  <g transform="rotate(-22 ${W / 2} ${H / 2})" fill="none" stroke="#b3261e" stroke-opacity="0.78" stroke-width="6">
    <rect x="${W / 2 - 470}" y="${H / 2 - 62}" width="940" height="124" rx="14"/>
    <text x="${W / 2}" y="${H / 2 + 26}" font-size="72" font-weight="700" text-anchor="middle" ${FONT} fill="#b3261e" fill-opacity="0.78" stroke="none">MẪU – KHÔNG CÓ GIÁ TRỊ</text>
  </g>
  <text x="${W / 2}" y="${H - 24}" font-size="22" text-anchor="middle" ${FONT} fill="#8a1c15">Bản mẫu trình diễn vCraft: dữ liệu hư cấu, không phải giấy tờ thật</text>`;

const docs = {
  'cccd-mau': `
    <rect width="${W}" height="${H}" fill="#e8efe6"/>
    <rect x="40" y="40" width="${W - 80}" height="${H - 80}" rx="28" fill="#f6faf3" stroke="#9db59a" stroke-width="4"/>
    ${text(80, 110, 30, 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM (BẢN MẪU)', 'font-weight="700"')}
    ${text(80, 150, 26, 'CĂN CƯỚC CÔNG DÂN MẪU')}
    <rect x="80" y="200" width="260" height="340" rx="10" fill="#d4dccf" stroke="#9db59a" stroke-width="3"/>
    <circle cx="210" cy="320" r="62" fill="#b9c5b4"/>
    <rect x="130" y="400" width="160" height="110" rx="55" fill="#b9c5b4"/>
    ${text(380, 250, 28, 'Số: 000 000 000 000')}
    ${text(380, 305, 28, 'Họ và tên: KIỀU BẢO CHÂU (HƯ CẤU)')}
    ${text(380, 360, 28, 'Ngày sinh: 01/01/1990 (GIẢ)')}
    ${text(380, 415, 28, 'Giới tính: Nữ     Quốc tịch: Việt Nam')}
    ${text(380, 470, 28, 'Nơi thường trú: Bát Tràng, Gia Lâm, Hà Nội (GIẢ)')}
    ${line(380, 500, 1120, 500)}
    ${text(380, 560, 24, 'Có giá trị đến: 01/01/2099 (GIẢ)')}
    ${stamp}`,
  'cu-tru-mau': `
    <rect width="${W}" height="${H}" fill="#f4efe4"/>
    <rect x="40" y="40" width="${W - 80}" height="${H - 80}" fill="#fffdf7" stroke="#cdbf9d" stroke-width="3"/>
    ${text(W / 2, 120, 30, 'UỶ BAN NHÂN DÂN XÃ BÁT TRÀNG (BẢN MẪU)', 'text-anchor="middle" font-weight="700"')}
    ${text(W / 2, 175, 38, 'GIẤY XÁC NHẬN CƯ TRÚ MẪU', 'text-anchor="middle" font-weight="700"')}
    ${text(100, 260, 28, 'Xác nhận ông/bà: KIỀU BẢO CHÂU (nhân vật hư cấu)')}
    ${text(100, 315, 28, 'Hiện cư trú tại: Xóm 3, thôn Giang Cao, Bát Tràng, Gia Lâm, Hà Nội (GIẢ)')}
    ${text(100, 370, 28, 'Thời gian cư trú: từ năm 2000 đến nay (GIẢ)')}
    ${text(100, 425, 28, 'Mục đích: bổ sung hồ sơ hộ sản xuất trên nền tảng vCraft (TRÌNH DIỄN)')}
    ${line(100, 470, 1100, 470)}
    ${text(100, 530, 24, 'Số hiệu: 00/XN-MẪU          Ngày cấp: 01/01/2026 (GIẢ)')}
    ${text(760, 620, 26, 'TM. UỶ BAN NHÂN DÂN (GIẢ)', 'font-weight="700"')}
    ${text(800, 665, 22, '(chữ ký và dấu: không có)')}
    ${stamp}`,
  'xuong-mau': `
    <rect width="${W}" height="${H}" fill="#dfe8ee"/>
    <rect y="520" width="${W}" height="280" fill="#c9b9a1"/>
    <polygon points="140,520 140,300 600,150 1060,300 1060,520" fill="#b86a4a"/>
    <polygon points="110,300 600,120 1090,300 1040,330 600,180 160,330" fill="#8f4a31"/>
    <rect x="260" y="360" width="190" height="160" fill="#f4e6cf" stroke="#6b3b28" stroke-width="5"/>
    <rect x="740" y="360" width="190" height="160" fill="#f4e6cf" stroke="#6b3b28" stroke-width="5"/>
    <rect x="520" y="380" width="160" height="140" rx="8" fill="#5e3a2a"/>
    <ellipse cx="350" cy="640" rx="70" ry="38" fill="#e9dfc9" stroke="#6b3b28" stroke-width="4"/>
    <ellipse cx="540" cy="680" rx="55" ry="30" fill="#e9dfc9" stroke="#6b3b28" stroke-width="4"/>
    <ellipse cx="860" cy="650" rx="80" ry="42" fill="#e9dfc9" stroke="#6b3b28" stroke-width="4"/>
    ${text(80, 90, 32, 'Hình vẽ minh họa xưởng gốm (KHÔNG PHẢI ẢNH THẬT)', 'font-weight="700"')}
    ${stamp}`,
};

for (const [id, body] of Object.entries(docs)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${body}</svg>`;
  const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
  fs.writeFileSync(path.join(outDir, `${id}.png`), png);
  console.log(id, `${(png.length / 1024).toFixed(0)} KB`);
}
