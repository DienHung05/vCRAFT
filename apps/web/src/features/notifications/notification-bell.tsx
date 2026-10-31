'use client';

import type { AccountClient } from '@vcraft/api-client';
import type { NotificationDto } from '@vcraft/contracts';
import { cn } from '@vcraft/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { browserAccountClient, browserSupabase } from '@/lib/auth/supabase-browser';
import { notificationHref } from './target-href';

/** Nhịp hỏi lại số chưa đọc (và danh sách khi đang mở); tạm dừng khi tab bị ẩn. */
export const BELL_POLL_MS = 30_000;
const LIST_LIMIT = 30;

/**
 * Chuông thông báo trong header cho mọi vai trò đã đăng nhập (GH#37, FR-NOTI-01/03). Không dùng SSE:
 * hỏi lại `GET /me/notifications/unread-count` mỗi 30s khi tab đang hiện (và ngay khi tab hiện lại),
 * danh sách chỉ tải khi mở bảng. Khách chưa đăng nhập hoặc đang kiểm tra phiên thì không hiện gì.
 * `client` chỉ để test truyền vào; mặc định lấy token từ phiên Supabase của trình duyệt.
 */
export function NotificationBell({
  client: provided,
  align = 'end',
}: {
  client?: AccountClient;
  align?: 'start' | 'end';
}) {
  const [client, setClient] = useState<AccountClient | null>(provided ?? null);

  useEffect(() => {
    if (provided) {
      setClient(provided);
      return;
    }
    const supabase = browserSupabase();
    if (!supabase) return;
    // Chỉ ghi state trong callback (không gọi lại Supabase) để tránh khóa vòng đời phiên.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setClient((current) => (session ? (current ?? browserAccountClient()) : null));
    });
    return () => data.subscription.unsubscribe();
  }, [provided]);

  return client ? <Bell client={client} align={align} /> : null;
}

