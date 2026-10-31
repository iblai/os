import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures/mentor-test';
import { MENTOR_NEXTJS_HOST, generateMentorName } from '../fixtures/test-data';
import {
  navigateToMentorApp,
  checkAdminStatus,
  getPlatformContext,
} from '../utils/auth';
import type { EditMentorPage } from '../page-objects/edit-mentor/edit-mentor.page';
import { waitForPageReady } from '../utils/resilient';

// The Welcome screen sub-tab (#2586) saves with the agent
// (iblai/iblai-platform#2626). wss-01..06 run on the tenant's default agent and
// never write to it (wss-06 aborts its save); wss-07..09 save on a throw-away
// agent and check the chat's new-chat heading.

// Newer SDK releases read the profile through the core proxy; accept both.
const USER_METADATA =
  /\/api\/(ibl\/users\/manage\/metadata|core\/users\/metadata\/proxy)\//;
const GREETING = '^Good (morning|afternoon|evening)';

/**
 * The first name the greeting should use (the rule the SDK's
 * `greetingFirstName` implements), or null for a nameless greeting.
 */
function expectedFirstName(fullName: string): string | null {
  const name = (fullName.trim().split(/\s+/)[0] ?? '')
    .replace(/^#+/, '')
    .split('#')[0];
  if (name.length < 1 || [...name].length > 20) return null;
  if (!/^[\p{L}\p{M}'’.-]+$/u.test(name) || !/\p{L}/u.test(name)) return null;
  const [first, ...rest] = name;
  return first.toLocaleUpperCase() + rest.join('');
}

function greetingFor(fullName: string): RegExp {
  const name = expectedFirstName(fullName)?.replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&',
  );
  return new RegExp(`${GREETING}${name ? `, ${name}` : ''}$`);
}

/** Serves the signed-in user's profile with `name` as their full name. */
async function withFullName(page: Page, name: string): Promise<void> {
  // SDK >= 2.59 reads the profile from localStorage `user_metadata`.
  await page.addInitScript((fullName) => {
    try {
      const raw = window.localStorage.getItem('user_metadata');
      const parsed = raw ? JSON.parse(raw) : {};
      window.localStorage.setItem(
        'user_metadata',
        JSON.stringify({ ...parsed, name: fullName }),
      );
    } catch {
      // storage unavailable — route mock below is the fallback
    }
  }, name);
  await page.route(USER_METADATA, async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    const response = await route.fetch();
    const body = (await response.json()) as Record<string, unknown>;
    const publicMetadata = body.public_metadata as
      | Record<string, unknown>
      | undefined;
    await route.fulfill({
      response,
      json: {
        ...body,
        name,
        ...(publicMetadata
          ? { public_metadata: { ...publicMetadata, name } }
          : {}),
      },
    });
  });
}
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
    // The default agent's saved heading style is real tenant data; pick Agent
    // name (unsaved) so the check doesn't depend on it.
    await settings.pickWelcomeOption('heading', 'Agent name');
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

  test('admin changes the Welcome screen choices and Save sends them (aborted, so the default agent is untouched)', async ({
    page,
    editMentorPage,
  }) => {
    const { settings, dialog } = editMentorPage;
    // Save sends only changed fields, so flip each choice away from whatever
    // the default agent has saved.
    await settings.selectSubTab('Welcome Screen');
    const savedHeading = (
      await dialog.getByTestId('welcome-heading-select').textContent()
    )?.trim();
    const heading =
      savedHeading === 'Personal greeting'
        ? { label: 'Agent name', value: 'agent_name' }
        : { label: 'Personal greeting', value: 'personal_greeting' };
    await settings.pickWelcomeOption('heading', heading.label);
    await settings.pickWelcomeOption(
      'prompt-source',
      'Guided prompts (AI writes them)',
    );
    const savedCount = (
      await dialog.getByTestId('welcome-prompt-count-select').textContent()
    )?.trim();
    const count = savedCount === '10' ? 3 : 10;
    await settings.pickWelcomeOption('prompt-count', String(count));

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
    expect(savedBody).toMatch(
      new RegExp(
        `name="welcome_heading_style"\\r?\\n\\r?\\n${heading.value}|"welcome_heading_style"\\s*:\\s*"${heading.value}"`,
      ),
    );
    expect(savedBody).toMatch(
      new RegExp(
        `name="guided_prompts_count"\\r?\\n\\r?\\n${count}\\b|"guided_prompts_count"\\s*:\\s*${count}\\b`,
      ),
    );
    await page.unroute(/\/mentors\/[^/]+\/settings\/?(\?|$)/);
    await editMentorPage.close();
  });

  test('admin goes to the Welcome screen sub-tab and every control changes the preview, heading back to the agent name and counts 1 to 10', async ({
    editMentorPage,
  }) => {
    const { settings, dialog } = editMentorPage;
    await settings.selectSubTab('Basic');
    const agentName = await dialog
      .getByRole('tabpanel')
      .locator('input')
      .first()
      .inputValue();

    await settings.pickWelcomeOption('heading', 'Personal greeting');
    await expect(settings.welcomePreviewHeading).toHaveText(
      /^(Good (morning|afternoon|evening)(, \S+)?|Hi there)$/,
    );
    await settings.pickWelcomeOption('heading', 'Agent name');
    await expect(settings.welcomePreviewHeading).toHaveText(agentName);

    await settings.pickWelcomeOption(
      'prompt-source',
      'Guided prompts (AI writes them)',
    );
    const chips = settings.welcomePreview.getByTestId('starter-prompt-chip');
    for (const count of [1, 3, 4, 5, 10]) {
      await settings.pickWelcomeOption('prompt-count', String(count));
      await expect(chips).toHaveCount(Math.min(count, 4));
      if (count > 4) {
        await expect(settings.welcomePreviewViewMore).toHaveText(
          `View more (${count - 4})`,
        );
      } else {
        await expect(settings.welcomePreviewViewMore).toHaveCount(0);
      }
    }

    await settings.pickWelcomeOption('prompt-source', 'Off');
    await expect(chips).toHaveCount(0);
    await settings.pickWelcomeOption(
      'prompt-source',
      'Guided prompts (AI writes them)',
    );
    await expect(chips).toHaveCount(4);
    await editMentorPage.close();
  });
});

