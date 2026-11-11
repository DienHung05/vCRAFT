import { screen, within } from '@testing-library/react';
import type { QuotationClient } from '@vcraft/api-client';
import { describe, expect, it, vi } from 'vitest';
import { QuotationInvitations } from '@/features/studio/quotation-invitations';
import { renderVi } from './render';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/x">{children}</a>,
}));

describe('Household request stages', () => {
  it.each([
    ['SENT', false, 'Đã gửi'],
    ['IN_PRODUCTION', true, 'Đang sản xuất'],
    ['DELIVERED', true, 'Đã giao'],
    ['CANCELLED', true, 'Đã hủy'],
    ['EXPIRED', false, 'Hết hạn'],
  ] as const)('shows the current %s stage on invitations', async (status, hasBids, label) => {
    const client = {
      listInvitations: async () => [
        {
          request: {
            id: 'one',
            title: 'Logo cups',
            quantity: 100,
            unit: 'cup',
            biddingClosesAt: '2100-01-01T00:00:00Z',
            status,
            hasBids,
          },
          contribution: null,
          directQuotation: null,
          declined: false,
        },
      ],
    } as unknown as QuotationClient;
    renderVi(<QuotationInvitations client={client} />);
    const nav = await screen.findByRole('navigation', { name: 'Tiến trình của yêu cầu báo giá' });
    expect(within(nav).getByText(label).closest('li')?.getAttribute('aria-current')).toBe('step');
    expect(nav.querySelector('[tabindex="0"]')).not.toBeNull();
  });
});