function Bell({ client, align }: { client: AccountClient; align: 'start' | 'end' }) {
  const t = useTranslations('notifications');
  const format = useFormatter();
  const panelId = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationDto[] | null>(null);
  const [unread, setUnread] = useState(0);
  const [failed, setFailed] = useState(false);
  // Giá trị `open` mới nhất cho nhịp hỏi lại mà không dựng lại bộ hẹn giờ mỗi lần mở/đóng.
  const openRef = useRef(open);
  openRef.current = open;
  const sequence = useRef(0);

  const refresh = useCallback(async () => {
    const current = ++sequence.current;
    try {
      if (openRef.current) {
        const next = await client.listNotifications(LIST_LIMIT);
        if (current !== sequence.current) return;
        setItems(next.data);
        setUnread(next.unreadCount);
      } else {
        const next = await client.unreadNotificationCount();
        if (current === sequence.current) setUnread(next.unreadCount);
      }
    } catch {
      // Lỗi tạm thời (mạng, 401) không xóa số đang hiện; lần hỏi sau thử lại.
    }
  }, [client]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      if (!document.hidden) void refresh();
    }, BELL_POLL_MS);
    const visible = () => {
      if (!document.hidden) void refresh();
    };
    document.addEventListener('visibilitychange', visible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [refresh]);

  // Mở bảng thì tải ngay danh sách.
  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  // Đóng khi bấm ra ngoài hoặc nhấn Escape (trả focus về nút chuông).
  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('keydown', onEscape);
    };
  }, [open]);

  async function markRead(item: NotificationDto) {
    if (item.readAt) return;
    setFailed(false);
    // Bỏ kết quả của lần hỏi đang bay: nó có thể mang số cũ và đè lên thay đổi vừa làm.
    sequence.current += 1;
    const readAt = new Date().toISOString();
    setItems((current) => current?.map((n) => (n.id === item.id ? { ...n, readAt } : n)) ?? null);
    setUnread((count) => Math.max(0, count - 1));
    try {
      await client.markNotificationRead(item.id);
    } catch {
      setFailed(true);
      void refresh();
    }
  }

  async function markAllRead() {
    setFailed(false);
    sequence.current += 1;
    try {
      await client.markAllNotificationsRead();
      const readAt = new Date().toISOString();
      setItems((current) => current?.map((n) => (n.readAt ? n : { ...n, readAt })) ?? null);
      setUnread(0);
    } catch {
      setFailed(true);
    }
  }

  const label = unread > 0 ? t('bell.labelUnread', { count: unread }) : t('bell.label');

  return (
    <div ref={root} className="sm:relative">
      <button
        ref={button}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
        className="relative grid size-9 place-items-center rounded-input text-ink hover:bg-ink/6 focus-visible:outline-2 focus-visible:outline-glaze"
      >
        <BellIcon />
        {unread > 0 ? (
          <span
            aria-hidden="true"
            className="absolute top-0 right-0 min-w-4 rounded-chip bg-seal px-1 text-center font-medium text-[0.65rem] text-paper leading-4"
          >
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <section
          id={panelId}
          role="dialog"
          aria-label={t('bell.label')}
          className={cn(
            'fixed inset-x-3 top-[4.25rem] z-50 rounded-card bg-surface shadow-warm ring-1 ring-ink/8',
            'sm:absolute sm:inset-x-auto sm:top-full sm:mt-2 sm:w-96',
            align === 'end' ? 'sm:right-0' : 'sm:left-0',
          )}
        >
          <header className="flex items-center justify-between gap-3 border-ink/8 border-b px-4 py-3">
            <h2 className="font-medium text-small text-ink">{t('title')}</h2>
            {unread > 0 ? (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="rounded-input px-2 py-1 text-clay text-small hover:bg-ink/6 focus-visible:outline-2 focus-visible:outline-glaze"
              >
                {t('markAllRead')}
              </button>
            ) : null}
          </header>
          {failed ? (
            <p role="alert" className="px-4 pt-3 text-seal text-small">
              {t('failed')}
            </p>
          ) : null}
          {items === null ? (
            <p role="status" className="px-4 py-6 text-ash text-small">
              {t('bell.loading')}
            </p>
          ) : items.length === 0 ? (
            <p className="px-4 py-6 text-ash text-small">{t('empty')}</p>
          ) : (
            <ul className="max-h-[min(24rem,60svh)] overflow-y-auto py-1">
              {items.map((item) => (
                <BellItem
                  key={item.id}
                  item={item}
                  when={format.dateTime(new Date(item.createdAt), 'short')}
                  onRead={() => void markRead(item)}
                  onNavigate={() => setOpen(false)}
                />
              ))}
            </ul>
          )}
          <footer className="border-ink/8 border-t px-4 py-3">
            <Link
              href="/tai-khoan"
              onClick={() => setOpen(false)}
              className="text-clay text-small underline underline-offset-4"
            >
              {t('bell.settings')}
            </Link>
          </footer>
        </section>
      ) : null}
    </div>
  );
}

function BellItem({
  item,
  when,
  onRead,
  onNavigate,
}: {
  item: NotificationDto;
  when: string;
  onRead: () => void;
  onNavigate: () => void;
}) {
  const t = useTranslations('notifications');
  const href = notificationHref(item.target);
  const title = t(`kind.${item.type}`);
  const body = (
    <>
      <span className="flex items-start gap-2">
        {item.readAt ? null : (
          <span
            role="img"
            aria-label={t('bell.unreadMark')}
            className="mt-2 size-2 shrink-0 rounded-full bg-seal"
          />
        )}
        <span className={cn('text-small', item.readAt ? 'text-ash' : 'font-medium text-ink')}>
          {title}
        </span>
      </span>
      <time dateTime={item.createdAt} className="block pl-0 text-ash text-small">
        {when}
      </time>
    </>
  );
  const rowClass = 'block min-w-0 flex-1 rounded-input px-2 py-2 hover:bg-ink/6';

  return (
    <li className="flex items-start gap-1 px-2">
      {href ? (
        <Link
          href={href}
          onClick={() => {
            onRead();
            onNavigate();
          }}
          className={rowClass}
        >
          {body}
        </Link>
      ) : (
        <div className={rowClass}>{body}</div>
      )}
      {item.readAt ? null : (
        <button
          type="button"
          aria-label={t('bell.markReadFor', { title })}
          onClick={onRead}
          className="mt-1 shrink-0 rounded-input px-2 py-1 text-clay text-small hover:bg-ink/6 focus-visible:outline-2 focus-visible:outline-glaze"
        >
          {t('markRead')}
        </button>
      )}
    </li>
  );
}

function BellIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6.5 2 6.5H4S6 14 6 9Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  );
}
