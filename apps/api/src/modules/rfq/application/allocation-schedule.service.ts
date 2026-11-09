import { type EntityManager, MikroORM } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import type { AllocationScheduleDto, ReallocateRequest } from '@vcraft/contracts';
import { AuditLog, Household, OrderAllocation, type QuotationRequest } from '@vcraft/database';
import { allocationTransition, reallocate } from '@vcraft/domain';
import type { Actor } from '../../../common/auth/auth.guard';
import { assertVersion, unwrap } from '../../../common/domain/unwrap';
import { AppError, forbidden, notFound } from '../../../common/errors/app-error';
import { allocationTimeline } from './allocation-timeline';
import { assertWithinCapacity } from './household-capacity';
import { QuotationNotifier } from './quotation-notifier';

/** Shares still being made: they count in the order total and can take reallocated pieces. */
const ACTIVE = ['CONFIRMED', 'IN_PROGRESS'] as const;

/** The completion date the household promised for this share, from the accepted quotation. */
function dueOf(allocation: OrderAllocation): Date | null {
  const part = allocation.quotation.parts.find((p) => p.householdId === allocation.household.id);
  return part ? new Date(part.completionDate) : null;
}

/**
 * Allocation timeline and reallocation for the village board (PLAN E10, FR-ORD-09). The expected curve
 * runs from when the share was handed out to the date the household committed to in its offer.
 */
@Injectable()
export class AllocationScheduleService {
  constructor(
    private readonly orm: MikroORM,
    private readonly notifier: QuotationNotifier,
  ) {}

  async schedule(now = new Date()): Promise<AllocationScheduleDto> {
    const em = this.orm.em.fork();
    const rows = await em.find(
      OrderAllocation,
      {
        // A declined share still waiting to be reallocated shows up so the board can act on it (GH#246).
        $or: [
          { status: { $in: [...ACTIVE, 'DONE'] } },
          { status: 'DECLINED', quantity: { $gt: 0 } },
        ],
        quotation: { request: { status: { $in: ['ACCEPTED', 'IN_PRODUCTION'] } } },
      },
      { populate: ['household', 'quotation.request'], orderBy: { createdAt: 'asc' } },
    );
    const byRequest = new Map<string, AllocationScheduleDto[number]>();
    for (const allocation of rows) {
      const request = allocation.quotation.request as QuotationRequest;
      const timeline = allocationTimeline(allocation, now);
      const entry = byRequest.get(request.id) ?? {
        requestId: request.id,
        title: request.title ?? request.design.slice(0, 80),
        unit: request.unit,
        requiredBy: request.requiredBy.toISOString(),
        allocations: [],
      };
      entry.allocations.push({
        id: allocation.id,
        version: allocation.version,
        householdId: allocation.household.id,
        ...timeline,
        quantity: allocation.quantity,
        completedQty: allocation.completedQty,
        status: allocation.status,
      });
      byRequest.set(request.id, entry);
    }
    return [...byRequest.values()];
  }

