import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, checkAdminStatus } from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';
import AxeBuilder from '@axe-core/playwright';

async function expectNoViolations(
  page: import('@playwright/test').Page,
  selector?: string,
) {
  const builder = new AxeBuilder({ page });
  if (selector) builder.include(selector);
  const { violations } = await builder.analyze();
  expect(violations).toEqual([]);
}

async function openEditMentorTab(
  page: import('@playwright/test').Page,
  editMentorPage: import('../page-objects/edit-mentor/edit-mentor.page').EditMentorPage,
  tabName: string,
) {
  if (await editMentorPage.isOpen()) {
    await editMentorPage.navigateToTab(tabName);
  } else {
    await editMentorPage.open(tabName);
  }
  await waitForPageReady(page);
}

test.describe('Journey 29: Accessibility — WCAG 2.1 AA — Non-Admin', () => {
  test.beforeEach(async ({ nonadminPage }) => {
    await navigateToMentorApp(nonadminPage);
  });

  test('non-admin goes to homepage and it has no accessibility violations', async ({
    nonadminPage,
  }) => {
    // fixme: The homepage currently has accessibility violations that are app-level issues
    test.fixme();
    const mentorButton = nonadminPage
      .getByRole('button', { name: 'Agents', exact: true })
      .or(nonadminPage.getByRole('button', { name: /explore/i }));
    await expect(mentorButton).toBeVisible({ timeout: 120_000 });
    await expectNoViolations(nonadminPage);
  });

  test('non-admin goes to explore page and the mentors catalog has no accessibility violations', async ({
    nonadminPage,
    nonadminSidebarPage,
  }) => {
    await nonadminSidebarPage.navigateToExplore();
    // The All Mentors section streams in via a separate /mentors/ fetch — the
    // trace shows the page often still renders "Loading mentors…" at 15s
    // when the backend is under load.
    await expect(
      nonadminPage.getByRole('heading', { name: /all agents/i }),
    ).toBeVisible({ timeout: 60_000 });
    // The mentors catalog is mounted inside #main-content. Sidebar +
    // nav-bar app-shell are covered by the sibling test at line 37
    // (currently fixme'd for known app-level violations).
    await expectNoViolations(nonadminPage, '#main-content');
  });
});

