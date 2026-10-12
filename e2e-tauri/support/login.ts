/// <reference types="@wdio/globals/types" />

/**
 * Log in through the auth SPA IF the login form is present. When the isolated
 * webview profile (XDG_DATA_HOME → ~/.local/share/iblai-os-test) already holds a
 * saved session, the app lands in the platform directly and this is a no-op.
 *
 * Credentials come from e2e-tauri/.env.local (TAURI_E2E_USERNAME / _PASSWORD).
 * The app origin is TAURI_APP_URL (default os.ibl.ai; CI points it at the
 * staging deployment the web e2e signs into). Resolves once it is reached.
 */
export const APP_URL = process.env.TAURI_APP_URL ?? 'https://os.ibl.ai';
const APP_HOST = new URL(APP_URL).hostname;

const hostname = async (): Promise<string> => {
  try {
    return new URL(await browser.getUrl()).hostname;
  } catch {
    return '';
  }
};
const onApp = async (): Promise<boolean> => (await hostname()) === APP_HOST;

export async function loginIfNeeded(): Promise<void> {
  await browser.waitUntil(
    async () =>
      (await browser.execute(() => document.readyState)) === 'complete',
    { timeout: 30_000, timeoutMsg: 'page never finished loading' },
  );
  await browser.pause(4000); // let the login SPA (or the app) hydrate

  const withPassword = $('button*=Continue with Password');
  const needsLogin =
    !(await onApp()) &&
    ((await withPassword.isExisting()) ||
      (await $('input[type="email"]').isExisting()));

  if (needsLogin) {
    const user = process.env.TAURI_E2E_USERNAME;
    const pass = process.env.TAURI_E2E_PASSWORD;
    if (!user || !pass) {
      throw new Error(
        'Login form present but TAURI_E2E_USERNAME / TAURI_E2E_PASSWORD are unset (see e2e-tauri/.env.local)',
      );
    }
    // The SPA's password form sits behind "Continue with Password" (the same
    // order the SDK's Playwright login helper uses).
    if (await withPassword.isExisting()) await withPassword.click();
    await $('input[type="email"]').waitForExist({ timeout: 15_000 });
    await $('input[type="email"]').setValue(user);
    await $('input[type="password"]').waitForExist({ timeout: 15_000 });
    await $('input[type="password"]').setValue(pass);
    await $('button=Continue').click();
  }

  await browser.waitUntil(onApp, {
    timeout: 60_000,
    interval: 1000,
    timeoutMsg: `never reached the ${APP_HOST} app origin after login`,
  });
}
