import { describe, expect, it } from 'vitest';
import { quotationTab } from '@/lib/auth/quotation-tab';

describe('quotationTab', () => {
  it.each([
    [null, '/yeu-cau-bao-gia', 'quotes'],
    ['BUYER', '/yeu-cau-bao-gia', 'quotes'],
    ['HOUSEHOLD', '/studio/bao-gia', 'invitations'],
    ['ADMIN', '/admin/dieu-phoi', 'coordination'],
  ] as const)('maps %s to %s', (role, href, labelKey) => {
    expect(quotationTab(role)).toEqual({ href, labelKey });
  });
});
