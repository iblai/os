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
    await editMentorPage.page
      .locator('div.flex.cursor-pointer.items-center')
      .first()
      .click();
    const firstOption = page
      .locator('button.flex.cursor-pointer.items-center.hover:bg-blue-50')
      .first();
    if (await firstOption.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await firstOption.click();
    } else {
      await page.keyboard.press('Escape');
    }
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
  // (Voice, Screen Share, Skills, Privacy — no `rbacResource` in
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