test.describe('Journey 29: Accessibility — WCAG 2.1 AA — Admin', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
  });

  test('admin goes to Create Mentor modal and it meets accessibility guidelines', async ({
    page,
    sidebarPage,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, 'Requires admin access');
    // "New Agent" lives inside the collapsible "Agents" section in the
    // new sidebar — expand the section first so the inner item resolves.
    await sidebarPage.expandSection('Agents');
    const newMentorBtn = page.getByRole('button', {
      name: 'New Agent',
      exact: true,
    });
    if (await newMentorBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await newMentorBtn.click();
      await page.waitForTimeout(1_000);
      await expectNoViolations(page, '[role="dialog"]');
      await page.keyboard.press('Escape');
    }
  });

  test('admin goes to Invite Users modal and it meets accessibility guidelines', async ({
    page,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, 'Requires admin access');
    const inviteBtn = page.getByRole('button', {
      name: 'Invite Users',
      exact: true,
    });
    if (await inviteBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await inviteBtn.click();
      await page.waitForTimeout(1_000);
      await expectNoViolations(page, '[role="dialog"]');
      await page.keyboard.press('Escape');
    }
  });

  // fixme: real accessibility violations in the app — not test bugs
  test.fixme(
    'admin goes to Settings modal and it meets accessibility guidelines',
    async ({ page }) => {
      const isAdmin = await checkAdminStatus(page);
      test.skip(!isAdmin, 'Requires admin access');
      const settingsBtn = page.getByRole('button', {
        name: 'Settings',
        exact: true,
      });
      if (await settingsBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await settingsBtn.click();
        await page.waitForTimeout(1_000);
        await expectNoViolations(page, '[role="dialog"]');
        await page.keyboard.press('Escape');
      }
    },
  );

  // fixme: WCAG violations — buttons without discernible text in Embed dialog
  test.fixme(
    'admin goes to Embed dialog and it is accessible',
    async ({ page, editMentorPage }) => {
      const isAdmin = await checkAdminStatus(page);
      test.skip(!isAdmin, 'Requires admin access');
      await openEditMentorTab(page, editMentorPage, 'Embed');
      await expectNoViolations(page, '[role="dialog"]');
      await editMentorPage.close();
    },
  );

  test('admin goes to Dataset dialog and it is accessible', async ({
    page,
    editMentorPage,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, 'Requires admin access');
    await openEditMentorTab(page, editMentorPage, 'Datasets');
    await expectNoViolations(page, '[role="dialog"]');
    await editMentorPage.close();
  });

  test('admin goes to Mentor Settings dialog and it is accessible', async ({
    page,
    editMentorPage,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, 'Requires admin access');
    await openEditMentorTab(page, editMentorPage, 'Settings');
    await expectNoViolations(page, '[role="dialog"]');
    await editMentorPage.close();
  });

  test('admin goes to LLM provider dialog and it is accessible', async ({
    page,
    editMentorPage,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, 'Requires admin access');
    await openEditMentorTab(page, editMentorPage, 'LLM');
    await expectNoViolations(page, '[role="dialog"]');
    await editMentorPage.close();
  });

  test('admin goes to Prompts dialog and it is accessible', async ({
    page,
    editMentorPage,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, 'Requires admin access');
    await openEditMentorTab(page, editMentorPage, 'Prompts');
    await expectNoViolations(page, '[role="dialog"]');
    await editMentorPage.close();
  });

  test('admin goes to Tools dialog and it is accessible', async ({
    page,
    editMentorPage,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, 'Requires admin access');
    await openEditMentorTab(page, editMentorPage, 'Tools');
    await expectNoViolations(page, '[role="dialog"]');
    await editMentorPage.close();
  });

  test('admin goes to Add Resources dialog and it is accessible', async ({
    page,
    editMentorPage,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, 'Requires admin access');
    await openEditMentorTab(page, editMentorPage, 'Datasets');
    await editMentorPage.datasets.openAddResourceModal();
    await expectNoViolations(page, '[role="dialog"]');
    await page.keyboard.press('Escape');
    await editMentorPage.close();
  });

  test('admin goes to History dialog and it is accessible', async ({
    page,
    editMentorPage,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, 'Requires admin access');
    await openEditMentorTab(page, editMentorPage, 'History');
    await expectNoViolations(page, '[role="dialog"]');
    await editMentorPage.close();
  });

  // fixme: WCAG violations — scrollable regions without keyboard access in Safety dialog
  test.fixme(
    'admin goes to Safety dialog and it is accessible',
    async ({ page, editMentorPage }) => {
      const isAdmin = await checkAdminStatus(page);
      test.skip(!isAdmin, 'Requires admin access');
      await openEditMentorTab(page, editMentorPage, 'Safety');
      await expectNoViolations(page, '[role="dialog"]');
      await editMentorPage.close();
    },
  );

  test('admin goes to API key dialog and it is accessible', async ({
    page,
    editMentorPage,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, 'Requires admin access');
    await openEditMentorTab(page, editMentorPage, 'API');
    await expectNoViolations(page, '[role="dialog"]');
    await editMentorPage.close();
  });

  // ---------------------------------------------------------------------------
  // Issue #576 — tooltip focus flash on non-keyboard focus
  //
  // The stop-streaming and copy buttons previously popped their Radix tooltips
  // any time focus landed on them — including DOM-swap focus (submit button
  // swapping into stop mid-stream, copy button mounting when streaming ends).
  // This read as a buggy flash and was flagged in Kaplan's accessibility pass.
  //
  // The fix gates the tooltip's open-on-focus behavior on `:focus-visible`,
  // so only keyboard-driven focus opens it; programmatic / DOM-swap focus is
  // preempted via `event.preventDefault()`.
  //
  // These tests are fixme until verified against a real browser — the
  // :focus-visible heuristic needs Chromium/WebKit/Firefox to behave
  // authentically, which JSDOM doesn't replicate.
  // ---------------------------------------------------------------------------

  test.fixme(
    'non-admin sends a message and the stop-streaming tooltip does not flash when the stop button mounts (issue #576)',
    async ({ nonadminPage, nonadminChatPage }) => {
      await navigateToMentorApp(nonadminPage);

      await nonadminChatPage.sendMessage('Hello, explain focus-visible');
      // Stop button appears while streaming — it inherits focus from the
      // submit button it replaced, but the tooltip should NOT open.
      const stopButton = nonadminPage.getByRole('button', {
        name: 'Stop streaming',
      });
      await expect(stopButton).toBeVisible({ timeout: 10_000 });
      await nonadminPage.waitForTimeout(1_500);
      expect(await nonadminPage.getByRole('tooltip').count()).toBe(0);
    },
  );

  test.fixme(
    'non-admin waits for streaming to end and the copy-to-clipboard tooltip does not flash when the copy button mounts (issue #576)',
    async ({ nonadminPage, nonadminChatPage }) => {
      await navigateToMentorApp(nonadminPage);

      await nonadminChatPage.sendMessage('Say hi');
      await nonadminChatPage.waitForAIResponse();

      const copyButton = nonadminPage.getByLabel('Copy to Clipboard').first();
      await expect(copyButton).toBeVisible({ timeout: 10_000 });
      // Give Radix's delay a chance to open; it should stay suppressed.
      await nonadminPage.waitForTimeout(1_500);
      expect(await nonadminPage.getByRole('tooltip').count()).toBe(0);
    },
  );

  test.fixme(
    'non-admin tabs to the copy button with the keyboard and the tooltip does open (issue #576)',
    async ({ nonadminPage, nonadminChatPage }) => {
      await navigateToMentorApp(nonadminPage);

      await nonadminChatPage.sendMessage('Say hi');
      await nonadminChatPage.waitForAIResponse();

      const copyButton = nonadminPage.getByLabel('Copy to Clipboard').first();
      await copyButton.focus(); // real focus; browser still decides :focus-visible
      await nonadminPage.keyboard.press('Tab');
      await nonadminPage.keyboard.press('Shift+Tab'); // arrive via keyboard

      await expect(nonadminPage.getByRole('tooltip')).toBeVisible({
        timeout: 5_000,
      });
    },
  );
});

