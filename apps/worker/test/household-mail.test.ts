import { describe, expect, it, vi } from 'vitest';
import { buildHouseholdMail } from '../src/processors/mail/send-household-mail';
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
    const dispatch = createOutboxDispatcher({ media, mail });
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
