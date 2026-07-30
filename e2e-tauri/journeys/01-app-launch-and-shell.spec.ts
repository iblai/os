/// <reference types="@wdio/globals/types" />

/**
 * Journey 1: App Launch & Desktop Shell
 *
 * Checkpoints (ledger: ../coverage.json / ../COVERAGE.md):
 *   shell-01  App binary launches under tauri-driver and a WebDriver session attaches
 *   shell-02  The WebView renders a <body>
 *   shell-03  The WebView loads a document with a non-empty URL
 *   shell-04  The document exposes a non-empty title
 *
 * Drives the built desktop binary through tauri-driver (see ../wdio.conf.ts) — a
 * layer the Playwright suite (e2e/) and the Vitest unit tests don't cover. Kept
 * resilient: the shell can be the online app or the offline fallback depending on
 * network/auth, so it asserts the app boots and renders rather than pinning copy.
 */
describe('Journey 1: App Launch & Desktop Shell', () => {
  it('shell-01: launches and attaches a WebDriver session to the WebView', async () => {
    // Reaching here means tauri-driver launched the binary and the native
    // WebView driver created a session; assert a live window handle exists.
    const handle = await browser.getWindowHandle();
    expect(typeof handle).toBe('string');
    expect(handle.length).toBeGreaterThan(0);
  });

  it('shell-02: renders a <body> in the WebView', async () => {
    const body = $('body');
    await body.waitForExist({
      timeout: 60_000,
      timeoutMsg: 'the app never rendered a <body> in its WebView',
    });
    await expect(body).toBeExisting();
  });

  it('shell-03: loads a document with a non-empty URL', async () => {
    const url = await browser.getUrl();
    console.log('[e2e] url  :', url);
    expect(typeof url).toBe('string');
    expect(url.length).toBeGreaterThan(0);
  });

  it('shell-04: exposes a non-empty document title', async () => {
    const title = await browser.getTitle();
    console.log('[e2e] title:', title);
    expect(typeof title).toBe('string');
    expect(title.length).toBeGreaterThan(0);
  });
});
