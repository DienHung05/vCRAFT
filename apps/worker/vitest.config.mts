import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/** Unit test của worker; package workspace trỏ thẳng mã nguồn để không phải build trước. */
export default defineConfig({
  resolve: {
    alias: Object.fromEntries(
      ['domain', 'storage'].map((name) => [
        `@vcraft/${name}`,
        fileURLToPath(new URL(`../../packages/${name}/src/index.ts`, import.meta.url)),
      ]),
    ),
  },
  test: {
    include: ['test/**/*.test.ts'],
    testTimeout: 60_000,
  },
});
