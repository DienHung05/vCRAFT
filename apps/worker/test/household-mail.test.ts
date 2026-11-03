import type { MikroORM } from '@mikro-orm/core';
import { AppUser, Household, NotificationPreference } from '@vcraft/database';
import { describe, expect, it, vi } from 'vitest';
import { buildHouseholdMail, sendHouseholdMail } from '../src/processors/mail/send-household-mail';
import { createOutboxDispatcher } from '../src/processors/outbox/dispatch';

describe('thư quyết định duyệt hộ', () => {
  it('nêu tên hộ, lý do và liên kết Studio', () => {
    const mail = buildHouseholdMail({
      decision: 'REJECT',
      householdName: 'Gốm Bảo Châu',
      reason: 'Thiếu giấy xác nhận cư trú',
      appUrl: 'https://vcraft.test/',
    });
    expect(mail.subject).toMatch(/chưa được chấp nhận/);
    expect(mail.text).toContain('Gốm Bảo Châu');
    expect(mail.text).toContain('Lý do: Thiếu giấy xác nhận cư trú');
    expect(mail.text).toContain('https://vcraft.test/vi/studio/ho-so');
  });

  it('duyệt không có dòng lý do', () => {
    const mail = buildHouseholdMail({
      decision: 'APPROVE',
      householdName: 'Gốm A',
      reason: null,
      appUrl: 'https://vcraft.test',
    });
    expect(mail.text).not.toContain('Lý do');
  });

  it('sự kiện outbox thành đúng một job mail theo id sự kiện', async () => {
    const mail = { add: vi.fn(async () => undefined) };
    const media = { add: vi.fn(async () => undefined) };
    const dispatch = createOutboxDispatcher({ media, mail, qrLabels: media });
    await dispatch({
      id: 'e9',
      type: 'household.decision',
      payload: { householdId: 'h1', decision: 'APPROVE', reason: null },
    } as never);
    expect(mail.add).toHaveBeenCalledWith(
      'household-decision',
      { householdId: 'h1', decision: 'APPROVE', reason: null },
      { jobId: 'mail-household-e9' },
    );
  });
});

describe('sendHouseholdMail và tùy chọn email', () => {
  function deps(preference: Partial<NotificationPreference> | null) {
    const asked: unknown[] = [];
    const em = {
      async findOne(entity: unknown, where: unknown) {
        if (entity === Household) return { name: 'Gốm A', representative: { id: 'u1' } };
        if (entity === AppUser) return { id: 'u1', email: 'rep@example.com' };
        if (entity === NotificationPreference) {
          asked.push(where);
          return preference;
        }
        return null;
      },
    };
    const sent: unknown[] = [];
    return {
      asked,
      sent,
      deps: {
        orm: { em: { fork: () => em } } as unknown as MikroORM,
        transport: { sendMail: async (message: unknown) => void sent.push(message) },
        from: 'x',
        appUrl: 'http://x',
      },
    };
  }
  const job = { householdId: 'h1', decision: 'SUSPEND', reason: null } as const;

  it('gửi thư khi chưa có tùy chọn hoặc người nhận bật email loại này', async () => {
    const none = deps(null);
    expect(await sendHouseholdMail(none.deps, job)).toBe(true);
    expect(none.asked[0]).toEqual({ userId: 'u1', type: 'HOUSEHOLD_SUSPENDED' });
    const on = deps({ emailEnabled: true });
    expect(await sendHouseholdMail(on.deps, job)).toBe(true);
    expect(on.sent).toHaveLength(1);
  });

  it('bỏ qua khi người nhận đã tắt email cho loại này', async () => {
    const off = deps({ emailEnabled: false });
    expect(await sendHouseholdMail(off.deps, job)).toBe(false);
    expect(off.sent).toHaveLength(0);
  });
});
