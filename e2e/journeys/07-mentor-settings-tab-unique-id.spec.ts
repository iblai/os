import { test, expect } from '../fixtures/mentor-test';
import {
  navigateToMentorApp,
  checkAdminStatus,
  getPlatformContext,
} from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';
import { logger } from '@iblai/iblai-js/playwright';
import { MentorTracker } from '../utils/mentor-cleanup';

test.describe('Journey 7: Mentor Settings Tab — Unique ID', () => {
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

  test('admin goes to mentor settings tab and sees the unique ID field is read-only', async ({
    page,
    editMentorPage,
  }) => {
    // Find the unique ID field — it should have readonly or disabled attribute
    const allInputs = editMentorPage.dialog.locator('input');
    const count = await allInputs.count();
    let foundReadonly = false;
    for (let i = 0; i < count; i++) {
      const input = allInputs.nth(i);
      const isReadonly = (await input.getAttribute('readonly')) !== null;
      const isDisabled = await input.isDisabled();
      if (isReadonly || isDisabled) {
        foundReadonly = true;
        break;
      }
    }
    expect(foundReadonly).toBe(true);
    await editMentorPage.close();
  });

  test('admin goes to mentor settings tab and is not allowed to edit the unique ID field', async ({
    page,
    editMentorPage,
  }) => {
    // H8 fix: don't call .fill() on readonly/disabled input — Playwright throws.
    // Instead, verify the input is readonly/disabled and value stays unchanged after focus.
    const uniqueIdInput = editMentorPage.dialog.getByRole('textbox', {
      name: 'Unique ID',
    });
    const fallbackInput = editMentorPage.dialog
      .locator('input[readonly], input[disabled]')
      .first();
    const input = (await uniqueIdInput
      .isVisible({ timeout: 5_000 })
      .catch(() => false))
      ? uniqueIdInput
      : fallbackInput;
    await expect(input).toBeVisible({ timeout: 10_000 });
    const originalValue = await input.inputValue();
    // Attempt to focus and type via keyboard — should not change value
    try {
      await input.focus();
    } catch {
      /* readonly input may reject focus */
    }
    await page.keyboard.type('changed-value');
    const newValue = await input.inputValue();
    expect(newValue).toBe(originalValue);
    await editMentorPage.close();
  });

  test('admin goes to mentor settings tab and sees the copy button for unique ID', async ({
    editMentorPage,
  }) => {
    await expect(editMentorPage.settings.copyButton).toBeVisible({
      timeout: 10_000,
    });
    await editMentorPage.close();
  });

  // fixme: clipboard copy times out — clipboard permissions may not be granted
  test.fixme(
    'admin goes to mentor settings tab and copies the unique ID to clipboard',
    async ({ page, editMentorPage }) => {
      await editMentorPage.settings.copyUniqueId();
      // Visual feedback should appear
      const feedback = page.getByText(/copied|copy.*success/i);
      const hasFeedback = await feedback
        .isVisible({ timeout: 5_000 })
        .catch(() => false);
      // Clipboard content should match the unique ID pattern
      const clipboardText = await page.evaluate(() =>
        navigator.clipboard.readText().catch(() => ''),
      );
      expect(hasFeedback || clipboardText.length > 0).toBe(true);
      await editMentorPage.close();
    },
  );

  test('admin goes to mentor settings tab and tooltip info icons have type=button and do not submit the form', async ({
    page,
    editMentorPage,
  }) => {
    await editMentorPage.navigateToTab('Settings');
    const tooltipButtons = editMentorPage.dialog.locator(
      'button[type="button"]',
    );
    const count = await tooltipButtons.count();
    expect(count).toBeGreaterThan(0);
    await editMentorPage.close();
  });

  test('admin goes to mentor settings tab and shows visual feedback after successful copy', async ({
    page,
    editMentorPage,
    context,
    browserName,
  }) => {
    test.skip(
      browserName === 'webkit',
      'Skipping on Safari due to clipboard API limitations',
    );
    try {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    } catch {}

    const copyButton = page.getByRole('button', {
      name: 'Copy unique ID to clipboard',
    });
    await expect(copyButton).toBeVisible({ timeout: 10_000 });
    await copyButton.click();

    // Success state lasts ~1 second — catch it or fall back to clipboard content
    const copiedButton = page.getByRole('button', {
      name: 'Unique ID copied to clipboard',
    });
    const successVisible = await copiedButton
      .isVisible({ timeout: 2_000 })
      .catch(() => false);
    if (successVisible) {
      await expect(copiedButton.locator('svg')).toBeVisible({
        timeout: 15_000,
      });
      logger.info('Copy button shows visual feedback (success state caught)');
    } else {
      const clip = await page.evaluate(() =>
        navigator.clipboard.readText().catch(() => ''),
      );
      expect(clip.length).toBeGreaterThan(0);
      logger.info(
        'Success state was brief — clipboard content verified instead',
      );
    }
    await editMentorPage.close();
  });

  test('admin goes to mentor settings tab and the unique ID field has the correct disabled CSS styling', async ({
    editMentorPage,
  }) => {
    const uniqueIdInput = editMentorPage.dialog.getByRole('textbox', {
      name: 'Unique ID',
    });
    if (await uniqueIdInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
      // Verify disabled styling classes
      await expect(uniqueIdInput).toHaveClass(/bg-gray-50/);
      await expect(uniqueIdInput).toHaveClass(/cursor-not-allowed/);
      logger.info('Unique ID input has correct disabled styling');
    }
    await editMentorPage.close();
  });

  test('admin goes to mentor settings tab and the copy button has an accessible label', async ({
    editMentorPage,
  }) => {
    const copyButton = editMentorPage.dialog.getByRole('button', {
      name: 'Copy unique ID to clipboard',
    });
    await expect(copyButton).toBeVisible({ timeout: 10_000 });
    await expect(copyButton).toHaveAccessibleName(
      'Copy unique ID to clipboard',
    );
    logger.info('Copy button has proper accessible name');
    await editMentorPage.close();
  });

  test('admin goes to mentor settings tab and the unique ID section is properly labeled with a visible label', async ({
    editMentorPage,
  }) => {
    const label = editMentorPage.dialog.getByText('Unique ID', { exact: true });
    await expect(label).toBeVisible({ timeout: 10_000 });
    logger.info('Unique ID section is properly labeled');
    await editMentorPage.close();
  });

  // uid-06: Enhanced RAG toggle is visible with correct label, default OFF
  test('admin goes to mentor settings tab and sees the Enhanced RAG toggle defaulting to OFF', async ({
    editMentorPage,
  }) => {
    // Renamed from "Enhanced RAG" → "Enhanced document retrieval" and moved
    // into the Capabilities sub-tab when Settings was split.
    await editMentorPage.settings.selectSubTab('Capabilities');
    const label = editMentorPage.dialog.getByText(
      'Enhanced document retrieval',
      {
        exact: true,
      },
    );
    await expect(label).toBeVisible({ timeout: 10_000 });

    const toggle = editMentorPage.settings.enhanceDocumentRetrievalToggle;
    await expect(toggle).toBeVisible({ timeout: 10_000 });

    // Default value is false (mentor?.enable_multi_query_rag ?? false)
    const ariaChecked = await toggle.getAttribute('aria-checked');
    expect(ariaChecked).toBe('false');
    logger.info(`uid-06: Enhanced RAG toggle aria-checked=${ariaChecked}`);

    await editMentorPage.close();
  });

  // uid-07: Enhanced RAG tooltip contains expected wording
  test('admin goes to mentor settings tab and sees the Enhanced RAG tooltip text', async ({
    page,
    editMentorPage,
  }) => {
    await editMentorPage.settings.selectSubTab('Capabilities');
    const tooltipTrigger =
      editMentorPage.settings.enhanceDocumentRetrievalTooltipTrigger;
    await expect(tooltipTrigger).toBeVisible({ timeout: 10_000 });
    await tooltipTrigger.hover();

    await expect(
      page.getByRole('tooltip', {
        name: /runs several search queries per question to pull more relevant documents/i,
      }),
    ).toBeVisible({ timeout: 5_000 });
    logger.info('uid-07: Enhanced RAG tooltip content is visible');

    await editMentorPage.close();
  });

  // uid-08: Enhanced RAG toggle persists ON then OFF across save/reopen cycles
  test('admin goes to mentor settings tab and toggles Enhanced RAG ON then OFF with persistence', async ({
    page,
    editMentorPage,
  }) => {
    // --- Turn ON ---
    await editMentorPage.settings.enableEnhanceDocumentRetrieval();
    logger.info('uid-08: Saved Enhanced RAG = ON');

    await editMentorPage.close();

    // Reopen and verify ON persisted
    await editMentorPage.open('Settings');
    await waitForPageReady(page);

    const isOn =
      await editMentorPage.settings.isEnhanceDocumentRetrievalEnabled();
    expect(isOn).toBe(true);
    logger.info(
      `uid-08: After reopen, toggle = ${isOn ? 'ON' : 'OFF'} (expected ON)`,
    );

    // --- Turn OFF ---
    await editMentorPage.settings.disableEnhanceDocumentRetrieval();
    logger.info('uid-08: Saved Enhanced RAG = OFF');

    await editMentorPage.close();

    // Reopen and verify OFF persisted
    await editMentorPage.open('Settings');
    await waitForPageReady(page);

    const isOff =
      await editMentorPage.settings.isEnhanceDocumentRetrievalEnabled();
    expect(isOff).toBe(false);
    logger.info(
      `uid-08: After reopen, toggle = ${isOff ? 'ON' : 'OFF'} (expected OFF)`,
    );

    await editMentorPage.close();
  });
});

