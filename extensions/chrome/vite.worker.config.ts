import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// The MV3 service worker, built on its own so it lands as ONE file. The
// manifest names it by path, so the filename cannot be hashed, and a module
// worker that imports a shared chunk would depend on a second file resolving at
// runtime — cheap to avoid, expensive to debug in a packaged extension.
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: './',
  // public/ is already copied by the panel build; doing it again would just
  // rewrite the same files.
  publicDir: false,
  build: {
    outDir: 'dist',
    // The panel build runs first and owns emptying dist/.
    emptyOutDir: false,
    target: 'es2022',
    minify: false,
    rolldownOptions: {
      input: 'src/background.ts',
      output: {
        entryFileNames: 'background.js',
        inlineDynamicImports: true,
      },
    },
  },
});
