import { MikroORM } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import type { FavouritesDto } from '@vcraft/contracts';
import { Product, ProductFavourite } from '@vcraft/database';
import { type Actor } from '../../../common/auth/auth.guard';
import { notFound } from '../../../common/errors/app-error';
import { toCardDto } from '../../catalog/application/catalog.service';
import { productMediaIds } from '../../households/households.mapper';
import { MediaService } from '../../media/application/media.service';

/** Products that can be favourited or listed: published or sold, of an approved household. */
const VISIBLE_PRODUCT = {
  status: { $in: ['PUBLISHED', 'SOLD'] },
  household: { status: 'APPROVED' },
} as const;

/** FR-CAT-07: the signed-in user's saved products, shared across devices. */
@Injectable()
export class FavouritesService {
  constructor(
    private readonly orm: MikroORM,
    private readonly media: MediaService,
  ) {}

  /** Cards of the saved products that are still publicly visible, most recently saved first. */
  async list(actor: Actor): Promise<FavouritesDto> {
    const em = this.orm.em.fork();
    const rows = await em.find(
      ProductFavourite,
      { userId: actor.id, product: VISIBLE_PRODUCT },
      { populate: ['product', 'product.household'], orderBy: { createdAt: 'desc', id: 'desc' } },
    );
    const products = rows.map((row) => row.product);
    const [media, covers] = await Promise.all([
      this.media.publicMedia(productMediaIds(products)),
      this.media.productCoverImages(products),
    ]);
    return { data: products.map((p) => toCardDto(p, media, covers.get(p.id))) };
  }

  /** Idempotent: saving a product twice keeps one row. A hidden or unknown product is a 404. */
  async add(actor: Actor, productId: string): Promise<void> {
    const em = this.orm.em.fork();
    const product = await em.findOne(Product, { id: productId, ...VISIBLE_PRODUCT });
    if (!product) throw notFound();
    if (await em.count(ProductFavourite, { userId: actor.id, product })) return;
    em.create(ProductFavourite, { userId: actor.id, product });
    try {
      await em.flush();
    } catch (error) {
      // A concurrent request saved the same pair first: the unique index made this one redundant.
      const fresh = this.orm.em.fork();
      if (!(await fresh.count(ProductFavourite, { userId: actor.id, product: productId }))) {
        throw error;
      }
    }
  }

  /** Idempotent: removing a product that is not saved succeeds too. */
  async remove(actor: Actor, productId: string): Promise<void> {
    await this.orm.em
      .fork()
      .nativeDelete(ProductFavourite, { userId: actor.id, product: productId });
  }
}
