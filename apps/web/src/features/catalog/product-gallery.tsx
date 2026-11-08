'use client';

import { useTranslations } from 'next-intl';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { GallerySlide } from './view-models';

const GalleryContext = createContext<((index: number) => void) | null>(null);

const ZOOM = 2.5;
const FOCUSABLE = 'button:not([disabled])';

/**
 * Photo gallery of a product (FR-CAT-05): wraps the page's photos and owns the lightbox they open. The
 * photos themselves are server-rendered children, each inside a `GalleryTrigger`.
 */
export function ProductGallery({
  slides,
  children,
}: {
  slides: readonly GallerySlide[];
  children: ReactNode;
}) {
  const [index, setIndex] = useState<number | null>(null);
  const open = useCallback((at: number) => setIndex(at), []);
  return (
    <GalleryContext.Provider value={open}>
      {children}
      {index !== null ? (
        <Lightbox slides={slides} start={index} onClose={() => setIndex(null)} />
      ) : null}
    </GalleryContext.Provider>
  );
}

/** A photo that opens the lightbox at slide `index`; a button, so Enter and Space work. */
export function GalleryTrigger({
  index,
  alt,
  children,
}: {
  index: number;
  alt: string;
  children: ReactNode;
}) {
  const t = useTranslations('product.lightbox');
  const open = useContext(GalleryContext);
  return (
    <button
      type="button"
      aria-label={t('open', { alt })}
      aria-haspopup="dialog"
      onClick={() => open?.(index)}
      className="block w-full cursor-zoom-in rounded-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-glaze"
    >
      {children}
    </button>
  );
}

function Lightbox({
  slides,
  start,
  onClose,
}: {
  slides: readonly GallerySlide[];
  start: number;
  onClose: () => void;
}) {
  const t = useTranslations('product.lightbox');
  const dialog = useRef<HTMLDialogElement>(null);
  const [current, setCurrent] = useState(start);
  // Zoom shows the photo at 2.5x around `origin` (percent of the photo); moving the pointer pans.
  const [zoomed, setZoomed] = useState(false);
  const [origin, setOrigin] = useState({ x: 50, y: 50 });
  const slide = slides[current];
  const many = slides.length > 1;

  // A native modal: inert page behind it and Esc support; focus goes back to the photo that opened it.
  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!el.open) el.showModal();
    el.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    return () => {
      if (el.open) el.close();
      opener?.focus();
    };
  }, []);

  const go = (step: number) => {
    setCurrent((at) => (at + step + slides.length) % slides.length);
    setZoomed(false);
  };

  const pan = (event: React.PointerEvent<HTMLElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return;
    setOrigin({
      x: Math.min(100, Math.max(0, ((event.clientX - box.left) / box.width) * 100)),
      y: Math.min(100, Math.max(0, ((event.clientY - box.top) / box.height) * 100)),
    });
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDialogElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    } else if (event.key === 'ArrowRight' && many) {
      event.preventDefault();
      go(1);
    } else if (event.key === 'ArrowLeft' && many) {
      event.preventDefault();
      go(-1);
    } else if (event.key === 'Tab') {
      const items = [...event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const first = items[0];
      const last = items.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  };

  if (!slide) return null;
  const buttonClass =
    'rounded-input bg-paper/90 px-3 py-2 text-small text-ink shadow-warm hover:bg-paper focus-visible:outline-2 focus-visible:outline-glaze';

  return (
    <dialog
      ref={dialog}
      aria-label={t('title')}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onKeyDown={onKeyDown}
      className="m-0 size-full max-h-none max-w-none bg-transparent p-0 text-ink backdrop:bg-ink/85"
    >
      {/* Clicking the dark margin closes; the photo and the buttons stop the click. */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: Esc and the Close button are the keyboard routes */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop click, see above */}
      <div
        className="relative flex size-full items-center justify-center p-4"
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <div className="absolute top-4 right-4 left-4 z-10 flex items-center justify-between gap-3">
          <p aria-live="polite" className="rounded-input bg-paper/90 px-3 py-2 text-small">
            {t('counter', { current: current + 1, total: slides.length })}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              aria-pressed={zoomed}
              onClick={() => setZoomed((z) => !z)}
              className={buttonClass}
            >
              {zoomed ? t('zoomOut') : t('zoomIn')}
            </button>
            <button type="button" data-autofocus onClick={onClose} className={buttonClass}>
              {t('close')}
            </button>
          </div>
        </div>
        {many ? (
          <>
            <button
              type="button"
              aria-label={t('previous')}
              onClick={() => go(-1)}
              className={`${buttonClass} absolute top-1/2 left-4 z-10 -translate-y-1/2`}
            >
              ‹
            </button>
            <button
              type="button"
              aria-label={t('next')}
              onClick={() => go(1)}
              className={`${buttonClass} absolute top-1/2 right-4 z-10 -translate-y-1/2`}
            >
              ›
            </button>
          </>
        ) : null}
        <div
          className="flex max-h-full max-w-full items-center justify-center overflow-hidden rounded-card"
          // While zoomed the pointer pans the photo, so the browser must not scroll or pinch the page.
          style={{ touchAction: zoomed ? 'none' : 'manipulation' }}
          onPointerMove={zoomed ? pan : undefined}
        >
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: the zoom button is the keyboard route */}
          {/* biome-ignore lint/performance/noImgElement: the photo is already a sized WebP from our storage */}
          <img
            src={slide.src}
            alt={slide.alt}
            draggable={false}
            onClick={(event) => {
              if (!zoomed) {
                const box = event.currentTarget.getBoundingClientRect();
                if (box.width > 0 && box.height > 0) {
                  setOrigin({
                    x: ((event.clientX - box.left) / box.width) * 100,
                    y: ((event.clientY - box.top) / box.height) * 100,
                  });
                }
              }
              setZoomed((z) => !z);
            }}
            className="max-h-[calc(100svh-2rem)] max-w-[calc(100vw-2rem)] object-contain transition-transform duration-200 motion-reduce:transition-none"
            style={{
              transform: zoomed ? `scale(${ZOOM})` : 'none',
              transformOrigin: `${origin.x}% ${origin.y}%`,
              cursor: zoomed ? 'zoom-out' : 'zoom-in',
            }}
          />
        </div>
      </div>
    </dialog>
  );
}
