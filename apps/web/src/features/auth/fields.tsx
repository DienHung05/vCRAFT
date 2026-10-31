'use client';

import { cn } from '@vcraft/ui';
import { useTranslations } from 'next-intl';
import { type ComponentProps, type ReactNode, type Ref, useId, useState } from 'react';

/**
 * Bộ ô nhập của các form tài khoản: nhãn luôn hiện (không dùng placeholder thay nhãn), lỗi gắn
 * `aria-describedby`, viền và chữ lỗi chuyển sang son triện (DESIGN: Inputs / Fields).
 * `ref` là prop thường (React 19) nên nhận thẳng kết quả `register()` của react-hook-form.
 */
const controlClass =
  'h-11 w-full rounded-input border bg-surface px-3 text-body text-ink placeholder:text-ash/70 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-glaze ' +
  'disabled:opacity-45';

interface FieldFrameProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | undefined;
  optionalLabel?: string | undefined;
  children: (ids: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
  className?: string | undefined;
}

function FieldFrame({ label, hint, error, optionalLabel, children, className }: FieldFrameProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ');
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-small font-medium text-ink">
        {label}
        {optionalLabel ? (
          <span className="ml-1 font-normal text-ash">({optionalLabel})</span>
        ) : null}
      </label>
      {children({ id, describedBy: describedBy || undefined, invalid: Boolean(error) })}
      {hint ? (
        <p id={hintId} className="text-small text-ash">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-small text-seal">
          {error}
        </p>
      ) : null}
    </div>
  );
}

interface BaseFieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | undefined;
  optionalLabel?: string | undefined;
  ref?: Ref<HTMLInputElement>;
}

export function TextField({
  label,
  hint,
  error,
  optionalLabel,
  className,
  ...input
}: BaseFieldProps & Omit<ComponentProps<'input'>, 'ref'>) {
  return (
    <FieldFrame label={label} hint={hint} error={error} optionalLabel={optionalLabel}>
      {({ id, describedBy, invalid }) => (
        <input
          id={id}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn(controlClass, invalid ? 'border-seal' : 'border-ink/20', className)}
          {...input}
        />
      )}
    </FieldFrame>
  );
}

/** Ô mật khẩu có nút Hiện/Ẩn (bàn phím, không phụ thuộc chuột). */
export function PasswordField({
  label,
  hint,
  error,
  optionalLabel,
  className,
  ...input
}: BaseFieldProps & Omit<ComponentProps<'input'>, 'ref' | 'type'>) {
  const t = useTranslations('auth.fields');
  const [visible, setVisible] = useState(false);
  return (
    <FieldFrame label={label} hint={hint} error={error} optionalLabel={optionalLabel}>
      {({ id, describedBy, invalid }) => (
        <div className="relative">
          <input
            id={id}
            type={visible ? 'text' : 'password'}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            className={cn(
              controlClass,
              'pr-16',
              invalid ? 'border-seal' : 'border-ink/20',
              className,
            )}
            {...input}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-pressed={visible}
            aria-controls={id}
            className="absolute inset-y-0 right-0 rounded-input px-3 text-small text-clay hover:text-ink focus-visible:outline-2 focus-visible:outline-glaze"
          >
            {visible ? t('hidePassword') : t('showPassword')}
          </button>
        </div>
      )}
    </FieldFrame>
  );
}

export function TextAreaField({
  label,
  hint,
  error,
  optionalLabel,
  className,
  ...input
}: Omit<BaseFieldProps, 'ref'> & { ref?: Ref<HTMLTextAreaElement> } & Omit<
    ComponentProps<'textarea'>,
    'ref'
  >) {
  return (
    <FieldFrame label={label} hint={hint} error={error} optionalLabel={optionalLabel}>
      {({ id, describedBy, invalid }) => (
        <textarea
          id={id}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn(
            controlClass,
            'min-h-28 py-2 leading-relaxed',
            invalid ? 'border-seal' : 'border-ink/20',
            className,
          )}
          {...input}
        />
      )}
    </FieldFrame>
  );
}

export function SelectField({
  label,
  hint,
  error,
  optionalLabel,
  className,
  children,
  ...input
}: Omit<BaseFieldProps, 'ref'> & { ref?: Ref<HTMLSelectElement> } & Omit<
    ComponentProps<'select'>,
    'ref'
  >) {
  return (
    <FieldFrame label={label} hint={hint} error={error} optionalLabel={optionalLabel}>
      {({ id, describedBy, invalid }) => (
        <select
          id={id}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn(controlClass, invalid ? 'border-seal' : 'border-ink/20', className)}
          {...input}
        >
          {children}
        </select>
      )}
    </FieldFrame>
  );
}

export function CheckboxField({
  label,
  className,
  ...input
}: { label: ReactNode; ref?: Ref<HTMLInputElement> } & Omit<
  ComponentProps<'input'>,
  'ref' | 'type'
>) {
  const id = useId();
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <input
        id={id}
        type="checkbox"
        className="size-5 shrink-0 rounded-input border-ink/30 accent-clay focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-glaze"
        {...input}
      />
      <label htmlFor={id} className="text-small text-ink">
        {label}
      </label>
    </div>
  );
}

/** Thông báo cấp form. Lỗi đọc ngay (`alert`), còn lại đọc lịch sự (`status`). */
export function FormAlert({
  tone,
  children,
  className,
}: {
  tone: 'error' | 'info' | 'success';
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'rounded-card border px-4 py-3 text-small',
        tone === 'error' && 'border-seal/40 bg-seal/5 text-seal',
        tone === 'info' && 'border-ink/15 bg-ink/4 text-ink',
        tone === 'success' && 'border-celadon/50 bg-celadon/10 text-ink',
        className,
      )}
    >
      {children}
    </p>
  );
}
