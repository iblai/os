import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The script the phone app injects into every page its webview loads
 * (`MOBILE_SAFE_AREA_SCRIPT`, `src-tauri/src/lib.rs`), run here as the webview
 * runs it: once per document, with the app's own address substituted in.
 */
const SCRIPT = readFileSync(
  resolve(process.cwd(), 'src-tauri/src/lib.rs'),
  'utf8',
)
  .split('const MOBILE_SAFE_AREA_SCRIPT: &str = r#"')[1]
  .split('"#;')[0];

/**
 * `otherSitesAsBrowser` is what the native side substitutes per platform:
 * true on iOS, where it also pins the webview to the safe area for such a
 * page, false on Android.
 */
const inject = (appUrl: string, otherSitesAsBrowser = true) => {
  delete (window as unknown as Record<string, unknown>).__safeAreaSetup;
  new Function(
    SCRIPT.replace('__IBL_APP_BASE_URL__', JSON.stringify(appUrl)).replace(
      '__IBL_OTHER_SITES_AS_BROWSER__',
      String(otherSitesAsBrowser),
    ),
  )();
};

/**
 * A touch drag on the page itself, outside any scrolling element — not a
 * `div`, since the app layout makes the body's first one the scroller.
 */
const dragThePage = () => {
  const target = document.body.appendChild(document.createElement('p'));
  const drag = new Event('touchmove', { bubbles: true, cancelable: true });
  target.dispatchEvent(drag);
  return drag;
};

const viewport = () =>
  document.head
    .querySelector('meta[name="viewport"]')
    ?.getAttribute('content') ?? null;

describe('the phone app’s injected page script', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    document.head.innerHTML =
      '<meta name="viewport" content="width=device-width, initial-scale=1">';
    document.documentElement.replaceChild(
      document.createElement('body'),
      document.body,
    );
  });

  it('gives the app’s own pages the fixed, safe-area layout', () => {
    inject(window.location.origin);

    const css = document.getElementById('ibl-safe-area-styles')?.textContent;
    expect(css).toContain('position: fixed;');
    expect(viewport()).toContain('viewport-fit=cover');
    expect(dragThePage().defaultPrevented).toBe(true);
  });

  it('injects no layout into another site’s page on iOS', () => {
    // The sign-in site is an ordinary document: under the shell's fixed body
    // a longer page could not scroll at all.
    inject('https://app.example.com');

    expect(document.getElementById('ibl-safe-area-styles')).toBeNull();
    expect(viewport()).toBe('width=device-width, initial-scale=1');
    expect(dragThePage().defaultPrevented).toBe(false);
  });

  it('keeps the layout on another site’s page on Android, where nothing pins the webview', () => {
    inject('https://app.example.com', false);

    expect(document.getElementById('ibl-safe-area-styles')).not.toBeNull();
    expect(dragThePage().defaultPrevented).toBe(true);
  });

  it('keeps the layout everywhere when the app’s address cannot be read', () => {
    inject('not a url');

    expect(document.getElementById('ibl-safe-area-styles')).not.toBeNull();
  });
});