test.describe.serial('Journey 83: Personal greeting in the chat', () => {
  test.setTimeout(240_000);

  let mentorUrl = '';

  test('wss-07: admin saves Personal greeting on an agent; it reloads saved and the new chat greets them by first name', async ({
    page,
    editMentorPage,
    createMentorPage,
  }) => {
    await navigateToMentorApp(page);
    if (!(await checkAdminStatus(page))) {
      test.skip(true, 'Requires admin access');
      return;
    }

    await createMentorPage.openAndCreate(generateMentorName());
    await waitForPageReady(page);
    const { tenantKey, mentorId } = await getPlatformContext(page);
    mentorUrl = `${MENTOR_NEXTJS_HOST}/platform/${tenantKey}/${mentorId}`;

    await editMentorPage.open('Settings');
    await waitForPageReady(page);
    const { settings, dialog } = editMentorPage;
    await settings.pickWelcomeOption('heading', 'Personal greeting');
    const body = await settings.saveAndCaptureField('welcome_heading_style');
    expect(body).toMatch(
      /name="welcome_heading_style"\r?\n\r?\npersonal_greeting|"welcome_heading_style"\s*:\s*"personal_greeting"/,
    );
    await editMentorPage.close();

    const profile = page.waitForResponse(
      (res) => USER_METADATA.test(res.url()) && res.ok(),
      { timeout: 30_000 },
    );
    await navigateToMentorApp(page, mentorUrl);
    const { name } = (await (await profile).json()) as { name?: string };
    await expect(page.getByTestId('welcome-heading')).toHaveText(
      greetingFor(name ?? ''),
      { timeout: 30_000 },
    );

    await editMentorPage.open('Settings');
    await waitForPageReady(page);
    await settings.selectSubTab('Welcome Screen');
    await expect(dialog.getByTestId('welcome-heading-select')).toHaveText(
      'Personal greeting',
      { timeout: 10_000 },
    );
    await editMentorPage.close();
  });

  test('wss-08: the embed of an agent with Personal greeting greets the user by first name', async ({
    page,
  }) => {
    test.skip(!mentorUrl, 'wss-07 did not create the agent');
    const profile = page.waitForResponse(
      (res) => USER_METADATA.test(res.url()) && res.ok(),
      { timeout: 30_000 },
    );
    // The embed has no agent dropdown, which navigateToMentorApp waits for.
    await page.goto(
      `${mentorUrl}?embed=true&extra-body-classes=iframed-externally`,
      { waitUntil: 'domcontentloaded' },
    );
    const { name } = (await (await profile).json()) as { name?: string };
    await expect(
      page.getByTestId('embed-empty-state').getByTestId('welcome-heading'),
    ).toHaveText(greetingFor(name ?? ''), { timeout: 30_000 });
  });

  for (const [fullName, shown] of [
    ['#12345', 'no name'],
    ['user_8812', 'no name'],
    ['john#4821 Doe', '"John"'],
  ] as const) {
    test(`wss-09: a user whose full name is "${fullName}" is greeted with ${shown}, never a # tag`, async ({
      page,
    }) => {
      test.skip(!mentorUrl, 'wss-07 did not create the agent');
      await withFullName(page, fullName);
      await navigateToMentorApp(page, mentorUrl);
      const heading = page.getByTestId('welcome-heading');
      await expect(heading).toHaveText(greetingFor(fullName), {
        timeout: 30_000,
      });
      await expect(heading).not.toContainText('#');
      await page.unroute(USER_METADATA);
    });
  }
});

