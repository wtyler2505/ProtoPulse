import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Workspace TS sources resolve directly (each @protopulse/* package's
 * `main` points at ./src/index.ts), so no aliases are needed. Concepts
 * content is bundled via import.meta.glob raw imports from the repo
 * root, so publicDir is unused.
 */
export default defineConfig({
  plugins: [react()],
  publicDir: false,
  // Inline (empty) PostCSS config so vite does NOT walk up and load the
  // legacy app's root postcss.config.js (tailwind) for our plain CSS.
  css: { postcss: {} },
  server: { port: 5174 },
  build: { outDir: 'dist' },
});
