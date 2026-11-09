import type { EntityManager } from '@mikro-orm/core';
import { MikroORM } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import type { ConsentDto, ConsentListResponse, RecordConsentRequest } from '@vcraft/contracts';
import { AuditLog, ConsentRecord } from '@vcraft/database';
import {
  type ConsentPurpose,
  isCurrentPolicyVersion,
  PRIVACY_POLICY_VERSION,
} from '@vcraft/domain';
import type { Actor } from '../../../common/auth/auth.guard';
import { AppError } from '../../../common/errors/app-error';

export const toConsentDto = (record: ConsentRecord): ConsentDto => ({
  id: record.id,
  purpose: record.purpose,
  policyVersion: record.policyVersion,
  givenAt: record.createdAt.toISOString(),
  withdrawnAt: record.withdrawnAt?.toISOString() ?? null,
});

/**
 * Recorded consent (NFR-SEC-07): who agreed to what, under which policy version, and when. Actions
 * that collect personal data call {@link ConsentService.require} and are refused without a record for
 * the current policy version. A person can withdraw a consent again (Decree 13/2023/ND-CP Art. 12): the
 * row stays as history, stops counting, and consenting again adds a new row.
 */
@Injectable()
export class ConsentService {
  constructor(private readonly orm: MikroORM) {}

  /** Idempotent: consent already on record for the same purpose and version is returned as it is. */
  async record(actor: Actor, input: RecordConsentRequest): Promise<ConsentDto> {
    if (!isCurrentPolicyVersion(input.policyVersion)) {
      throw new AppError('VALIDATION_FAILED', undefined, [
        {
          path: 'policyVersion',
          message: `Phiên bản chính sách không còn hiệu lực; hãy tải lại trang (hiện là ${PRIVACY_POLICY_VERSION}).`,
          code: 'policy_version_outdated',
        },
      ]);
    }
    const em = this.orm.em.fork();
    const existing = await em.findOne(ConsentRecord, {
      userId: actor.id,
      purpose: input.purpose,
      policyVersion: input.policyVersion,
      withdrawnAt: null,
    });
    if (existing) return toConsentDto(existing);
    const created = em.create(ConsentRecord, {
      userId: actor.id,
      purpose: input.purpose,
      policyVersion: input.policyVersion,
    });
    await em.flush();
    return toConsentDto(created);
  }

  async list(actor: Actor): Promise<ConsentListResponse> {
    const records = await this.orm.em
      .fork()
      .find(ConsentRecord, { userId: actor.id }, { orderBy: { createdAt: 'asc', id: 'asc' } });
    return { currentPolicyVersion: PRIVACY_POLICY_VERSION, data: records.map(toConsentDto) };
  }

  /**
   * Withdraw the consent for `purpose`: every standing record of it is marked withdrawn and an audit entry
   * is written. Withdrawing a consent that is not standing changes nothing. `SIGN_UP` is refused: it is
   * the basis for having an account, so withdrawing it means deleting the account.
   */
  async withdraw(actor: Actor, purpose: ConsentPurpose): Promise<ConsentListResponse> {
    if (purpose === 'SIGN_UP') {
      throw new AppError('VALIDATION_FAILED', undefined, [
        {
          path: 'purpose',
          message:
            'Sự đồng ý khi đăng ký không rút riêng được; muốn rút, hãy xóa tài khoản (DELETE /me).',
          code: 'consent_not_withdrawable',
        },
      ]);
    }
    await this.orm.em.fork().transactional(async (em) => {
      const standing = await em.find(ConsentRecord, {
        userId: actor.id,
        purpose,
        withdrawnAt: null,
      });
      if (standing.length === 0) return;
      const now = new Date();
      for (const row of standing) row.withdrawnAt = now;
      em.create(AuditLog, {
        actorId: actor.id,
        action: 'consent.withdraw',
        entity: 'consent',
        entityId: actor.id,
        before: null,
        after: { purpose },
      });
    });
    return this.list(actor);
  }

  /** Throws `CONSENT_REQUIRED` unless the person consented to `purpose` under the current policy. */
  async require(userId: string, purpose: ConsentPurpose, em?: EntityManager): Promise<void> {
    const found = await (em ?? this.orm.em.fork()).count(ConsentRecord, {
      userId,
      purpose,
      policyVersion: PRIVACY_POLICY_VERSION,
      withdrawnAt: null,
    });
    if (found === 0) {
      throw new AppError(
        'CONSENT_REQUIRED',
        `consent to the privacy policy for ${purpose} is required`,
      );
    }
  }
}
