import type { MikroORM } from '@mikro-orm/core';
import { AppUser, Notification, NotificationPreference, QuotationNotice } from '@vcraft/database';
import { describe, expect, it } from 'vitest';
import { createNoticeLoader } from '../src/processors/mail/load-notice';

/** ORM giả: tra theo lớp entity, đủ để kiểm cách bộ nạp ghép thông báo, người nhận và tùy chọn email. */
function fakeOrm(rows: {
  quotation?: Partial<QuotationNotice>;
  notification?: Partial<Notification>;
  user?: Partial<AppUser>;
  preference?: Partial<NotificationPreference>;
}): MikroORM {
  const em = {
    async findOne(entity: unknown) {
      if (entity === QuotationNotice) return rows.quotation ?? null;
      if (entity === Notification) return rows.notification ?? null;
      if (entity === AppUser) return rows.user ?? null;
      if (entity === NotificationPreference) return rows.preference ?? null;
      return null;
    },
  };
  return { em: { fork: () => em } } as unknown as MikroORM;
}

const user = { email: 'rep@example.com', role: 'HOUSEHOLD' } as const;

describe('createNoticeLoader', () => {
  it('loads a quotation notice with email enabled by default', async () => {
    const load = createNoticeLoader(
      fakeOrm({
        quotation: { recipientId: 'u1', kind: 'RFQ_INVITED', requestId: 'req-1' },
        user,
      }),
    );
    expect(await load('n1')).toEqual({
      kind: 'RFQ_INVITED',
      subjectId: 'req-1',
      email: 'rep@example.com',
      role: 'HOUSEHOLD',
      emailEnabled: true,
    });
  });

  it('loads a general notification', async () => {
    const load = createNoticeLoader(
      fakeOrm({
        notification: { recipientId: 'u1', type: 'HOUSEHOLD_APPROVED', subjectId: 'h1' },
        user,
      }),
    );
    expect(await load('n2')).toMatchObject({
      kind: 'HOUSEHOLD_APPROVED',
      subjectId: 'h1',
      emailEnabled: true,
    });
  });

  it('reports email as disabled when the recipient turned the kind off', async () => {
    const load = createNoticeLoader(
      fakeOrm({
        quotation: { recipientId: 'u1', kind: 'RFQ_INVITED', requestId: 'req-1' },
        user,
        preference: { emailEnabled: false },
      }),
    );
    expect(await load('n1')).toMatchObject({ emailEnabled: false });
  });

  it('returns null when the notice or the recipient is gone', async () => {
    expect(await createNoticeLoader(fakeOrm({}))('gone')).toBeNull();
    const noUser = fakeOrm({
      quotation: { recipientId: 'u1', kind: 'RFQ_INVITED', requestId: 'req-1' },
    });
    expect(await createNoticeLoader(noUser)('n1')).toBeNull();
  });
});
