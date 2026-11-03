import { describe, expect, it, vi } from 'vitest';
import {
  type MailTransport,
  type NoticeRecipient,
  sendNoticeMail,
} from '../src/processors/mail/send-notice-mail';
import { createOutboxDispatcher } from '../src/processors/outbox/dispatch';

describe('outbox dispatcher: quotation.notice', () => {
  it('adds one mail job per notice with a deterministic jobId', async () => {
    const mail = { add: vi.fn(async () => undefined) };
    const media = { add: vi.fn(async () => undefined) };
    const dispatch = createOutboxDispatcher({ media, mail, qrLabels: media, scheduler: media });
    await dispatch({ id: 'e1', type: 'quotation.notice', payload: { noticeIds: ['n1', 'n2'] } });
    expect(mail.add.mock.calls).toEqual([
      ['send', { noticeId: 'n1' }, { jobId: 'mail-n1' }],
      ['send', { noticeId: 'n2' }, { jobId: 'mail-n2' }],
    ]);
    expect(media.add).not.toHaveBeenCalled();
  });

  it('routes notification.created to the same mail queue', async () => {
    const mail = { add: vi.fn(async () => undefined) };
    const media = { add: vi.fn(async () => undefined) };
    const dispatch = createOutboxDispatcher({ media, mail, qrLabels: media, scheduler: media });
    await dispatch({ id: 'e3', type: 'notification.created', payload: { noticeIds: ['n9'] } });
    expect(mail.add.mock.calls).toEqual([['send', { noticeId: 'n9' }, { jobId: 'mail-n9' }]]);
  });

  it('ignores a payload without notice ids', async () => {
    const mail = { add: vi.fn(async () => undefined) };
    const dispatch = createOutboxDispatcher({ media: mail, mail, qrLabels: mail, scheduler: mail });
    await dispatch({ id: 'e2', type: 'quotation.notice', payload: {} });
    expect(mail.add).not.toHaveBeenCalled();
  });
});

describe('sendNoticeMail', () => {
  const recipient: NoticeRecipient = {
    kind: 'ALLOCATION_PROPOSED',
    subjectId: 'req-1',
    email: 'rep@example.com',
    role: 'HOUSEHOLD',
    emailEnabled: true,
  };

  function fakeTransport() {
    const sent: Array<Parameters<MailTransport['sendMail']>[0]> = [];
    const transport: MailTransport = {
      async sendMail(message) {
        sent.push(message);
      },
    };
    return { transport, sent };
  }

  it('sends the built message to the recipient through the injected transport', async () => {
    const { transport, sent } = fakeTransport();
    const delivered = await sendNoticeMail(
      {
        loadNotice: async () => recipient,
        transport,
        from: 'vCraft <no-reply@vcraft.local>',
        appUrl: 'http://localhost:8080',
      },
      'n1',
    );
    expect(delivered).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      from: 'vCraft <no-reply@vcraft.local>',
      to: 'rep@example.com',
      subject: '[vCraft] Bạn có phần sản xuất cần xác nhận',
    });
    expect(sent[0]?.text).toContain('http://localhost:8080/vi/studio/de-xuat-tham-gia/req-1');
  });

  it('does not send when the recipient turned email off for this kind', async () => {
    const { transport, sent } = fakeTransport();
    const delivered = await sendNoticeMail(
      {
        loadNotice: async () => ({ ...recipient, emailEnabled: false }),
        transport,
        from: 'x',
        appUrl: 'http://x',
      },
      'n1',
    );
    expect(delivered).toBe(false);
    expect(sent).toHaveLength(0);
  });

  it('skips silently when the notice or recipient is missing', async () => {
    const { transport, sent } = fakeTransport();
    const delivered = await sendNoticeMail(
      { loadNotice: async () => null, transport, from: 'x', appUrl: 'http://x' },
      'gone',
    );
    expect(delivered).toBe(false);
    expect(sent).toHaveLength(0);
  });

  it('propagates SMTP failures so BullMQ retries the job', async () => {
    const transport: MailTransport = {
      async sendMail() {
        throw new Error('smtp down');
      },
    };
    await expect(
      sendNoticeMail(
        { loadNotice: async () => recipient, transport, from: 'x', appUrl: 'http://x' },
        'n1',
      ),
    ).rejects.toThrow('smtp down');
  });
});
