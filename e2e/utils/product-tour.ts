import { expect, type Page, type Response } from '@playwright/test';

/** Mirrors `productTourMetadataKey()` in components/product-tour/use-tour-completion.ts. */
export const PRODUCT_TOUR_METADATA_KEY = 'os-product-tour';

/** Mirrors LOCAL_STORAGE_KEYS.USER_METADATA — the app reads the tour record here. */
const USER_METADATA_STORAGE_KEY = 'user_metadata';

const USER_METADATA_PATH = '/api/ibl/users/manage/metadata/';

export const isUserMetadataResponse = (
  response: Response,
  method: 'GET' | 'POST',
): boolean =>
  response.url().includes(USER_METADATA_PATH) &&
  response.request().method() === method;

/**
 * Seed a tour record into the `user_metadata` localStorage key the app reads
 * from (via `useStoredUserMetadata` → `use-tour-completion`). The auth app
 * forwards this key at login in production; in e2e the login is stubbed, so we
 * write it directly. Merges into any existing `public_metadata` so other keys
 * survive.
 */
async function seedTourRecord(page: Page, source: string): Promise<void> {
  const record = {
    status: 'skipped',
    version: 1,
    completed_at: new Date().toISOString(),
    // Ignored by the app; tells a seeded record from a real one.
    source,
  };
  await page.evaluate(
    ({ storageKey, tourKey, value }) => {
      let meta: Record<string, any> = {};
      try {
        const raw = localStorage.getItem(storageKey);
        meta = raw ? JSON.parse(raw) : {};
      } catch {
        meta = {};
      }
      if (!meta || typeof meta !== 'object') meta = {};
      meta.public_metadata = {
        ...(meta.public_metadata ?? {}),
        [tourKey]: value,
      };
      localStorage.setItem(storageKey, JSON.stringify(meta));
    },
    {
      storageKey: USER_METADATA_STORAGE_KEY,
      tourKey: PRODUCT_TOUR_METADATA_KEY,
      value: record,
    },
  );
}

/**
 * Marks the tour seen so its overlay never blocks other journeys. The app reads
 * the record from the `user_metadata` localStorage key, so seed it there before
 * storage state is saved.
 */
export async function markProductTourSeen(page: Page): Promise<void> {
  await seedTourRecord(page, 'e2e-auth-setup');
}

/**
 * Re-seeds a seen record after a spec replayed the tour, so later journeys stay
 * unblocked.
 */
export async function restoreProductTourSeen(page: Page): Promise<void> {
  await seedTourRecord(page, 'e2e-restore');
}

/**
 * Runs `action` (clicking Done or the X) and returns the tour record the app
 * sent to the user-metadata endpoint, once that request has succeeded. The
 * write still goes through the update mutation, so the POST is unchanged.
 */
export async function saveTourOutcome(
  page: Page,
  action: () => Promise<void>,
): Promise<Record<string, any> | null> {
  const saved = page.waitForResponse(
    (response) => isUserMetadataResponse(response, 'POST'),
    { timeout: 30_000 },
  );
  await action();
  const response = await saved;
  expect(
    response.ok(),
    `saving the tour outcome failed: ${response.status()}`,
  ).toBeTruthy();
  return (
    response.request().postDataJSON()?.public_metadata?.[
      PRODUCT_TOUR_METADATA_KEY
    ] ?? null
  );
}

/**
 * For freshly signed-up users, whose metadata has no record yet: the tour
 * starts about a second after the shell mounts, so wait for it and skip it.
 */
export async function dismissProductTourIfShown(
  page: Page,
  timeout = 8_000,
): Promise<void> {
  const tooltip = page.getByTestId('product-tour-tooltip');
  try {
    await tooltip.waitFor({ state: 'visible', timeout });
  } catch {
    return;
  }
  await tooltip.getByRole('button', { name: 'Close tour' }).click();
  await expect(tooltip).toHaveCount(0);
}
