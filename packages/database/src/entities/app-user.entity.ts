import { type Opt } from '@mikro-orm/core';
import { Entity, PrimaryKey, Property, Unique } from '@mikro-orm/decorators/legacy';
import type { AccountRole } from '@vcraft/domain';

export const ACCOUNT_STATUSES = ['ACTIVE', 'LOCKED', 'DELETED'] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

/**
 * Tài khoản vCraft (ARCHITECTURE §7.5): Supabase giữ danh tính, vCraft giữ quyền.
 * `id` = `sub` của Supabase (không FK sang schema `auth`). Một vai trò cho mỗi tài khoản (vCRAFT-9hg.3).
 * `LOCKED` (khóa người đại diện) đóng băng nhật ký nhưng trang đã xuất bản vẫn còn.
 * `DELETED`: chủ tài khoản đã xóa (NFR-SEC-07). Dòng này chỉ còn là mốc ẩn danh để các bản ghi nghiệp vụ trỏ tới
 * không bị đứt: `email` và `fullName` đã bị gỡ và tài khoản không đăng nhập lại được.
 */
@Entity({ tableName: 'app_user' })
export class AppUser {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Property({ type: 'string', length: 320 })
  @Unique()
  email!: string;

  @Property({ type: 'string', length: 160, nullable: true })
  fullName?: string | null;

  @Property({ type: 'string', length: 20 })
  role!: AccountRole;

  @Property({ type: 'string', length: 20 })
  status: Opt<AccountStatus> = 'ACTIVE';

  @Property({ type: 'datetime', length: 3 })
  createdAt: Opt<Date> = new Date();

  @Property({ type: 'datetime', length: 3, onUpdate: () => new Date() })
  updatedAt: Opt<Date> = new Date();

  @Property({ type: 'integer', version: true })
  version!: Opt<number>;
}
