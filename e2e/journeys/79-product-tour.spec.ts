import { test, expect } from '../fixtures/mentor-test';
import type { Locator, Page } from '@playwright/test';
import { navigateToMentorApp, checkAdminStatus } from '../utils/auth';
import {
  isUserMetadataResponse,
  restoreProductTourSeen,
  saveTourOutcome,
  trackUserMetadata,
} from '../utils/product-tour';

/**
 * Journey 79: First-Visit Product Tour
 *
 * react-joyride tour over the agent chat page chrome: it opens on the chat
 * input, then the profile menu, privacy mode, conversation starters (only when
 * the agent has some), the sidebar Agents menu and, for live admins only, the
 * account tools in the sidebar footer. The send button is not a step. Whether it was seen lives on the user's
 * metadata (`public_metadata["os-product-tour"]`); the auth setups mark it
 * seen so it never blocks other journeys, and each checkpoint here replays it
 * with `?tour=1`. Every outcome (finished / skipped) still counts as seen, and
 * `afterEach` rewrites the record anyway so later journeys stay unblocked.
 */

const tooltipOf = (page: Page) => page.getByTestId('product-tour-tooltip');
const progressOf = (page: Page) => page.getByTestId('product-tour-progress');

function withQuery(url: string, query: string): string {
  const next = new URL(url);
  next.search = query;
  return next.toString();
}

async function openTour(page: Page, query = 'tour=1'): Promise<Locator> {
  await navigateToMentorApp(page, withQuery(page.url(), query));
  const tip = tooltipOf(page);
  await expect(tip).toBeVisible({ timeout: 30_000 });
  return tip;
}

async function stepCount(page: Page): Promise<number> {
  await expect(progressOf(page)).toHaveText(/^\d+ of \d+$/);
  const text = (await progressOf(page).textContent()) ?? '';
  return Number(/of (\d+)/.exec(text)?.[1]);
}

async function collectStepIds(page: Page): Promise<string[]> {
  const tip = tooltipOf(page);
  const total = await stepCount(page);
  const ids: string[] = [];
  for (let step = 1; step <= total; step += 1) {
    await expect(progressOf(page)).toHaveText(`${step} of ${total}`);
    ids.push((await tip.getAttribute('data-step-id')) ?? '');
    if (step < total) await tip.getByRole('button', { name: 'Next' }).click();
  }
  return ids;
}

async function goToLastStep(page: Page): Promise<void> {
  const total = await stepCount(page);
  for (let step = 1; step < total; step += 1) {
    await tooltipOf(page).getByRole('button', { name: 'Next' }).click();
    await expect(progressOf(page)).toHaveText(`${step + 1} of ${total}`);
  }
}

