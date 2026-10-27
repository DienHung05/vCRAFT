import { useId } from 'react';
import { cn } from '../lib/cn';
import {
  SEAL_BAND_PATH,
  SEAL_BAND_STROKE,
  SEAL_PATH,
  SEAL_VASE_PATH,
  SEAL_VIEWBOX,
} from './seal-geometry';

export type SealVariant = 'seal' | 'ink' | 'inverse';

/** Màu nền của ấn theo biến thể; token đổi theo chế độ sáng/tối. */
const FILL: Record<SealVariant, string> = {
  /** Đầy đủ: son triện. Chỉ dùng cho khoảnh khắc xác thực (BRAND §3.1). */
  seal: 'var(--color-seal)',
  /** Đơn sắc mực, dùng để in tem. */
  ink: 'var(--color-ink)',
  /** Đảo màu, đặt trên khối tối như `bg-ink`, `bg-glaze` (hình bình để lộ nền khối). */
  inverse: 'var(--color-paper)',
};

export interface SealMarkProps {
  /** Cạnh ấn, px. Tối thiểu 20px trên màn hình (BRAND §2). Mặc định 40. */
  size?: number;
  /** Có `title` ⇒ `role="img"` + `aria-label`; không có ⇒ trang trí (`aria-hidden`). */
  title?: string;
  variant?: SealVariant;
  /** Vết mực loang ở viền (feTurbulence + feDisplacementMap). Mặc định bật. */
  bleed?: boolean;
  className?: string;
}

/** Bỏ ký tự làm hỏng `url(#id)`: `useId` của React có thể chứa `:` hoặc `«»`. */
function safeId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '');
}

/**
 * Logomark "Ấn bình" (BRAND §2): ấn vuông bo góc không đều, bình gốm dáng tỏi âm bản
 * với dải sóng hoa lam ngang bụng.
 */
export function SealMark({
  size = 40,
  title,
  variant = 'seal',
  bleed = true,
  className,
}: SealMarkProps) {
  const uid = safeId(useId());
  const maskId = `seal-mask-${uid}`;
  const filterId = `seal-bleed-${uid}`;
  const labelled = title !== undefined && title !== '';

  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: nhãn truy cập được gán theo prop `title` (role=img) hoặc ẩn (aria-hidden)
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${SEAL_VIEWBOX} ${SEAL_VIEWBOX}`}
      width={size}
      height={size}
      className={cn('inline-block shrink-0', className)}
      {...(labelled
        ? { role: 'img', 'aria-label': title }
        : { 'aria-hidden': true, focusable: false })}
    >
      {labelled ? <title>{title}</title> : null}
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="40" height="40">
          <rect width="40" height="40" fill="white" />
          <path d={SEAL_VASE_PATH} fill="black" />
          <path
            d={SEAL_BAND_PATH}
            fill="none"
            stroke="white"
            strokeWidth={SEAL_BAND_STROKE}
            strokeLinecap="round"
          />
        </mask>
        {bleed ? (
          <filter
            id={filterId}
            filterUnits="userSpaceOnUse"
            x="-2"
            y="-2"
            width="44"
            height="44"
            colorInterpolationFilters="sRGB"
          >
            {/* Viền rung nhẹ như mực loang ra thớ giấy. */}
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.06"
              numOctaves="2"
              seed="7"
              result="warp"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="warp"
              scale="1.4"
              xChannelSelector="R"
              yChannelSelector="G"
              result="rough"
            />
            {/* Vài lỗ li ti nơi mực không bám. */}
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.9"
              numOctaves="1"
              seed="3"
              result="speck"
            />
            <feColorMatrix
              in="speck"
              type="matrix"
              values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -12 8.68"
              result="holes"
            />
            <feComposite in="rough" in2="holes" operator="in" />
          </filter>
        ) : null}
      </defs>
      <g filter={bleed ? `url(#${filterId})` : undefined}>
        <path d={SEAL_PATH} fill={FILL[variant]} mask={`url(#${maskId})`} />
      </g>
    </svg>
  );
}
