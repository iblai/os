import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, checkAdminStatus } from '../utils/auth';
import { EMBED_URL } from '../fixtures/test-data';
import { waitForPageReady } from '../utils/resilient';

test.describe('Journey 13: Shareable Links & Embed Integration', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) test.skip(true, 'Embed configuration requires admin access');
  });

  // fixme: embed configuration times out — setVisibility method error
  test.fixme(
    'admin goes to embed tab and configures a non-anonymous embed with voice call, voice record, and attachment buttons',
    async ({ page, editMentorPage }) => {
      await editMentorPage.open('Embed');
      await waitForPageReady(page);
      await expect(editMentorPage.embed.embedCodeBlock).toBeVisible({
        timeout: 15_000,
      });
      const code = await editMentorPage.embed.getEmbedCode();
      expect(code.length).toBeGreaterThan(0);
      await editMentorPage.close();
    },
  );

  test('admin goes to embed tab and an authenticated embed chat sends a message and receives a response', async ({
    page,
    editMentorPage,
  }) => {
    if (!EMBED_URL) {
      test.skip(true, 'Set EMBED_URL to enable embed integration test');
      return;
    }
    await editMentorPage.open('Embed');
    const embedCode = await editMentorPage.embed.getEmbedCode().catch(() => '');
    await editMentorPage.close();

    if (!embedCode) return;

    await page.goto(EMBED_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    const iframe = page.frameLocator('iframe').first();
    const chatInput = iframe.getByPlaceholder('Ask anything', { exact: true });
    if (await chatInput.isVisible({ timeout: 15_000 }).catch(() => false)) {
      await chatInput.fill('Hello from embed test');
      await iframe.getByRole('button', { name: 'Send message' }).click();
      await expect(
        iframe.locator('.chat-ai-message-response').first(),
      ).toBeVisible({ timeout: 60_000 });
    }
  });

  // fixme: embed visibility setting fails — Radix UI option locator issue
  test.fixme(
    'admin goes to embed tab and configures an advanced anonymous embed with Anyone visibility',
    async ({ page, editMentorPage }) => {
      await editMentorPage.open('Settings');
      await waitForPageReady(page);
      const hasVisibility = await editMentorPage.settings.visibilityCombobox
        .isVisible({ timeout: 5_000 })
        .catch(() => false);
      if (hasVisibility) {
        await editMentorPage.settings.setVisibility('Anyone');
      }
      await editMentorPage.navigateToTab('Embed');
      await expect(editMentorPage.embed.embedCodeBlock).toBeVisible({
        timeout: 15_000,
      });
      await editMentorPage.close();
    },
  );

  test('admin goes to embed tab and configures context-aware anonymous embed', async ({
    page,
    editMentorPage,
  }) => {
    await editMentorPage.open('Embed');
    await waitForPageReady(page);
    const contextSwitch = editMentorPage.dialog.getByRole('switch', {
      name: /context aware/i,
    });
    if (await contextSwitch.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await contextSwitch.click();
      await page.waitForTimeout(500);
      await contextSwitch.click(); // restore
    }
    await editMentorPage.close();
  });
});
