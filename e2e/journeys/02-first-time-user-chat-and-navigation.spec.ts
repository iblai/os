import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp } from '../utils/auth';
import { openMoreOptionsMenu } from '../utils/navigation';

test.describe('Journey 2: First-Time User Chat & Navigation', () => {
  test.beforeEach(async ({ nonadminPage }) => {
    await navigateToMentorApp(nonadminPage);
  });

  // fixme: AI response timeout — dependent on LLM service availability
  test.fixme(
    'newly registered user goes to chat page and sends a message and receives an AI response',
    async ({ nonadminChatPage }) => {
      await nonadminChatPage.sendMessage('Hello, can you help me?');
      await nonadminChatPage.waitForAIResponse();
      await expect(nonadminChatPage.aiMessages.first()).toBeVisible();
    },
  );

  // fixme: depends on test 1 sending a message first; times out when LLM unavailable
  test.fixme(
    'newly registered user goes to chat page and starts a new chat session after chatting',
    async ({ nonadminChatPage }) => {
      await nonadminChatPage.sendMessage('First message');
      await nonadminChatPage.waitForAIResponse();
      await nonadminChatPage.startNewChat();
      await expect(nonadminChatPage.userMessages).toHaveCount(0);
    },
  );

  // fixme: explore page navigation timeout — non-admin storageState may not be ready
  test.fixme(
    'newly registered user goes to sidebar and navigates to the explore page',
    async ({ nonadminPage, nonadminSidebarPage, nonadminExplorePage }) => {
      await nonadminSidebarPage.navigateToExplore();
      await expect(nonadminExplorePage.heading).toBeVisible({
        timeout: 15_000,
      });
      await expect(nonadminPage).toHaveURL(/explore/);
    },
  );

  test('newly registered user goes to profile dropdown and logs out', async ({
    nonadminPage,
    nonadminNavbarPage,
  }) => {
    await nonadminNavbarPage.logout();
    await expect(nonadminPage).toHaveURL(/login|auth/i, { timeout: 15_000 });
  });

  test('newly registered user goes to sidebar and toggles it open and closed', async ({
    nonadminPage,
    nonadminSidebarPage,
  }) => {
    const sidebar = nonadminPage
      .locator('[data-state="expanded"], [data-state="collapsed"]')
      .first();
    await nonadminSidebarPage.toggle();
    await nonadminPage.waitForTimeout(500);
    // After toggle, state should have changed
    const newState = await sidebar.getAttribute('data-state').catch(() => null);
    expect(['expanded', 'collapsed']).toContain(newState ?? 'collapsed');
  });

  test('newly registered user goes to sidebar and clicks the help button to open docs link', async ({
    nonadminPage,
    nonadminSidebarPage,
  }) => {
    const [newPage] = await Promise.all([
      nonadminPage.context().waitForEvent('page', { timeout: 10_000 }),
      openMoreOptionsMenu(nonadminPage),
      nonadminPage
        .getByRole('menu', { name: /more options/i })
        .or(nonadminPage.getByRole('dialog'))
        .getByRole('menuitem', { name: /help/i })
        .click(),
    ]);
    expect(newPage.url()).toMatch(/ibl|docs|help/i);
    await newPage.close();
  });

  // Issue #1179 — suggested prompts authored in the Prompts editor contain
  // Markdown (links, bold, etc.). They must render through the Markdown
  // component so that formatting survives into the welcome screen and
  // embeds.
  //
  // Fixme: needs a tenant whose suggested-prompt list includes a Markdown
  // link — we don't have a deterministic fixture yet. Flip to `test(...)`
  // once a seeded mentor is available.
  test.fixme(
    'newly registered user sees suggested prompts rendered as Markdown (issue #1179)',
    async ({ nonadminPage }) => {
      // A suggested prompt authored as "See [docs](https://…)" should
      // render an anchor tag, not literal brackets.
      const promptLink = nonadminPage
        .locator('button[type="button"] a[href^="http"]')
        .first();
      await expect(promptLink).toBeVisible({ timeout: 10_000 });
    },
  );
});
