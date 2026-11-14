'use client';

import { buttonVariants, cn } from '@vcraft/ui';
import { ImagePlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState } from 'react';

export interface PhotoPickerProps {
  /** Already translated label shown above the button; also the accessible name of the file input. */
  label: string;
  accept: string;
  /** Opens the camera directly on phones that support it. */
  capture?: 'environment' | 'user';
  /** The chosen file, owned by the parent so it can reset the picker after a save. */
  file: File | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * One file picker for progress photos: label, an upload button, then the chosen file (thumbnail and name)
 * each on its own line, instead of the browser's bare "Choose file / No file chosen" control. The native
 * input stays in the tree (visually hidden) so keyboard focus and screen readers reach the real control.
 */
export function PhotoPicker({
  label,
  accept,
  capture,
  file,
  onChange,
  disabled,
  className,
}: PhotoPickerProps) {
  const t = useTranslations('photoPicker');
  const labelId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    // jsdom and very old browsers have no createObjectURL; the file name alone is enough then.
    if (!file || typeof URL.createObjectURL !== 'function') {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // The parent may clear the file (for example after a save); keep the native input in step so the
  // same photo can be picked again.
  useEffect(() => {
    if (!file && inputRef.current) inputRef.current.value = '';
  }, [file]);

  const remove = () => {
    if (inputRef.current) inputRef.current.value = '';
    onChange(null);
  };

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <span id={labelId} className="text-small">
        {label}
      </span>
      <label
        className={cn(
          buttonVariants({ variant: 'secondary', size: 'md' }),
          'w-fit cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-glaze',
          disabled && 'pointer-events-none opacity-45',
        )}
      >
        <ImagePlus aria-hidden="true" className="size-4" />
        {t('upload')}
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          aria-labelledby={labelId}
          accept={accept}
          capture={capture}
          disabled={disabled}
          onChange={(event) => onChange(event.target.files?.[0] ?? null)}
        />
      </label>
      <div aria-live="polite" className="flex min-h-12 items-center gap-3">
        {file ? (
          <>
            {previewUrl ? (
              // biome-ignore lint/performance/noImgElement: a local object URL cannot go through the image optimizer.
              <img src={previewUrl} alt={file.name} className="size-12 rounded object-cover" />
            ) : null}
            <span className="min-w-0 flex-1 truncate text-small">{file.name}</span>
            <button
              type="button"
              onClick={remove}
              disabled={disabled}
              className="text-small text-clay underline underline-offset-2 hover:text-ink"
            >
              {t('remove')}
            </button>
          </>
        ) : (
          <span className="text-ash text-small">{t('none')}</span>
        )}
      </div>
    </div>
  );
}
