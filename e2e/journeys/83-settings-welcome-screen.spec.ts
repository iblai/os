import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, checkAdminStatus } from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';

// The Welcome screen sub-tab (#2586) is UI-only until the backend stores its
// fields (iblai/iblai-platform#2626): every choice lives in local state and
// only drives the live preview. Nothing here saves to the real agent.
test.describe('Journey 83: Settings Welcome Screen Sub-Tab', () => {
  test.beforeEach(async ({ page, editMentorPage }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      test.skip(true, 'Requires admin access');
      return;
    }
    await editMentorPage.open('Settings');
    await waitForPageReady(page);
  });

  test('admin goes to settings and opens the Welcome screen sub-tab after Capabilities with the agent name in the preview', async ({
    editMentorPage,
  }) => {
    const { settings, dialog } = editMentorPage;
    const subTabs = dialog.getByRole('tablist', {
      name: /settings sub-categories/i,
    });
    await expect(subTabs.getByRole('tab')).toHaveText([
      'Basic',
      'Discovery',
      'Capabilities',
      'Welcome Screen',
    ]);

    await settings.selectSubTab('Basic');
    const agentName = await dialog
      .getByRole('tabpanel')
      .locator('input')
      .first()
      .inputValue();

    await settings.selectSubTab('Welcome Screen');
    await expect(settings.welcomePreview).toBeVisible();
    await expect(settings.welcomePreview).toHaveAttribute(
      'data-surface',
      'main',
    );
    await expect(settings.welcomePreviewHeading).toHaveText(agentName);
    await editMentorPage.close();
  });

  test('admin goes to the Welcome screen sub-tab and sees the guided-prompt count only for guided prompts', async ({
    editMentorPage,
  }) => {
    const { settings, dialog } = editMentorPage;
    await settings.pickWelcomeOption(
      'prompt-source',
      'Guided prompts (AI writes them)',
    );
    await expect(
      dialog.getByTestId('welcome-prompt-count-select'),
    ).toBeVisible();

    await settings.pickWelcomeOption(
      'prompt-source',
      'Suggested prompts (yours)',
    );
    await expect(dialog.getByTestId('welcome-prompt-count-select')).toHaveCount(
      0,
    );

    await settings.pickWelcomeOption('prompt-source', 'Off');
    await expect(dialog.getByTestId('welcome-prompt-count-select')).toHaveCount(
      0,
    );
    await expect(
      settings.welcomePreview.getByTestId('starter-prompt-chip'),
    ).toHaveCount(0);
    await editMentorPage.close();
  });

  test('admin goes to the Welcome screen sub-tab, picks 10 guided prompts and expands them with View more', async ({
    editMentorPage,
  }) => {
    const { settings } = editMentorPage;
    await settings.pickWelcomeOption(
      'prompt-source',
      'Guided prompts (AI writes them)',
    );
    await settings.pickWelcomeOption('prompt-count', '10');

    const chips = settings.welcomePreview.getByTestId('starter-prompt-chip');
    await expect(chips).toHaveCount(4);
    await expect(settings.welcomePreviewViewMore).toHaveText('View more (6)');

    await settings.welcomePreviewViewMore.click();
    await expect(chips).toHaveCount(10);
    await expect(settings.welcomePreviewViewMore).toHaveText('Show less');

    await settings.welcomePreviewViewMore.click();
    await expect(chips).toHaveCount(4);
    await editMentorPage.close();
  });

  test('admin goes to the Welcome screen sub-tab and previews the embed and mobile as stacked rows', async ({
    editMentorPage,
  }) => {
    const { settings } = editMentorPage;
    await settings.pickWelcomeOption(
      'prompt-source',
      'Guided prompts (AI writes them)',
    );
    await settings.pickWelcomeOption('prompt-count', '5');

    await settings.showWelcomePreview('Embed');
    await expect(settings.welcomePreview).toHaveAttribute(
      'data-surface',
      'embed',
    );
    const rows = settings.welcomePreview.getByTestId('starter-prompt-row');
    await expect(rows).toHaveCount(4);
    await settings.welcomePreviewViewMore.click();
    await expect(rows).toHaveCount(5);

    await settings.showWelcomePreview('Mobile');
    await expect(settings.welcomePreview).toHaveAttribute(
      'data-surface',
      'mobile',
    );
    await expect(rows).toHaveCount(5);
    await editMentorPage.close();
  });

  test('admin goes to the Welcome screen sub-tab and switches the heading to a personal greeting', async ({
    editMentorPage,
  }) => {
    const { settings, dialog } = editMentorPage;
    await settings.pickWelcomeOption('heading', 'Personal greeting');
    await expect(settings.welcomePreviewHeading).toHaveText(
      /^(Good (morning|afternoon|evening), \S+|Hi there)$/,
    );

    await dialog
      .getByRole('checkbox', { name: 'Preview as a logged-out visitor' })
      .click();
    await expect(settings.welcomePreviewHeading).toHaveText('Hi there');
    await editMentorPage.close();
  });

  test('admin changes the Welcome screen choices and Save does not send them', async ({
    page,
    editMentorPage,
  }) => {
    const { settings } = editMentorPage;
    await settings.pickWelcomeOption('heading', 'Personal greeting');
    await settings.pickWelcomeOption(
      'prompt-source',
      'Guided prompts (AI writes them)',
    );
    await settings.pickWelcomeOption('prompt-count', '10');

    // Abort the save so the real agent is never written to.
    let savedBody: string | null = null;
    await page.route(/\/mentors\/[^/]+\/settings\/?(\?|$)/, async (route) => {
      if (route.request().method() !== 'PUT') return route.continue();
      savedBody = route.request().postDataBuffer()?.toString('utf8') ?? '';
      await route.abort();
    });

    await expect(settings.saveButton).toBeEnabled();
    await settings.saveButton.click();
    await expect.poll(() => savedBody, { timeout: 15_000 }).not.toBeNull();
    expect(savedBody).not.toContain('welcome_heading_style');
    expect(savedBody).not.toContain('guided_prompts_count');
    await page.unroute(/\/mentors\/[^/]+\/settings\/?(\?|$)/);
    await editMentorPage.close();
  });
});
