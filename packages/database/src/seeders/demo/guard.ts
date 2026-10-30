/**
 * Cổng chặn `pnpm demo:reset` (GH#14): lệnh này XÓA toàn bộ bảng nghiệp vụ rồi nạp lại dữ liệu mẫu, nên
 * chỉ chạy trên môi trường demo được khai báo rõ ràng. Hàm thuần, không đọc `process.env` trực tiếp
 * và không import gì, để test được và để script khác dùng lại.
 *
 * Điều kiện (mọi điều kiện phải thỏa, báo đủ lý do khi từ chối):
 *  1. `APP_ENV=demo` (dev/production/để trống đều bị từ chối).
 *  2. `NODE_ENV` không phải `development` (shell dev vô tình trỏ tới CSDL demo bị chặn).
 *  3. `DB_NAME`/`DB_HOST` không chứa `prod` (heuristic chặn nhầm CSDL production).
 *  4. `DEMO_RESET_CONFIRM` đúng bằng `<DB_HOST>:<DB_PORT>/<DB_NAME>` của kết nối sắp bị xóa
 *     (người vận hành gõ lại đích danh CSDL, sao chép nhầm `.env` sẽ không khớp).
 */
export type DemoGuardEnv = Readonly<Record<string, string | undefined>>;

export type DemoGuardResult =
  | { readonly allowed: true; readonly target: string }
  | { readonly allowed: false; readonly reasons: readonly string[]; readonly target: string };

const DEFAULT_PORTS: Record<string, string> = { postgresql: '5432', mysql: '3306' };

/** `<host>:<port>/<name>` của CSDL đích, đúng như tầng dữ liệu sẽ kết nối (cùng giá trị mặc định). */
export function describeDemoTarget(env: DemoGuardEnv): string {
  const driver = (env.DB_DRIVER ?? 'postgresql').trim().toLowerCase();
  const host = env.DB_HOST?.trim() || 'localhost';
  const port = env.DB_PORT?.trim() || DEFAULT_PORTS[driver] || '5432';
  const name = env.DB_NAME?.trim() || 'vcraft';
  return `${host}:${port}/${name}`;
}

export function evaluateDemoResetGuard(env: DemoGuardEnv): DemoGuardResult {
  const target = describeDemoTarget(env);
  const reasons: string[] = [];

  const appEnv = env.APP_ENV?.trim().toLowerCase();
  if (appEnv !== 'demo') {
    reasons.push(
      `APP_ENV phải là "demo" (hiện là ${appEnv ? `"${appEnv}"` : 'chưa đặt'}); dev và production không bao giờ được reset.`,
    );
  }

  if (env.NODE_ENV?.trim().toLowerCase() === 'development') {
    reasons.push(
      'NODE_ENV=development bị từ chối; chạy lệnh trên máy/tiến trình của môi trường demo (NODE_ENV=production hoặc test).',
    );
  }

  const host = env.DB_HOST?.trim() || 'localhost';
  const name = env.DB_NAME?.trim() || 'vcraft';
  if (/prod/i.test(host) || /prod/i.test(name)) {
    reasons.push(`Đích ${target} có vẻ là CSDL production (tên/host chứa "prod").`);
  }

  if (env.DEMO_RESET_CONFIRM?.trim() !== target) {
    reasons.push(
      `Phải xác nhận đích danh CSDL sẽ bị xóa: đặt DEMO_RESET_CONFIRM=${target} (hiện là ${env.DEMO_RESET_CONFIRM ? `"${env.DEMO_RESET_CONFIRM}"` : 'chưa đặt'}).`,
    );
  }

  return reasons.length === 0 ? { allowed: true, target } : { allowed: false, reasons, target };
}

/** Thông báo nhiều dòng để in ra khi bị từ chối. */
export function formatDemoGuardRefusal(
  result: Extract<DemoGuardResult, { allowed: false }>,
): string {
  return [
    `demo:reset TỪ CHỐI chạy trên ${result.target}:`,
    ...result.reasons.map((reason) => `  - ${reason}`),
    'Không có dữ liệu nào bị xóa.',
  ].join('\n');
}
