import type { EntityManager, EntityName } from '@mikro-orm/core';
import {
  AppUser,
  Artisan,
  AuditLog,
  ConsentRecord,
  ContributionOffer,
  CooperativeQuotation,
  Household,
  JournalEntry,
  MediaAsset,
  MediaLink,
  News,
  OrderAllocation,
  OutboxEvent,
  Payment,
  Product,
  ProductMaker,
  QuotationNotice,
  QuotationRequest,
  Workshop,
} from '../../entities/index.js';

/**
 * Xóa MỌI dòng bảng nghiệp vụ theo thứ tự con trước cha (tôn trọng khóa ngoại trên cả hai CSDL).
 * Nguy hiểm: chỉ gọi sau khi `evaluateDemoResetGuard` cho phép (xem `reset-cli.ts`). Không động tới bảng
 * migration, schema `auth`/`storage` của Supabase hay tệp trong object storage.
 */
export async function clearBusinessData(em: EntityManager): Promise<void> {
  // Mốc đính chính trỏ về chính bảng journal_entry: gỡ liên kết trước để MySQL (kiểm khóa từng dòng) xóa được
  await em.nativeUpdate(JournalEntry, {}, { supersedes: null });
  const order = [
    QuotationNotice,
    ConsentRecord,
    OutboxEvent,
    News,
    AuditLog,
    MediaLink,
    MediaAsset,
    Payment,
    OrderAllocation,
    CooperativeQuotation,
    ContributionOffer,
    QuotationRequest,
    JournalEntry,
    ProductMaker,
    Product,
    Workshop,
    Artisan,
    Household,
    AppUser,
  ] as const;
  for (const entity of order) await em.nativeDelete(entity as EntityName<object>, {});
  em.clear();
}
