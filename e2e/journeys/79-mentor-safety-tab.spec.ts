import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, checkAdminStatus } from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';
import {
  FlaggedPromptsDialog,
  MockModerationLog,
  SAFETY_CARDS,
  SAFETY_TOOLTIP,
  SafetyCard,
  SafetySwitchCard,
} from '../page-objects/edit-mentor/safety.tab';

/**
 * Journey 79 — Mentor Safety Tab.
 *
 * Safety net for the Safety tab of the Edit Agent modal, written BEFORE the
 * tab's OS implementation is swapped for the SDK's `AgentSafetyTab`. Every
 * assertion pins user-visible behaviour through role / accessible-name /
 * visible-text locators (see `page-objects/edit-mentor/safety.tab.ts`), so the
 * file must keep passing unchanged after the swap. Behaviours that only the
 * OS implementation has (the `safety-info-box` info box, the
 * `#view_moderation_logs` RBAC gate on the flagged-prompts button, the
 * free-trial gate on toggles) are intentionally NOT pinned here.
 *
 * ── What the tab renders ───────────────────────────────────────────────
 * Four cards: Moderation Prompt and Safety Prompt (each with an info icon
 * tooltip and an Active/Inactive switch whose accessible name is
 * "{Moderation|Safety} prompt {enabled|disabled}"), and Moderation Response
 * and Safety Response (text only). Each card shows its content in a region
 * labelled "{…} content" and has Edit + Copy buttons. Edit opens an
 * "Edit {card}" dialog with a rich-text editor; Save PUTs the field and shows
 * the "Agent updated successfully" toast. Toggles PUT `enable_moderation` /
 * `enable_safety_system` and are controlled by the settings query (not
 * optimistic). A "View Flagged Prompts" button opens the host-provided
 * flagged-prompts list modal.
 *
 * ── Isolation ──────────────────────────────────────────────────────────
 * Edits and toggles mutate the mentor, so every test gets its own freshly
 * created mentor via `createMentorPage.openAndCreate()` (auto-tracked,
 * auto-pinned to the cheap ibl.ai model, reaped by the run-level residue
 * teardown). Nothing tenant-level is touched.
 *
 * ── Flagged prompts ────────────────────────────────────────────────────
 * Real flagged prompts cannot be produced deterministically, so the
 * moderation-logs endpoint is route-mocked (`FlaggedPromptsDialog.mock`) with
 * a stateful in-memory list. Page size is 5.
 *
 * ── Not reachable (documented, not pinned) ─────────────────────────────
 * The OS flagged-prompt detail pane has no Contact/Notify button: the
 * `onContactUser` callback is passed to `FlaggedPromptDetail` but never
 * rendered, so `SendNotificationDialog` is unreachable from the UI today.
 * There is therefore no notify checkpoint.
 */

const SWITCH_CARDS: SafetySwitchCard[] = ['Moderation Prompt', 'Safety Prompt'];

