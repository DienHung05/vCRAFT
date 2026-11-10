import type { EntityManager, EntityName } from '@mikro-orm/core';
import {
  AccountInvitation,
  AppUser,
  Artisan,
  AuditLog,
  ConsentRecord,
  ContributionOffer,
  CooperativeQuotation,
  Household,
  HouseholdRating,
  JournalEntry,
  MediaAsset,
  MediaLink,
  News,
  Notification,
  OrderAllocation,
  OutboxEvent,
  Payment,
  Product,
  ProductFavourite,
  ProductMaker,
  QuotationNotice,
  QuotationRequest,
  TraceScan,
  Workshop,
} from '../../entities/index.js';

/**
 * Các thực thể bị xóa, theo thứ tự con trước cha (mỗi bảng đứng trước mọi bảng mà nó tham chiếu bằng khóa ngoại).
 * Có test chống lệch (`test/demo-reset-order.test.ts`): thêm bảng mới tham chiếu một bảng nghiệp vụ mà quên đưa vào
 * đây thì test đỏ, thay vì để `demo:reset` vỡ khóa ngoại trên CSDL thật.
 *
 * Cố ý KHÔNG xóa (không cản khóa ngoại hoặc là dữ liệu vận hành): `knowledge_chunks` (chỉ mục RAG của trợ lý),
 * `assistant_message_log`, `login_event`, `idempotency_keys`, `mail_claim`, `slug_redirect`,
 * `notification_preference`, `unapplied_payment` (khóa ngoại SET NULL tới `payment`).
 */
export const CLEARED_ENTITIES = [
  QuotationNotice,
  ConsentRecord,
  OutboxEvent,
  News,
  AuditLog,
  // Thông báo và lời mời trỏ tới đối tượng nghiệp vụ sẽ mồ côi sau khi nạp lại seed
  Notification,
  AccountInvitation,
  MediaLink,
  MediaAsset,
  Payment,
  OrderAllocation,
  CooperativeQuotation,
  ContributionOffer,
  HouseholdRating,
  QuotationRequest,
  JournalEntry,
  ProductMaker,
  // Xóa tường minh (không dựa vào ON DELETE CASCADE) để MySQL và PostgreSQL chạy giống nhau
  TraceScan,
  ProductFavourite,
  Product,
  Workshop,
  Artisan,
  Household,
  AppUser,
] as const;

/**
 * Xóa MỌI dòng bảng nghiệp vụ theo thứ tự con trước cha (tôn trọng khóa ngoại trên cả hai CSDL), xem `CLEARED_ENTITIES`.
 * Nguy hiểm: chỉ gọi sau khi `evaluateDemoResetGuard` cho phép (xem `reset-cli.ts`). Không động tới bảng
 * migration, schema `auth`/`storage` của Supabase hay tệp trong object storage.
 */
export async function clearBusinessData(em: EntityManager): Promise<void> {
  // Mốc đính chính trỏ về chính bảng journal_entry: gỡ liên kết trước để MySQL (kiểm khóa từng dòng) xóa được
  await em.nativeUpdate(JournalEntry, {}, { supersedes: null });
  for (const entity of CLEARED_ENTITIES) await em.nativeDelete(entity as EntityName<object>, {});
  em.clear();
}
