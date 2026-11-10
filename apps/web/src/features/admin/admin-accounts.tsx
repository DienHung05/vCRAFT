'use client';

import { type AdminClient, ApiError } from '@vcraft/api-client';
import {
  type AdminUserDto,
  type AdminUserListQuery,
  INVITABLE_ROLES,
  type InvitableRole,
  type InvitationDto,
} from '@vcraft/contracts';
import { Badge, Button, Card } from '@vcraft/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { EmptyState } from '@/components/states/empty-state';
import { ErrorState } from '@/components/states/error-state';
import { useLatestRequest } from '@/lib/use-latest-request';
import { useAdminClient } from './admin-dashboard';

const inputClass = 'rounded-input border border-ink/20 bg-surface px-3 py-2';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_REASON = 3;
const ERROR_CODES = ['BUSINESS_RULE_VIOLATED', 'INVALID_TRANSITION', 'NOT_FOUND'] as const;

/** Invitations by email (FR-AUTH-03): the form, and the invitations sent so far. */
function InvitationsPanel({ client }: { client: AdminClient }) {
  const t = useTranslations('admin.accounts.invite');
  const format = useFormatter();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InvitableRole>('ADMIN');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<readonly InvitationDto[] | null>(null);
  const [listFailed, setListFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems((await client.listInvitations()).items);
      setListFailed(false);
    } catch {
      setListFailed(true);
    }
  }, [client]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSent(null);
    setFailure(null);
    const address = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(address) || address.length > 320) {
      setFieldError(t('emailInvalid'));
      return;
    }
    setFieldError(null);
    setBusy(true);
    try {
      await client.inviteAccount({ email: address, role });
      setSent(address);
      setEmail('');
      await load();
    } catch (error) {
      const known = error instanceof ApiError && error.code === 'CONFLICT_DUPLICATE';
      setFailure(known ? t('errors.CONFLICT_DUPLICATE') : t('errors.default'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div>
        <h2 className="text-h3">{t('title')}</h2>
        <p className="mt-1 text-small text-ash">{t('lead')}</p>
      </div>
      <form
        aria-label={t('title')}
        noValidate
        onSubmit={(event) => void submit(event)}
        className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
      >
        <label className="flex min-w-0 flex-col gap-1 text-small sm:flex-1">
          {t('email')}
          <input
            type="email"
            autoComplete="off"
            value={email}
            maxLength={320}
            aria-invalid={fieldError ? true : undefined}
            aria-describedby={fieldError ? 'invite-email-error' : undefined}
            onChange={(event) => setEmail(event.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-small">
          {t('role')}
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as InvitableRole)}
            className={inputClass}
          >
            {INVITABLE_ROLES.map((value) => (
              <option key={value} value={value}>
                {t(`roles.${value}`)}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" disabled={busy}>
          {busy ? t('sending') : t('submit')}
        </Button>
      </form>
      {fieldError ? (
        <p id="invite-email-error" role="alert" className="text-small text-seal">
          {fieldError}
        </p>
      ) : null}
      {role === 'ADMIN' ? <p className="text-small text-ash">{t('adminNote')}</p> : null}
      {sent ? (
        <p role="status" className="text-small text-ink">
          {t('sent', { email: sent })}
        </p>
      ) : null}
      {failure ? (
        <p role="alert" className="text-small text-seal">
          {failure}
        </p>
      ) : null}
      <div className="border-ink/10 border-t pt-4">
        <h3 className="mb-2 font-medium">{t('listTitle')}</h3>
        {listFailed ? <p className="text-small text-ash">{t('failed')}</p> : null}
        {items?.length === 0 ? <p className="text-small text-ash">{t('listEmpty')}</p> : null}
        {items && items.length > 0 ? (
          <ul className="divide-y divide-ink/8 text-small" data-testid="invitations">
            {items.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="flex min-w-0 flex-col">
                  <span className="break-all">{item.email}</span>
                  <span className="text-ash">
                    {t(`roles.${item.role as InvitableRole}`)}
                    {item.invitedByName ? ` · ${t('by', { name: item.invitedByName })}` : ''}
                    {' · '}
                    <time dateTime={item.createdAt}>
                      {format.dateTime(new Date(item.createdAt), { dateStyle: 'medium' })}
                    </time>
                  </span>
                </span>
                <Badge tone={item.status === 'ACCEPTED' ? 'celadon' : 'outline'}>
                  {t(`status.${item.status}`)}
                </Badge>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Card>
  );
}

type Pending = { kind: 'suspend' | 'unsuspend'; user: AdminUserDto } | null;

/** Accounts and the suspend / restore actions (FR-AUTH-10). */
function UsersPanel({ client }: { client: AdminClient }) {
  const t = useTranslations('admin.accounts.users');
  const tAuth = useTranslations('auth');
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Partial<AdminUserListQuery>>({});
  const [users, setUsers] = useState<readonly AdminUserDto[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState<Pending>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const latest = useLatestRequest();

  const load = useCallback(async () => {
    const id = latest.begin();
    setFailed(false);
    try {
      const page = await client.listUsers(filters);
      if (latest.isCurrent(id)) setUsers(page.items);
    } catch {
      if (latest.isCurrent(id)) setFailed(true);
    }
  }, [client, filters, latest]);

  useEffect(() => {
    void load();
  }, [load]);

  const close = () => {
    setPending(null);
    setReason('');
  };

  const confirm = async () => {
    if (!pending) return;
    setBusy(true);
    setActionError(null);
    try {
      const updated =
        pending.kind === 'suspend'
          ? await client.suspendUser(pending.user.id, reason.trim())
          : await client.unsuspendUser(pending.user.id);
      setUsers((current) => current?.map((u) => (u.id === updated.id ? updated : u)) ?? null);
      close();
    } catch (error) {
      const code = error instanceof ApiError ? error.code : null;
      const known = ERROR_CODES.find((value) => value === code);
      setActionError(known ? t(`errors.${known}`) : t('errors.default'));
      close();
      if (known === 'INVALID_TRANSITION') void load();
    } finally {
      setBusy(false);
    }
  };

  const nameOf = (user: AdminUserDto) => user.fullName ?? user.username ?? user.email;
  const reasonOk = reason.trim().length >= MIN_REASON;

  return (
    <section className="flex flex-col gap-4" aria-labelledby="admin-users-title">
      <h2 id="admin-users-title" className="text-h3">
        {t('title')}
      </h2>
      <form
        aria-label={t('filters')}
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          setFilters((current) => ({ ...current, q: query.trim() || undefined }));
        }}
      >
        <label className="flex min-w-0 flex-col gap-1 text-small sm:min-w-72">
          {t('search')}
          <input
            type="search"
            value={query}
            maxLength={120}
            onChange={(event) => setQuery(event.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-small">
          {t('role')}
          <select
            value={filters.role ?? ''}
            onChange={(event) =>
              setFilters({
                ...filters,
                role: (event.target.value || undefined) as AdminUserListQuery['role'],
              })
            }
            className={inputClass}
          >
            <option value="">{t('allRoles')}</option>
            {(['ADMIN', 'HOUSEHOLD', 'BUYER'] as const).map((role) => (
              <option key={role} value={role}>
                {tAuth(`roles.${role}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-small">
          {t('status')}
          <select
            value={filters.status ?? ''}
            onChange={(event) =>
              setFilters({
                ...filters,
                status: (event.target.value || undefined) as AdminUserListQuery['status'],
              })
            }
            className={inputClass}
          >
            <option value="">{t('allStatuses')}</option>
            <option value="ACTIVE">{t('statusValues.ACTIVE')}</option>
            <option value="LOCKED">{t('statusValues.LOCKED')}</option>
          </select>
        </label>
      </form>
      {actionError ? (
        <p role="alert" className="text-small text-seal">
          {actionError}
        </p>
      ) : null}
      {failed ? (
        <ErrorState message={t('failed')} onRetry={() => void load()} />
      ) : users === null ? (
        <p className="text-small text-ash">{t('loading')}</p>
      ) : users.length === 0 ? (
        <EmptyState illustration="scroll" title={t('empty')} />
      ) : (
        <ul
          className="divide-y divide-ink/10 rounded-card border border-ink/10"
          data-testid="users"
        >
          {users.map((user) => (
            <li key={user.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex min-w-0 flex-col gap-1">
                <span className="font-medium">{user.fullName ?? user.username ?? t('noName')}</span>
                <span className="break-all text-small text-ash">{user.email}</span>
                <span className="flex flex-wrap items-center gap-2">
                  <Badge tone="glaze">{tAuth(`roles.${user.role}`)}</Badge>
                  <Badge tone={user.status === 'LOCKED' ? 'seal' : 'celadon'}>
                    {t(`statusValues.${user.status}`)}
                  </Badge>
                </span>
                {user.status === 'LOCKED' && user.statusReason ? (
                  <span className="text-small text-ash">
                    {t('reason', { reason: user.statusReason })}
                  </span>
                ) : null}
              </div>
              <Button
                type="button"
                variant="secondary"
                aria-label={`${user.status === 'LOCKED' ? t('unsuspend') : t('suspend')}: ${nameOf(user)}`}
                onClick={() => {
                  setActionError(null);
                  setPending({ kind: user.status === 'LOCKED' ? 'unsuspend' : 'suspend', user });
                }}
              >
                {user.status === 'LOCKED' ? t('unsuspend') : t('suspend')}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={pending !== null}
        title={
          pending
            ? t(pending.kind === 'suspend' ? 'suspendTitle' : 'unsuspendTitle', {
                name: nameOf(pending.user),
              })
            : ''
        }
        confirmLabel={pending?.kind === 'unsuspend' ? t('unsuspend') : t('suspend')}
        cancelLabel={t('cancel')}
        tone={pending?.kind === 'suspend' ? 'seal' : 'primary'}
        confirmDisabled={busy || (pending?.kind === 'suspend' && !reasonOk)}
        onConfirm={() => void confirm()}
        onClose={close}
      >
        <p className="text-small text-ash">
          {pending?.kind === 'suspend' ? t('suspendText') : t('unsuspendText')}
        </p>
        {pending?.kind === 'suspend' ? (
          <label className="flex flex-col gap-1 text-small">
            {t('reasonLabel')}
            <textarea
              rows={3}
              maxLength={500}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className={inputClass}
            />
          </label>
        ) : null}
      </ConfirmDialog>
    </section>
  );
}

/** Account administration screen (FR-AUTH-03, FR-AUTH-10): invite by email, suspend and restore. */
export function AdminAccounts({ client: provided }: { client?: AdminClient }) {
  const t = useTranslations('admin.accounts');
  const { client, loading } = useAdminClient(provided);

  if (!loading && !client) return <p>{t('signIn')}</p>;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-h2">{t('title')}</h1>
        <p className="text-ash">{t('lead')}</p>
      </header>
      {client ? (
        <>
          <InvitationsPanel client={client} />
          <UsersPanel client={client} />
        </>
      ) : null}
    </div>
  );
}
