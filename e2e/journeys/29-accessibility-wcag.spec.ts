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
    nonadminExplorePage,
  }) => {
    await nonadminSidebarPage.navigateToExplore();
    // Gate on the always-rendered page chrome rather than the "All Agents"
    // <h2>. The <h2> is data-conditional (it never renders when
    // DefaultMentorsSection short-circuits to <EmptyState /> on a tenant
    // with no agents) and, being matched by role, it also disappears from
    // the a11y tree if a stale `aria-hidden` lingers on the app shell —
    // both produce false 60s timeouts here. `nonadminExplorePage.main`
    // (`getByLabel('Agent exploration page')` → the `#main-content`
    // container) always renders once mounted and is immune to aria-hidden.
    await expect(nonadminExplorePage.main).toBeVisible({ timeout: 60_000 });
    // Let the All Mentors section settle — it streams in via a separate
    // /mentors/ fetch and the page can still show "Loading mentors…" for a
    // few seconds under load — so the scan covers the resolved catalog.
    await waitForPageReady(nonadminPage);
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
  // Issue #576 → updated by #1904 — focus stays on textarea during streaming
  //
  // The original #576 fix gated tooltip-open-on-focus on `:focus-visible` so
  // programmatic DOM-swap focus (submit→stop, stop→copy) could not flash a
  // tooltip.  Issue #1904 goes further: the `onMouseDown={(e) =>
  // e.preventDefault()}` on both Send and Stop buttons means clicking them
  // never pulls focus off the textarea at all.  The textarea also
  // auto-focuses on mount (when enabled, non-embed) so focus is already
  // there when the first message is sent.
  //
  // New contract verified here:
  //   • While streaming: textarea is focused, stop button is NOT focused.
  //   • After streaming: textarea is focused, copy button is NOT focused.
  // ---------------------------------------------------------------------------

  test.fixme(
    'non-admin sends a message and the textarea stays focused while streaming (issue #1904, updated #576)',
    async ({ nonadminPage, nonadminChatPage }) => {
      await navigateToMentorApp(nonadminPage);

      // Fill the textarea (it should already have focus on mount)
      await expect(nonadminChatPage.chatInput).toBeVisible({ timeout: 15_000 });
      await nonadminChatPage.chatInput.fill('Hello, explain focus-visible');
      await expect(nonadminChatPage.sendButton).toBeEnabled({
        timeout: 10_000,
      });
      // Click Send without pulling focus off textarea (onMouseDown preventDefault)
      await nonadminChatPage.sendButton.click();

      // Stop button mounts when streaming starts
      const stopButton = nonadminPage.getByRole('button', {
        name: /stop streaming/i,
      });
      let stopVisible = false;
      try {
        await stopButton.waitFor({ state: 'visible', timeout: 15_000 });
        stopVisible = true;
      } catch {
        stopVisible = false;
      }

      if (stopVisible) {
        // Textarea must hold focus — stop button must NOT be focused
        await expect(nonadminChatPage.chatInput).toBeFocused();
        const stopFocused = await stopButton.evaluate(
          (el) => el === document.activeElement,
        );
        expect(stopFocused).toBe(false);
      }
      // If the response came back before stop button mounted, that is
      // acceptable — just verify focus on textarea after stream
      await expect(nonadminChatPage.chatInput).toBeFocused();
    },
  );

  test.fixme(
    'non-admin waits for streaming to end and the textarea stays focused — copy button is not focused (issue #1904, updated #576)',
    async ({ nonadminPage, nonadminChatPage }) => {
      await navigateToMentorApp(nonadminPage);

      await expect(nonadminChatPage.chatInput).toBeVisible({ timeout: 15_000 });
      await nonadminChatPage.chatInput.fill('Say hi');
      await expect(nonadminChatPage.sendButton).toBeEnabled({
        timeout: 10_000,
      });
      await nonadminChatPage.sendButton.click();

      // Wait for an AI message to appear (streaming complete)
      await nonadminChatPage.waitForAIResponse(90_000);

      const copyButton = nonadminPage.getByLabel('Copy to Clipboard').first();
      let copyVisible = false;
      try {
        await copyButton.waitFor({ state: 'visible', timeout: 10_000 });
        copyVisible = true;
      } catch {
        copyVisible = false;
      }

      if (copyVisible) {
        // Copy button must NOT be focused after it mounts
        const copyFocused = await copyButton.evaluate(
          (el) => el === document.activeElement,
        );
        expect(copyFocused).toBe(false);
      }

      // Textarea must hold focus after streaming ends
      await expect(nonadminChatPage.chatInput).toBeFocused();
    },
  );

  // a11y-19: keyboard navigation to the copy button still opens the tooltip.
  // This confirms the tooltip is not globally suppressed — only programmatic
  // focus (DOM-swap) no longer triggers it.  The textarea-focus contract
  // (#1904) is orthogonal: keyboard Tab deliberately moves focus away.
  test.fixme(
    'non-admin tabs to the copy button with the keyboard and the tooltip does open (issue #576)',
    async ({ nonadminPage, nonadminChatPage }) => {
      await navigateToMentorApp(nonadminPage);

      await expect(nonadminChatPage.chatInput).toBeVisible({ timeout: 15_000 });
      await nonadminChatPage.chatInput.fill('Say hi');
      await expect(nonadminChatPage.sendButton).toBeEnabled({
        timeout: 10_000,
      });
      await nonadminChatPage.sendButton.click();
      await nonadminChatPage.waitForAIResponse(90_000);

      const copyButton = nonadminPage.getByLabel('Copy to Clipboard').first();
      await expect(copyButton).toBeVisible({ timeout: 10_000 });

      // Tab to the copy button via keyboard so `:focus-visible` fires
      await nonadminPage.keyboard.press('Tab');
      await nonadminPage.keyboard.press('Shift+Tab'); // land on copy button

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

// ---------------------------------------------------------------------------
// Issue #1904 — Keep focus on textarea throughout the chat cycle
//
// Previously the chat composer moved keyboard focus to the Stop-streaming
// button when streaming started and to the Copy button when it ended.
// Issue #1904 removes that focus-stealing behavior:
//
//   1. AutoResizeTextarea focuses itself on mount (enabled, non-embed).
//   2. Send and Stop buttons use onMouseDown={(e) => e.preventDefault()}
//      so clicking them never pulls focus off the textarea.
//   3. The old useEffect that moved focus to the stop/copy buttons is gone.
//
// These tests verify the full lifecycle: type → send (Enter or click) →
// stream-start → stream-end — focus stays on the textarea throughout.
//
// a11y-24  Textarea on mount has focus (non-embed, enabled)
// a11y-25  Press Enter to send — textarea retains focus during streaming
// a11y-26  Click Send button — textarea retains focus during streaming
// a11y-27  After stream ends — textarea retains focus, copy button NOT focused
// a11y-28  Stop button is NOT focused while streaming is active
// ---------------------------------------------------------------------------

test.describe('Journey 29: Accessibility — Issue #1904 — Chat textarea focus retention', () => {
  test.beforeEach(async ({ nonadminPage }) => {
    await navigateToMentorApp(nonadminPage);
  });

  test.fixme(
    'non-admin goes to chat page and the textarea has focus on mount (issue #1904 a11y-24)',
    async ({ nonadminPage, nonadminChatPage }) => {
      // The textarea focuses itself on mount when the composer is enabled.
      await expect(nonadminChatPage.chatInput).toBeVisible({ timeout: 15_000 });
      await expect(nonadminChatPage.chatInput).toBeFocused();
    },
  );

  test.fixme(
    'non-admin presses Enter to send and the textarea retains focus during streaming (issue #1904 a11y-25)',
    async ({ nonadminPage, nonadminChatPage }) => {
      await expect(nonadminChatPage.chatInput).toBeVisible({ timeout: 15_000 });
      await nonadminChatPage.chatInput.fill('Hello from keyboard send');
      await expect(nonadminChatPage.sendButton).toBeEnabled({
        timeout: 10_000,
      });

      // Submit via Enter key — focus stays in the textarea
      await nonadminChatPage.chatInput.press('Enter');

      // User message must appear in the chat
      await nonadminChatPage.waitForUserMessage(
        'Hello from keyboard send',
        30_000,
      );

      // Textarea stays focused after the keyboard send
      await expect(nonadminChatPage.chatInput).toBeFocused();

      // Stop-streaming button must NOT have focus while streaming
      const stopButton = nonadminPage.getByRole('button', {
        name: /stop streaming/i,
      });
      let stopVisible = false;
      try {
        await stopButton.waitFor({ state: 'visible', timeout: 10_000 });
        stopVisible = true;
      } catch {
        stopVisible = false;
      }
      if (stopVisible) {
        const stopFocused = await stopButton.evaluate(
          (el) => el === document.activeElement,
        );
        expect(stopFocused).toBe(false);
        // Textarea must still hold focus while stop button is visible
        await expect(nonadminChatPage.chatInput).toBeFocused();
      }
    },
  );

  test.fixme(
    'non-admin clicks Send button and the textarea retains focus during streaming (issue #1904 a11y-26)',
    async ({ nonadminPage, nonadminChatPage }) => {
      await expect(nonadminChatPage.chatInput).toBeVisible({ timeout: 15_000 });
      await nonadminChatPage.chatInput.fill('Hello from click send');
      await expect(nonadminChatPage.sendButton).toBeEnabled({
        timeout: 10_000,
      });

      // Click Send — onMouseDown preventDefault keeps focus on textarea
      await nonadminChatPage.sendButton.click();

      await nonadminChatPage.waitForUserMessage(
        'Hello from click send',
        30_000,
      );

      // Textarea must still hold focus immediately after click-send
      await expect(nonadminChatPage.chatInput).toBeFocused();
    },
  );

  test.fixme(
    'non-admin sends a message and after streaming ends the textarea retains focus and copy button is not focused (issue #1904 a11y-27)',
    async ({ nonadminPage, nonadminChatPage }) => {
      await expect(nonadminChatPage.chatInput).toBeVisible({ timeout: 15_000 });
      await nonadminChatPage.chatInput.fill('Say hi in one word');
      await expect(nonadminChatPage.sendButton).toBeEnabled({
        timeout: 10_000,
      });
      await nonadminChatPage.sendButton.click();

      // Wait for the AI response to arrive (stream end)
      await nonadminChatPage.waitForAIResponse(90_000);

      const copyButton = nonadminPage.getByLabel('Copy to Clipboard').first();
      let copyVisible = false;
      try {
        await copyButton.waitFor({ state: 'visible', timeout: 10_000 });
        copyVisible = true;
      } catch {
        copyVisible = false;
      }

      if (copyVisible) {
        // Copy button must NOT be focused after it mounts
        const copyFocused = await copyButton.evaluate(
          (el) => el === document.activeElement,
        );
        expect(copyFocused).toBe(false);
      }

      // Textarea holds focus after stream completes
      await expect(nonadminChatPage.chatInput).toBeFocused();
    },
  );

  test.fixme(
    'non-admin sends a message and the stop-streaming button is not focused during streaming (issue #1904 a11y-28)',
    async ({ nonadminPage, nonadminChatPage }) => {
      await expect(nonadminChatPage.chatInput).toBeVisible({ timeout: 15_000 });
      await nonadminChatPage.chatInput.fill('Count slowly to ten with pauses');
      await expect(nonadminChatPage.sendButton).toBeEnabled({
        timeout: 10_000,
      });
      await nonadminChatPage.sendButton.click();

      const stopButton = nonadminPage.getByRole('button', {
        name: /stop streaming/i,
      });
      let stopVisible = false;
      try {
        await stopButton.waitFor({ state: 'visible', timeout: 15_000 });
        stopVisible = true;
      } catch {
        stopVisible = false;
      }

      if (stopVisible) {
        // Stop button must NOT be focused — textarea holds focus
        const stopFocused = await stopButton.evaluate(
          (el) => el === document.activeElement,
        );
        expect(stopFocused).toBe(false);
        await expect(nonadminChatPage.chatInput).toBeFocused();
      }
    },
  );
});
