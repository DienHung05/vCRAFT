import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Options } from '@mikro-orm/core';
import { ReflectMetadataProvider } from '@mikro-orm/decorators/legacy';
import { Migrator } from '@mikro-orm/migrations';
import { defineConfig as defineMySqlConfig, type MySqlDriver } from '@mikro-orm/mysql';
import {
  defineConfig as definePostgreSqlConfig,
  type PostgreSqlDriver,
} from '@mikro-orm/postgresql';
import { SeedManager } from '@mikro-orm/seeder';
import {
  AppUser,
  Artisan,
  AuditLog,
  BaseEntity,
  ContributionOffer,
  CooperativeQuotation,
  Household,
  JournalEntry,
  MediaAsset,
  MediaLink,
  News,
  OrderAllocation,
  OutboxEvent,
  Product,
  ProductMaker,
  QuotationNotice,
  QuotationRequest,
  Workshop,
} from './entities/index.js';

/** CSDL được hỗ trợ (ADR-05: PostgreSQL chính, MySQL kiểm chứng độc lập CSDL). */
export const DB_DRIVERS = ['postgresql', 'mysql'] as const;
export type DbDriver = (typeof DB_DRIVERS)[number];

/** Tập con của `process.env` mà tầng dữ liệu đọc (xem `.env.example`). */
export type DbEnv = Readonly<Record<string, string | undefined>>;

export type VcraftMikroOrmOptions =
  | ReturnType<typeof definePostgreSqlConfig>
  | ReturnType<typeof defineMySqlConfig>;

const DEFAULT_PORTS: Record<DbDriver, number> = { postgresql: 5432, mysql: 3306 };

/** Thư mục gốc package: `src/` (mã nguồn) và `dist/` (bản build) đều nằm ngay dưới nó. Migration/seeder luôn đọc từ `src/`. */
const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Chọn driver theo `DB_DRIVER`; mặc định `postgresql`, giá trị lạ thì báo lỗi rõ ràng. */
export function resolveDbDriver(env: DbEnv = process.env): DbDriver {
  const raw = env.DB_DRIVER?.trim().toLowerCase();
  if (!raw) return 'postgresql';
  if ((DB_DRIVERS as readonly string[]).includes(raw)) return raw as DbDriver;
  throw new Error(
    `DB_DRIVER="${env.DB_DRIVER}" không hợp lệ; chỉ hỗ trợ: ${DB_DRIVERS.join(' | ')}`,
  );
}

function resolvePort(env: DbEnv, driver: DbDriver): number {
  if (env.DB_PORT === undefined || env.DB_PORT.trim() === '') return DEFAULT_PORTS[driver];
  const port = Number(env.DB_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`DB_PORT="${env.DB_PORT}" không hợp lệ`);
  }
  return port;
}

/**
 * `DB_SSL=true` bật TLS và LUÔN xác thực chứng chỉ máy chủ (`rejectUnauthorized: true`); không có biến
 * nào tắt việc xác thực. Chứng chỉ do CA công khai ký thì không cần cấu hình thêm. Với CA riêng
 * (vd. Postgres của Supabase, ADR-15) khai báo CA tin cậy một trong hai cách:
 * - `DB_SSL_CA`: nội dung PEM (xuống dòng có thể viết thành chuỗi `\n` khi để trên một dòng trong `.env`);
 * - `DB_SSL_CA_FILE`: đường dẫn tới file PEM.
 * `pg` và `mysql2` cùng nhận khóa `ssl` trong tùy chọn pool.
 */
function resolveDriverOptions(env: DbEnv): Record<string, unknown> | undefined {
  if (env.DB_SSL?.trim().toLowerCase() !== 'true') return undefined;
  const ca = resolveSslCa(env);
  return { ssl: { ...(ca !== undefined && { ca }), rejectUnauthorized: true } };
}

