import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Bundler không tự đóng gói được worker của MapLibre 6, nên phục vụ đúng bản đang cài từ `public/`.
const require = createRequire(import.meta.url);
const source = join(dirname(require.resolve('maplibre-gl/package.json')), 'dist/maplibre-gl-worker.mjs');
const target = join(dirname(fileURLToPath(import.meta.url)), '../public/map/maplibre-gl-worker.mjs');
mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);
