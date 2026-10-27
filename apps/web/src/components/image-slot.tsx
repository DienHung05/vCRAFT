import { cn } from '@vcraft/ui';
import type { ReactNode } from 'react';

export interface ImageSlotProps {
  /** Mô tả ảnh (alt), bắt buộc như ảnh thật (FR-ART-04). */
  alt: string;
  /** Màu chủ đạo của ảnh (`dominantColor`, BRAND §3.2). */
  tint: string;
  /** Tỉ lệ khung CSS, vd. `4/5`. Không truyền thì khối tự lấp đầy cha. */
  ratio?: string;
  /** Hiện chú thích ở góc dưới. */
  caption?: string;
  className?: string;
  children?: ReactNode;
}

/**
 * Khung ảnh tạm khi chưa có ảnh có giấy phép (BRAND §7): nền nhuốm màu chủ đạo + hạt giấy.
 * Cùng kích thước, tỉ lệ và alt với `<CraftImage>` sau này (E4) nên thay thế không vỡ bố cục.
 */
export function ImageSlot({ alt, tint, ratio, caption, className, children }: ImageSlotProps) {
  return (
    <div
      role="img"
      aria-label={alt}
      className={cn('grain relative isolate overflow-hidden rounded-card', className)}
      style={{
        aspectRatio: ratio,
        background: `radial-gradient(120% 90% at 30% 20%, color-mix(in oklch, ${tint} 55%, var(--color-paper)), ${tint} 70%, color-mix(in oklch, ${tint} 80%, var(--color-ink)))`,
      }}
    >
      {children}
      {caption ? (
        <span className="absolute bottom-3 left-3 rounded-chip bg-paper/85 px-2.5 py-0.5 text-[0.75rem] text-ink backdrop-blur-sm">
          {caption}
        </span>
      ) : null}
    </div>
  );
}
