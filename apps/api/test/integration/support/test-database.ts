import { MikroORM, type Options } from '@mikro-orm/core';
import { MySqlContainer, type StartedMySqlContainer } from '@testcontainers/mysql';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { createMikroOrmOptions, type DbDriver, resolveDbDriver } from '@vcraft/database';

/** CSDL dưới test: CI đặt `DB_DRIVER=postgresql|mysql`; chạy cục bộ không đặt thì dùng PostgreSQL. */
export const testDriver: DbDriver = resolveDbDriver(process.env);

const DB_NAME = 'vcraft';
const DB_PASSWORD = 'vcraft-test';

export interface TestDatabase {
  driver: DbDriver;
  /** Kết nối MikroORM tới container; schema trống cho tới khi gọi `migrate()`. */
  orm: MikroORM;
  /** Chạy toàn bộ migration MikroORM của `packages/database` cho driver hiện tại. */
  migrate: () => Promise<void>;
  stop: () => Promise<void>;
}

/**
 * Dựng CSDL thật bằng Testcontainers theo `DB_DRIVER`. Cần Docker daemon: nếu thiếu, hook ném lỗi
 * (test không được xanh khi không chạm CSDL).
 *
 * Postgres dùng user `postgres` để khớp migration Supabase (`alter default privileges for role postgres`).
 */
export async function startTestDatabase(): Promise<TestDatabase> {
  let container: StartedPostgreSqlContainer | StartedMySqlContainer;
  let env: Record<string, string>;

  if (testDriver === 'mysql') {
    const mysql = await new MySqlContainer('mysql:8.4')
      .withDatabase(DB_NAME)
      .withUsername('vcraft')
      .withUserPassword(DB_PASSWORD)
      .start();
    container = mysql;
    env = {
      DB_DRIVER: 'mysql',
      DB_HOST: mysql.getHost(),
      DB_PORT: String(mysql.getPort()),
      DB_NAME,
      DB_USER: 'vcraft',
      DB_PASSWORD,
    };
  } else {
    const postgres = await new PostgreSqlContainer('postgres:17-alpine')
      .withDatabase(DB_NAME)
      .withUsername('postgres')
      .withPassword(DB_PASSWORD)
      .start();
    container = postgres;
    env = {
      DB_DRIVER: 'postgresql',
      DB_HOST: postgres.getHost(),
      DB_PORT: String(postgres.getPort()),
      DB_NAME,
      DB_USER: 'postgres',
      DB_PASSWORD,
    };
  }

  // Dùng chính factory của production, chỉ đổi thông tin kết nối (container không bật TLS)
  // Kiểu cấu hình khác nhau theo driver; test chỉ dùng API chung nên nới về Options mặc định.
  // Tắt snapshot: nếu không, `migrator.up()` ghi đè `.snapshot-vcraft.json` trong repo bằng schema của CSDL test.
  const base = createMikroOrmOptions(env);
  const orm = await MikroORM.init(
    createMikroOrmOptions(env, {
      migrations: { ...base.migrations, snapshot: false },
    }) as unknown as Options,
  );

  return {
    driver: testDriver,
    orm,
    migrate: async () => {
      await orm.migrator.up();
    },
    stop: async () => {
      await orm.close(true);
      await container.stop();
    },
  };
}
