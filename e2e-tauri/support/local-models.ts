/// <reference types="@wdio/globals/types" />

/**
 * The on-device model UI as a signed-in user meets it: the nav-bar's LLM Model
 * Selector → a provider card → the SDK's "LLM Selection" dialog with its
 * on-device rows; the Local Models switch in Profile → Advanced; and the
 * device-global flag (`ibl_local_llm_enabled`) both of them read.
 */

/** The catalog model the UI checkpoints pull — the smallest desktop entry. */
export const UI_MODEL = { id: 'llama3.2', name: 'Llama 3.2', provider: 'Meta' };
/** A second catalog model, in another provider's picker, for the one-at-a-time guard. */
export const OTHER_MODEL = { name: 'Phi-4 Mini', provider: 'Microsoft' };

/** Same-tab event the nav-bar badge listens for (`LOCAL_LLM_CHANGED_EVENT`). */
const LOCAL_LLM_CHANGED_EVENT = 'ibl:local-llm-changed';

export const pickerButton = () => $('button[aria-label="LLM Model Selector"]');
export const localRow = (name: string) =>
  $(`[data-testid="llm-local-model-row"][data-model="${name}"]`);

/** The row's `data-status`, or null when the row is not on screen. */
export async function rowStatus(name: string): Promise<string | null> {
  const row = localRow(name);
  if (!(await row.isExisting())) return null;
  return row.getAttribute('data-status');
}

/** The flag as the app stores it: 'true', 'false' or null (never set). */
export async function localModelsEnabled(): Promise<string | null> {
  return browser.execute(() => localStorage.getItem('ibl_local_llm_enabled'));
}

/** Flip the flag the way the Advanced tab does; off also forgets the model. */
export async function setLocalModelsEnabled(enabled: boolean): Promise<void> {
  await browser.execute(
    (on: boolean, event: string) => {
      localStorage.setItem('ibl_local_llm_enabled', String(on));
      if (!on) localStorage.removeItem('ibl_local_llm_model');
      window.dispatchEvent(new Event(event));
    },
    enabled,
    LOCAL_LLM_CHANGED_EVENT,
  );
}

/** Escape out of whatever dialogs are open (picker, providers list, profile). */
export async function closeDialogs(): Promise<void> {
  for (let i = 0; i < 4; i += 1) {
    if (!(await $('[role="dialog"], [role="alertdialog"]').isExisting())) {
      return;
    }
    await browser.keys('Escape');
    await browser.pause(300);
  }
}

/** Open the "LLM Selection" dialog on one provider's models. */
export async function openPicker(provider: string): Promise<void> {
  await closeDialogs();
  await pickerButton().waitForClickable({ timeout: 30_000 });
  await pickerButton().click();
  await $('[data-testid="llm-provider-card"]').waitForExist({
    timeout: 30_000,
    timeoutMsg: 'the LLM Providers dialog listed no provider card',
  });
  for (const card of await $$('[data-testid="llm-provider-card"]')) {
    const name = (await card.getAttribute('data-provider')) ?? '';
    if (name.toLowerCase() !== provider.toLowerCase()) continue;
    await card.click();
    await $(
      '//*[@role="dialog"]//*[normalize-space(.)="LLM Selection"]',
    ).waitForExist({
      timeout: 30_000,
      timeoutMsg: `the "${provider}" card opened no LLM Selection dialog`,
    });
    return;
  }
  throw new Error(`no provider card for "${provider}"`);
}

/** The nav-bar's on-device badge, by its accessible name ('' when hidden). */
export async function badgeText(): Promise<string> {
  const badge = $('[data-testid="local-model-indicator"]');
  if (!(await badge.isExisting())) return '';
  return (await badge.getAttribute('aria-label')) ?? '';
}

/**
 * Profile → Advanced → the "Enable Local Models" switch: its `aria-checked`
 * ('true' | 'false'). Leaves the profile open; `closeDialogs()` shuts it.
 */
export async function advancedSwitchChecked(): Promise<string | null> {
  await closeDialogs();
  // The nav-bar's profile dropdown (the SDK's, named "More options").
  await $(
    '//nav//button[@aria-label="More options" or normalize-space(.)="More options"]',
  ).click();
  await $(
    '//*[@role="menuitem" and contains(normalize-space(.), "Profile")]',
  ).click();
  const tab = $('//*[@role="tab" and normalize-space(.)="Advanced"]');
  await tab.waitForClickable({
    timeout: 30_000,
    timeoutMsg:
      'the profile shows no Advanced tab (only the desktop app has one)',
  });
  await tab.click();
  const sw = $('button[role="switch"][aria-label^="Enable Local Models"]');
  await sw.waitForExist({
    timeout: 15_000,
    timeoutMsg: 'no "Enable Local Models" switch on the Advanced tab',
  });
  return sw.getAttribute('aria-checked');
}
