import { DomainError } from '../shared/domain-error';
import { err, ok, type Result } from '../shared/result';

/**
 * Ghi công người làm (vCRAFT-9hg.2, 9hg.6): công làm ra món đồ ghi cho từng nghệ nhân có tên, theo
 * phần việc của họ. Tài khoản đăng bài là "ban điều hành hộ", không bao giờ được ghi là người làm.
 */
export const POSTED_BY_ADMINISTRATION = 'HOUSEHOLD_ADMINISTRATION' as const;

export interface MakerCreditInput {
  readonly artisanId: string;
  readonly contribution: string;
}

export type MakerCreditCode = 'MAKER_NOT_IN_HOUSEHOLD' | 'MAKER_DUPLICATED' | 'MAKER_REQUIRED';

/** Mỗi nghệ nhân xuất hiện một lần, phải thuộc hộ sở hữu sản phẩm, và có ít nhất một người. */
export function checkMakerCredits(
  credits: readonly MakerCreditInput[],
  householdArtisanIds: ReadonlySet<string>,
): Result<void, DomainError<MakerCreditCode>> {
  if (credits.length === 0) {
    return err(new DomainError('MAKER_REQUIRED', 'name at least one maker'));
  }
  const seen = new Set<string>();
  for (const credit of credits) {
    if (!householdArtisanIds.has(credit.artisanId)) {
      return err(
        new DomainError('MAKER_NOT_IN_HOUSEHOLD', 'maker must belong to the household', {
          artisanId: credit.artisanId,
        }),
      );
    }
    if (seen.has(credit.artisanId)) {
      return err(
        new DomainError('MAKER_DUPLICATED', 'each maker is credited once', {
          artisanId: credit.artisanId,
        }),
      );
    }
    seen.add(credit.artisanId);
  }
  return ok(undefined);
}
