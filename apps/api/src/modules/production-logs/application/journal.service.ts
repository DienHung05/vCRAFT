import { type EntityManager, LockMode, MikroORM } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import type {
  CreateJournalEntryRequest,
  JournalDto,
  UpdateJournalEntryRequest,
} from '@vcraft/contracts';
import { JournalEntry, Product, queueExhibitionChange } from '@vcraft/database';
import {
  checkDraftEdit,
  checkNewEntry,
  computeEntryHash,
  GENESIS,
  type JournalState,
  verifyChain,
} from '@vcraft/domain';
import { productTag, traceTag } from '@vcraft/utils';
import type { Actor } from '../../../common/auth/auth.guard';
import { deniedAccess } from '../../../common/auth/denied-access';
import { assertVersion, unwrap } from '../../../common/domain/unwrap';
import { AppError, forbidden, notFound } from '../../../common/errors/app-error';
import { MediaService } from '../../media/application/media.service';
import { loadEntries, loadJournal, toChainEntry, toJournalDto } from './journal.queries';

/**
 * Viết nhật ký sản xuất (vCRAFT-9hg.4):
 * - Mỗi lần ghi khóa dòng sản phẩm (PESSIMISTIC_WRITE, chạy được trên PostgreSQL và MySQL) để `seq`
 *   và `prevHash` không bị hai request tranh nhau.
 * - Trước khi ghi thêm, backend kiểm lại toàn bộ chuỗi đang lưu; chuỗi gãy thì từ chối ghi.
 * - Trước lần xuất bản đầu tiên được sửa/xóa mốc; chuỗi được niêm phong lại từ mốc bị đổi trở đi.
 */
@Injectable()
export class JournalService {
  constructor(
    private readonly orm: MikroORM,
    private readonly media: MediaService,
  ) {}

  async get(actor: Actor, productId: string): Promise<JournalDto> {
    const em = this.orm.em.fork();
    const product = await this.ownProduct(em, actor, productId);
    return loadJournal(em, product, this.media);
  }

  async append(
    actor: Actor,
    productId: string,
    input: CreateJournalEntryRequest,
  ): Promise<JournalDto> {
    return this.orm.em.fork().transactional(async (em) => {
      const product = await this.ownProduct(em, actor, productId, true);
      await this.assertOwnImages(actor, input.images);
      const entries = await loadEntries(em, product);

      const supersedes =
        input.supersedesEntryId === undefined
          ? undefined
          : entries.find((e) => e.id === input.supersedesEntryId);
      if (input.supersedesEntryId !== undefined && !supersedes) {
        throw new AppError('JOURNAL_CORRECTION_TARGET_NOT_FOUND');
      }
      unwrap(
        checkNewEntry(this.state(actor, product, entries), {
          stage: input.stage,
          skipReason: input.skipReason,
          supersedesSeq: supersedes?.seq,
        }),
      );

      const chain = entries.map(toChainEntry);
      const verified = await verifyChain(product.id, chain);
      if (!verified.ok) {
        throw new AppError(
          'JOURNAL_INTEGRITY_BROKEN',
          `entry ${verified.index + 1} failed the ${verified.reason} check`,
        );
      }

      const entry = em.create(JournalEntry, {
        product,
        seq: entries.length,
        stage: input.stage,
        declaredDate: input.declaredDate,
        note: input.note,
        images: input.images,
        supersedes: supersedes ?? null,
        skipReason: input.skipReason || null,
        prevHash: chain.at(-1)?.hash ?? GENESIS,
        hash: '',
      });
      entry.hash = await computeEntryHash(product.id, toChainEntry(entry));
      // A new or correcting entry shows on the trace page and the product page (ADR-0027).
      queueExhibitionChange(em, [productTag(product.slug), traceTag(product.traceCode)]);
      await em.flush();
      return toJournalDto(product, [...entries, entry], this.media);
    });
  }

