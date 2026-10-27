import { MySqlDriver } from '@mikro-orm/mysql';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { describe, expect, it } from 'vitest';
import { createMikroOrmOptions, resolveDbDriver } from '../src/mikro-orm.config.js';

describe('resolveDbDriver', () => {
  it('mặc định là postgresql khi không đặt DB_DRIVER', () => {
    expect(resolveDbDriver({})).toBe('postgresql');
    expect(resolveDbDriver({ DB_DRIVER: '  ' })).toBe('postgresql');
  });

  it('nhận postgresql | mysql, không phân biệt hoa thường', () => {
    expect(resolveDbDriver({ DB_DRIVER: 'postgresql' })).toBe('postgresql');
    expect(resolveDbDriver({ DB_DRIVER: 'MySQL' })).toBe('mysql');
  });

  it('báo lỗi rõ ràng với driver lạ', () => {
    expect(() => resolveDbDriver({ DB_DRIVER: 'sqlite' })).toThrow(/DB_DRIVER="sqlite"/);
  });
});

describe('createMikroOrmOptions', () => {
  it('chọn driver PostgreSQL, cổng mặc định 5432 và thư mục migration riêng', () => {
    const options = createMikroOrmOptions({ DB_DRIVER: 'postgresql' });
    expect(options.driver).toBe(PostgreSqlDriver);
    expect(options.port).toBe(5432);
    expect(options.migrations?.path).toMatch(/migrations[\\/]postgresql$/);
  });

  it('chọn driver MySQL, cổng mặc định 3306 và thư mục migration riêng', () => {
    const options = createMikroOrmOptions({ DB_DRIVER: 'mysql' });
    expect(options.driver).toBe(MySqlDriver);
    expect(options.port).toBe(3306);
    expect(options.migrations?.path).toMatch(/migrations[\\/]mysql$/);
  });

  it('đọc biến kết nối từ env và cho phép ghi đè', () => {
    const options = createMikroOrmOptions(
      {
        DB_DRIVER: 'mysql',
        DB_HOST: 'db',
        DB_PORT: '3307',
        DB_NAME: 'x',
        DB_USER: 'u',
        DB_PASSWORD: 'p',
      },
      { debug: true },
    );
    expect(options).toMatchObject({
      host: 'db',
      port: 3307,
      dbName: 'x',
      user: 'u',
      password: 'p',
      debug: true,
    });
  });

  it('chỉ bật TLS khi DB_SSL=true', () => {
    expect(createMikroOrmOptions({}).driverOptions).toBeUndefined();
    expect(createMikroOrmOptions({ DB_SSL: 'false' }).driverOptions).toBeUndefined();
    expect(createMikroOrmOptions({ DB_SSL: 'TRUE' }).driverOptions).toEqual({
      ssl: { rejectUnauthorized: false },
    });
  });

  it('PostgreSQL mặc định bật RLS cho mọi entity, MySQL thì không (ADR-15)', () => {
    const meta: { rowLevelSecurity?: boolean | 'force' } = {};
    createMikroOrmOptions({ DB_DRIVER: 'postgresql' }).discovery?.onMetadata?.(
      meta as never,
      undefined as never,
    );
    expect(meta.rowLevelSecurity).toBe(true);

    const optOut: { rowLevelSecurity?: boolean | 'force' } = { rowLevelSecurity: false };
    createMikroOrmOptions({ DB_DRIVER: 'postgresql' }).discovery?.onMetadata?.(
      optOut as never,
      undefined as never,
    );
    expect(optOut.rowLevelSecurity).toBe(false);

    expect(createMikroOrmOptions({ DB_DRIVER: 'mysql' }).discovery?.onMetadata).toBeUndefined();
  });

  it('từ chối DB_PORT không hợp lệ', () => {
    expect(() => createMikroOrmOptions({ DB_PORT: 'abc' })).toThrow(/DB_PORT/);
  });
});
