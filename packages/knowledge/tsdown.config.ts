import { defineConfig } from 'tsdown';

/**
 * Package được backend (Node) dùng nên phải build ra JS; frontend cũng dùng bản build này.
 * Kiểu vẫn trỏ thẳng src/ để IDE và typecheck không phải chờ build (ARCHITECTURE §3.2).
 */
export default defineConfig({
  entry: ['src/index.ts'],
  format: 'esm',
  platform: 'node',
  dts: false,
  sourcemap: true,
});
