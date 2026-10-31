'use client';

import type { AccountClient } from '@vcraft/api-client';
import type { NotificationPreferenceDto } from '@vcraft/contracts';
import { Button } from '@vcraft/ui';
import { useTranslations } from 'next-intl';
import { type FormEvent, useEffect, useState } from 'react';
import { FormAlert } from '@/features/auth/fields';
import { browserAccountClient } from '@/lib/auth/supabase-browser';
import { EMAIL_TOPICS, topicOf } from './email-topics';

type Status = 'idle' | 'saving' | 'saved' | 'failed';

/**
 * Chọn loại thông báo nào cũng gửi email (GH#37, FR-NOTI-02). Danh sách do API trả theo vai trò của
 * người gọi, mặc định bật hết; thông báo trong chuông không bị ảnh hưởng. `client` chỉ để test.
 */
export function EmailPreferencesForm({ client: provided }: { client?: AccountClient }) {
  const t = useTranslations('account.email');
  const tKind = useTranslations('notifications.kind');
  const [prefs, setPrefs] = useState<NotificationPreferenceDto[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [status, setStatus] = useState<Status>('idle');

  useEffect(() => {
    let active = true;
    (provided ?? browserAccountClient())
      .notificationPreferences()
      .then((next) => active && setPrefs(next.data))
      .catch(() => active && setLoadFailed(true));
    return () => {
      active = false;
    };
  }, [provided]);

  if (loadFailed) return <FormAlert tone="error">{t('loadFailed')}</FormAlert>;
  if (!prefs) {
    return (
      <p role="status" className="text-ash text-small">
        {t('loading')}
      </p>
    );
  }

  const toggle = (type: NotificationPreferenceDto['type'], email: boolean) => {
    setStatus('idle');
    setPrefs((current) => current?.map((p) => (p.type === type ? { ...p, email } : p)) ?? null);
  };

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!prefs) return;
    setStatus('saving');
    try {
      const saved = await (provided ?? browserAccountClient()).saveNotificationPreferences({
        preferences: prefs,
      });
      setPrefs(saved.data);
      setStatus('saved');
    } catch {
      setStatus('failed');
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      {EMAIL_TOPICS.map((topic) => {
        const group = prefs.filter((p) => topicOf(p.type) === topic);
        if (group.length === 0) return null;
        return (
          <fieldset key={topic} className="flex flex-col gap-3">
            <legend className="mb-1 font-medium text-ink text-small">{t(`topic.${topic}`)}</legend>
            {group.map((p) => (
              <label key={p.type} className="flex items-start gap-3 text-ink text-small">
                <input
                  type="checkbox"
                  checked={p.email}
                  onChange={(event) => toggle(p.type, event.target.checked)}
                  className="mt-0.5 size-5 shrink-0 rounded-input border-ink/30 accent-clay focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-glaze"
                />
                <span>{tKind(p.type)}</span>
              </label>
            ))}
          </fieldset>
        );
      })}
      {status === 'saved' ? <FormAlert tone="success">{t('saved')}</FormAlert> : null}
      {status === 'failed' ? <FormAlert tone="error">{t('saveFailed')}</FormAlert> : null}
      <div>
        <Button type="submit" disabled={status === 'saving'}>
          {status === 'saving' ? t('saving') : t('save')}
        </Button>
      </div>
    </form>
  );
}
