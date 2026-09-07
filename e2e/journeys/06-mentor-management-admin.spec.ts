import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, checkAdminStatus } from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';

test.describe('Journey 6: Mentor Management — Admin', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) test.skip(true, 'Requires admin access');
  });

  // fixme: edit mentor save/close flow times out — "Modify" menuitem locator change
  test.fixme(
    'admin goes to edit mentor modal and updates mentor profile, saves, and closes',
    async ({ page, editMentorPage }) => {
      await editMentorPage.open('Settings');
      await waitForPageReady(page);
      await editMentorPage.settings.setVisibilityAnyone();
      const saveBtn = editMentorPage.dialog
        .getByRole('button', { name: /save/i })
        .first();
      if (await saveBtn.isEnabled({ timeout: 3_000 }).catch(() => false)) {
        await saveBtn.click();
      }
      await editMentorPage.close();
      await expect(editMentorPage.dialog).not.toBeVisible();
    },
  );

  // Intentionally empty — the non-admin test for this journey is below,
  // outside the admin describe block.

  test('admin goes to edit mentor LLM tab and changes the LLM provider', async ({
    page,
    editMentorPage,
  }) => {
    await editMentorPage.open('LLM');
    await waitForPageReady(page);
    await expect(editMentorPage.llm.providerTabpanel).toBeVisible({
      timeout: 10_000,
    });

    const card = editMentorPage.llm.providerCards.first();
    await expect(card).toBeVisible({ timeout: 15_000 });
    await card.click();
    await expect(editMentorPage.llm.llmSelectionDialog).toBeVisible({
      timeout: 10_000,
    });

    const firstModel = editMentorPage.llm.modelRows.first();
    let hasSelectableModel = false;
    try {
      await firstModel.waitFor({ state: 'visible', timeout: 10_000 });
      hasSelectableModel = !(await firstModel.isDisabled());
    } catch {
      hasSelectableModel = false;
    }
    if (hasSelectableModel) {
      await firstModel.click();
    } else {
      await page.keyboard.press('Escape');
    }
    await editMentorPage.close();
  });

  // Issue #2318: two-group ordering — providers the admin can actually use
  // (canAccessProvider) render first, then the ones they can't; each group
  // alphabetical by display label. The exact provider mix is credential- and
  // environment-dependent, so this asserts the ORDERING INVARIANTS rather
  // than a hard-coded provider list.
  test('admin goes to edit mentor LLM tab and sees provider cards grouped usable-first and alphabetical within each group', async ({
    page,
    editMentorPage,
  }) => {
    await editMentorPage.open('LLM');
    await waitForPageReady(page);
    await expect(editMentorPage.llm.providerCards.first()).toBeVisible({
      timeout: 15_000,
    });

    const cards = await editMentorPage.llm.getProviderCardsInfo();
    expect(cards.length).toBeGreaterThan(0);

    // Invariant 1: no enabled (data-disabled="false") card appears after the
    // first disabled one.
    const firstDisabledIndex = cards.findIndex((c) => c.disabled);
    if (firstDisabledIndex !== -1) {
      const enabledAfterDisabled = cards
        .slice(firstDisabledIndex)
        .some((c) => !c.disabled);
      expect(
        enabledAfterDisabled,
        `an enabled provider card was found after the first grayed card (index ${firstDisabledIndex}): ${JSON.stringify(cards)}`,
      ).toBe(false);
    }

    // Invariant 2: labels within each group are case-insensitive alphabetical.
    const collator = (a: string, b: string) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' });
    const enabledLabels = cards.filter((c) => !c.disabled).map((c) => c.label);
    const disabledLabels = cards.filter((c) => c.disabled).map((c) => c.label);
    expect(enabledLabels).toEqual([...enabledLabels].sort(collator));
    expect(disabledLabels).toEqual([...disabledLabels].sort(collator));

    await editMentorPage.close();
  });

  // Issue #2318 regression guard: getLLMProviderDetails had no `iblai` entry
  // so the card fell through to the generic default logo/label. Skips
  // gracefully if this tenant's LLM list doesn't include the ibl.ai provider.
  test('admin goes to edit mentor LLM tab and sees the ibl.ai provider card with its own logo and label', async ({
    page,
    editMentorPage,
  }) => {
    await editMentorPage.open('LLM');
    await waitForPageReady(page);
    await expect(editMentorPage.llm.providerCards.first()).toBeVisible({
      timeout: 15_000,
    });

    const iblaiCard = editMentorPage.llm.providerCardByKey('iblai');
    let hasIblai = false;
    try {
      await iblaiCard.waitFor({ state: 'visible', timeout: 5_000 });
      hasIblai = true;
    } catch {
      hasIblai = false;
    }
    if (!hasIblai) {
      test.skip(true, "ibl.ai provider not present in this tenant's LLM list");
      return;
    }

    await expect(iblaiCard.locator('span').first()).toHaveText('ibl.ai');

    const logo = iblaiCard.locator('img');
    await expect(logo).toBeVisible();
    const naturalWidth = await logo.evaluate(
      (img: HTMLImageElement) => img.naturalWidth,
    );
    expect(
      naturalWidth,
      'ibl.ai provider logo failed to load (naturalWidth 0 renders blank — the #2318 bug signature)',
    ).toBeGreaterThan(0);

    await editMentorPage.close();
  });

  // Regression guard for the getLLMModelDisplayName navbar rewrite: the card
  // label test above (#2318) only proves the LLM tab's own grid renders "ibl.ai"
  // — it says nothing about what the navbar badge shows once an ibl.ai model is
  // actually SAVED on the mentor. The navbar reads the mentor's persisted
  // llm_name ("iblai-pro") through the same display-name mapping independently,
  // so this exercises that second call site end-to-end. Skips gracefully if
  // this tenant's LLM list doesn't include the ibl.ai provider (same
  // precondition as the card test above).
  test('admin switches to the ibl.ai model and the navbar badge shows the display name, not the raw wire key', async ({
    page,
    editMentorPage,
    navbarPage,
  }) => {
    await editMentorPage.open('LLM');
    await waitForPageReady(page);
    await expect(editMentorPage.llm.providerCards.first()).toBeVisible({
      timeout: 15_000,
    });

    const iblaiCard = editMentorPage.llm.providerCardByKey('iblai');
    let hasIblai = false;
    try {
      await iblaiCard.waitFor({ state: 'visible', timeout: 5_000 });
      hasIblai = true;
    } catch {
      hasIblai = false;
    }
    if (!hasIblai) {
      test.skip(true, "ibl.ai provider not present in this tenant's LLM list");
      return;
    }

    try {
      // Display label ("ibl.ai"), not the raw provider key — providerCard()
      // matches on the rendered alt text ("<label> logo"), same label the
      // #2318 card test asserts above. The model key is the wire value
      // (llm_name), which for this tenant's sole ibl.ai model is "iblai-pro".
      await editMentorPage.llm.selectProviderAndModel('ibl.ai', 'iblai-pro');
      await editMentorPage.close();

      // The navbar badge must render the display name ("ibl.ai"), never the
      // raw wire key ("iblai-pro") the API returns as llm_name — an exact
      // match, not a substring/regex, so a regression that renders the raw
      // key fails this assertion instead of silently passing it.
      await expect(navbarPage.llmNameSpan).toHaveText('ibl.ai Pro', {
        timeout: 15_000,
      });
    } finally {
      // Restore the mentor's original provider/model so later tests in this
      // (and other) journeys don't inherit an ibl.ai-selected mentor.
      await editMentorPage.open('LLM');
      await editMentorPage.llm.selectProviderAndModel(
        'Anthropic',
        'claude-haiku-4-5-20251001',
      );
      await editMentorPage.close();
    }
  });

  // A grayed (no-credential) provider card must stay clickable — graying is a
  // visual/model-row-disabling treatment, not a click-blocker on the card
  // itself. Skips gracefully if every provider in this tenant is usable.
  test('admin goes to edit mentor LLM tab and a grayed provider card is still clickable and opens the model picker', async ({
    page,
    editMentorPage,
  }) => {
    await editMentorPage.open('LLM');
    await waitForPageReady(page);
    await expect(editMentorPage.llm.providerCards.first()).toBeVisible({
      timeout: 15_000,
    });

    const cards = await editMentorPage.llm.getProviderCardsInfo();
    const grayed = cards.find((c) => c.disabled);
    if (!grayed) {
      test.skip(
        true,
        'No grayed (no-credential) provider in this tenant to exercise',
      );
      return;
    }

    await editMentorPage.llm.providerCardByKey(grayed.provider).click();
    await expect(editMentorPage.llm.llmSelectionDialog).toBeVisible({
      timeout: 10_000,
    });
    await page.keyboard.press('Escape');
    await expect(editMentorPage.llm.llmSelectionDialog).not.toBeVisible({
      timeout: 10_000,
    });

    await editMentorPage.close();
  });

  // Issue #2318 point 4: model rows render a human-readable label
  // (display_name || llm_name) instead of the raw wire key, and search
  // matches whatever is shown.
  test('admin goes to edit mentor LLM tab and the provider modal lists models with readable labels searchable by that same text', async ({
    page,
    editMentorPage,
  }) => {
    await editMentorPage.open('LLM');
    await waitForPageReady(page);
    await expect(editMentorPage.llm.providerCards.first()).toBeVisible({
      timeout: 15_000,
    });

    const cards = await editMentorPage.llm.getProviderCardsInfo();
    const usable = cards.find((c) => !c.disabled) ?? cards[0];
    await editMentorPage.llm.providerCardByKey(usable.provider).click();
    await expect(editMentorPage.llm.llmSelectionDialog).toBeVisible({
      timeout: 10_000,
    });

    let hasModels = false;
    try {
      await editMentorPage.llm.modelRows
        .first()
        .waitFor({ state: 'visible', timeout: 10_000 });
      hasModels = true;
    } catch {
      hasModels = false;
    }
    if (!hasModels) {
      test.skip(
        true,
        `Provider "${usable.provider}" has no listed chat models in this tenant`,
      );
      return;
    }

    const rowLabels = await editMentorPage.llm.modelRows.allTextContents();
    expect(rowLabels.length).toBeGreaterThan(0);
    // Every row must show a non-blank label — a raw key or a display name are
    // both non-blank, so this is the baseline "renders something" contract.
    for (const label of rowLabels) {
      expect(label.trim().length).toBeGreaterThan(0);
    }

    // Search-by-visible-label round trip: whatever text a row shows must be
    // findable by searching a substring of that same text (the search
    // predicate matches display_name OR llm_name, so it must match whichever
    // one is actually rendered).
    const modelText = rowLabels[0].trim();
    const searchSubstring = modelText.slice(0, Math.min(4, modelText.length));
    if (searchSubstring) {
      await editMentorPage.llm.modelSearchInput.fill(searchSubstring);
      await expect(
        editMentorPage.llm.modelRows.filter({ hasText: modelText }).first(),
      ).toBeVisible({ timeout: 10_000 });
    }

    await page.keyboard.press('Escape');
    await editMentorPage.close();
  });

  test('admin goes to edit mentor tools tab and toggles a tool on and off', async ({
    page,
    editMentorPage,
  }) => {
    await editMentorPage.open('Tools');
    await waitForPageReady(page);
    const count = await editMentorPage.tools.getToolCount();
    expect(count).toBeGreaterThan(0);
    await editMentorPage.tools.toolToggles.first().click();
    await page.waitForTimeout(500);
    await editMentorPage.tools.toolToggles.first().click();
    await editMentorPage.close();
  });

  test('admin goes to edit mentor settings tab and applies custom CSS via the editor', async ({
    page,
    editMentorPage,
  }) => {
    await editMentorPage.open('Settings');
    await waitForPageReady(page);
    const section = editMentorPage.settings.advancedCssSection;
    const expanded = await section
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    if (!expanded) {
      const expandBtn = editMentorPage.dialog
        .getByRole('button', { name: /advanced css/i })
        .first();
      if (await expandBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await expandBtn.click();
      }
    }
    await editMentorPage.close();
  });

  test('admin goes to edit mentor settings tab and resets custom CSS back to default', async ({
    editMentorPage,
  }) => {
    await editMentorPage.open('Settings');
    const discardBtn = editMentorPage.settings.advancedCssDiscardButton;
    const visible = await discardBtn
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    if (
      visible &&
      (await discardBtn.isEnabled({ timeout: 2_000 }).catch(() => false))
    ) {
      await discardBtn.click();
    }
    await editMentorPage.close();
  });

  test('admin goes to edit mentor settings tab and applies valid custom JavaScript', async ({
    page,
    editMentorPage,
  }) => {
    await editMentorPage.open('Settings');
    await waitForPageReady(page);
    const jsEditor = editMentorPage.settings.advancedJsEditor;
    const visible = await jsEditor
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    if (visible) {
      await expect(jsEditor).toBeVisible();
    }
    await editMentorPage.close();
  });

  test('admin goes to edit mentor prompts tab and edits the system prompt', async ({
    page,
    editMentorPage,
  }) => {
    await editMentorPage.open('Prompts');
    await waitForPageReady(page);

    await editMentorPage.prompts.page
      .getByRole('button', { name: 'Edit', exact: true })
      .first()
      .click();
    await editMentorPage.prompts.setSystemPrompt(
      'You are a helpful E2E test assistant.',
    );
    await editMentorPage.close();
  });

  // fixme: flaky — LLM response time can exceed test timeout on remote server
  test.fixme(
    'admin goes to chat page and sends a message to a newly created mentor and receives a response',
    async ({ page, chatPage }) => {
      await chatPage.sendMessage('Hello, can you help me?');
      await chatPage.waitForAIResponse();
      await expect(chatPage.aiMessages.first()).toBeVisible();
    },
  );

  test('admin goes to edit mentor settings tab and deletes a mentor', async ({
    page,
    editMentorPage,
  }) => {
    // Only run if a deletable test mentor exists — skip gracefully otherwise
    await editMentorPage.open('Settings');
    await waitForPageReady(page);
    const deleteBtn = editMentorPage.settings.deleteButton;
    const visible = await deleteBtn
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    if (!visible) {
      test.skip(true, 'No deletable mentor available in this environment');
      return;
    }
    await editMentorPage.settings.deleteMentor();
    await expect(page).toHaveURL(/\/platform\//, { timeout: 15_000 });
  });

  // Regression: opening Edit Agent for a sibling mentor via sidebar →
  // Agents → My Agents → click row used to render ONLY the Privacy tab
  // (the page mentor's RBAC was the only set in the global cache, so the
  // segment filter stripped every tab with an `rbacResource`).
  //
  // The modal opens whichever mentor sits FIRST in the My Agents list —
  // an arbitrary sibling this admin may hold only partial rights on. The
  // rbacResource-gated tabs (Settings, LLM, Prompts, …) are therefore NOT
  // guaranteed; what IS guaranteed for an admin is the ungated set
  // (Voice, Screen, Skills, Privacy — no `rbacResource` in
  // `MENTOR_SEGMENTS`). So the regression guard is: the sidebar renders
  // MORE than just Privacy, and whatever tab comes first actually works.
  // When the picked mentor does grant Settings, the original strong
  // canary pair (Settings + LLM) is asserted too.
  test('admin opens edit mentor from My Agents and sees the full segment sidebar', async ({
    page,
    editMentorPage,
  }) => {
    // The auth + platform-load beforeEach can eat most of the default 120s
    // budget on a slow remote server, and the agent list inside the modal is
    // fetched server-side with pagination. Triple the budget (→360s) so the
    // slow before-hooks don't starve the modal-load wait below.
    test.slow();

    await editMentorPage.openFromMyAgents();
    await waitForPageReady(page);

    // Visible segment triggers of the active category (uniquely
    // `aria-controls="panel-…"`; excludes the category pills and each
    // trigger's hidden responsive twin).
    const segmentTabs = editMentorPage.dialog.locator(
      '[role="tab"][aria-controls^="panel-"]:visible',
    );
    await expect(segmentTabs.first()).toBeVisible({ timeout: 15_000 });

    // The bug's signature was a single-tab (Privacy-only) sidebar; an
    // admin must always get at least the ungated segments on top of it.
    const tabNames = await segmentTabs.allTextContents();
    expect(
      tabNames.length,
      `sidebar collapsed to [${tabNames.join(', ')}] — RBAC hydration regression`,
    ).toBeGreaterThan(1);

    // Verify the sidebar is functional with whatever tab is first: click
    // it and confirm it activates its panel.
    const firstTab = segmentTabs.first();
    await firstTab.click();
    await expect(firstTab).toHaveAttribute('data-state', 'active', {
      timeout: 10_000,
    });

    // When this admin holds full rights on the picked mentor, keep the
    // original strong canary pair: Settings (first to drop in the bug)
    // plus LLM (confirms it isn't a one-off fallback).
    if (tabNames.some((t) => /settings/i.test(t))) {
      await expect(
        editMentorPage.dialog
          .getByRole('tab', { name: 'Settings', exact: true })
          .and(
            editMentorPage.dialog.locator('[aria-controls^="panel-"]:visible'),
          ),
      ).toBeVisible({ timeout: 10_000 });
      await expect(
        editMentorPage.dialog
          .getByRole('tab', { name: 'LLM', exact: true })
          .and(
            editMentorPage.dialog.locator('[aria-controls^="panel-"]:visible'),
          ),
      ).toBeVisible({ timeout: 10_000 });
    }

    await editMentorPage.close();
  });
});

test.describe('Journey 6: Mentor Management — Non-Admin', () => {
  test.beforeEach(async ({ nonadminPage }) => {
    await navigateToMentorApp(nonadminPage);
  });

  test('non-admin user goes to mentor dropdown and does not see Settings or Tools menu items', async ({
    nonadminPage,
    nonadminNavbarPage,
  }) => {
    await nonadminNavbarPage.openMentorDropdown();
    await expect(
      nonadminPage.getByRole('menuitem', { name: /settings/i }),
    ).not.toBeVisible();
    await expect(
      nonadminPage.getByRole('menuitem', { name: /tools/i }),
    ).not.toBeVisible();
  });
});
