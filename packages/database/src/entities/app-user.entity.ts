import { type Opt } from '@mikro-orm/core';
import { Check, Entity, PrimaryKey, Property, Unique } from '@mikro-orm/decorators/legacy';
import type { AccountRole } from '@vcraft/domain';

export const ACCOUNT_STATUSES = ['ACTIVE', 'LOCKED', 'DELETED'] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

/**
 * Database CHECK for `username` (GH#212): only lowercase `a-z 0-9 . _ -`, 3-30 characters. The
 * application layer (`UsernameSchema` of `@vcraft/contracts`) normalizes to lowercase before writing;
 * this constraint keeps the database clean even when a row is written through another path. The
 * `'c'` flag forces case-sensitive matching: MySQL's default collation would otherwise let
 * uppercase through. `regexp_like` exists on both PostgreSQL 15+ (Supabase) and MySQL 8+. A CHECK
 * constraint ignores NULL, so existing accounts that have not chosen a username yet stay valid.
 */
const USERNAME_CHECK = {
  name: 'app_user_username_format_check',
  expression: "regexp_like(username, '^[a-z0-9._-]{3,30}$', 'c')",
} as const;

/**
 * Tài khoản vCraft (ARCHITECTURE §7.5): Supabase giữ danh tính, vCraft giữ quyền.
 * `id` = `sub` của Supabase (không FK sang schema `auth`). Một vai trò cho mỗi tài khoản (vCRAFT-9hg.3).
 * `LOCKED` (khóa người đại diện) đóng băng nhật ký nhưng trang đã xuất bản vẫn còn.
 * `DELETED`: chủ tài khoản đã xóa (NFR-SEC-07). Dòng này chỉ còn là mốc ẩn danh để các bản ghi nghiệp vụ trỏ tới
 * không bị đứt: `email` và `fullName` đã bị gỡ và tài khoản không đăng nhập lại được.
 */
@Entity({ tableName: 'app_user' })
@Check(USERNAME_CHECK)
export class AppUser {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Property({ type: 'string', length: 320 })
  @Unique()
  email!: string;

  /**
   * Sign-in username (GH#212): unique, case-insensitive by storing everything lowercase
   * (`UsernameSchema` of `@vcraft/contracts` normalizes before writing). `null` = an existing account
   * that has not chosen a name yet; the user is asked to pick one after their next sign-in.
   */
  @Property({ type: 'string', length: 30, nullable: true })
  @Unique()
  username?: string | null;

  @Property({ type: 'string', length: 160, nullable: true })
  fullName?: string | null;

  @Property({ type: 'string', length: 20 })
  role!: AccountRole;

  @Property({ type: 'string', length: 20 })
  status: Opt<AccountStatus> = 'ACTIVE';

  /** Why an administrator suspended the account (`LOCKED`, FR-AUTH-10); `null` while it is active. */
  @Property({ type: 'string', length: 500, nullable: true })
  statusReason?: string | null;

  @Property({ type: 'datetime', length: 3 })
  createdAt: Opt<Date> = new Date();

  @Property({ type: 'datetime', length: 3, onUpdate: () => new Date() })
  updatedAt: Opt<Date> = new Date();

  @Property({ type: 'integer', version: true })
  version!: Opt<number>;
}
