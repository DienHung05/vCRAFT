import { describe, expect, it } from 'vitest';
import {
  describeDemoTarget,
  evaluateDemoResetGuard,
  formatDemoGuardRefusal,
} from '../src/seeders/demo/guard.js';

const ok = {
  APP_ENV: 'demo',
  NODE_ENV: 'production',
  DB_HOST: 'db.demo.internal',
  DB_PORT: '5432',
  DB_NAME: 'vcraft_demo',
  DEMO_RESET_CONFIRM: 'db.demo.internal:5432/vcraft_demo',
};

describe('evaluateDemoResetGuard', () => {
  it('cho phép khi đủ APP_ENV=demo, không phải development, đích không giống production và đã xác nhận', () => {
    expect(evaluateDemoResetGuard(ok)).toEqual({
      allowed: true,
      target: 'db.demo.internal:5432/vcraft_demo',
    });
  });

  it.each([
    ['chưa đặt APP_ENV', { ...ok, APP_ENV: undefined }],
    ['APP_ENV=development', { ...ok, APP_ENV: 'development' }],
    ['APP_ENV=production', { ...ok, APP_ENV: 'production' }],
    ['APP_ENV=Demo-staging', { ...ok, APP_ENV: 'demo-staging' }],
  ])('từ chối khi %s', (_name, env) => {
    const result = evaluateDemoResetGuard(env);
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.reasons.join('\n')).toMatch(/APP_ENV/);
  });

  it('từ chối NODE_ENV=development dù APP_ENV=demo', () => {
    const result = evaluateDemoResetGuard({ ...ok, NODE_ENV: 'development' });
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.reasons.join('\n')).toMatch(/NODE_ENV/);
  });

  it('từ chối đích có tên hoặc host chứa "prod"', () => {
    for (const env of [
      { ...ok, DB_NAME: 'vcraft_prod', DEMO_RESET_CONFIRM: 'db.demo.internal:5432/vcraft_prod' },
      { ...ok, DB_HOST: 'prod-db', DEMO_RESET_CONFIRM: 'prod-db:5432/vcraft_demo' },
    ]) {
      const result = evaluateDemoResetGuard(env);
      expect(result.allowed).toBe(false);
      if (!result.allowed) expect(result.reasons.join('\n')).toMatch(/production/);
    }
  });

  it('từ chối khi thiếu hoặc sai xác nhận đích danh CSDL', () => {
    for (const confirm of [undefined, '', 'yes', 'db.demo.internal:5432/other']) {
      const result = evaluateDemoResetGuard({ ...ok, DEMO_RESET_CONFIRM: confirm });
      expect(result.allowed).toBe(false);
      if (!result.allowed) expect(result.reasons.join('\n')).toMatch(/DEMO_RESET_CONFIRM/);
    }
  });

  it('gom đủ mọi lý do và nêu rõ không xóa gì', () => {
    const result = evaluateDemoResetGuard({ NODE_ENV: 'development' });
    expect(result.allowed).toBe(false);
    if (result.allowed) return;
    expect(result.reasons).toHaveLength(3);
    const message = formatDemoGuardRefusal(result);
    expect(message).toContain('TỪ CHỐI');
    expect(message).toContain('Không có dữ liệu nào bị xóa');
  });

  it('mô tả đích bằng giá trị mặc định giống tầng dữ liệu', () => {
    expect(describeDemoTarget({})).toBe('localhost:5432/vcraft');
    expect(describeDemoTarget({ DB_DRIVER: 'mysql' })).toBe('localhost:3306/vcraft');
  });
});
