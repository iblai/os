// Pins the in-app updater feed wiring. GitHub's `releases/latest` is simply the
// most recently created release, which in this repo is usually a web `v*`
// release (release-it), not an `app-v*` desktop release — an endpoint built on
// it 404s and the updater silently reports "no update" forever. The apps must
// poll the rolling `app-latest` release, and both desktop release workflows
// must publish their manifests there.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const conf = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8'));
const macWorkflow = readFileSync(
  '.github/workflows/reusable-release-macos-dmg.yml',
  'utf8',
);
const winWorkflow = readFileSync(
  '.github/workflows/reusable-release-windows.yml',
  'utf8',
);

describe('desktop updater feed', () => {
  it('polls the rolling app-latest release, never GitHub releases/latest', () => {
    const endpoints: string[] = conf.plugins.updater.endpoints;
    expect(endpoints).toHaveLength(1);
    expect(endpoints[0]).toBe(
      'https://github.com/iblai/os/releases/download/app-latest/latest-{{target}}-{{arch}}.json',
    );
    expect(endpoints[0]).not.toContain('releases/latest');
  });

  it('ships a pubkey so downloaded updates are signature-checked', () => {
    expect(conf.plugins.updater.pubkey).toMatch(/^[A-Za-z0-9+/=]{40,}$/);
    expect(conf.bundle.createUpdaterArtifacts).toBe(true);
  });

  it.each([
    [
      'macOS',
      macWorkflow,
      'latest-darwin-aarch64.json latest-darwin-x86_64.json',
    ],
    ['Windows', winWorkflow, '"latest-windows-${arch}.json"'],
  ])(
    '%s release workflow publishes manifests to app-latest',
    (_, wf, files) => {
      expect(wf).toContain('gh release view app-latest');
      expect(wf).toContain('gh release create app-latest --latest=false');
      expect(wf).toContain(`gh release upload app-latest ${files} --clobber`);
      expect(wf).toContain(
        'TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}',
      );
      expect(wf).toContain(
        'TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}',
      );
    },
  );
});
