'use client';

import { SealMark } from '@vcraft/ui';
import { useTranslations } from 'next-intl';
import { type ComponentProps, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from '@/i18n/navigation';
import type { PinStatus } from './map-model';
import { LABEL_GAP, layoutMiniMap, type PlacedPin } from './mini-map-layout';

/** What a tapped pin shows (GH#216): a title, a few short lines, its status and one link. */
export interface MiniMapCard {
  title: string;
  lines: readonly string[];
  status?: PinStatus;
  link?: { href: ComponentProps<typeof Link>['href']; label: string };
}

export interface MiniMapPin {
  id: string;
  /** Vị trí theo % khung. */
  x: number;
  y: number;
  open: boolean;
  label: string;
  /** With a card the pin is a button that opens it; without one the pin is only a mark. */
  card?: MiniMapCard;
}

const STATUS_KEY = {
  open: 'legendOpen',
  closed: 'legendClosed',
  production: 'legendProduction',
} as const;

const PIN_SIZE = 26;
const HIGHLIGHT_SIZE = 34;

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
 * Sau khi đo khung và nhãn, ghim gần nhau được đẩy ra và nhãn chọn phía (dưới, trên, phải, trái) để
 * không đè lên ghim hay nhãn khác (vCRAFT-83g.46); trước đó (SSR) nhãn nằm dưới ghim.
 */
export function VillageMiniMap({ label, pins, highlight, className }: VillageMiniMapProps) {
  const t = useTranslations('villageMap');
  const figure = useRef<HTMLElement>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  // Esc closes the open card; a tap outside the map does too.
  useEffect(() => {
    if (!openId) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenId(null);
    };
    const onPointer = (event: PointerEvent) => {
      if (!figure.current?.contains(event.target as Node)) setOpenId(null);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointer);
    };
  }, [openId]);
  const [placement, setPlacement] = useState<{
    key: string;
    pins: Map<string, PlacedPin>;
  } | null>(null);

  useLayoutEffect(() => {
    const el = figure.current;
    if (!el) return;
    let cancelled = false;
    const measure = () => {
      if (cancelled) return;
      const width = el.clientWidth;
      const height = el.clientHeight;
      if (width === 0 || height === 0) return;
      const widths = new Map<string, number>();
      for (const node of el.querySelectorAll<HTMLElement>('[data-pin-label]')) {
        widths.set(node.dataset.pinLabel ?? '', node.offsetWidth);
      }
      const input = pins.map((p) => ({
        id: p.id,
        x: p.x,
        y: p.y,
        size: p.id === highlight ? HIGHLIGHT_SIZE : PIN_SIZE,
        labelWidth: widths.get(p.id) ?? 0,
      }));
      const key = JSON.stringify([width, height, input]);
      setPlacement((prev) =>
        prev?.key === key ? prev : { key, pins: layoutMiniMap(input, { width, height }) },
      );
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(el);
    // Label widths change once the web font has loaded.
    void document.fonts?.ready.then(measure);
    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, [pins, highlight]);

  return (
    <figure
      ref={figure}
      aria-label={label}
      className={`grain relative m-0 aspect-[4/3] rounded-card bg-paper text-ink shadow-warm ${className ?? ''}`}
    >
      {/* Only the drawing is clipped, so an info card near the edge can overflow the frame (GH#216). */}
      <svg
        aria-hidden="true"
        viewBox="0 0 400 300"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 size-full overflow-hidden rounded-card"
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
        {pins.map((p) => {
          const size = p.id === highlight ? HIGHLIGHT_SIZE : PIN_SIZE;
          const placed = placement?.pins.get(p.id);
          const expanded = openId === p.id;
          const mark = (
            <>
              {p.open ? (
                <span
                  aria-hidden="true"
                  className="absolute size-7 animate-ping rounded-full bg-celadon/40 [animation-duration:2.4s] motion-reduce:hidden"
                />
              ) : null}
              <SealMark
                size={size}
                variant={p.open ? 'seal' : 'ink'}
                bleed={false}
                className={p.open ? '' : 'opacity-50'}
              />
            </>
          );
          return (
            <li
              key={p.id}
              className={`absolute size-0 ${expanded ? 'z-20' : ''}`}
              style={
                placed ? { left: placed.cx, top: placed.cy } : { left: `${p.x}%`, top: `${p.y}%` }
              }
            >
              {p.card ? (
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-label={t('pinButton', { name: p.card.title })}
                  onClick={() => setOpenId(expanded ? null : p.id)}
                  className="absolute top-0 left-0 grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-glaze motion-reduce:transition-none"
                >
                  {mark}
                </button>
              ) : (
                <span className="absolute top-0 left-0 grid -translate-x-1/2 -translate-y-1/2 place-items-center">
                  {mark}
                </span>
              )}
              <span
                data-pin-label={p.id}
                className="absolute rounded-chip bg-paper/90 px-2 text-[0.7rem] leading-5 whitespace-nowrap shadow-warm"
                style={
                  placed
                    ? { left: placed.labelLeft - placed.cx, top: placed.labelTop - placed.cy }
                    : { left: 0, top: size / 2 + LABEL_GAP, transform: 'translateX(-50%)' }
                }
              >
                {p.label}
              </span>
              {p.card && expanded ? <PinCard card={p.card} x={p.x} y={p.y} t={t} /> : null}
            </li>
          );
        })}
      </ul>
    </figure>
  );
}

/**
 * Small info card beside a tapped mini-map pin (GH#216). It opens below pins in the top half and above
 * pins in the bottom half, and leans away from the nearer side edge, so it stays over the map.
 */
function PinCard({
  card,
  x,
  y,
  t,
}: {
  card: MiniMapCard;
  x: number;
  y: number;
  t: ReturnType<typeof useTranslations<'villageMap'>>;
}) {
  const vertical = y < 50 ? 'top-6' : 'bottom-6';
  const horizontal = x < 35 ? '-left-4' : x > 65 ? '-right-4' : '-translate-x-1/2';
  return (
    // biome-ignore lint/a11y/useSemanticElements: a labelled group of text and one link, not a form fieldset.
    <div
      role="group"
      aria-label={card.title}
      className={`absolute ${vertical} ${horizontal} w-60 max-w-[70vw] rounded-card bg-surface p-3 text-left text-small shadow-warm ring-1 ring-ink/10`}
    >
      <p className="font-medium text-body leading-snug">{card.title}</p>
      {card.lines.map((line) => (
        <p key={line} className="text-ash">
          {line}
        </p>
      ))}
      {card.status ? (
        <p className={card.status === 'open' ? 'mt-1 font-medium text-glaze' : 'mt-1 text-ash'}>
          {t(STATUS_KEY[card.status])}
        </p>
      ) : null}
      {card.link ? (
        <Link
          href={card.link.href}
          className="mt-2 inline-flex min-h-11 items-center text-clay underline underline-offset-4"
        >
          {card.link.label}
        </Link>
      ) : null}
    </div>
  );
}