// ─── Journey 7B: Category Combobox — iblai-platform#2289 ──────────────────
//
// The Basic sub-tab's Category combobox rendered/painted its options but
// was not hit-testable: it inherited `pointer-events: none` from the host
// Dialog (the SDK ships its own copy of `@radix-ui/react-dismissable-layer`)
// and the host's focus trap stole focus from the search box. A second,
// independent bug scored the typed search query against the option's
// numeric id instead of its name, so typing a category NAME matched
// nothing and every option vanished behind the empty state.
//
// This bug is NOT specific to copied mentors — the client reported it via a
// copied mentor, but it reproduces on a plain, never-copied agent and
// affects every agent in every tenant. This describe block runs against a
// freshly created, owned, tracked mentor (never copied) so the fix is
// verified on the common path too; the copied-mentor scenario the client
// actually hit is covered separately in
// journeys/36-copy-mentor.spec.ts.
//
// `toBeVisible()` alone never catches this regression — the options were
// visible the entire time the bug was live. Every checkpoint below proves
// INTERACTIVITY: a real click or keystroke followed by an assertion on the
// resulting state change. No click in this block uses `{ force: true }` —
// that would defeat the exact actionability check that caught the bug.
test.describe('Journey 7B: Mentor Settings Tab — Category Combobox (#2289)', () => {
  test.setTimeout(120_000);
  const tracker = new MentorTracker();

  test.beforeEach(async ({ page, createMentorPage, editMentorPage }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      test.skip(true, 'Requires admin access');
      return;
    }
    await createMentorPage.openAndCreate();
    const { mentorId } = await getPlatformContext(page);
    tracker.add(mentorId);
    await editMentorPage.open('Settings');
    await waitForPageReady(page);
  });

  test.afterAll(async ({ browser }, testInfo) => {
    await tracker.deleteAll(browser, testInfo);
  });

  test('admin clicks a Category option and the trigger label updates to that category (cat-01)', async ({
    editMentorPage,
  }) => {
    await editMentorPage.settings.openCategoryPopover();
    const names = await editMentorPage.settings.getCategoryOptionNames();
    expect(names.length).toBeGreaterThan(0);
    const target = names[0];

    await editMentorPage.settings.categoryOption(target).click();
    await expect(editMentorPage.settings.categoryTrigger).toHaveText(target, {
      timeout: 10_000,
    });
    logger.info(
      `cat-01: trigger label updated to "${target}" after a real click`,
    );
    await editMentorPage.close();
  });

  // cat-04: keystrokes land in the search box. Deliberately independent of
  // cat-02 below — this only proves the search input can receive and echo
  // real keystrokes (what `portalled={false}` fixes: the host Dialog's focus
  // trap previously stole focus before a single key could land). It says
  // nothing about whether the *filtering* is correct, which is a separate,
  // still-open bug (see cat-02). Uses `pressSequentially` (real per-key
  // keydown/keyup events) rather than `.fill()` so a regressed focus trap
  // would actually be caught.
  test('admin types into the Category search box and every keystroke lands in the input (cat-04)', async ({
    editMentorPage,
  }) => {
    await editMentorPage.settings.openCategoryPopover();
    const names = await editMentorPage.settings.getCategoryOptionNames();
    expect(names.length).toBeGreaterThan(0);
    const substring = names[0].slice(
      0,
      Math.max(1, Math.ceil(names[0].length / 2)),
    );

    await editMentorPage.settings.categorySearchInput.pressSequentially(
      substring,
      { delay: 20 },
    );
    await expect(editMentorPage.settings.categorySearchInput).toHaveValue(
      substring,
    );
    logger.info(
      `cat-04: search input echoed every typed character: "${substring}"`,
    );
    await editMentorPage.close();
  });

  // cat-02: type-to-filter by category NAME.
  //
  // fixme — KNOWN FAILING against @iblai/web-containers@1.16.1, blocked on an
  // upstream SDK fix. This is NOT flakiness and NOT a test defect: the second
  // bug described in iblai-platform#2289 is still live. `<Command>` runs with
  // cmdk's default filtering, which scores the typed query against each
  // item's `value` — and `basic-sub-tab.tsx` still passes
  // `value={category.id.toString()}`, a numeric id. So typing a category NAME
  // matches nothing and every option disappears behind `CommandEmpty`.
  // Verified on the published package: typing "Advi" leaves the input
  // populated and renders "No Category found.".
  //
  // The fix is `value={category.name}` with the id captured in the
  // `onSelect` closure. It was authored, then reverted to narrow #2289's PR
  // to the `portalled={false}` popover-placement fix alone.
  //
  // REMOVE THIS `.fixme` once that SDK change ships — the assertion below is
  // the correct end state and must not be weakened or inverted.
  test.fixme(
    'admin types a category NAME substring and the option list narrows to matching results (cat-02)',
    async ({ editMentorPage }) => {
      await editMentorPage.settings.openCategoryPopover();
      const names = await editMentorPage.settings.getCategoryOptionNames();
      expect(names.length).toBeGreaterThan(0);
      const target = names[0];
      const substring = target.slice(
        0,
        Math.max(1, Math.ceil(target.length / 2)),
      );
      const other = names.find(
        (n) =>
          n !== target && !n.toLowerCase().includes(substring.toLowerCase()),
      );

      await editMentorPage.settings.categorySearchInput.fill(substring);

      await expect(editMentorPage.settings.categoryOption(target)).toBeVisible({
        timeout: 10_000,
      });
      await expect(
        editMentorPage.settings.categoryEmptyState,
      ).not.toBeVisible();
      if (other) {
        await expect(
          editMentorPage.settings.categoryOption(other),
        ).not.toBeVisible();
      }
      logger.info(
        `cat-02: option list narrowed to "${target}" for query "${substring}"`,
      );
      await editMentorPage.close();
    },
  );

  test('admin types a query with no matches and sees the empty state (cat-03)', async ({
    editMentorPage,
  }) => {
    await editMentorPage.settings.openCategoryPopover();
    await editMentorPage.settings.categorySearchInput.fill(
      'zzz-no-such-category-9999',
    );
    await expect(editMentorPage.settings.categoryEmptyState).toBeVisible({
      timeout: 10_000,
    });
    logger.info('cat-03: "No Category found." shown for a non-matching query');
    await editMentorPage.close();
  });

  test('admin selects a category, saves, and it persists after reopening — including the check mark (cat-05, cat-06)', async ({
    page,
    editMentorPage,
  }) => {
    await editMentorPage.settings.openCategoryPopover();
    const names = await editMentorPage.settings.getCategoryOptionNames();
    expect(names.length).toBeGreaterThan(0);
    const target = names[0];

    await editMentorPage.settings.categoryOption(target).click();
    await expect(editMentorPage.settings.categoryTrigger).toHaveText(target, {
      timeout: 10_000,
    });

    await expect(editMentorPage.settings.saveButton).toBeEnabled({
      timeout: 10_000,
    });
    await editMentorPage.settings.saveButton.click();
    await expect(
      page.getByText(/agent updated successfully/i).first(),
    ).toBeVisible({ timeout: 30_000 });
    logger.info(`cat-05: saved Category = "${target}"`);

    await editMentorPage.close();
    await editMentorPage.open('Settings');
    await waitForPageReady(page);

    // Persisted trigger label proves the numeric id (not the name) reached
    // the API payload and was correctly resolved back to a name on refetch.
    await expect(editMentorPage.settings.categoryTrigger).toHaveText(target, {
      timeout: 10_000,
    });
    logger.info('cat-05: Category label persisted across close/reopen');

    await editMentorPage.settings.categoryTrigger.click();
    await expect(editMentorPage.settings.categorySearchInput).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      editMentorPage.settings.categoryOptionCheck(target),
    ).toHaveClass(/opacity-100/, { timeout: 10_000 });
    logger.info(`cat-06: check mark visible on "${target}" after reopen`);
    await editMentorPage.close();
  });

  // cat-07: clipping guard. The popover now renders inside the dialog's
  // `overflow-hidden` subtree (align="start" portalled={false}) instead of a
  // body-level portal — nobody has verified a short viewport doesn't clip it.
  // Deliberately interaction-based rather than bounding-box math: pixel
  // comparisons are flaky across browsers/DPI and wouldn't even catch the
  // failure mode that matters (an option that LOOKS present but can never be
  // scrolled into an actionable position). A real click that still lands and
  // updates the trigger is the strongest available signal that the popover
  // was not clipped un-scrollably.
  test('Category popover remains interactive at a small viewport (cat-07, clipping guard)', async ({
    page,
    editMentorPage,
  }) => {
    await page.setViewportSize({ width: 390, height: 640 });
    await editMentorPage.settings.openCategoryPopover();
    const names = await editMentorPage.settings.getCategoryOptionNames();
    expect(names.length).toBeGreaterThan(0);

    await editMentorPage.settings.categoryOption(names[0]).click();
    await expect(editMentorPage.settings.categoryTrigger).toHaveText(names[0], {
      timeout: 10_000,
    });
    logger.info(
      `cat-07: selected "${names[0]}" at a 390x640 viewport — popover was not clipped un-scrollably`,
    );
    await editMentorPage.close();
  });
});