  /** Sửa trực tiếp một mốc nháp (chỉ trước lần xuất bản đầu tiên). */
  async updateDraft(
    actor: Actor,
    entryId: string,
    expectedVersion: number,
    input: UpdateJournalEntryRequest,
  ): Promise<JournalDto> {
    const productId = await this.entryProductId(entryId);
    return this.orm.em.fork().transactional(async (em) => {
      const { product, entries, entry } = await this.ownEntry(em, actor, entryId, productId);
      unwrap(checkDraftEdit(this.state(actor, product, entries)));
      assertVersion(entry, expectedVersion);
      await this.assertOwnImages(actor, input.images);
      const before = entries.filter((e) => e.seq < entry.seq);
      unwrap(
        checkNewEntry(
          { entries: before, published: false, frozen: false },
          { stage: input.stage, skipReason: input.skipReason },
        ),
      );
      Object.assign(entry, {
        stage: input.stage,
        declaredDate: input.declaredDate,
        note: input.note,
        images: input.images,
        skipReason: input.skipReason || null,
      });
      await this.reseal(product, entries, entry.seq);
      await em.flush();
      return toJournalDto(product, entries, this.media);
    });
  }

  /** Xóa một mốc nháp; các mốc sau lùi `seq` và được niêm phong lại. */
  async deleteDraft(actor: Actor, entryId: string, expectedVersion: number): Promise<JournalDto> {
    const productId = await this.entryProductId(entryId);
    return this.orm.em.fork().transactional(async (em) => {
      const { product, entries, entry } = await this.ownEntry(em, actor, entryId, productId);
      unwrap(checkDraftEdit(this.state(actor, product, entries)));
      assertVersion(entry, expectedVersion);
      em.remove(entry);
      await em.flush();
      const remaining = entries.filter((e) => e !== entry);
      // Lùi `seq` từng mốc theo thứ tự tăng dần để không vướng UNIQUE(product, seq) giữa chừng
      for (const later of remaining.filter((e) => e.seq > entry.seq)) {
        later.seq -= 1;
        await em.flush();
      }
      await this.reseal(product, remaining, entry.seq);
      await em.flush();
      return toJournalDto(product, remaining, this.media);
    });
  }

  private state(actor: Actor, product: Product, entries: readonly JournalEntry[]): JournalState {
    return {
      entries: entries.map((e) => ({
        seq: e.seq,
        stage: e.stage,
        supersedesSeq: e.supersedes?.seq,
      })),
      published: product.publishedAt !== null && product.publishedAt !== undefined,
      frozen: actor.locked,
    };
  }

  /** Tính lại `prevHash`/`hash` từ mốc `fromSeq` tới cuối (chỉ dùng cho nhật ký chưa xuất bản). */
  private async reseal(product: Product, entries: readonly JournalEntry[], fromSeq: number) {
    let prevHash = entries.find((e) => e.seq === fromSeq - 1)?.hash ?? GENESIS;
    for (const entry of entries.filter((e) => e.seq >= fromSeq)) {
      entry.prevHash = prevHash;
      entry.hash = await computeEntryHash(product.id, toChainEntry(entry));
      prevHash = entry.hash;
    }
  }

  private async ownProduct(
    em: EntityManager,
    actor: Actor,
    productId: string,
    lock = false,
  ): Promise<Product> {
    const product = await em.findOne(Product, productId, {
      populate: ['household'],
      ...(lock && { lockMode: LockMode.PESSIMISTIC_WRITE }),
    });
    if (!product) throw notFound();
    if (product.household.representative.id !== actor.id) {
      // Reading another household's journal stays a plain 404; a write is a denied, audited attempt (AC-4).
      if (lock) throw await deniedAccess(this.orm, actor, 'product', product.id);
      throw notFound();
    }
    return product;
  }

  private async assertOwnImages(
    actor: Actor,
    images: readonly { url?: string | undefined; sha256: string }[],
  ) {
    if (!(await this.media.ownsJournalImages(actor.id, images)))
      throw forbidden('journal photos must be your own uploads that have not failed processing');
  }

  /**
   * Reads the entry's product id before BEGIN. Under MySQL REPEATABLE READ a plain read of the entry
   * inside the transaction, before the product lock, would fix the snapshot and hide a concurrent append.
   */
  private async entryProductId(entryId: string): Promise<string> {
    const found = await this.orm.em.fork().findOne(JournalEntry, entryId);
    if (!found) throw notFound();
    return found.product.id;
  }

  /** Locks the product first, then loads the chain so it reflects every append committed before the lock. */
  private async ownEntry(em: EntityManager, actor: Actor, entryId: string, productId: string) {
    const product = await this.ownProduct(em, actor, productId, true);
    const entries = await em.find(
      JournalEntry,
      { product },
      { orderBy: { seq: 'asc' }, populate: ['supersedes'], refresh: true },
    );
    const entry = entries.find((e) => e.id === entryId);
    if (!entry) throw notFound();
    return { product, entries, entry };
  }
}
