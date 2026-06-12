import { test, expect } from '../fixtures/mentor-test';
import type { Page } from '@playwright/test';
import { navigateToMentorApp, checkAdminStatus } from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';

/**
 * Journey 46: Onboarding — `app/onboarding/page.tsx` renders the SDK onboarding
 * wizard (`@iblai/iblai-js/web-containers`) with an OS-local create-agent final
 * step (`components/onboarding/onboarding-create-agent-step.tsx`).
 *
 * Flow: Organization → Sector → Invite team → first agent. The wizard persists
 * the answers itself (platform metadata) and, on completion, the page redirects
 * to an agent's explore page. These tests walk the flow without submitting the
 * final create (no throwaway agent / redirect side-effect).
 */

const ORG_NAME = 'Playwright Test Org';

const orgInput = (page: Page) => page.getByLabel('Organization name');
const continueButton = (page: Page) =>
  page.getByRole('button', { name: 'Continue' });
const backButton = (page: Page) => page.getByRole('button', { name: 'Back' });

/** Open the wizard at /onboarding once a tenant session is established. */
async function openOnboarding(page: Page): Promise<void> {
  // Establish auth + current tenant (persisted to localStorage), then open the
  // self-contained /onboarding route directly.
  await navigateToMentorApp(page);
  await page.goto('/onboarding', { waitUntil: 'domcontentloaded' });
  await waitForPageReady(page);
  await expect(orgInput(page)).toBeVisible({ timeout: 30_000 });
}

/** Fill the org name and advance to the sector step. */
async function gotoSectorStep(page: Page): Promise<void> {
  await orgInput(page).fill(ORG_NAME);
  await continueButton(page).click();
  await expect(page.getByText('What best describes your sector?')).toBeVisible({
    timeout: 15_000,
  });
}

/** Pick the first sector and advance to the invite step. */
async function gotoInviteStep(page: Page): Promise<void> {
  await gotoSectorStep(page);
  await page.getByRole('radio').first().click();
  await continueButton(page).click();
  await expect(page.getByText('Invite your team')).toBeVisible({
    timeout: 15_000,
  });
}

test.describe('Journey 46: Onboarding', () => {
  // onboarding-01: the route renders the wizard
  test('renders the onboarding wizard with a progress bar and the organization step', async ({
    page,
  }) => {
    await openOnboarding(page);

    await expect(page.getByRole('progressbar')).toBeVisible();
    await expect(orgInput(page)).toBeVisible();
    await expect(continueButton(page)).toBeVisible();
  });

  // onboarding-02: organization step gates Continue
  test('Continue is disabled until an organization name is entered', async ({
    page,
  }) => {
    await openOnboarding(page);

    await expect(continueButton(page)).toBeDisabled();
    await orgInput(page).fill(ORG_NAME);
    await expect(continueButton(page)).toBeEnabled();
  });

  // onboarding-03: sector step lists sectors and gates Continue until one is chosen
  test('sector step lists selectable sectors and gates Continue until one is chosen', async ({
    page,
  }) => {
    await openOnboarding(page);
    await gotoSectorStep(page);

    const radios = page.getByRole('radio');
    await expect(radios.first()).toBeVisible();
    expect(await radios.count()).toBeGreaterThan(1);

    await expect(continueButton(page)).toBeDisabled();
    await radios.first().click();
    await expect(continueButton(page)).toBeEnabled();
  });

  // onboarding-04: invite step embeds the team-invite UI
  test('invite step embeds the team-invite block', async ({ page }) => {
    await openOnboarding(page);
    await gotoInviteStep(page);

    await expect(
      page.getByText('Teammates can collaborate on agents and your workspace.'),
    ).toBeVisible();
    await expect(continueButton(page)).toBeVisible();
  });

  // onboarding-05: Back navigation preserves earlier answers
  test('Back navigation returns to the previous step and preserves the organization name', async ({
    page,
  }) => {
    await openOnboarding(page);
    await gotoSectorStep(page);

    await backButton(page).click();
    await expect(orgInput(page)).toHaveValue(ORG_NAME, { timeout: 10_000 });
  });

  // onboarding-06: final create-agent step renders, prefilled from the sector
  test('final step shows the create-agent form prefilled from the chosen sector', async ({
    page,
  }) => {
    await openOnboarding(page);

    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      test.skip(true, 'Creating the first agent requires admin access');
      return;
    }

    await gotoInviteStep(page);
    // Leaving the invite step persists the answers (platform metadata) first.
    await continueButton(page).click();

    await expect(page.getByText('Make your first agent')).toBeVisible({
      timeout: 20_000,
    });
    // Name is prefilled from the chosen sector's suggested first agent.
    await expect(page.getByLabel('Name', { exact: true })).not.toHaveValue('');
    await expect(page.getByLabel('Description', { exact: true })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Create agent' }),
    ).toBeVisible();
    // Intentionally NOT submitting — avoids creating a throwaway agent + redirect.
  });
});
