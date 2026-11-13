import { expect, type Locator, type Page } from '@playwright/test';
import { logger } from '@iblai/iblai-js/playwright';

/**
 * The plan picker (`UpgradePackageModal` from `@iblai/web-containers`) in both
 * of its modes:
 *
 *   - "Choose Your Plan": a free-trial user (main tenant) picks their first
 *     plan. Every card offers "Choose <name>" and Pro is marked "Most Popular".
 *     Choosing a plan leaves the app for a Stripe checkout.
 *   - "Change Your Plan": an account already on a plan. Its own card is marked
 *     "Current Plan" (disabled button), cheaper plans offer "Downgrade to
 *     <name>", dearer ones "Upgrade to <name>", and a dashed box above the
 *     cards offers "Add One-Time Credits". An upgrade with a card on file is
 *     applied in place (toast "You're now on the <name> plan."), a downgrade is
 *     scheduled for the end of the period, and a change that still needs a
 *     card leaves for a Stripe checkout.
 *
 * The SDK's own `plan-picker-helpers` only know the trial mode (they look for
 * the "Choose Your Plan" heading and "Choose …" buttons), so these helpers
 * cover both.
 */

/** Plan keys as the backend and the `plan-card-<key>` test ids name them. */
export type PlanKey = 'free' | 'premium' | 'max' | 'ultra';

/** The heading each known plan card carries (the `premium` key reads "Pro"). */
export const PLAN_NAMES: Record<PlanKey, string> = {
  free: 'Free',
  premium: 'Pro',
  max: 'Max',
  ultra: 'Ultra',
};

/** Cheapest first; the picker says "Upgrade to" / "Downgrade to" from this order. */
export const PLAN_ORDER: PlanKey[] = ['free', 'premium', 'max', 'ultra'];

export type PlanPickerMode = 'choose' | 'change';

const PICKER_TIMEOUT = 20_000;

function planRank(key: string): number {
  const index = PLAN_ORDER.indexOf(key as PlanKey);
  return index === -1 ? PLAN_ORDER.length : index;
}

/** The picker dialog in either mode. */
export function planPickerDialog(page: Page): Locator {
  return page.getByRole('dialog').filter({
    has: page.getByRole('heading', { name: /^(Choose|Change) Your Plan$/ }),
  });
}

/** One plan card, by key. */
export function planCard(page: Page, key: string): Locator {
  return planPickerDialog(page).getByTestId(`plan-card-${key}`);
}

/**
 * A card's one button: "Choose <name>" on the trial picker, "Upgrade to" /
 * "Downgrade to" / "Switch to <name>" in change mode, or the disabled
 * "Current Plan".
 */
export function planCardButton(page: Page, key: string): Locator {
  return planCard(page, key).getByRole('button');
}

/** The card marked as the account's current plan (change mode only). */
export function currentPlanCard(page: Page): Locator {
  return planPickerDialog(page).locator(
    '[data-testid^="plan-card-"][data-current="true"]',
  );
}

/** The "Just need more credits?" box above the cards (change mode only). */
export function oneTimeCreditsBox(page: Page): Locator {
  return planPickerDialog(page).getByTestId('plan-picker-one-time-credits');
}

/**
 * Waits until the picker is open and shows its plan cards. Fails here, not
 * later, when the plans could not load ("Try Again") or there are none.
 */
export async function waitForPlanPicker(page: Page): Promise<Locator> {
  const dialog = planPickerDialog(page);
  await expect(dialog).toBeVisible({ timeout: PICKER_TIMEOUT });
  await expect(dialog.locator('[aria-busy="true"]')).toHaveCount(0, {
    timeout: PICKER_TIMEOUT,
  });
  await expect(
    dialog.locator('[data-testid^="plan-card-"]').first(),
  ).toBeVisible({ timeout: PICKER_TIMEOUT });
  return dialog;
}

/** Which mode the open picker is in, read from its heading. */
export async function getPlanPickerMode(page: Page): Promise<PlanPickerMode> {
  const dialog = planPickerDialog(page);
  await expect(dialog).toBeVisible({ timeout: PICKER_TIMEOUT });
  const change = await dialog
    .getByRole('heading', { name: 'Change Your Plan' })
    .count();
  return change > 0 ? 'change' : 'choose';
}

/** The plan keys the picker shows, in card order. */
export async function getPlanPickerKeys(page: Page): Promise<string[]> {
  const cards = planPickerDialog(page).locator('[data-testid^="plan-card-"]');
  const ids = await cards.evaluateAll((els) =>
    els.map((el) => el.getAttribute('data-testid') || ''),
  );
  return ids.map((id) => id.replace(/^plan-card-/, ''));
}

/**
 * Asserts the trial picker: "Choose Your Plan", one "Choose <name>" button per
 * card, Pro marked "Most Popular" when it is offered next to other plans, no
 * current-plan card and no one-time credits box. Returns the plan keys shown.
 */
