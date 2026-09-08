/**
 * Config for the markdown render gallery generator.
 *
 * scripts/build-gallery.test.tsx is not a unit test — it renders every case in
 * scripts/gallery-cases.ts through the real <Markdown> component and through
 * markdownToHtml(), and writes public/markdown-gallery.html so the whole render
 * surface can be reviewed on one page. It needs vitest only for its jsdom +
 * React environment.
 *
 * vitest.config.ts excludes it from the unit suite, because it reads the
 * compiled CSS out of .next/static/css and CI runs unit tests without building.
 * This config re-includes just that file. Use `pnpm gallery`, which builds first.
 */
import { defineConfig } from 'vitest/config';
import base from './vitest.config';

// Not mergeConfig: it concatenates arrays, so the base `exclude` would survive
// and keep excluding the one file this config exists to run.
export default defineConfig({
  ...base,
  test: {
    ...base.test,
    include: ['scripts/build-gallery.test.tsx'],
    exclude: [],
  },
});