  /**
   * Moves the unfinished quantity of a share in production to other approved households. The late share
   * keeps what it made (closed as DONE, or CANCELLED if it made nothing); a target already in the order
   * gets its share raised, a new one gets an IN_PROGRESS share due on the late share's date. The order
   * total is checked unchanged before anything is written.
   */
  async reallocate(
    actor: Actor,
    allocationId: string,
    version: number,
    input: ReallocateRequest,
  ): Promise<AllocationScheduleDto> {
    if (actor.locked) throw forbidden();
    await this.orm.em.fork().transactional(async (em) => {
      const late = await em.findOne(OrderAllocation, allocationId, {
        populate: ['quotation.request', 'household'],
      });
      if (!late) throw notFound();
      assertVersion(late, version);
      const quotation = late.quotation;
      const request = quotation.request as QuotationRequest;
      // A declined share is handed out again before production starts (FR-ORD-05, GH#246).
      if (request.status === 'ACCEPTED' && late.status === 'DECLINED' && late.quantity > 0) {
        await this.checkTargets(em, input);
        await this.reallocateDeclined(em, actor, late, request, input);
        return;
      }
      if (request.status !== 'IN_PRODUCTION' || late.status !== 'IN_PROGRESS')
        throw new AppError('INVALID_TRANSITION', 'only a share in production can be reallocated');
      await this.checkTargets(em, input);

      const active = await em.find(
        OrderAllocation,
        { quotation, status: { $in: [...ACTIVE] } },
        { populate: ['household'], orderBy: { createdAt: 'asc' } },
      );
      const result = reallocate(
        active.map((a) => ({
          householdId: a.household.id,
          quantity: a.quantity,
          completedQty: a.completedQty,
        })),
        active.findIndex((a) => a.id === late.id),
        input.targets,
      );
      if (!result.ok) throw new AppError('VALIDATION_FAILED', result.error.message);
      await this.checkCapacity(em, request, active, result.value);
      const total = (rows: readonly { quantity: number }[]) =>
        rows.reduce((sum, row) => sum + row.quantity, 0);
      if (total(result.value) !== total(active))
        throw new AppError('VALIDATION_FAILED', 'order total changed');

      const remaining = late.quantity - late.completedQty;
      const dueAt = dueOf(late) ?? request.requiredBy;
      const unitPriceVnd =
        quotation.parts.find((p) => p.householdId === late.household.id)?.unitPriceVnd ?? 0;
      const touched: string[] = [];
      for (const share of result.value) {
        const row = active.find((a) => a.household.id === share.householdId);
        if (row) {
          if (row.id !== late.id && row.quantity !== share.quantity)
            touched.push(share.householdId);
          row.quantity = share.quantity;
          continue;
        }
        em.create(OrderAllocation, {
          quotation,
          household: em.getReference(Household, share.householdId),
          quantity: share.quantity,
          status: 'IN_PROGRESS',
        });
        touched.push(share.householdId);
        // The new household inherits the late share's due date and unit price for the timeline.
        quotation.parts = [
          ...quotation.parts,
          {
            householdId: share.householdId,
            quantity: share.quantity,
            unitPriceVnd,
            completionDate: dueAt.toISOString(),
            contributionVersion: 0,
          },
        ];
      }
      late.quantity = late.completedQty;
      // The late share closes with what it made (FR-ORD-09).
      late.status = unwrap(
        late.completedQty > 0
          ? allocationTransition(late.status, 'COMPLETE', {
              quantity: late.quantity,
              completedQty: late.completedQty,
            })
          : allocationTransition(late.status, 'CANCEL', {}),
      );

      em.create(AuditLog, {
        actorId: actor.id,
        action: 'allocation.reallocate',
        entity: 'OrderAllocation',
        entityId: late.id,
        before: { householdId: late.household.id, remaining },
        after: { targets: input.targets },
      });
      await this.notifier.notify(em, {
        kind: 'ALLOCATION_INCREASED',
        requestId: request.id,
        quotationId: quotation.id,
        actorId: actor.id,
        recipientIds: await this.notifier.representativeIds(em, touched),
      });
      // FR-ORD-09: the late household learns that the rest of its share moved to others.
      await this.notifier.notify(em, {
        kind: 'ALLOCATION_REASSIGNED',
        requestId: request.id,
        quotationId: quotation.id,
        actorId: actor.id,
        recipientIds: await this.notifier.representativeIds(em, [late.household.id]),
      });
      request.revision++;
      await em.flush();
    });
    return this.schedule();
  }

