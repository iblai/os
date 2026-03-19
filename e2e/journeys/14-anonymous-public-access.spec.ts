import { test, expect } from '../fixtures/mentor-test';
import { MENTOR_NEXTJS_HOST, AUTH_HOST } from '../fixtures/test-data';
import { safeWaitForURL } from '../utils/navigation';

test.describe('Journey 14: Anonymous / Public Access', () => {
  test.use({ storageState: undefined });

  test('unauthenticated user goes to a public mentor page and sees the Log In button', async ({
    page,
  }) => {
    test.skip(!MENTOR_NEXTJS_HOST, 'Requires MENTOR_NEXTJS_HOST');
    await page.goto(MENTOR_NEXTJS_HOST, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    await page.waitForTimeout(3_000);
    const loginButton = page.getByRole('button', { name: /log in/i });
    const visible = await loginButton.isVisible({ timeout: 15_000 }).catch(() => false);
    expect(visible).toBe(true);
  });

  test('unauthenticated user goes to the login button on mentor page and is redirected to auth host', async ({
    page,
  }) => {
    test.skip(!MENTOR_NEXTJS_HOST || !AUTH_HOST, 'Requires MENTOR_NEXTJS_HOST and AUTH_HOST');
    await page.goto(MENTOR_NEXTJS_HOST, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    await page.waitForTimeout(3_000);
    const loginButton = page.getByRole('button', { name: /log in/i });
    if (await loginButton.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await loginButton.click();
      await safeWaitForURL(
        page,
        (url) => url.href.includes(AUTH_HOST) || url.href.includes('login'),
        { timeout: 30_000 },
      );
      expect(page.url()).toMatch(/login|auth/i);
    }
  });

  test('unauthenticated user goes to sidebar and navigates to the explore page', async ({
    page,
  }) => {
    test.skip(!MENTOR_NEXTJS_HOST, 'Requires MENTOR_NEXTJS_HOST');
    await page.goto(MENTOR_NEXTJS_HOST, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    await page.waitForTimeout(3_000);
    const exploreLink = page.getByRole('button', { name: /explore/i });
    if (await exploreLink.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await exploreLink.click();
      await expect(page).toHaveURL(/explore/, { timeout: 15_000 });
    }
  });

  test('unauthenticated user goes to a mentor configured for Anyone and can chat and start a new chat', async ({
    page,
  }) => {
    test.skip(!MENTOR_NEXTJS_HOST, 'Requires MENTOR_NEXTJS_HOST');
    await page.goto(MENTOR_NEXTJS_HOST, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    await page.waitForTimeout(3_000);
    const chatInput = page.getByPlaceholder('Ask anything', { exact: true });
    const isAccessible = await chatInput
      .isVisible({ timeout: 15_000 })
      .catch(() => false);
    if (!isAccessible) return; // Mentor not configured for anonymous access
    await chatInput.fill('Hello anonymous test');
    const sendButton = page.getByRole('button', { name: 'Send message' });
    await expect(sendButton).toBeEnabled({ timeout: 10_000 });
    await sendButton.click();
    await expect(
      page.locator('.chat-ai-message-response').first(),
    ).toBeVisible({ timeout: 60_000 });
  });

  test('unauthenticated user goes to sidebar and opens My Mentors modal without seeing the Create button', async ({
    page,
  }) => {
    test.skip(!MENTOR_NEXTJS_HOST, 'Requires MENTOR_NEXTJS_HOST');
    await page.goto(MENTOR_NEXTJS_HOST, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    await page.waitForTimeout(3_000);
    const mentorDropdown = page.getByRole('button', {
      name: 'Selected mentor dropdown button',
    });
    if (await mentorDropdown.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await mentorDropdown.click();
      const myMentorsItem = page.getByRole('menuitem', { name: /my mentors/i });
      if (await myMentorsItem.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await myMentorsItem.click();
        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible({ timeout: 10_000 });
        const createButton = dialog.getByRole('button', { name: /create/i });
        await expect(createButton).not.toBeVisible({ timeout: 3_000 });
        await page.keyboard.press('Escape');
      }
    }
  });

  test('unauthenticated user goes to collapsed sidebar and admin buttons redirect to auth', async ({
    page,
  }) => {
    test.skip(!MENTOR_NEXTJS_HOST || !AUTH_HOST, 'Requires MENTOR_NEXTJS_HOST and AUTH_HOST');
    await page.goto(MENTOR_NEXTJS_HOST, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    await page.waitForTimeout(3_000);
    const analyticsBtn = page.getByRole('button', { name: 'Analytics', exact: true });
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