function uniqueText(label: string): string {
  return `E2E ${label} ${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

function makeLogs(count: number): MockModerationLog[] {
  return Array.from({ length: count }, (_, i) => {
    const n = i + 1;
    return {
      id: 9000 + n,
      username: `flagged-user-${String(n).padStart(2, '0')}`,
      target_system: n % 2 === 0 ? 'Safety System' : 'Moderation System',
      prompt: `Flagged prompt text number ${n}`,
      reason: `System analysis for flagged prompt ${n}`,
      date_created: new Date(Date.now() - n * 3_600_000).toISOString(),
    };
  });
}

test.describe('Journey 79: Mentor Safety Tab', () => {
  test.beforeEach(async ({ page, editMentorPage, createMentorPage }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      test.skip(true, 'Safety tab requires admin access');
      return;
    }

    // Fresh, dedicated mentor per test — see the isolation note above.
    await createMentorPage.openAndCreate();
    await editMentorPage.open('Safety');
    await waitForPageReady(page);
  });

  // SAFETY-01: Header, description and all four cards render, each with an
  // Edit and a Copy button.
  test('admin opens the Safety tab and sees the header and all four prompt cards', async ({
    editMentorPage,
  }) => {
    const { safety } = editMentorPage;
    await expect(safety.heading).toBeVisible({ timeout: 10_000 });
    await expect(safety.description).toBeVisible({ timeout: 5_000 });

    for (const card of SAFETY_CARDS) {
      await expect(safety.cardHeading(card)).toBeVisible({ timeout: 10_000 });
      await expect(safety.contentRegion(card)).toBeVisible();
      await expect(safety.editButton(card)).toBeEnabled();
      await expect(safety.copyButton(card)).toBeEnabled();
    }
    await expect(safety.viewFlaggedPromptsButton).toBeVisible();

    await editMentorPage.close();
  });

  // SAFETY-02: Both switches expose their live state in the accessible name
  // and the Active/Inactive label, flip on click, and persist across a
  // close + full reload + reopen.
  for (const card of SWITCH_CARDS) {
    test(`admin toggles the ${card} switch and it persists after reload`, async ({
      page,
      editMentorPage,
    }) => {
      test.setTimeout(240_000);
      const { safety } = editMentorPage;
      const initial = await safety.isSwitchOn(card);
      await expect(safety.statusLabel(card)).toHaveText(
        initial ? 'Active' : 'Inactive',
      );

      const flipped = await safety.toggle(card);
      expect(flipped).toBe(!initial);
      await expect(safety.statusLabel(card)).toHaveText(
        flipped ? 'Active' : 'Inactive',
      );
      const stem = card === 'Moderation Prompt' ? 'Moderation' : 'Safety';
      await expect(
        editMentorPage.dialog.getByRole('switch', {
          name: `${stem} prompt ${flipped ? 'enabled' : 'disabled'}`,
          exact: true,
        }),
      ).toBeVisible();

      await editMentorPage.close();
      await page.reload();
      await waitForPageReady(page);
      await editMentorPage.open('Safety');
      expect(await editMentorPage.safety.isSwitchOn(card)).toBe(flipped);

      await editMentorPage.close();
    });
  }

  // SAFETY-03: Each of the four prompts/responses can be edited and saved;
  // the new text shows in the card immediately and survives a reload.
  test('admin edits all four prompts, they show in the cards and persist after reload', async ({
    page,
    editMentorPage,
  }) => {
    test.setTimeout(240_000);
    const { safety } = editMentorPage;
    const edits = new Map<SafetyCard, string>();
    for (const card of SAFETY_CARDS) {
      edits.set(card, uniqueText(card));
    }

    for (const [card, text] of edits) {
      await safety.editPrompt(card, text);
      await expect(safety.contentRegion(card)).toContainText(text, {
        timeout: 20_000,
      });
    }

    await editMentorPage.close();
    await page.reload();
    await waitForPageReady(page);
    await editMentorPage.open('Safety');

    for (const [card, text] of edits) {
      await expect(editMentorPage.safety.contentRegion(card)).toContainText(
        text,
        { timeout: 20_000 },
      );
    }

    await editMentorPage.close();
  });

  // SAFETY-04: The edit dialog opens pre-filled with the card's current
  // content and refuses an empty prompt ("Prompt is required", Save off).
  test('edit dialog is pre-filled and rejects an empty prompt', async ({
    editMentorPage,
  }) => {
    const { safety } = editMentorPage;
    const seeded = uniqueText('prefill');
    await safety.editPrompt('Safety Response', seeded);

    const dlg = await safety.openEditDialog('Safety Response');
    const editor = safety.editorIn(dlg);
    await expect(editor).toContainText(seeded, { timeout: 10_000 });

    await safety.emptyEditor(dlg);
    await expect(dlg.getByText('Prompt is required')).toBeVisible({
      timeout: 5_000,
    });
    await expect(
      dlg.getByRole('button', { name: 'Save', exact: true }),
    ).toBeDisabled();

    await safety.closeEditDialog('Safety Response');
    // Cancelled edit leaves the saved content untouched.
    await expect(safety.contentRegion('Safety Response')).toContainText(seeded);

    await editMentorPage.close();
  });

  // SAFETY-05: Each card's Copy button gives feedback ("Copied").
  test('copy button on a card confirms the copy', async ({
    context,
    browserName,
    editMentorPage,
  }) => {
    if (browserName === 'chromium') {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    }
    const { safety } = editMentorPage;
    const copy = safety.copyButton('Moderation Response');
    await expect(copy).toHaveAccessibleName('Copy text to clipboard');
    await copy.click();
    await expect(copy).toHaveAccessibleName('Text copied to clipboard', {
      timeout: 5_000,
    });
    await expect(copy).toHaveText('Copied');
    // Reverts after a moment.
    await expect(copy).toHaveAccessibleName('Copy text to clipboard', {
      timeout: 10_000,
    });

    await editMentorPage.close();
  });

  // SAFETY-06: The info icons are labelled and their tooltips explain what
  // the prompt controls on hover and keyboard focus.
  test('info icons are labelled and show their tooltip on hover and focus', async ({
    editMentorPage,
  }) => {
    const { safety, page } = editMentorPage;

    const moderationIcon = safety.infoIcon('Moderation Prompt');
    await expect(moderationIcon).toBeVisible({ timeout: 10_000 });
    await moderationIcon.hover();
    await expect(
      page.getByRole('tooltip').getByText(SAFETY_TOOLTIP['Moderation Prompt']),
    ).toBeVisible({ timeout: 5_000 });

    const safetyIcon = safety.infoIcon('Safety Prompt');
    await safetyIcon.focus();
    await expect(
      page.getByRole('tooltip').getByText(SAFETY_TOOLTIP['Safety Prompt']),
    ).toBeVisible({ timeout: 5_000 });

    await editMentorPage.close();
  });

  // SAFETY-07: With no flagged prompts the list opens with the empty state.
  test('admin opens View Flagged Prompts and sees the empty state', async ({
    page,
    editMentorPage,
  }) => {
    const flagged = new FlaggedPromptsDialog(page);
    await flagged.mock([]);

    await editMentorPage.safety.viewFlaggedPromptsButton.click();
    await expect(flagged.root).toBeVisible({ timeout: 15_000 });
    await expect(flagged.summary(0)).toBeVisible({ timeout: 10_000 });
    await expect(flagged.emptyState).toBeVisible();
    await expect(flagged.searchInput).toBeVisible();

    await flagged.close();
    await expect(editMentorPage.safety.heading).toBeVisible();
    await editMentorPage.close();
  });

  // SAFETY-08: Populated list — summary count, first page of 5 rows, type
  // badges, selecting a row shows its detail, paging fetches the next page.
  test('flagged prompts list shows a paginated page of rows and a detail pane', async ({
    page,
    editMentorPage,
  }) => {
    const logs = makeLogs(12);
    const flagged = new FlaggedPromptsDialog(page);
    await flagged.mock(logs);

    await editMentorPage.safety.viewFlaggedPromptsButton.click();
    await expect(flagged.root).toBeVisible({ timeout: 15_000 });
    await expect(flagged.summary(12)).toBeVisible({ timeout: 10_000 });

    // Page 1 = prompts 1-5 only.
    for (let n = 1; n <= 5; n++) {
      await expect(
        flagged.row(`Flagged prompt text number ${n}`),
      ).toBeVisible();
    }
    await expect(flagged.row('Flagged prompt text number 6')).toHaveCount(0);
    await expect(flagged.detailPlaceholder).toBeVisible();

    // Selecting a row fills the detail pane.
    await flagged.row('Flagged prompt text number 1').click();
    await expect(
      flagged.root.getByText('Flagged by Moderation System'),
    ).toBeVisible();
    await expect(
      flagged.root.getByText('System analysis for flagged prompt 1'),
    ).toBeVisible();
    await expect(
      flagged.root.getByRole('button', { name: 'Delete', exact: true }),
    ).toBeVisible();

    // Next page.
    await flagged.nextPageButton.click();
    await expect(flagged.row('Flagged prompt text number 6')).toBeVisible({
      timeout: 10_000,
    });
    // Prompt 1 stays selected in the detail pane, so check an unselected
    // page-1 row instead.
    await expect(flagged.row('Flagged prompt text number 2')).toHaveCount(0);
    expect(flagged.requests.some((q) => q.get('page') === '2')).toBe(true);

    // Jump to the last page (12 items -> 3 pages, 2 rows).
    await flagged.pageLink(3).click();
    await expect(flagged.row('Flagged prompt text number 11')).toBeVisible({
      timeout: 10_000,
    });
    await expect(flagged.row('Flagged prompt text number 12')).toBeVisible();
    await expect(flagged.row('Flagged prompt text number 10')).toHaveCount(0);

    // Back to the previous page.
    await flagged.previousPageButton.click();
    await expect(flagged.row('Flagged prompt text number 10')).toBeVisible({
      timeout: 10_000,
    });

    await flagged.close();
    await editMentorPage.close();
  });

  // SAFETY-09: Searching by user and filtering by type re-query the list and
  // reset it to page 1.
  test('flagged prompts can be searched by user and filtered by type', async ({
    page,
    editMentorPage,
  }) => {
    const flagged = new FlaggedPromptsDialog(page);
    await flagged.mock(makeLogs(12));

    await editMentorPage.safety.viewFlaggedPromptsButton.click();
    await expect(flagged.summary(12)).toBeVisible({ timeout: 15_000 });

    // Move off page 1 first so the reset-to-page-1 behaviour is observable.
    await flagged.nextPageButton.click();
    await expect(flagged.row('Flagged prompt text number 6')).toBeVisible({
      timeout: 10_000,
    });

    await flagged.searchInput.fill('flagged-user-03');
    await expect(flagged.summary(1)).toBeVisible({ timeout: 10_000 });
    await expect(flagged.row('Flagged prompt text number 3')).toBeVisible();
    expect(
      flagged.requests.some((q) => q.get('search') === 'flagged-user-03'),
    ).toBe(true);

    await flagged.searchInput.clear();
    await expect(flagged.summary(12)).toBeVisible({ timeout: 10_000 });
    await expect(flagged.row('Flagged prompt text number 1')).toBeVisible();

    // Type filter: Safety = even-numbered items (6 of 12).
    await flagged.typeFilter.click();
    await page.getByRole('option', { name: 'Safety', exact: true }).click();
    await expect(flagged.summary(6)).toBeVisible({ timeout: 10_000 });
    expect(
      flagged.requests.some((q) => q.get('target_system') === 'Safety System'),
    ).toBe(true);

    await flagged.typeFilter.click();
    await page.getByRole('option', { name: 'Moderation', exact: true }).click();
    await expect(flagged.summary(6)).toBeVisible({ timeout: 10_000 });
    expect(
      flagged.requests.some(
        (q) => q.get('target_system') === 'Moderation System',
      ),
    ).toBe(true);

    await flagged.close();
    await editMentorPage.close();
  });

  // SAFETY-10: Deleting a flagged prompt asks for confirmation, can be
  // cancelled, and on confirm DELETEs the log and clears the selection.
  test('admin deletes a flagged prompt after confirming', async ({
    page,
    editMentorPage,
  }) => {
    const flagged = new FlaggedPromptsDialog(page);
    await flagged.mock(makeLogs(3));

    await editMentorPage.safety.viewFlaggedPromptsButton.click();
    await expect(flagged.summary(3)).toBeVisible({ timeout: 15_000 });

    await flagged.row('Flagged prompt text number 2').click();
    await flagged.root
      .getByRole('button', { name: 'Delete', exact: true })
      .click();

    const confirm = page.getByRole('alertdialog');
    await expect(confirm).toBeVisible({ timeout: 10_000 });
    await expect(
      confirm.getByText('Delete Moderation Log').first(),
    ).toBeVisible();

    // Cancel: nothing deleted.
    await confirm.getByRole('button', { name: 'Cancel' }).click();
    await expect(confirm).toBeHidden({ timeout: 10_000 });
    expect(flagged.deletedIds).toHaveLength(0);

    // Confirm: DELETE sent for the selected log, success toast, selection cleared.
    await flagged.root
      .getByRole('button', { name: 'Delete', exact: true })
      .click();
    await expect(confirm).toBeVisible({ timeout: 10_000 });
    await confirm.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(
      page.getByText('Moderation log deleted successfully').first(),
    ).toBeVisible({ timeout: 15_000 });
    expect(flagged.deletedIds).toEqual([9002]);
    await expect(flagged.detailPlaceholder).toBeVisible({ timeout: 10_000 });

    await flagged.close();
    await editMentorPage.close();
  });
});

// SAFETY-11 — Non-Admin: Safety tab must stay unreachable ──────────────────
//
// Mirrors journeys 77/78: the Edit Agent modal is only reachable through the
// "Settings" menu item a plain non-admin never sees; if it ever is reachable,
// the Safety tab itself must still be absent.
test.describe('Journey 79: Mentor Safety Tab — Non-Admin', () => {
  test('non-admin does not see the Safety tab in the Edit Mentor modal', async ({
    nonadminPage,
    nonadminEditMentorPage,
  }) => {
    await navigateToMentorApp(nonadminPage);

    const dropdown = nonadminPage.getByRole('button', {
      name: /^Selected (agent|mentor) dropdown button$/,
    });
    await expect(dropdown).toBeVisible({ timeout: 15_000 });
    await dropdown.click();

    const settingsItem = nonadminPage.getByRole('menuitem', {
      name: 'Settings',
      exact: true,
    });

    let menuItemVisible = false;
    try {
      await settingsItem.waitFor({ state: 'visible', timeout: 3_000 });
      menuItemVisible = true;
    } catch {
      menuItemVisible = false;
    }

    if (!menuItemVisible) {
      await nonadminPage.keyboard.press('Escape');
      return;
    }

    await settingsItem.click();
    await expect(nonadminEditMentorPage.dialog).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      nonadminEditMentorPage.dialog.getByRole('tab', {
        name: 'Safety',
        exact: true,
      }),
    ).toHaveCount(0);

    await nonadminEditMentorPage.close();
  });
});
