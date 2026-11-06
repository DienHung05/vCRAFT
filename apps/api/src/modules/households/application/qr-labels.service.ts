import { type EntityManager, MikroORM } from '@mikro-orm/core';
import { Inject, Injectable } from '@nestjs/common';
import type { QrLabelsDto } from '@vcraft/contracts';
import { Household, OutboxEvent, Product } from '@vcraft/database';
import { type ObjectStorage, PRESIGN_TTL_SECONDS } from '@vcraft/storage';
import { v7 as uuidv7 } from 'uuid';
import type { Actor } from '../../../common/auth/auth.guard';
import { forbidden, notFound } from '../../../common/errors/app-error';
import { OBJECT_STORAGE } from '../../../infrastructure/storage/storage.module';

/** Outbox event the worker turns into a `qr.labels` job (apps/worker `dispatch.ts`). */
export const QR_LABELS_REQUESTED_EVENT = 'qr.labels.requested';

/** Same key as the worker's `qrLabelsKey`. */
const keyOf = (householdId: string, requestId: string) =>
  `qr-labels/${householdId}/${requestId}.pdf`;

/**
 * Printable QR label sheets (PLAN E6, FR-TRC): the request is queued through the outbox, the worker
 * renders the PDF into the private bucket, and the household polls until a presigned link is ready.
 */
@Injectable()
export class QrLabelsService {
  constructor(
    private readonly orm: MikroORM,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  async request(
    actor: Actor,
    input: { productIds: string[]; copies: number },
  ): Promise<QrLabelsDto> {
    return this.orm.em.fork().transactional(async (em) => {
      const household = await this.own(em, actor);
      const ids = [...new Set(input.productIds)];
      const products = await em.find(Product, { id: { $in: ids }, household });
      if (products.length !== ids.length) throw forbidden('products are not yours');
      // Labels follow the order the products were picked in, each repeated `copies` times.
      const byId = new Map(products.map((p) => [p.id, p.traceCode]));
      const codes = ids.flatMap((id) => Array(input.copies).fill(byId.get(id) as string));
      const requestId = uuidv7();
      em.create(OutboxEvent, {
        type: QR_LABELS_REQUESTED_EVENT,
        payload: { requestId, householdId: household.id, codes },
      });
      await em.flush();
      return { requestId, status: 'PENDING', url: null };
    });
  }

  async status(actor: Actor, requestId: string): Promise<QrLabelsDto> {
    const household = await this.own(this.orm.em.fork(), actor);
    const key = keyOf(household.id, requestId);
    try {
      await this.storage.get('private', key);
    } catch {
      return { requestId, status: 'PENDING', url: null };
    }
    return {
      requestId,
      status: 'READY',
      url: await this.storage.presignGet(key, PRESIGN_TTL_SECONDS),
    };
  }

  private async own(em: EntityManager, actor: Actor) {
    const household = await em.findOne(Household, { representative: actor.id });
    if (!household) throw notFound();
    return household;
  }
}