test.describe('Journey 79: First-Visit Product Tour', () => {
  test.setTimeout(200_000);

  let userMetadata: ReturnType<typeof trackUserMetadata>;

  test.beforeEach(async ({ page }) => {
    userMetadata = trackUserMetadata(page);
    await navigateToMentorApp(page);
  });

  test.afterEach(async ({ page }) => {
    try {
      await restoreProductTourSeen(page, userMetadata);
    } catch {
      // Best effort: a completed or skipped tour is already a seen record.
    }
  });

  test('admin opens the chat page with ?tour=1 and the tour starts on the prompt input step with no Back button', async ({
    page,
  }) => {
    const tip = await openTour(page);

    await expect(tip).toHaveAttribute('data-step-id', 'prompt-input');
    await expect(progressOf(page)).toHaveText(/^1 of \d+$/);
    await expect(tip.getByRole('button', { name: 'Back' })).toHaveCount(0);
    await expect(tip.getByRole('button', { name: 'Next' })).toBeVisible();
    await expect(tip.getByRole('button', { name: 'Skip tour' })).toBeVisible();
    await expect(tip.getByRole('button', { name: 'Close tour' })).toBeVisible();
  });

  test('admin clicks Next and Back and the tour moves between steps with matching progress text', async ({
    page,
  }) => {
    const tip = await openTour(page);
    const total = await stepCount(page);

    await tip.getByRole('button', { name: 'Next' }).click();
    await expect(tip).toHaveAttribute('data-step-id', 'profile');
    await expect(progressOf(page)).toHaveText(`2 of ${total}`);
    await expect(tip.getByRole('button', { name: 'Back' })).toBeVisible();

    // Step 3 depends on the tenant: the privacy toggle renders nothing when
    // private mode is off, and its step is dropped.
    await tip.getByRole('button', { name: 'Next' }).click();
    await expect(progressOf(page)).toHaveText(`3 of ${total}`);
    await expect(tip).not.toHaveAttribute('data-step-id', 'profile');

    await tip.getByRole('button', { name: 'Back' }).click();
    await expect(tip).toHaveAttribute('data-step-id', 'profile');
    await expect(progressOf(page)).toHaveText(`2 of ${total}`);

    await tip.getByRole('button', { name: 'Back' }).click();
    await expect(tip).toHaveAttribute('data-step-id', 'prompt-input');
    await expect(progressOf(page)).toHaveText(`1 of ${total}`);
    await expect(tip.getByRole('button', { name: 'Back' })).toHaveCount(0);
  });

  test('admin walks every step and the account step comes last with Done instead of Skip tour', async ({
    page,
  }) => {
    expect(await checkAdminStatus(page)).toBe(true);
    const tip = await openTour(page);

    const ids = await collectStepIds(page);

    const canonicalOrder = [
      'prompt-input',
      'profile',
      'privacy-mode',
      'conversation-starters',
      'agents',
      'account',
    ];
    expect(ids).toEqual(canonicalOrder.filter((id) => ids.includes(id)));
    expect(ids[0]).toBe('prompt-input');
    expect(ids).toContain('profile');
    expect(ids).toContain('agents');
    expect(ids).not.toContain('prompt-submit');
    expect(ids[ids.length - 1]).toBe('account');
    expect(new Set(ids).size).toBe(ids.length);
    await expect(tip.getByRole('button', { name: 'Done' })).toBeVisible();
    await expect(tip.getByRole('button', { name: 'Skip tour' })).toHaveCount(0);
  });

  test('non-admin walks every step and never sees the account step', async ({
    nonadminPage,
  }) => {
    await navigateToMentorApp(nonadminPage);
    const tip = await openTour(nonadminPage);

    const ids = await collectStepIds(nonadminPage);

    expect(ids[0]).toBe('prompt-input');
    expect(ids).toContain('profile');
    expect(ids).not.toContain('account');
    await expect(tip.getByRole('button', { name: 'Done' })).toBeVisible();
  });

  test('admin finishes the tour with Done, the finished outcome is saved, and it does not auto-start on the next visit', async ({
    page,
  }) => {
    const tip = await openTour(page);
    await goToLastStep(page);

    const saved = await saveTourOutcome(page, () =>
      tip.getByRole('button', { name: 'Done' }).click(),
    );

    expect(saved).toMatchObject({ status: 'finished', version: 1 });
    expect(Date.parse(saved?.completed_at)).not.toBeNaN();
    await expect(tip).toHaveCount(0);

    const metadataLoaded = page.waitForResponse(
      (response) => isUserMetadataResponse(response, 'GET') && response.ok(),
      { timeout: 60_000 },
    );
    await navigateToMentorApp(page, withQuery(page.url(), ''));
    await metadataLoaded;
    // Past the tour's start delay (1s) and its retry window.
    await page.waitForTimeout(4_000);
    await expect(tooltipOf(page)).toHaveCount(0);
  });

  test('admin closes the tour with the X and the skipped outcome is saved', async ({
    page,
  }) => {
    const tip = await openTour(page);

    const saved = await saveTourOutcome(page, () =>
      tip.getByRole('button', { name: 'Close tour' }).click(),
    );

    expect(saved).toMatchObject({ status: 'skipped', version: 1 });
    await expect(tip).toHaveCount(0);
  });

  test('admin clicks Skip tour and the skipped outcome is saved', async ({
    page,
  }) => {
    const tip = await openTour(page);

    const saved = await saveTourOutcome(page, () =>
      tip.getByRole('button', { name: 'Skip tour' }).click(),
    );

    expect(saved).toMatchObject({ status: 'skipped', version: 1 });
    await expect(tip).toHaveCount(0);
  });

  test('admin presses Escape and the tour is skipped', async ({ page }) => {
    const tip = await openTour(page);

    const saved = await saveTourOutcome(page, () =>
      page.keyboard.press('Escape'),
    );

    expect(saved).toMatchObject({ status: 'skipped', version: 1 });
    await expect(tip).toHaveCount(0);
  });

  test('admin opens the chat page with ?tour=1&embed=true and no tour is shown', async ({
    page,
  }) => {
    await page.goto(withQuery(page.url(), 'tour=1&embed=true'), {
      waitUntil: 'domcontentloaded',
      timeout: 120_000,
    });
    await expect(page.locator('[data-tour="prompt-input"]')).toBeVisible({
      timeout: 60_000,
    });
    // Past the tour's start delay (1s) and its retry window.
    await page.waitForTimeout(4_000);
    await expect(tooltipOf(page)).toHaveCount(0);
  });
});
