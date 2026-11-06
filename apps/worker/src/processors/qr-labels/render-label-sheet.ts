import { PDFDocument, type PDFPage, rgb, StandardFonts } from 'pdf-lib';
import QRCode from 'qrcode';

const MM = 72 / 25.4;

/** A4 portrait in points. */
const PAGE = { width: 210 * MM, height: 297 * MM };
/** 5 × 9 labels of 38 × 30 mm on a 10 mm / 13.5 mm margin: the QR itself prints at 20 mm (PLAN E6). */
export const LABEL_GRID = { columns: 5, rows: 9 } as const;
export const LABELS_PER_PAGE = LABEL_GRID.columns * LABEL_GRID.rows;
const CELL = { width: 38 * MM, height: 30 * MM };
const MARGIN = { x: 10 * MM, y: 13.5 * MM };
export const QR_SIZE_MM = 20;
const QR_SIZE = QR_SIZE_MM * MM;
// Brand colours from packages/ui tokens: ink for the code (scanners need dark on light), clay for the mark.
const INK = rgb(0x1c / 255, 0x18 / 255, 0x14 / 255);
const CLAY = rgb(0xa8 / 255, 0x48 / 255, 0x2a / 255);
const GUIDE = rgb(0.85, 0.83, 0.8);

export interface LabelSheetInput {
  /** Trace codes, one label each, in order. */
  codes: readonly string[];
  /** Site origin; each QR encodes `<origin>/q/<code>`. */
  origin: string;
}

/** The short URL a label's QR encodes, the same one the web prints (`traceShortUrl`). */
export function labelUrl(origin: string, code: string): string {
  return `${origin.replace(/\/+$/, '')}/q/${encodeURIComponent(code)}`;
}

/**
 * Draws a QR as vector squares, so it stays sharp at 20 mm on any printer. Error correction M keeps the
 * symbol at version 3–4 for a ~45-character URL, i.e. modules of ~0.6 mm.
 */
function drawQr(page: PDFPage, text: string, x: number, y: number, size: number) {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
  const count = qr.modules.size;
  const module = size / count;
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (!qr.modules.get(row, col)) continue;
      page.drawRectangle({
        x: x + col * module,
        // PDF y grows upwards; QR rows go down.
        y: y + size - (row + 1) * module,
        width: module,
        height: module,
        color: INK,
      });
    }
  }
}

/**
 * An A4 sheet (or several) of QR labels for printing and sticking on pieces (FR-TRC, PLAN E6): each cell
 * has the QR for `/q/<code>`, the code in monospace under it and the vCraft mark, with light cut guides.
 * Codes are ASCII, so the standard PDF fonts suffice.
 */
export async function renderLabelSheet({ codes, origin }: LabelSheetInput): Promise<Uint8Array> {
  if (codes.length === 0) throw new Error('no labels to render');
  const pdf = await PDFDocument.create();
  pdf.setTitle('vCraft QR labels');
  pdf.setCreator('vCraft');
  const mono = await pdf.embedFont(StandardFonts.CourierBold);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page: PDFPage | undefined;
  codes.forEach((code, index) => {
    const slot = index % LABELS_PER_PAGE;
    if (slot === 0) page = pdf.addPage([PAGE.width, PAGE.height]);
    if (!page) return;
    const column = slot % LABEL_GRID.columns;
    const row = Math.floor(slot / LABEL_GRID.columns);
    const left = MARGIN.x + column * CELL.width;
    const top = PAGE.height - MARGIN.y - row * CELL.height;

    page.drawRectangle({
      x: left,
      y: top - CELL.height,
      width: CELL.width,
      height: CELL.height,
      borderColor: GUIDE,
      borderWidth: 0.4,
    });
    const qrX = left + (CELL.width - QR_SIZE) / 2;
    const qrY = top - 2 * MM - QR_SIZE;
    drawQr(page, labelUrl(origin, code), qrX, qrY, QR_SIZE);

    const codeSize = 7.5;
    const codeWidth = mono.widthOfTextAtSize(code, codeSize);
    page.drawText(code, {
      x: left + (CELL.width - codeWidth) / 2,
      y: qrY - 3.2 * MM,
      size: codeSize,
      font: mono,
      color: INK,
    });
    const mark = 'vCraft';
    const markSize = 5.5;
    page.drawText(mark, {
      x: left + (CELL.width - bold.widthOfTextAtSize(mark, markSize)) / 2,
      y: qrY - 5.6 * MM,
      size: markSize,
      font: bold,
      color: CLAY,
    });
  });
  return pdf.save();
}
