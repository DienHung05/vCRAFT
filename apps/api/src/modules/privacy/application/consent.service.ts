import type { EntityManager } from '@mikro-orm/core';
import { MikroORM } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import type { ConsentDto, ConsentListResponse, RecordConsentRequest } from '@vcraft/contracts';
import { ConsentRecord } from '@vcraft/database';
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
});

/**
 * Recorded consent (NFR-SEC-07): who agreed to what, under which policy version, and when. Actions
 * that collect personal data call {@link ConsentService.require} and are refused without a record for
 * the current policy version.
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

  /** Throws `CONSENT_REQUIRED` unless the person consented to `purpose` under the current policy. */
  async require(userId: string, purpose: ConsentPurpose, em?: EntityManager): Promise<void> {
    const found = await (em ?? this.orm.em.fork()).count(ConsentRecord, {
      userId,
      purpose,
      policyVersion: PRIVACY_POLICY_VERSION,
    });
    if (found === 0) {
      throw new AppError(
        'CONSENT_REQUIRED',
        `consent to the privacy policy for ${purpose} is required`,
      );
    }
  }
}
