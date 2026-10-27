import { SealMark } from '@vcraft/ui';

export interface MiniMapPin {
  id: string;
  /** Vị trí theo % khung. */
  x: number;
  y: number;
  open: boolean;
  label: string;
}

export interface VillageMiniMapProps {
  label: string;
  pins: readonly MiniMapPin[];
  /** Ghim cần nhấn mạnh (vd. xưởng của sản phẩm đang xem). */
  highlight?: string;
  className?: string;
}

/**
 * Bản đồ thu nhỏ vẽ tay theo style BRAND §9 (nền giấy, sông men lam nhạt, đường mực mảnh, ghim ấn).
 * Chỉ để định hướng; bản đồ tương tác MapLibre nằm ở trang /ban-do (FR-MAP).
 * Ghim xưởng đang mở có vòng sóng men ngọc (BRAND §6.3 #7), tắt khi giảm chuyển động.
 */
export function VillageMiniMap({ label, pins, highlight, className }: VillageMiniMapProps) {
  return (
    <figure
      aria-label={label}
      className={`grain relative m-0 aspect-[4/3] overflow-hidden rounded-card bg-paper text-ink shadow-warm ${className ?? ''}`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 400 300"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 size-full"
      >
        {/* Sông Hồng */}
        <path
          d="M-10 40 C80 60 120 20 210 48 S340 110 410 70 L410 0 L-10 0 Z"
          fill="color-mix(in oklch, var(--color-glaze) 16%, var(--color-paper))"
        />
        <path
          d="M-10 40 C80 60 120 20 210 48 S340 110 410 70"
          fill="none"
          stroke="var(--color-glaze)"
          strokeOpacity="0.35"
          strokeWidth="1"
        />
        {/* Đường làng */}
        <g fill="none" stroke="var(--color-ink)" strokeOpacity="0.28" strokeLinecap="round">
          <path d="M20 120 C110 112 190 140 260 128 S360 150 390 140" strokeWidth="2.2" />
          <path d="M150 60 C160 130 140 200 170 290" strokeWidth="1.4" />
          <path d="M270 70 C255 140 300 210 290 290" strokeWidth="1.4" />
          <path d="M40 220 C120 210 220 236 380 214" strokeWidth="1.2" strokeDasharray="3 4" />
        </g>
        {/* Khối nhà */}
        <g fill="var(--color-clay)" fillOpacity="0.12">
          <rect x="60" y="140" width="60" height="40" rx="3" />
          <rect x="190" y="150" width="70" height="44" rx="3" />
          <rect x="300" y="160" width="60" height="38" rx="3" />
          <rect x="90" y="236" width="70" height="36" rx="3" />
          <rect x="220" y="80" width="40" height="30" rx="3" />
        </g>
      </svg>
      <ul className="absolute inset-0">
        {pins.map((p) => (
          <li
            key={p.id}
            className="absolute -translate-x-1/2 -translate-y-full"
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
          >
            <span className="relative flex flex-col items-center">
              {p.open ? (
                <span
                  aria-hidden="true"
                  className="absolute top-1 size-7 animate-ping rounded-full bg-celadon/40 [animation-duration:2.4s] motion-reduce:hidden"
                />
              ) : null}
              <SealMark
                size={p.id === highlight ? 34 : 26}
                variant={p.open ? 'seal' : 'ink'}
                bleed={false}
                className={p.open ? '' : 'opacity-50'}
              />
              <span className="mt-1 rounded-chip bg-paper/90 px-2 text-[0.7rem] leading-5 whitespace-nowrap shadow-warm">
                {p.label}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
