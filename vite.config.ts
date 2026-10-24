import preact from '@preact/preset-vite';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// The Mogshot engine (CASC reader, model parsers, skinning, renderer, worker) comes from the
// submodule in vendor/mogshot. MOGSHOT_SRC points at a checkout elsewhere while its engine is
// being worked on alongside the game: MOGSHOT_SRC=../wow-creator-suite/src pnpm dev
const mogshot = fileURLToPath(new URL(process.env.MOGSHOT_SRC ?? 'vendor/mogshot/src', import.meta.url));

export default defineConfig({
  // Served from https://realworldbuilder.github.io/makgorakombat/
  base: '/makgorakombat/',
  plugins: [preact()],
  worker: { format: 'es' },
  resolve: { alias: { '@mogshot': mogshot } },
  server: { fs: { allow: ['.', mogshot] } },
  test: {
    include: ['test/**/*.test.ts'],
    alias: { '@mogshot': mogshot },
  },
});
