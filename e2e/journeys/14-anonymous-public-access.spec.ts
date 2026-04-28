import { expect, type Page } from '@playwright/test';
import { test } from '../fixtures/mentor-test';
import { MENTOR_NEXTJS_HOST, AUTH_HOST } from '../fixtures/test-data';
import { safeWaitForURL, parsePlatformUrl } from '../utils/navigation';
import { navigateToMentorApp } from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';
import { CreateMentorPage } from '../page-objects/create-mentor.page';
import { EditMentorPage } from '../page-objects/edit-mentor/edit-mentor.page';
import { logger } from '@iblai/iblai-js/playwright';
import path from 'path';

test.describe('Journey 14: Anonymous / Public Access', () => {
  let mentorId = '';
  let platformKey = '';

  test.beforeAll(async ({ browser }, testInfo) => {
    // Create an authenticated context using the admin storage state
    const browserKey = testInfo.project.name
      .replace('mentor-desktop-', '')
      .toLowerCase();
    const authFile = path.join(
      __dirname,
      `../../playwright/.auth/user-${browserKey}.json`,
    );
    const setupContext = await browser.newContext({ storageState: authFile });
    const setupPage = await setupContext.newPage();

    try {
      // Navigate to the app as an authenticated admin
      await navigateToMentorApp(setupPage);

      // Create a new mentor for anonymous access testing
      const createMentorPage = new CreateMentorPage(setupPage);
      const mentorName = await createMentorPage.openAndCreate(
        `Anon Test ${Date.now()}`,
      );
      logger.info(`Created mentor: ${mentorName}`);

      // Extract platformKey and mentorId from the URL
      const { platformKey: pk, mentorId: mi } = parsePlatformUrl(
        setupPage.url(),
      );
      platformKey = pk;
      mentorId = mi;
      logger.info(
        `Mentor created — platform: ${platformKey}, mentor: ${mentorId}`,
      );

      // Set visibility to "Anyone" and chat access to "Anyone"
      const editMentorPage = new EditMentorPage(setupPage);
      await editMentorPage.open('Settings');
      await waitForPageReady(setupPage);
      await editMentorPage.settings.setVisibilityAnyone();
      await editMentorPage.settings.setChatAccessAnyone();
      const saveBtn = editMentorPage.dialog
        .getByRole('button', { name: /save/i })
        .first();
      await expect(saveBtn).toBeEnabled({ timeout: 5_000 });
      await saveBtn.click();
      await setupPage.waitForTimeout(2_000);
      await editMentorPage.close();
      logger.info('Mentor visibility and chat access set to Anyone');
    } finally {
      await setupPage.close();
      await setupContext.close();
    }
  });

  test.afterAll(async ({ browser }, testInfo) => {
    // Clean up: delete the mentor created for this test suite
    if (!mentorId || !platformKey) return;
    const browserKey = testInfo.project.name
      .replace('mentor-desktop-', '')
      .toLowerCase();
    const authFile = path.join(
      __dirname,
      `../../playwright/.auth/user-${browserKey}.json`,
    );
    const cleanupContext = await browser.newContext({ storageState: authFile });
    const cleanupPage = await cleanupContext.newPage();

    try {
      const mentorUrl = `${MENTOR_NEXTJS_HOST}/platform/${platformKey}/${mentorId}`;
      await cleanupPage.goto(mentorUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 60_000,
      });
      await waitForPageReady(cleanupPage);

      const editMentorPage = new EditMentorPage(cleanupPage);
      await editMentorPage.open('Settings');
      await editMentorPage.settings.deleteMentor();
      logger.info(`Deleted mentor ${mentorId}`);
    } catch (err) {
      logger.warn(`Failed to clean up mentor ${mentorId}: ${err}`);
    } finally {
      await cleanupPage.close();
      await cleanupContext.close();
    }
  });

  /**
   * Navigate an unauthenticated page to the anonymous mentor URL
   * and wait for the page to stabilise.
   */
  async function goToAnonymousMentor(page: Page): Promise<void> {
    const mentorUrl = `${MENTOR_NEXTJS_HOST}/platform/${platformKey}/${mentorId}`;
    await page.goto(mentorUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    // Wait for the chat interface or login button to appear
    await page
      .getByPlaceholder('Ask anything', { exact: true })
      .or(page.getByRole('button', { name: 'Log in' }))
      .first()
      .waitFor({ timeout: 120_000 });
  }

  // All tests use unauthenticated context — no storageState
  test.use({ storageState: { cookies: [], origins: [] } });

  test('unauthenticated user sees the chat interface on a public mentor page', async ({
    page,
  }) => {
    test.skip(!MENTOR_NEXTJS_HOST, 'Requires MENTOR_NEXTJS_HOST');
    await goToAnonymousMentor(page);
    const chatInput = page.getByPlaceholder('Ask anything', { exact: true });
    await expect(chatInput).toBeVisible({ timeout: 15_000 });
  });

  test('unauthenticated user can chat with a public mentor', async ({
    page,
  }) => {
    test.skip(!MENTOR_NEXTJS_HOST, 'Requires MENTOR_NEXTJS_HOST');
    await goToAnonymousMentor(page);
    const chatInput = page.getByPlaceholder('Ask anything', { exact: true });
    await expect(chatInput).toBeVisible({ timeout: 15_000 });
    await chatInput.fill('Hello anonymous test');
    const sendButton = page.getByRole('button', { name: 'Send message' });
    await expect(sendButton).toBeEnabled({ timeout: 10_000 });
    await sendButton.click();
    await expect(page.locator('.chat-ai-message-response').first()).toBeVisible(
      { timeout: 60_000 },
    );
  });

  test('unauthenticated user sees a Log In button on a public mentor page', async ({
    page,
  }) => {
    test.skip(!MENTOR_NEXTJS_HOST, 'Requires MENTOR_NEXTJS_HOST');
    await goToAnonymousMentor(page);
    const loginButton = page.getByRole('button', { name: 'Log in' });
    await expect(loginButton).toBeVisible({ timeout: 15_000 });
  });

  test('unauthenticated user clicks Log In and is redirected to auth host', async ({
    page,
  }) => {
    test.skip(
      !MENTOR_NEXTJS_HOST || !AUTH_HOST,
      'Requires MENTOR_NEXTJS_HOST and AUTH_HOST',
    );
    await goToAnonymousMentor(page);
    const loginButton = page.getByRole('button', { name: 'Log in' });
    await expect(loginButton).toBeVisible({ timeout: 15_000 });
    await loginButton.click();
    await safeWaitForURL(
      page,
      (url) => url.href.includes(AUTH_HOST) || url.href.includes('login'),
      { timeout: 30_000 },
    );
    expect(page.url()).toMatch(/login|auth/i);
  });

  test('unauthenticated user navigates to the explore page via sidebar', async ({
    page,
  }) => {
    test.skip(!MENTOR_NEXTJS_HOST, 'Requires MENTOR_NEXTJS_HOST');
    await goToAnonymousMentor(page);
    const mentorsButton = page.getByRole('button', {
      name: 'Mentors',
      exact: true,
    });
    await expect(mentorsButton).toBeVisible({ timeout: 10_000 });
    await mentorsButton.click();
    await safeWaitForURL(page, (url) => url.pathname.endsWith('/explore'), {
      timeout: 15_000,
    });
    await expect(page).toHaveURL(/explore/);
  });

  test('unauthenticated user does not see Create button in My Mentors modal', async ({
    page,
  }) => {
    test.skip(!MENTOR_NEXTJS_HOST, 'Requires MENTOR_NEXTJS_HOST');
    await goToAnonymousMentor(page);

    const myMentorsButton = page.getByRole('button', { name: 'My Mentors' });
    const visible = await myMentorsButton
      .isVisible({ timeout: 10_000 })
      .catch(() => false);
    if (!visible) {
      // Fallback: try via mentor dropdown
      const dropdown = page.getByRole('button', {
        name: 'Selected mentor dropdown button',
      });
      if (await dropdown.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await dropdown.click();
        const myMentorsItem = page.getByRole('menuitem', {
          name: /my mentors/i,
        });
        await expect(myMentorsItem).toBeVisible({ timeout: 3_000 });
        await myMentorsItem.click();
      }
    } else {
      await myMentorsButton.click();
    }

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    const createButton = dialog.getByRole('button', { name: /create/i });
    await expect(createButton).not.toBeVisible({ timeout: 3_000 });
    await page.keyboard.press('Escape');
  });

  test('unauthenticated user clicking admin buttons is redirected to auth', async ({
    page,
  }) => {
    test.skip(
      !MENTOR_NEXTJS_HOST || !AUTH_HOST,
      'Requires MENTOR_NEXTJS_HOST and AUTH_HOST',
    );
    await goToAnonymousMentor(page);

    const analyticsBtn = page.getByRole('button', {
      name: 'Analytics',
      exact: true,
    });
    if (await analyticsBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await analyticsBtn.click();
      await page.waitForTimeout(2_000);
      const isRedirected =
        page.url().includes(AUTH_HOST) || page.url().includes('login');
      const hasModal = await page
        .getByRole('dialog')
        .isVisible({ timeout: 3_000 })
        .catch(() => false);
      expect(isRedirected || hasModal).toBe(true);
    }
  });
});