function resolveSslCa(env: DbEnv): string | undefined {
  const inline = env.DB_SSL_CA?.trim();
  const file = env.DB_SSL_CA_FILE?.trim();
  if (inline && file) {
    throw new Error('Chỉ đặt một trong DB_SSL_CA hoặc DB_SSL_CA_FILE, không đặt cả hai');
  }
  if (inline) return inline.replaceAll('\\n', '\n');
  if (!file) return undefined;
  try {
    return readFileSync(file, 'utf8');
  } catch (cause) {
    throw new Error(`Không đọc được DB_SSL_CA_FILE="${file}"`, { cause });
  }
}

/**
 * Factory cấu hình MikroORM dùng chung cho CLI (migration, seeder) và `apps/api`/`apps/worker`
 * (qua `@mikro-orm/nestjs`: `MikroOrmModule.forRoot(createMikroOrmOptions())`).
 *
 * Migration sinh riêng cho từng driver ở `src/migrations/<driver>`; seeder dùng chung (ARCHITECTURE §4.4).
 * Entity khai báo tường minh (không glob) để chạy được cả khi bị bundle bằng tsdown/SWC.
 */
export function createMikroOrmOptions(
  env: DbEnv = process.env,
  overrides: Record<string, unknown> = {},
): VcraftMikroOrmOptions {
  const driver = resolveDbDriver(env);
  const migrationsDir = join(PACKAGE_ROOT, 'src', 'migrations', driver);

  const common: Record<string, unknown> = {
    host: env.DB_HOST ?? 'localhost',
    port: resolvePort(env, driver),
    dbName: env.DB_NAME ?? 'vcraft',
    user: env.DB_USER ?? 'vcraft',
    password: env.DB_PASSWORD ?? 'vcraft',
    driverOptions: resolveDriverOptions(env),
    entities: [
      BaseEntity,
      OutboxEvent,
      AppUser,
      AuditLog,
      Household,
      Artisan,
      Workshop,
      Product,
      JournalEntry,
      ProductMaker,
      QuotationRequest,
      QuotationNotice,
      ContributionOffer,
      CooperativeQuotation,
      OrderAllocation,
      MediaAsset,
      MediaLink,
      News,
    ],
    metadataProvider: ReflectMetadataProvider,
    extensions: [Migrator, SeedManager],
    // Chỉ dùng để chạy lệnh CLI từ nguồn TS; migration chạy khi deploy dùng chính các file này.
    migrations: {
      path: migrationsDir,
      pathTs: migrationsDir,
      snapshot: true,
      // Cố định tên snapshot: mặc định MikroORM đặt theo dbName (`postgres` trên Supabase, `vcraft` khi chạy MySQL cục bộ)
      snapshotName: '.snapshot-vcraft',
      emit: 'ts',
    },
    seeder: {
      path: join(PACKAGE_ROOT, 'src', 'seeders'),
      pathTs: join(PACKAGE_ROOT, 'src', 'seeders'),
      defaultSeeder: 'DatabaseSeeder',
    },
    // ADR-15: bảng nghiệp vụ trên Supabase luôn bật RLS (không policy) để Data API không đọc/ghi được.
    // Khai báo ở đây để schema diff không sinh lệnh tắt RLS; MySQL không có khái niệm này.
    ...(driver === 'postgresql' && {
      discovery: {
        onMetadata: (meta: { rowLevelSecurity?: boolean | 'force' }) => {
          meta.rowLevelSecurity ??= true;
        },
      },
    }),
    schemaGenerator: {
      // ADR-15: schema hệ thống của Supabase và vector store của trợ lý (ADR-13) không thuộc MikroORM quản lý
      ignoreSchema: [
        'auth',
        'extensions',
        'graphql',
        'graphql_public',
        'pgbouncer',
        'private',
        'realtime',
        'storage',
        'supabase_migrations',
        'vault',
      ],
      skipTables: ['knowledge_chunks'],
    },
    debug: env.DB_DEBUG === 'true',
    ...overrides,
  };

  return driver === 'mysql'
    ? defineMySqlConfig(common as unknown as Options<MySqlDriver>)
    : definePostgreSqlConfig(common as unknown as Options<PostgreSqlDriver>);
}

/** Mặc định xuất cho MikroORM CLI: factory lười, đọc `process.env` lúc CLI chạy. */
export default () => createMikroOrmOptions();
