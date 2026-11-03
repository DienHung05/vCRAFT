import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';

/** Open Graph card size (1.91:1), shared by every dynamic `opengraph-image`/`twitter-image`. */
export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = 'image/png';

// Light "Giấy dó" palette from packages/ui/src/tokens/theme.css; satori cannot read CSS variables.
const PAPER = '#f5efe4';
const INK = '#1c1814';
const ASH = '#6b635a';
const CLAY = '#a8482a';
const GLAZE = '#1e3a6e';

/*
 * The bundled Geist face has no Vietnamese diacritics, so the card ships Be Vietnam Pro (SIL OFL 1.1,
 * `assets/og/OFL.txt`) as static TTFs: satori reads neither woff2 nor variable fonts. `process.cwd()` plus a
 * literal path is what Next's file tracer follows into the deployed function.
 */
let assets: Promise<{ regular: Buffer; semibold: Buffer; seal: string }> | null = null;
function loadAssets() {
  assets ??= Promise.all([
    readFile(join(process.cwd(), 'assets/og/BeVietnamPro-Regular.ttf')),
    readFile(join(process.cwd(), 'assets/og/BeVietnamPro-SemiBold.ttf')),
    readFile(join(process.cwd(), 'public/brand/icon-192.png')),
  ]).then(([regular, semibold, seal]) => ({
    regular,
    semibold,
    seal: `data:image/png;base64,${seal.toString('base64')}`,
  }));
  return assets;
}

export interface OgCardContent {
  /** Small caps line above the title: the page type ("Sản phẩm", "News"). */
  eyebrow: string;
  title: string;
  /** One line under the title (household, summary); trimmed to fit. */
  subtitle?: string | null | undefined;
}

function clip(text: string, max: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}

/** A typographic share card on washi paper: seal, eyebrow, title, subtitle, wordmark and slogan. */
export async function renderOgCard({ eyebrow, title, subtitle }: OgCardContent) {
  const { regular, semibold, seal } = await loadAssets();
  const heading = clip(title, 90);
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '72px 80px',
        background: PAPER,
        color: INK,
        fontFamily: 'Be Vietnam Pro',
        borderBottom: `16px solid ${GLAZE}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        {/* biome-ignore lint/performance/noImgElement: satori renders plain <img>, not next/image. */}
        <img src={seal} width={64} height={64} alt="" />
        <span style={{ fontSize: 28, letterSpacing: 4, textTransform: 'uppercase', color: CLAY }}>
          {clip(eyebrow, 40)}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div
          style={{
            fontSize: heading.length > 50 ? 60 : 76,
            fontWeight: 600,
            lineHeight: 1.12,
            color: GLAZE,
          }}
        >
          {heading}
        </div>
        {subtitle ? (
          <div style={{ fontSize: 32, lineHeight: 1.4, color: ASH }}>{clip(subtitle, 110)}</div>
        ) : null}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 26, color: ASH }}>
        <span style={{ fontWeight: 600, color: INK }}>vCraft</span>
        <span>Tinh hoa làng nghề, muôn phương lan tỏa</span>
      </div>
    </div>,
    {
      ...OG_SIZE,
      fonts: [
        { name: 'Be Vietnam Pro', data: regular, weight: 400, style: 'normal' },
        { name: 'Be Vietnam Pro', data: semibold, weight: 600, style: 'normal' },
      ],
    },
  );
}
