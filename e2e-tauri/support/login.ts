/// <reference types="@wdio/globals/types" />

/**
 * Log in through login.iblai.app IF the login form is present. When the isolated
 * webview profile (XDG_DATA_HOME → ~/.local/share/iblai-os-test) already holds a
 * saved session, the app lands in the platform directly and this is a no-op.
 *
 * Credentials come from e2e-tauri/.env.local (TAURI_E2E_USERNAME / _PASSWORD).
 * Resolves once the app origin (os.ibl.ai) is reached.
 */
const hostname = async (): Promise<string> => {
  try {
    return new URL(await browser.getUrl()).hostname;
  } catch {
    return '';
  }
};

export async function loginIfNeeded(): Promise<void> {
  await browser.waitUntil(
    async () =>
      (await browser.execute(() => document.readyState)) === 'complete',
    { timeout: 30_000, timeoutMsg: 'page never finished loading' },
  );
  await browser.pause(4000); // let the login SPA (or the app) hydrate

  const needsLogin =
    (await hostname()) !== 'os.ibl.ai' &&
    (await $('input[type="email"]').isExisting());

  if (needsLogin) {
    const user = process.env.TAURI_E2E_USERNAME;
    const pass = process.env.TAURI_E2E_PASSWORD;
    if (!user || !pass) {
      throw new Error(
        'Login form present but TAURI_E2E_USERNAME / TAURI_E2E_PASSWORD are unset (see e2e-tauri/.env.local)',
      );
    }
    await $('input[type="email"]').setValue(user);
    await $('button*=Continue with Password').click();
    await $('input[type="password"]').waitForExist({ timeout: 15_000 });
    await $('input[type="password"]').setValue(pass);
    await $('button*=Continue').click();
  }

  await browser.waitUntil(async () => (await hostname()) === 'os.ibl.ai', {
    timeout: 60_000,
    interval: 1000,
    timeoutMsg: 'never reached the os.ibl.ai app origin after login',
  });
}