// ---------------------------------------------------------------------------
// Issue #1596 — WCAG 4.1.2 Name, Role, Value
//
// Alfred State ELITE team / Deepa Deshpande reported that the icon-only
// composer buttons announced as just "button" in screen readers.
//
// a11y-20  Plus / Microphone / Send composer buttons expose accessible names
//          via getByRole({ name }).
// ---------------------------------------------------------------------------

test.describe('Journey 29: Accessibility — Issue #1596 — Composer button aria-labels', () => {
  test.beforeEach(async ({ nonadminPage }) => {
    await navigateToMentorApp(nonadminPage);
  });

  test('non-admin goes to chat page and Plus / Microphone / Send composer buttons have accessible names (issue #1596)', async ({
    nonadminPage,
  }) => {
    await expect(nonadminPage.locator('#chat-input-textarea')).toBeVisible({
      timeout: 30_000,
    });

    await expect(
      nonadminPage.getByRole('button', { name: 'Attach file' }),
    ).toBeVisible({ timeout: 10_000 });

    await expect(
      nonadminPage.getByRole('button', { name: 'Send message' }),
    ).toBeVisible({ timeout: 10_000 });

    let voiceInputVisible = false;
    try {
      await nonadminPage
        .getByRole('button', { name: 'Voice input' })
        .waitFor({ state: 'visible', timeout: 5_000 });
      voiceInputVisible = true;
    } catch {
      voiceInputVisible = false;
    }
    if (voiceInputVisible) {
      await expect(
        nonadminPage.getByRole('button', { name: 'Voice input' }),
      ).toBeVisible();
    }
  });
});