  /**
   * Hands a declined share's quantity to other approved households. New households get a PROPOSED share;
   * a household already in the order gets its share raised and confirms again (CONFIRMED → PROPOSED). The
   * declined share keeps its status and drops to zero, and the audit entry records what it held.
   */
  private async reallocateDeclined(
    em: EntityManager,
    actor: Actor,
    declined: OrderAllocation,
    request: QuotationRequest,
    input: ReallocateRequest,
  ) {
    const quotation = declined.quotation;
    const open = await em.find(
      OrderAllocation,
      { quotation, status: { $in: ['PROPOSED', 'CONFIRMED'] } },
      { populate: ['household'], orderBy: { createdAt: 'asc' } },
    );
    if (input.targets.some((t) => t.householdId === declined.household.id))
      throw new AppError('VALIDATION_FAILED', 'the declining household cannot take the share back');
    const rows = [...open, declined];
    const result = reallocate(
      rows.map((a) => ({ householdId: a.household.id, quantity: a.quantity, completedQty: 0 })),
      rows.length - 1,
      input.targets,
    );
    if (!result.ok) throw new AppError('VALIDATION_FAILED', result.error.message);
    await this.checkCapacity(em, request, rows, result.value);
    const before = declined.quantity;
    const dueAt = dueOf(declined) ?? request.requiredBy;
    const unitPriceVnd =
      quotation.parts.find((p) => p.householdId === declined.household.id)?.unitPriceVnd ?? 0;
    const touched: string[] = [];
    for (const share of result.value) {
      if (share.householdId === declined.household.id) continue;
      const row = open.find((a) => a.household.id === share.householdId);
      if (row) {
        if (row.quantity === share.quantity) continue;
        row.quantity = share.quantity;
        if (row.status === 'CONFIRMED')
          row.status = unwrap(allocationTransition(row.status, 'REOPEN', {}));
        touched.push(share.householdId);
        continue;
      }
      em.create(OrderAllocation, {
        quotation,
        household: em.getReference(Household, share.householdId),
        quantity: share.quantity,
        status: 'PROPOSED',
      });
      touched.push(share.householdId);
      quotation.parts = [
        ...quotation.parts,
        {
          householdId: share.householdId,
          quantity: share.quantity,
          unitPriceVnd,
          completionDate: dueAt.toISOString(),
          contributionVersion: 0,
        },
      ];
    }
    declined.quantity = 0;
    em.create(AuditLog, {
      actorId: actor.id,
      action: 'allocation.reallocate',
      entity: 'OrderAllocation',
      entityId: declined.id,
      before: { householdId: declined.household.id, remaining: before, status: 'DECLINED' },
      after: { targets: input.targets },
    });
    await this.notifier.notify(em, {
      kind: 'ALLOCATION_PROPOSED',
      requestId: request.id,
      quotationId: quotation.id,
      actorId: actor.id,
      recipientIds: await this.notifier.representativeIds(em, touched),
    });
    request.revision++;
    await em.flush();
  }

  /**
   * BR-L6: a household whose share is raised by a reallocation must stay within the capacity it declared
   * for the request's category. A share that did not grow is left alone, so an older over-capacity share
   * does not block moving the work away from it.
   */
  private async checkCapacity(
    em: EntityManager,
    request: QuotationRequest,
    before: readonly OrderAllocation[],
    after: readonly { householdId: string; quantity: number }[],
  ) {
    const previous = new Map(before.map((a) => [a.household.id, a.quantity]));
    const raised = after.filter((s) => s.quantity > (previous.get(s.householdId) ?? 0));
    if (raised.length === 0 || !request.category) return;
    const households = await em.find(Household, { id: { $in: raised.map((s) => s.householdId) } });
    for (const share of raised) {
      const household = households.find((h) => h.id === share.householdId);
      if (household) assertWithinCapacity(household, request.category, share.quantity);
    }
  }

  private async checkTargets(em: EntityManager, input: ReallocateRequest) {
    const ids = [...new Set(input.targets.map((t) => t.householdId))];
    const approved = await em.count(Household, { id: { $in: ids }, status: 'APPROVED' });
    if (approved !== ids.length)
      throw new AppError('VALIDATION_FAILED', 'targets must be approved households');
  }
}
