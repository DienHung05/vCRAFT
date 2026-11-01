import { readFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import tls from 'node:tls';
import { fileURLToPath } from 'node:url';
import { MySqlDriver } from '@mikro-orm/mysql';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createMikroOrmOptions, resolveDbDriver } from '../src/mikro-orm.config.js';

// Cặp khóa/chứng chỉ tự ký CHỈ để test (CN=localhost, hết hạn rất xa); không dùng ở bất kỳ môi trường nào.
const CA_FILE = fileURLToPath(new URL('./fixtures/test-server-ca.pem', import.meta.url));
const KEY_FILE = fileURLToPath(new URL('./fixtures/test-server-key.pem', import.meta.url));

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
    expect(createMikroOrmOptions({}).driverOptions).not.toHaveProperty('ssl');
    expect(createMikroOrmOptions({ DB_SSL: 'false' }).driverOptions).not.toHaveProperty('ssl');
  });

  it('DB_SSL=true luôn xác thực chứng chỉ máy chủ (không có đường tắt)', () => {
    for (const driver of ['postgresql', 'mysql']) {
      expect(
        createMikroOrmOptions({ DB_DRIVER: driver, DB_SSL: 'TRUE' }).driverOptions,
      ).toMatchObject({ ssl: { rejectUnauthorized: true } });
    }
    // Không biến môi trường nào (kể cả tên "thân thiện") được tắt việc xác thực
    const options = createMikroOrmOptions({
      DB_SSL: 'true',
      DB_SSL_REJECT_UNAUTHORIZED: 'false',
      NODE_TLS_REJECT_UNAUTHORIZED: '0',
    });
    expect(options.driverOptions?.ssl).toEqual({ rejectUnauthorized: true });
  });

  it('DB_SSL_CA: tin CA riêng nhưng vẫn xác thực; chấp nhận chuỗi \\n trên một dòng', () => {
    const pem = readFileSync(CA_FILE, 'utf8');
    const oneLine = pem.trim().replaceAll('\n', '\\n');
    expect(createMikroOrmOptions({ DB_SSL: 'true', DB_SSL_CA: pem }).driverOptions?.ssl).toEqual({
      ca: pem.trim(),
      rejectUnauthorized: true,
    });
    expect(
      createMikroOrmOptions({ DB_SSL: 'true', DB_SSL_CA: oneLine }).driverOptions?.ssl,
    ).toEqual({ ca: pem.trim(), rejectUnauthorized: true });
  });

  it('DB_SSL_CA_FILE: đọc CA từ file; file hỏng hoặc đặt cả hai biến thì báo lỗi', () => {
    expect(
      createMikroOrmOptions({ DB_SSL: 'true', DB_SSL_CA_FILE: CA_FILE }).driverOptions?.ssl,
    ).toEqual({ ca: readFileSync(CA_FILE, 'utf8'), rejectUnauthorized: true });
    expect(() =>
      createMikroOrmOptions({ DB_SSL: 'true', DB_SSL_CA_FILE: '/khong/ton/tai.pem' }),
    ).toThrow(/DB_SSL_CA_FILE/);
    expect(() =>
      createMikroOrmOptions({ DB_SSL: 'true', DB_SSL_CA: 'x', DB_SSL_CA_FILE: CA_FILE }),
    ).toThrow(/một trong/);
  });

  describe('xác thực TLS thật (máy chủ tự ký trên localhost)', () => {
    let server: tls.Server;
    let port: number;

    beforeAll(async () => {
      server = tls.createServer(
        { key: readFileSync(KEY_FILE), cert: readFileSync(CA_FILE) },
        (socket) => socket.end(),
      );
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
      port = (server.address() as AddressInfo).port;
    });

    afterAll(async () => {
      await new Promise((resolve) => server.close(resolve));
    });

    const connect = (env: Record<string, string>): Promise<void> => {
      const { ssl } = createMikroOrmOptions({ DB_SSL: 'true', ...env }).driverOptions as {
        ssl: tls.ConnectionOptions;
      };
      return new Promise((resolve, reject) => {
        const socket = tls.connect({ host: 'localhost', port, ...ssl }, () => {
          socket.end();
          resolve();
        });
        socket.on('error', reject);
      });
    };

    it('từ chối chứng chỉ không do CA tin cậy ký', async () => {
      await expect(connect({})).rejects.toMatchObject({ code: 'DEPTH_ZERO_SELF_SIGNED_CERT' });
    });

    it('chấp nhận khi CA của máy chủ được khai báo', async () => {
      await expect(connect({ DB_SSL_CA_FILE: CA_FILE })).resolves.toBeUndefined();
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
