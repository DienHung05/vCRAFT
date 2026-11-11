import type { AccountRole } from '@vcraft/domain';

export type QuotationTabHref = '/yeu-cau-bao-gia' | '/studio/yeu-cau-mo' | '/admin/dieu-phoi';
export type QuotationTabLabelKey = 'quotes' | 'openRequests' | 'coordination';

/**
 * The header's quotation tab depends on who looks at it (GH#388): a guest or buyer opens the buyer
 * area, a household representative browses the open coordinated requests in Studio (GH#490: the
 * invitations answered at `/studio/bao-gia` already have their own Studio tab), an administrator
 * coordinates.
 * `null` is a guest, or a viewer whose role is not known yet.
 */
export function quotationTab(role: AccountRole | null): {
  href: QuotationTabHref;
  labelKey: QuotationTabLabelKey;
} {
  switch (role) {
    case 'HOUSEHOLD':
      return { href: '/studio/yeu-cau-mo', labelKey: 'openRequests' };
    case 'ADMIN':
      return { href: '/admin/dieu-phoi', labelKey: 'coordination' };
    default:
      return { href: '/yeu-cau-bao-gia', labelKey: 'quotes' };
  }
}
