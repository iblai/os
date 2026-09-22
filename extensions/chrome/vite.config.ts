import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import {
  cspWithMentorOrigin,
  DEFAULT_MENTOR_URL,
  MENTOR_ORIGIN_PLACEHOLDER,
} from './src/mentor-origin';

// The panel is a packaged MV3 page, so `vite dev` cannot serve it: the only
// modes are `pnpm ext:build` and `pnpm ext:watch`. Everything under public/
// (manifest, icons, the vendored <agent-ai> bundle, locales) is copied
// verbatim; panel.html is the single entry and lands at the dist root, which is
// what the manifest's side_panel.default_path expects.
//
// "Verbatim" is why the manifest cannot read `.env.local` itself, and why the
// plugin below fills its `__MENTOR_ORIGIN__` holes after the copy.
//
// The service worker is a SEPARATE build (vite.worker.config.ts) so it comes
// out as one self-contained file. Built together, rolldown hoists what the two
// entries share into a chunk the worker would have to import at runtime.

/**
 * Write the configured mentor origin into the built manifest's CSP.
 *
 * `public/` is copied into `dist/` by Vite's own `vite:prepare-out-dir` in
 * `renderStart` (`order: 'pre'`), so by `writeBundle` the manifest is there and
 * ours to rewrite — and in `--watch` it is re-copied on every rebuild, so this
 * has to run every time too.
 *
 * A missing placeholder is a hard error rather than a no-op: the alternative is
 * a build whose panel frames nothing, explained only by a CSP violation in a
 * DevTools console nobody has open.
 */
function mentorOriginInManifest(): Plugin {
  const manifest = fileURLToPath(
    new URL('dist/manifest.json', import.meta.url),
  );
  let mentorUrl = DEFAULT_MENTOR_URL;
  return {
    name: 'ibl:mentor-origin-in-manifest',
    // Vite has already loaded .env/.env.local for the bundle; reading its
    // resolved env means the manifest and `MENTOR_URL` cannot disagree.
    configResolved(config) {
      mentorUrl = config.env.VITE_MENTOR_URL || DEFAULT_MENTOR_URL;
    },
    writeBundle() {
      const parsed = JSON.parse(readFileSync(manifest, 'utf8'));
      const csp = parsed.content_security_policy?.extension_pages;
      if (typeof csp !== 'string' || !csp.includes(MENTOR_ORIGIN_PLACEHOLDER)) {
        throw new Error(
          `[${MENTOR_ORIGIN_PLACEHOLDER}] not found in ${manifest} — ` +
            'public/manifest.json must keep it in frame-src and child-src, and ' +
            'the public directory must be copied before writeBundle.',
        );
      }
      parsed.content_security_policy.extension_pages = cspWithMentorOrigin(
        csp,
        mentorUrl,
      );
      writeFileSync(manifest, `${JSON.stringify(parsed, null, 2)}\n`);
    },
  };
}

export default defineConfig({
  // `pnpm ext:build` runs from the repo root; without an explicit root Vite
  // would look for panel.html and public/ there.
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: './',
  plugins: [react(), mentorOriginInManifest()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Readable output: the zip is what Web Store reviewers read, and the
    // injected page functions are serialized from this exact source.
    minify: false,
    modulePreload: { polyfill: false },
    rolldownOptions: { input: 'panel.html' },
  },
});
