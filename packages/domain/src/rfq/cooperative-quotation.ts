import { checkAllocationPlan } from '../allocation/allocation-plan';
import { DomainError } from '../shared/domain-error';
import { err, ok, type Result } from '../shared/result';

export interface ContributionOffer {
  readonly householdId: string;
  readonly maxQuantity: number;
  readonly unitPriceVnd: number;
  readonly completionDate: Date;
  readonly version: number;
}

export interface CooperativeQuotationPart {
  readonly householdId: string;
  readonly quantity: number;
  readonly unitPriceVnd: number;
  readonly completionDate: Date;
  readonly contributionVersion: number;
}

export const DELIVERY_TERMS = ['INCLUDED', 'SEPARATE'] as const;
export type DeliveryTerms = (typeof DELIVERY_TERMS)[number];

export interface CooperativeQuotation {
  readonly quantity: number;
  readonly parts: readonly CooperativeQuotationPart[];
  readonly productionTotalVnd: number;
  readonly additionalChargeVnd: number;
  readonly totalVnd: number;
  readonly deliveryTerms: DeliveryTerms;
}

export interface CooperativeQuotationDraft {
  readonly requiredQuantity: number;
  readonly biddingClosesAt: Date;
  readonly requiredBy: Date;
  readonly contributions: readonly ContributionOffer[];
  readonly parts: readonly CooperativeQuotationPart[];
  readonly additionalChargeVnd: number;
  readonly deliveryTerms: DeliveryTerms;
}

export type QuotationErrorCode =
  | 'QUOTATION_INPUT_INVALID'
  | 'QUOTATION_QUANTITY_MISMATCH'
  | 'CONTRIBUTION_NOT_FOUND'
  | 'CONTRIBUTION_DUPLICATE'
  | 'CONTRIBUTION_QUANTITY_EXCEEDED'
  | 'CONTRIBUTION_PRICE_MISMATCH'
  | 'CONTRIBUTION_DATE_MISMATCH'
  | 'CONTRIBUTION_VERSION_MISMATCH'
  | 'COMPLETION_DATE_INVALID';

const isWhole = (value: number, minimum: number) => Number.isSafeInteger(value) && value >= minimum;

export function isCompletionDateValid(
  completionDate: Date,
  biddingClosesAt: Date,
  requiredBy: Date,
): boolean {
  const completion = completionDate.getTime();
  return completion > biddingClosesAt.getTime() && completion <= requiredBy.getTime();
}

/** Manual composition uses current per-request offers. It never reserves other requests' capacity. */
export function assembleCooperativeQuotation(
  draft: CooperativeQuotationDraft,
): Result<CooperativeQuotation, DomainError<QuotationErrorCode>> {
  const fail = (code: QuotationErrorCode) => err(new DomainError(code, code));
  if (
    !isWhole(draft.requiredQuantity, 1) ||
    !isWhole(draft.additionalChargeVnd, 0) ||
    !DELIVERY_TERMS.includes(draft.deliveryTerms) ||
    !(draft.requiredBy.getTime() > draft.biddingClosesAt.getTime())
  ) {
    return fail('QUOTATION_INPUT_INVALID');
  }

  const offers = new Map(draft.contributions.map((offer) => [offer.householdId, offer]));
  const seen = new Set<string>();
  let productionTotalVnd = 0;
  for (const part of draft.parts) {
    if (seen.has(part.householdId)) return fail('CONTRIBUTION_DUPLICATE');
    seen.add(part.householdId);
    if (
      !isWhole(part.quantity, 1) ||
      !isWhole(part.unitPriceVnd, 1) ||
      !isWhole(part.contributionVersion, 0)
    ) {
      return fail('QUOTATION_INPUT_INVALID');
    }
    if (!isCompletionDateValid(part.completionDate, draft.biddingClosesAt, draft.requiredBy)) {
      return fail('COMPLETION_DATE_INVALID');
    }
    const offer = offers.get(part.householdId);
    if (!offer) return fail('CONTRIBUTION_NOT_FOUND');
    if (part.contributionVersion !== offer.version) return fail('CONTRIBUTION_VERSION_MISMATCH');
    if (!isWhole(offer.maxQuantity, 1) || part.quantity > offer.maxQuantity) {
      return fail('CONTRIBUTION_QUANTITY_EXCEEDED');
    }
    if (part.unitPriceVnd !== offer.unitPriceVnd) return fail('CONTRIBUTION_PRICE_MISMATCH');
    if (part.completionDate.getTime() !== offer.completionDate.getTime()) {
      return fail('CONTRIBUTION_DATE_MISMATCH');
    }
    productionTotalVnd += part.quantity * part.unitPriceVnd;
    if (!isWhole(productionTotalVnd, 0)) return fail('QUOTATION_INPUT_INVALID');
  }

  const check = checkAllocationPlan(
    draft.requiredQuantity,
    draft.parts.map((part) => ({
      quantity: part.quantity,
      capacity: offers.get(part.householdId)?.maxQuantity ?? 0,
    })),
  );
  if (!check.ok) return fail('QUOTATION_QUANTITY_MISMATCH');
  const totalVnd = productionTotalVnd + draft.additionalChargeVnd;
  if (!isWhole(totalVnd, 0)) return fail('QUOTATION_INPUT_INVALID');

  return ok({
    quantity: draft.requiredQuantity,
    parts: draft.parts.map((part) => ({ ...part, completionDate: new Date(part.completionDate) })),
    productionTotalVnd,
    additionalChargeVnd: draft.additionalChargeVnd,
    totalVnd,
    deliveryTerms: draft.deliveryTerms,
  });
}

/** Allowlist buyer fields. Do not spread the private quotation or any private part here. */
export function projectBuyerQuotation(quotation: CooperativeQuotation) {
  return {
    quantity: quotation.quantity,
    parts: quotation.parts.map((part) => ({
      householdId: part.householdId,
      quantity: part.quantity,
      completionDate: new Date(part.completionDate),
    })),
    productionTotalVnd: quotation.productionTotalVnd,
    additionalChargeVnd: quotation.additionalChargeVnd,
    totalVnd: quotation.totalVnd,
    deliveryTerms: quotation.deliveryTerms,
  };
}
