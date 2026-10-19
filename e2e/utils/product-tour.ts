import { expect, type Page, type Response } from '@playwright/test';

/** Mirrors `productTourMetadataKey()` in components/product-tour/use-tour-completion.ts. */
export const PRODUCT_TOUR_METADATA_KEY = 'os-product-tour';

const USER_METADATA_PATH = '/api/ibl/users/manage/metadata/';

export const isUserMetadataResponse = (
  response: Response,
  method: 'GET' | 'POST',
): boolean =>
  response.url().includes(USER_METADATA_PATH) &&
  response.request().method() === method;

export type CapturedUserMetadata = {
  url: string;
  authorization: string;
  body: Record<string, any>;
};

/**
 * Remembers the app's own user-metadata GET (URL, auth header, payload). It
 * carries everything a direct call to the same endpoint needs, so no extra
 * host or token configuration is required. Attach before the first navigation.
 */
export function trackUserMetadata(page: Page) {
  const state: { latest: CapturedUserMetadata | null } = { latest: null };

  const capture = async (
    response: Response,
  ): Promise<CapturedUserMetadata | null> => {
    if (!isUserMetadataResponse(response, 'GET') || !response.ok()) return null;
    const headers = await response.request().allHeaders();
    state.latest = {
      url: response.url(),
      authorization: headers['authorization'] ?? '',
      body: await response.json().catch(() => ({})),
    };
    return state.latest;
  };

  page.on('response', (response) => {
    void capture(response).catch(() => undefined);
  });

  return {
    async current(timeout = 60_000): Promise<CapturedUserMetadata> {
      if (state.latest) return state.latest;
      const response = await page.waitForResponse(
        (candidate) =>
          isUserMetadataResponse(candidate, 'GET') && candidate.ok(),
        { timeout },
      );
      const captured = await capture(response);
      if (!captured)
        throw new Error('The user metadata response was not usable');
      return captured;
    },
  };
}

export function readTourRecord(
  metadata: CapturedUserMetadata,
): Record<string, any> | null {
  return metadata.body?.public_metadata?.[PRODUCT_TOUR_METADATA_KEY] ?? null;
}

async function writeTourRecord(
  page: Page,
  metadata: CapturedUserMetadata,
  record: Record<string, any>,
): Promise<void> {
  const username =
    metadata.body?.username ??
    new URL(metadata.url).searchParams.get('username');
  expect(username, 'username missing from the user metadata').toBeTruthy();

  // The endpoint replaces public_metadata wholesale, so keep the other keys.
  const response = await page.request.post(metadata.url, {
    headers: {
      authorization: metadata.authorization,
      'content-type': 'application/json',
    },
    data: {
      username,
      public_metadata: {
        ...(metadata.body?.public_metadata ?? {}),
        [PRODUCT_TOUR_METADATA_KEY]: record,
      },
    },
  });
  expect(
    response.ok(),
    `writing the tour record failed: ${response.status()}`,
  ).toBeTruthy();
}

/** Marks the tour as seen on the user's metadata. No-op when a record exists. */
export async function markProductTourSeen(
  page: Page,
  tracker: ReturnType<typeof trackUserMetadata>,
): Promise<void> {
  const metadata = await tracker.current();
  if (readTourRecord(metadata)) return;

  await writeTourRecord(page, metadata, {
    status: 'skipped',
    version: 1,
    completed_at: new Date().toISOString(),
    // Ignored by the app; tells a seeded record from a real one.
    source: 'e2e-auth-setup',
  });
}

/**
 * Overwrites the tour record with a seen one, whatever is stored. For specs
 * that replayed the tour and must leave later journeys unblocked.
 */
export async function restoreProductTourSeen(
  page: Page,
  tracker: ReturnType<typeof trackUserMetadata>,
): Promise<void> {
  await writeTourRecord(page, await tracker.current(), {
    status: 'skipped',
    version: 1,
    completed_at: new Date().toISOString(),
    source: 'e2e-restore',
  });
}

/**
 * Runs `action` (clicking Done or the X) and returns the tour record the app
 * sent to the user-metadata endpoint, once that request has succeeded.
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
