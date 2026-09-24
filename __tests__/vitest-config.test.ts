import { describe, it, expect, vi } from 'vitest';

// Importing vitest.config.ts pulls in vite's node entry, which cannot load
// under the jsdom test environment. Mock the config helpers and plugins as
// passthroughs so these tests assert the authored config object only.
vi.mock('vitest/config', () => ({
  defineConfig: (config: unknown) => config,
  configDefaults: { exclude: ['**/node_modules/**'] },
}));
vi.mock('@vitejs/plugin-react', () => ({ default: () => [] }));
vi.mock('vite-tsconfig-paths', () => ({ default: () => ({}) }));

// Guard tests pinning the load-bearing lines of vitest.config.ts. Each entry
// here keeps a directory out of the unit-test run for a reason documented in
// the config; dropping one silently re-collects files that cannot pass here.
describe('vitest.config test.exclude', () => {
  async function loadExclude(): Promise<string[]> {
    const config = (await import('../vitest.config')).default as {
      test?: { exclude?: string[] };
    };
    return config.test?.exclude ?? [];
  }

  it('excludes Claude Code worktrees so sibling checkouts never run in this suite', async () => {
    // `.claude/worktrees/*` are full git worktrees of other branches, each
    // with its own tests and node_modules. Without this entry Vitest walks
    // into them and the pre-push hook fails on another branch's tests.
    expect(await loadExclude()).toContain('.claude/**');
  });

  it('keeps the vitest defaults (node_modules etc.) excluded', async () => {
    expect(await loadExclude()).toContain('**/node_modules/**');
  });

  it('excludes the browser-driven E2E suites', async () => {
    const exclude = await loadExclude();
    expect(exclude).toContain('e2e/**');
    expect(exclude).toContain('e2e-tauri/**');
  });

  it('excludes the gallery generator, which needs a prior build', async () => {
    expect(await loadExclude()).toContain('scripts/build-gallery.test.tsx');
  });
});
