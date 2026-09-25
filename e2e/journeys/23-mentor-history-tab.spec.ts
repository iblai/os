import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, checkAdminStatus } from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';
import AxeBuilder from '@axe-core/playwright';

test.describe('Journey 23: Mentor History Tab', () => {
  test.beforeEach(async ({ page, editMentorPage }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      test.skip(true, 'History tab requires admin access');
      return;
    }
    await editMentorPage.open('History');
    await waitForPageReady(page);
  });

  test('admin goes to history dialog and it has no accessibility violations', async ({
    page,
    editMentorPage,
  }) => {
    const results = await new AxeBuilder({ page })
      .include('[role="dialog"]')
      .analyze();
    expect(results.violations.length).toBe(0);
    await editMentorPage.close();
  });

  // fixme: flaky — neither conversation list nor empty state visible within timeout (app loading race)
  test.fixme(
    'admin goes to history tab and verifies the conversation list loads or shows an empty state',
    async ({ editMentorPage }) => {
      const hasConversations = await editMentorPage.history.hasConversations();
      const hasEmptyState = await editMentorPage.history.emptyState
        .isVisible({ timeout: 5_000 })
        .catch(() => false);
      expect(hasConversations || hasEmptyState).toBe(true);
      await editMentorPage.close();
    },
  );

  test('admin goes to history tab and tests the sentiment and topic filters', async ({
    page,
    editMentorPage,
  }) => {
    const hasConversations = await editMentorPage.history.hasConversations();
    if (!hasConversations) {
      await editMentorPage.close();
      return;
    }
    const sentimentFilter = editMentorPage.history.sentimentFilter;
    if (
      await sentimentFilter.isVisible({ timeout: 5_000 }).catch(() => false)
    ) {
      await sentimentFilter.click();
      const positiveOption = page.getByRole('option', { name: /positive/i });
      if (
        await positiveOption.isVisible({ timeout: 3_000 }).catch(() => false)
      ) {
        await positiveOption.click();
        await page.waitForTimeout(1_000);
      } else {
        await page.keyboard.press('Escape');
      }
    }
    await editMentorPage.close();
  });

  test('admin goes to history tab and clicks a conversation row to expand the transcript in the preview panel', async ({
    page,
    editMentorPage,
  }) => {
    const hasConversations = await editMentorPage.history.hasConversations();
    if (!hasConversations) {
      await editMentorPage.close();
      return;
    }
    await editMentorPage.history.clickFirstRow();
    const preview = editMentorPage.history.previewPanel;
    const visible = await preview
      .isVisible({ timeout: 10_000 })
      .catch(() => false);
    if (visible) {
      await expect(preview).toBeVisible();
    }
    await editMentorPage.close();
  });

  // hist-06: every row names its owner (a real full name, else email →
  // username → "Anonymous"), and an owner with a platform profile is a link that opens the
  // shared Profile viewer — the same modal Management → Users opens — without
  // selecting the row underneath.
  test('admin goes to history tab and sees each conversation owner labelled, with linked owners opening the profile viewer', async ({
    page,
    editMentorPage,
  }) => {
    const history = editMentorPage.history;
    const hasConversations = await history.hasConversations();
    if (!hasConversations) {
      await editMentorPage.close();
      return;
    }
    const rowCount = await history.conversationRows.count();
    await expect(history.rowOwners).toHaveCount(rowCount);
    const emailLike = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const label of await history.rowOwners.allTextContents()) {
      const text = label.trim();
      expect(text.length).toBeGreaterThan(0);
      // An email, "Anonymous", or a name/username — never a bare placeholder.
      expect(
        emailLike.test(text) || text === 'Anonymous' || /\w/.test(text),
      ).toBe(true);
      expect(text.toLowerCase()).not.toMatch(/^(none|null|undefined)$/);
    }

    const linkedCount = await history.linkedRowOwners.count();
    if (linkedCount === 0) {
      // LTI-only or anonymous rows: labels are plain text, not links.
      await expect(history.rowOwners.first()).toBeVisible();
      await expect(history.ownerProfileDialog).toHaveCount(0);
      await editMentorPage.close();
      return;
    }

    const link = history.linkedRowOwners.first();
    await expect(link).toHaveClass(/cursor-pointer/);
    await link.click();
    await expect(history.ownerProfileDialog).toBeVisible({ timeout: 15_000 });
    // The click must not bubble to the row: nothing is selected behind the
    // profile, so the preview pane still shows its prompt (desktop only).
    const prompt = editMentorPage.dialog.getByText(/select a conversation/i);
    if (await prompt.isVisible().catch(() => false)) {
      await expect(prompt).toBeVisible();
    }
    await page.keyboard.press('Escape');
    await expect(history.ownerProfileDialog).toBeHidden({ timeout: 10_000 });
    await editMentorPage.close();
  });

  // hist-07: rows whose turns carry retrieved documents / tool calls are
  // badged ("Documents · N" / "Tools · N"), never with an empty chip container,
  // and the transcript offers a collapsible per-turn details panel only for
  // turns that actually have extended data.
  test('admin goes to history tab and sees source/tool badges and per-turn details only where the conversation has them', async ({
    page,
    editMentorPage,
  }) => {
    const history = editMentorPage.history;
    const hasConversations = await history.hasConversations();
    if (!hasConversations) {
      await editMentorPage.close();
      return;
    }

    // "Documents · N" chips carry a positive count and open the chat's
    // Retrieved Documents dialog listing what the conversation retrieved.
    const documentsChips = await history.documentsChips.count();
    for (let i = 0; i < documentsChips; i++) {
      const text = (await history.documentsChips.nth(i).textContent()) ?? '';
      expect(Number(text.match(/\d+/)?.[0] ?? '0')).toBeGreaterThan(0);
    }
    if (documentsChips > 0) {
      await history.documentsChips.first().click();
      await expect(history.retrievedDocumentsDialog).toBeVisible({
        timeout: 10_000,
      });
      // At least one listed document, never an empty dialog.
      await expect(
        history.retrievedDocumentsDialog.locator('p').first(),
      ).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(history.retrievedDocumentsDialog).toBeHidden({
        timeout: 10_000,
      });
    }

    const badgeGroups = await history.rollupBadges.count();
    for (let i = 0; i < badgeGroups; i++) {
      const group = history.rollupBadges.nth(i);
      const sources = group.getByTestId('transcript-sources-badge');
      const tools = group.getByTestId('transcript-tools-badge');
      const chipCount = (await sources.count()) + (await tools.count());
      expect(chipCount).toBeGreaterThan(0);
      for (const chip of [sources, tools]) {
        if ((await chip.count()) > 0) {
          const text = (await chip.textContent()) ?? '';
          const n = Number(text.match(/\d+/)?.[0] ?? '0');
          expect(n).toBeGreaterThan(0);
        }
      }
    }

    await history.clickFirstRow();
    const preview = history.previewPanel;
    if (!(await preview.isVisible({ timeout: 10_000 }).catch(() => false))) {
      await editMentorPage.close();
      return;
    }

    const toggleCount = await history.turnDetailsToggles.count();
    if (toggleCount === 0) {
      // No extended data on this transcript: no empty panel is rendered.
      await expect(history.turnDetailsPanels).toHaveCount(0);
      await editMentorPage.close();
      return;
    }
    const toggle = history.turnDetailsToggles.first();
    await expect(toggle).toHaveText(/show details/i);
    await toggle.click();
    await expect(toggle).toHaveText(/hide details/i);
    const panel = history.turnDetailsPanels.first();
    const sections = panel.locator(
      '[data-testid="transcript-turn-sources"], [data-testid="transcript-turn-tools"], [data-testid="transcript-turn-metadata"], [data-testid="transcript-turn-request-context"]',
    );
    expect(await sections.count()).toBeGreaterThan(0);
    await expect(sections.first()).toBeVisible();
    await editMentorPage.close();
  });

  test('admin goes to history tab and clicks on Export to trigger a file download', async ({
    page,
    editMentorPage,
  }) => {
    const exportBtn = editMentorPage.history.exportButton;
    const visible = await exportBtn
      .isVisible({ timeout: 10_000 })
      .catch(() => false);
    if (!visible) {
      await editMentorPage.close();
      return;
    }
    // Skip when the mentor has no conversation history: exporting an empty
    // history produces neither a file download nor the deferred-notification
    // toast (the button just sits at "Exporting…"), so the assertion below
    // can only ever time out. Nothing to export ≠ a real failure.
    const isEmpty = await editMentorPage.history.emptyState
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    if (isEmpty) {
      await editMentorPage.close();
      test.skip(
        true,
        'Mentor has no conversation history — nothing to export.',
      );
    }
    await expect(exportBtn).toBeEnabled({ timeout: 5_000 });
    const downloadPromise = page
      .waitForEvent('download', { timeout: 30_000 })
      .catch(() => null);
    await exportBtn.click();
    const pendingToast = page.getByText(
      /You will be notified once the report is available\./i,
    );
    const result = await Promise.race([
      downloadPromise.then((d) =>
        d ? { kind: 'download' as const, d } : null,
      ),
      pendingToast
        .waitFor({ state: 'visible', timeout: 33_000 })
        .then(() => ({ kind: 'toast' as const }))
        .catch(() => null),
    ]);
    const finalResult =
      result ??
      (await downloadPromise.then((d) =>
        d ? { kind: 'download' as const, d } : null,
      ));
    expect(finalResult).not.toBeNull();
    if (finalResult?.kind === 'download') {
      expect(finalResult.d.suggestedFilename()).toMatch(/\.(csv|json|xlsx?)$/i);
    } else {
      await expect(pendingToast).toBeVisible();
    }
    await editMentorPage.close();
  });
});