// wss-11..15 run on their own throw-away agent: the admin saves each
// combination, reloads to see it persisted, then the admin's chat and a
// student's chat show it. wss-11..15 depend on the backend storing
// welcome_heading_style / guided_prompts_count / starter_prompts 'none'
// (iblai-platform#2626) and the SDK chat honouring them.
test.describe
  .serial('Journey 83: Welcome screen choices reach the chat', () => {
  test.setTimeout(240_000);

  const GUIDED = 'Guided prompts (AI writes them)';
  const GUIDED_PROMPTS = /\/guided-prompts\//;
  let mentorUrl = '';

  async function reopenWelcomeScreen(
    page: Page,
    editMentorPage: EditMentorPage,
  ) {
    await navigateToMentorApp(page, mentorUrl);
    await editMentorPage.open('Settings');
    await waitForPageReady(page);
    await editMentorPage.settings.selectSubTab('Welcome Screen');
  }

  test('wss-11: admin saves Agent name + 3 guided prompts on a new agent; both are still chosen after a reload', async ({
    page,
    editMentorPage,
    createMentorPage,
  }) => {
    await navigateToMentorApp(page);
    if (!(await checkAdminStatus(page))) {
      test.skip(true, 'Requires admin access');
      return;
    }
    await createMentorPage.openAndCreate(generateMentorName());
    await waitForPageReady(page);
    const { tenantKey, mentorId } = await getPlatformContext(page);
    mentorUrl = `${MENTOR_NEXTJS_HOST}/platform/${tenantKey}/${mentorId}`;

    await editMentorPage.open('Settings');
    await waitForPageReady(page);
    const { settings, dialog } = editMentorPage;
    await settings.pickWelcomeOption('prompt-source', GUIDED);
    await settings.pickWelcomeOption('prompt-count', '3');
    const body = await settings.saveAndCaptureField('guided_prompts_count');
    expect(body).toMatch(
      /name="guided_prompts_count"\r?\n\r?\n3|"guided_prompts_count"\s*:\s*3/,
    );
    await editMentorPage.close();

    await reopenWelcomeScreen(page, editMentorPage);
    await expect(dialog.getByTestId('welcome-heading-select')).toHaveText(
      'Agent name',
    );
    await expect(dialog.getByTestId('welcome-prompt-source-select')).toHaveText(
      GUIDED,
    );
    await expect(dialog.getByTestId('welcome-prompt-count-select')).toHaveText(
      '3',
    );
    await expect(
      settings.welcomePreview.getByTestId('starter-prompt-chip'),
    ).toHaveCount(3);
    await editMentorPage.close();
  });

  test('wss-12: with Agent name + 3 guided prompts, the admin and a student see the agent name and at most 3 prompts', async ({
    page,
    nonadminPage,
  }) => {
    test.skip(!mentorUrl, 'wss-11 did not create the agent');
    for (const user of [page, nonadminPage]) {
      await navigateToMentorApp(user, mentorUrl);
      await waitForPageReady(user);
      const heading = user.getByTestId('welcome-heading');
      await expect(heading).toBeVisible({ timeout: 30_000 });
      await expect(heading).not.toContainText(
        /^Good (morning|afternoon|evening)/,
      );
      const chips = user.getByTestId('starter-prompt-chip');
      let hasChips = false;
      try {
        await chips.first().waitFor({ state: 'visible', timeout: 30_000 });
        hasChips = true;
      } catch {
        hasChips = false;
      }
      if (hasChips) {
        expect(await chips.count()).toBeLessThanOrEqual(3);
      }
    }
  });

  test('wss-13: admin saves Personal greeting + Off; both persist and the new chat greets them with no prompt chips and no guided-prompts request', async ({
    page,
    editMentorPage,
  }) => {
    test.skip(!mentorUrl, 'wss-11 did not create the agent');
    await reopenWelcomeScreen(page, editMentorPage);
    const { settings, dialog } = editMentorPage;
    await settings.pickWelcomeOption('heading', 'Personal greeting');
    await settings.pickWelcomeOption('prompt-source', 'Off');
    const body = await settings.saveAndCaptureField('welcome_heading_style');
    expect(body).toMatch(/personal_greeting/);
    expect(body).toMatch(/starter_prompts/);
    await editMentorPage.close();

    await reopenWelcomeScreen(page, editMentorPage);
    await expect(dialog.getByTestId('welcome-heading-select')).toHaveText(
      'Personal greeting',
    );
    await expect(dialog.getByTestId('welcome-prompt-source-select')).toHaveText(
      'Off',
    );
    await expect(
      settings.welcomePreview.getByTestId('starter-prompt-chip'),
    ).toHaveCount(0);
    await editMentorPage.close();

    const guidedRequests: string[] = [];
    page.on('request', (req) => {
      if (GUIDED_PROMPTS.test(req.url())) guidedRequests.push(req.url());
    });
    const profile = page.waitForResponse(
      (res) => USER_METADATA.test(res.url()) && res.ok(),
      { timeout: 30_000 },
    );
    await navigateToMentorApp(page, mentorUrl);
    const { name } = (await (await profile).json()) as { name?: string };
    await expect(page.getByTestId('welcome-heading')).toHaveText(
      greetingFor(name ?? ''),
      { timeout: 30_000 },
    );
    await waitForPageReady(page);
    await expect(page.getByTestId('starter-prompt-chip')).toHaveCount(0);
    expect(guidedRequests, 'Off asks for no guided prompts').toHaveLength(0);
  });

  test("wss-14: a student sees the admin's Personal greeting with their own first name and no prompt chips", async ({
    nonadminPage,
  }) => {
    test.skip(!mentorUrl, 'wss-11 did not create the agent');
    const profile = nonadminPage.waitForResponse(
      (res) => USER_METADATA.test(res.url()) && res.ok(),
      { timeout: 30_000 },
    );
    await navigateToMentorApp(nonadminPage, mentorUrl);
    const { name } = (await (await profile).json()) as { name?: string };
    await expect(nonadminPage.getByTestId('welcome-heading')).toHaveText(
      greetingFor(name ?? ''),
      { timeout: 30_000 },
    );
    await waitForPageReady(nonadminPage);
    await expect(nonadminPage.getByTestId('starter-prompt-chip')).toHaveCount(
      0,
    );
  });

  test('wss-15: admin saves Suggested prompts (yours) and Agent name; both persist after a reload', async ({
    page,
    editMentorPage,
  }) => {
    test.skip(!mentorUrl, 'wss-11 did not create the agent');
    await reopenWelcomeScreen(page, editMentorPage);
    const { settings, dialog } = editMentorPage;
    await settings.pickWelcomeOption('heading', 'Agent name');
    await settings.pickWelcomeOption(
      'prompt-source',
      'Suggested prompts (yours)',
    );
    await settings.saveAndCaptureField('starter_prompts');
    await editMentorPage.close();

    await reopenWelcomeScreen(page, editMentorPage);
    await expect(dialog.getByTestId('welcome-heading-select')).toHaveText(
      'Agent name',
    );
    await expect(dialog.getByTestId('welcome-prompt-source-select')).toHaveText(
      'Suggested prompts (yours)',
    );
    await expect(dialog.getByTestId('welcome-prompt-count-select')).toHaveCount(
      0,
    );
    await editMentorPage.close();
  });
});
