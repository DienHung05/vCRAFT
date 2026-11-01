import { cn } from '@vcraft/ui';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import type { DemoPhotoRef } from '@/lib/demo/data';
import { PHOTO_BY_ID } from '@/lib/demo/photo-credits';

export interface ImageSlotProps {
  /** Mô tả ảnh (alt), bắt buộc như ảnh thật (FR-ART-04). Khi có `photo`, dùng alt của ảnh. */
  alt: string;
  /** Màu chủ đạo của ảnh (`dominantColor`, BRAND §3.2). */
  tint: string;
  /** Tỉ lệ khung CSS, vd. `4/5`. Không truyền thì khối tự lấp đầy cha. */
  ratio?: string;
  /** Hiện chú thích ở góc dưới. */
  caption?: string;
  /** Ảnh thật có giấy phép (demo); không có thì hiện khung nhuốm màu như cũ. */
  photo?: DemoPhotoRef | undefined;
  /** Ảnh ở URL công khai khác (kho media), không thuộc bộ ảnh có giấy phép. */
  src?: string | undefined;
  /** `sizes` cho `<picture>`: chiều rộng ảnh theo viewport. */
  sizes?: string;
  /** Ảnh trên màn đầu (LCP): nạp ngay thay vì lười. */
  priority?: boolean;
  className?: string;
  children?: ReactNode;
}

const DEFAULT_SIZES = '(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw';

/**
 * Khung ảnh: nền nhuốm màu chủ đạo + hạt giấy (BRAND §7). Có `photo` thì vẽ `<picture>` AVIF/WebP
 * 640w + 1280w trong đúng khung (không dịch bố cục), màu chủ đạo làm nền khi ảnh chưa về.
 * Cùng kích thước, tỉ lệ và alt với `<CraftImage>` sau này (E4) nên thay thế không vỡ bố cục.
 */
export function ImageSlot({
  alt,
  tint,
  ratio,
  caption,
  photo,
  src,
  sizes = DEFAULT_SIZES,
  priority = false,
  className,
  children,
}: ImageSlotProps) {
  const photoAlt = useTranslations('photoAlt');
  const credit = photo ? PHOTO_BY_ID.get(photo.id) : undefined;
  const altText = photo?.altKey
    ? photoAlt(photo.altKey as Parameters<typeof photoAlt>[0])
    : photo?.alt;
  const base = credit ? `/images/demo/${credit.id}` : undefined;
  const srcSet = (ext: 'avif' | 'webp') =>
    credit?.widths.map((w) => `${base}-${w}.${ext} ${w}w`).join(', ');
  const smallest = credit ? Math.min(...credit.widths) : 0;
  const [rw = 1, rh = 1] = (ratio ?? credit?.ratio ?? '1/1').split('/').map(Number);

  return (
    <div
      {...(credit ? {} : { role: 'img', 'aria-label': alt })}
      className={cn('grain relative isolate overflow-hidden rounded-card', className)}
      style={{
        aspectRatio: ratio,
        background: credit
          ? credit.tint
          : `radial-gradient(120% 90% at 30% 20%, color-mix(in oklch, ${tint} 55%, var(--color-paper)), ${tint} 70%, color-mix(in oklch, ${tint} 80%, var(--color-ink)))`,
      }}
    >
      {credit && photo ? (
        <picture>
          <source type="image/avif" srcSet={srcSet('avif')} sizes={sizes} />
          <source type="image/webp" srcSet={srcSet('webp')} sizes={sizes} />
          <img
            src={`${base}-${smallest}.webp`}
            alt={altText ?? photo.alt}
            width={smallest}
            height={Math.round((smallest * rh) / rw)}
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : undefined}
            decoding="async"
            className="absolute inset-0 size-full object-cover"
          />
        </picture>
      ) : null}
      {src && !credit ? (
        // biome-ignore lint/performance/noImgElement: URL của kho media đã là bản tối ưu, không qua next/image.
        <img
          src={src}
          alt=""
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          className="absolute inset-0 size-full object-cover"
        />
      ) : null}
      {children}
      {caption ? (
        <span className="absolute bottom-3 left-3 rounded-chip bg-paper/85 px-2.5 py-0.5 text-[0.75rem] text-ink backdrop-blur-sm">
          {caption}
        </span>
      ) : null}
    </div>
  );
}
