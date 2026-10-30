'use client';

import type { QuotationClient } from '@vcraft/api-client';
import type { QuotationNoticeDto } from '@vcraft/contracts';
import { Badge, Button } from '@vcraft/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useId, useState } from 'react';
import { useQuotationClient } from '@/lib/api/use-quotation-client';

const POLL_MS = 15_000;

/**
 * Hộp thư in-app (GH#13): hỏi lại API mỗi 15s khi tab đang hiện, không dùng SSE. Chưa đăng nhập
 * hoặc API lỗi thì không hiện gì để không che màn nghiệp vụ bên dưới.
 */
export function NotificationInbox({ client: provided }: { client?: QuotationClient }) {
  const { client } = useQuotationClient(provided);
  if (!client) return null;
  return <Inbox client={client} />;
}

function Inbox({ client }: { client: QuotationClient }) {
  const t = useTranslations('notifications');
  const format = useFormatter();
  const titleId = useId();
  const [notices, setNotices] = useState<QuotationNoticeDto[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let sequence = 0;
    async function load() {
      const current = ++sequence;
      try {
        const next = await client.listNotices();
        if (active && current === sequence) setNotices(next);
      } catch {
        // Lỗi tạm thời (mạng, 401) không xóa danh sách đang hiện; lần hỏi sau thử lại.
      }
    }
    void load();
    const timer = window.setInterval(() => {
      if (!document.hidden) void load();
    }, POLL_MS);
    const visible = () => {
      if (!document.hidden) void load();
    };
    document.addEventListener('visibilitychange', visible);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [client]);

  async function markRead(id: string) {
    setFailed(false);
    try {
      const updated = await client.markNoticeRead(id);
      setNotices((current) => current?.map((n) => (n.id === id ? updated : n)) ?? current);
    } catch {
      setFailed(true);
    }
  }

  async function markAllRead() {
    setFailed(false);
    try {
      await client.markAllNoticesRead();
      const readAt = new Date().toISOString();
      setNotices((current) => current?.map((n) => (n.readAt ? n : { ...n, readAt })) ?? current);
    } catch {
      setFailed(true);
    }
  }

  if (!notices) return null;
  const unread = notices.filter((notice) => !notice.readAt).length;

  return (
    <section aria-labelledby={titleId} className="rounded-card bg-surface p-4 ring-1 ring-ink/8">
      <details>
        <summary className="flex cursor-pointer items-center gap-3">
          <h2 id={titleId} className="text-small font-medium">
            {t('title')}
          </h2>
          <Badge>{t('unread', { count: unread })}</Badge>
        </summary>
        <div className="mt-4 flex flex-col gap-3">
          {failed ? <p role="alert">{t('failed')}</p> : null}
          {notices.length === 0 ? <p className="text-small text-ash">{t('empty')}</p> : null}
          {unread > 0 ? (
            <div>
              <Button type="button" onClick={() => void markAllRead()}>
                {t('markAllRead')}
              </Button>
            </div>
          ) : null}
          <ul className="flex max-h-72 flex-col gap-2 overflow-y-auto">
            {notices.map((notice) => (
              <li
                key={notice.id}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1"
              >
                <div className="flex flex-col">
                  <span className={notice.readAt ? 'text-ash' : 'font-medium'}>
                    {t(`kind.${notice.kind}`)}
                  </span>
                  <span className="text-small text-ash">
                    <span className="font-mono">{notice.requestId}</span>{' '}
                    <time dateTime={notice.createdAt}>
                      {format.dateTime(new Date(notice.createdAt), 'short')}
                    </time>
                  </span>
                </div>
                {notice.readAt ? null : (
                  <Button type="button" onClick={() => void markRead(notice.id)}>
                    {t('markRead')}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      </details>
    </section>
  );
}
