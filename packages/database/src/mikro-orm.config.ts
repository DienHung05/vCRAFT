import 'reflect-metadata';
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
import { BaseEntity, OutboxEvent } from './entities/index.js';

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
    entities: [BaseEntity, OutboxEvent],
    metadataProvider: ReflectMetadataProvider,
    extensions: [Migrator, SeedManager],
    // Chỉ dùng để chạy lệnh CLI từ nguồn TS; migration chạy khi deploy dùng chính các file này.
    migrations: {
      path: migrationsDir,
      pathTs: migrationsDir,
      snapshot: true,
      emit: 'ts',
    },
    seeder: {
      path: join(PACKAGE_ROOT, 'src', 'seeders'),
      pathTs: join(PACKAGE_ROOT, 'src', 'seeders'),
      defaultSeeder: 'DatabaseSeeder',
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