export async function expectTrialPlanPicker(page: Page): Promise<string[]> {
  const dialog = await waitForPlanPicker(page);
  await expect(
    dialog.getByRole('heading', { name: 'Choose Your Plan' }),
  ).toBeVisible();
  const keys = await getPlanPickerKeys(page);
  expect(keys.length, 'expected at least one plan card').toBeGreaterThan(0);
  for (const key of keys) {
    const name = PLAN_NAMES[key as PlanKey];
    await expect(planCardButton(page, key)).toHaveText(
      name ? `Choose ${name}` : /^Choose /,
    );
    await expect(planCardButton(page, key)).toBeEnabled();
  }
  if (keys.includes('premium') && keys.length > 1) {
    await expect(
      planCard(page, 'premium').getByText('Most Popular'),
    ).toBeVisible();
  }
  await expect(currentPlanCard(page)).toHaveCount(0);
  await expect(oneTimeCreditsBox(page)).toHaveCount(0);
  logger.info(`Trial plan picker shows: ${keys.join(', ')}`);
  return keys;
}

/** The key of the card marked "Current Plan" in the open change-mode picker. */
export async function getCurrentPlanKey(page: Page): Promise<string> {
  const card = currentPlanCard(page);
  await expect(card).toHaveCount(1, { timeout: PICKER_TIMEOUT });
  const id = (await card.getAttribute('data-testid')) || '';
  return id.replace(/^plan-card-/, '');
}

/**
 * Asserts the change-mode picker: "Change Your Plan", the account's card
 * marked "Current Plan" with a disabled button, every other card offering
 * "Upgrade to" (dearer) or "Downgrade to" (cheaper) its plan, and the "Add
 * One-Time Credits" box. Pass `currentKey` to pin which plan must be current;
 * omitted, it is read from the marked card. Returns the plan keys shown.
 */
export async function expectChangePlanPicker(
  page: Page,
  currentKey?: string,
): Promise<string[]> {
  const dialog = await waitForPlanPicker(page);
  await expect(
    dialog.getByRole('heading', { name: 'Change Your Plan' }),
  ).toBeVisible();
  const keys = await getPlanPickerKeys(page);
  if (!currentKey) currentKey = await getCurrentPlanKey(page);
  expect(keys, `expected the ${currentKey} card in the picker`).toContain(
    currentKey,
  );
  await expect(currentPlanCard(page)).toHaveAttribute(
    'data-testid',
    `plan-card-${currentKey}`,
  );
  await expect(planCardButton(page, currentKey)).toHaveText('Current Plan');
  await expect(planCardButton(page, currentKey)).toBeDisabled();
  for (const key of keys) {
    if (key === currentKey) continue;
    const name = PLAN_NAMES[key as PlanKey];
    const diff = planRank(key) - planRank(currentKey);
    const verb =
      diff > 0 ? 'Upgrade to' : diff < 0 ? 'Downgrade to' : 'Switch to';
    await expect(planCardButton(page, key)).toHaveText(
      name ? `${verb} ${name}` : new RegExp(`^${verb} `),
    );
    await expect(planCardButton(page, key)).toBeEnabled();
  }
  await expect(
    oneTimeCreditsBox(page).getByRole('button', {
      name: 'Add One-Time Credits',
    }),
  ).toBeVisible();
  logger.info(
    `Change-plan picker shows: ${keys.join(', ')} (current: ${currentKey})`,
  );
  return keys;
}

/**
 * Clicks a plan's button and returns once the browser has left the app for
 * Stripe: "Choose <name>" on the trial picker, or a change that needs a
 * checkout (no card on file yet). Stripe's page need not finish loading.
 */
export async function pickPlanExpectingCheckout(
  page: Page,
  key: string,
): Promise<string> {
  await waitForPlanPicker(page);
  const button = planCardButton(page, key);
  await expect(button).toBeEnabled({ timeout: PICKER_TIMEOUT });
  const appOrigin = new URL(page.url()).origin;
  await button.click();
  await page.waitForURL((url) => url.origin !== appOrigin, {
    timeout: 60_000,
    waitUntil: 'commit',
  });
  logger.info(`Picked plan ${key}; now at ${page.url()}`);
  return page.url();
}

/**
 * Clicks a plan's button for a change applied without leaving the app (an
 * upgrade charged to the card on file, or a scheduled downgrade) and waits for
 * the toast that confirms it and for the picker to close.
 */
export async function pickPlanInPlace(
  page: Page,
  key: string,
  expectedToast: RegExp,
): Promise<void> {
  const dialog = await waitForPlanPicker(page);
  const button = planCardButton(page, key);
  await expect(button).toBeEnabled({ timeout: PICKER_TIMEOUT });
  await button.click();
  await expect(page.getByText(expectedToast).first()).toBeVisible({
    timeout: 60_000,
  });
  await expect(dialog).toBeHidden({ timeout: 30_000 });
  logger.info(`Plan ${key} applied in place`);
}

/** Closes the picker with its Close button and waits for it to go. */
export async function closePlanPicker(page: Page): Promise<void> {
  const dialog = planPickerDialog(page);
  await expect(dialog).toBeVisible({ timeout: PICKER_TIMEOUT });
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toBeHidden({ timeout: 15_000 });
}
