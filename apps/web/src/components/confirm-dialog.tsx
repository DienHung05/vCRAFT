'use client';

import { Button, cn } from '@vcraft/ui';
import { type ReactNode, useEffect, useId, useRef } from 'react';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** Nội dung giữa hộp thoại (mô tả, ô nhập lý do…). */
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  /** Nút xác nhận dùng son triện cho khoảnh khắc chốt (BRAND §3.1). */
  tone?: 'primary' | 'seal';
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Hộp thoại xác nhận dựng trên `<dialog>` gốc: có sẵn bẫy tiêu điểm, Esc và lớp nền của trình duyệt.
 * Bấm ra ngoài hoặc Esc ⇒ đóng. Studio/Admin chỉ phản hồi trạng thái nên không thêm hoạt ảnh.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel,
  tone = 'primary',
  confirmDisabled = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
      className={cn(
        'm-auto w-[min(32rem,calc(100vw-2rem))] rounded-card bg-surface p-0 text-ink shadow-warm',
        'backdrop:bg-ink/45 backdrop:backdrop-blur-[2px]',
      )}
    >
      <div className="flex flex-col gap-4 p-6">
        <h2 id={titleId} className="text-h3">
          {title}
        </h2>
        {children}
        <div className="mt-2 flex flex-wrap justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button variant={tone} disabled={confirmDisabled} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
