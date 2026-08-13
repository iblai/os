import { Page, Locator, expect } from '@playwright/test';
import { isVisibleWithin } from '../../utils/resilient';

export class SettingsTab {
  readonly page: Page;
  readonly dialog: Locator;

  readonly uniqueIdField: Locator;
  readonly copyButton: Locator;
  readonly visibilityCombobox: Locator;
  readonly saveButton: Locator;
  readonly deleteButton: Locator;
  readonly advancedCssSection: Locator;
  readonly advancedCssEditor: Locator;
  readonly advancedCssSaveButton: Locator;
  readonly advancedCssDiscardButton: Locator;
  readonly advancedJsEditor: Locator;
  readonly allowCopiesToggle: Locator;
  readonly copyMentorButton: Locator;
  readonly chatAccessCombobox: Locator;
  readonly verboseReasoningToggle: Locator;
  readonly enhanceDocumentRetrievalToggle: Locator;
  readonly enhanceDocumentRetrievalTooltipTrigger: Locator;
  readonly promptCachingToggle: Locator;
  readonly promptCachingTooltipTrigger: Locator;
  /**
   * Voice-call toggle: persists `use_function_calling_for_rag` on the
   * mentor's CallConfiguration. Resolved via `data-testid` so the
   * locator survives label rewrites in the host.
   */
  readonly useFunctionCallingForRagToggle: Locator;
  /** "Enable file attachments" toggle (Capabilities sub-tab, feat/1902) */
  readonly allowFileAttachmentsToggle: Locator;

  /**
   * Basic sub-tab. The Category combobox (iblai-platform#2289 regression
   * coverage). Trigger's aria-label is a fixed SDK translation
   * (`tabsSettingsTab.categorySelectAriaLabel`) — it does NOT change with
   * the OS `labels` override, and stays "Select a category" even once a
   * value is chosen (only the trigger's visible text changes).
   */
  readonly categoryTrigger: Locator;
  /**
   * The popover's search box. cmdk's `Command.Input` ALSO reports
   * `role="combobox"`, so this is disambiguated from `categoryTrigger` by
   * placeholder text, never by role — do not swap this for a role-based
   * locator.
   */
  readonly categorySearchInput: Locator;
  readonly categoryEmptyState: Locator;

  /**
   * Bound to `EditMentorPage.navigateToTab` (see its constructor). The modal
   * only mounts the active category's segments, so when a preceding call
   * switched the category (e.g. `LtiTab` activates Integrations), the
   * Settings sub-tab triggers are not in the DOM. `selectSubTab` uses this
   * to restore the Settings segment first; it no-ops when already active.
   */
  private navigateToTab?: (tabName: string) => Promise<void>;

  bindTabNav(navigateToTab: (tabName: string) => Promise<void>): void {
    this.navigateToTab = navigateToTab;
  }

  constructor(page: Page, dialog: Locator) {
    this.page = page;
    this.dialog = dialog;
    this.uniqueIdField = dialog
      .locator('input[readonly], input[disabled]')
      .filter({
        hasText: /.{8}-.{4}-.{4}-.{4}-.{12}/,
      })
      .or(dialog.locator('[data-testid="unique-id-field"]'))
      .or(dialog.getByLabel(/unique id/i));
    this.copyButton = dialog.getByRole('button', { name: /copy/i }).first();
    this.visibilityCombobox = dialog.getByRole('combobox', {
      name: 'Select Who Can View',
      exact: true,
    });
    this.saveButton = dialog.getByRole('button', { name: /save/i }).first();
    this.deleteButton = dialog.getByRole('button', { name: /delete/i }).first();
    this.advancedCssSection = dialog
      .getByText(/advanced css/i)
      .locator('..')
      .locator('..');
    this.advancedCssEditor = dialog
      .locator('[data-testid="advanced-css-editor"], .cm-editor')
      .first();
    this.advancedCssSaveButton = dialog
      .getByRole('button', { name: /save.*css|save.*advanced/i })
      .first();
    this.advancedCssDiscardButton = dialog
      .getByRole('button', { name: /discard/i })
      .first();
    this.advancedJsEditor = dialog
      .locator('[data-testid="advanced-js-editor"]')
      .or(dialog.locator('.cm-editor').nth(1));
    // Renamed in the Capabilities sub-tab: aria-label is now
    // "Enable copies" (no enabled/disabled
    // suffix — state is exposed via aria-checked).
    this.allowCopiesToggle = dialog.getByRole('switch', {
      name: /enable copies/i,
    });
    this.copyMentorButton = dialog.getByRole('button', {
      name: 'Copy',
      exact: true,
    });
    this.chatAccessCombobox = dialog.getByRole('combobox', {
      name: 'Select who can chat',
    });
    // Capabilities sub-tab. The "Enable verbose reasoning" toggle (show_reasoning);
    // aria-label is "Enable verbose reasoning enabled" / "Enable verbose reasoning disabled"
    // depending on current state.
    this.verboseReasoningToggle = dialog.getByRole('switch', {
      name: /^Enable verbose reasoning /i,
    });
    // Capabilities sub-tab. Visible label "Enhanced document retrieval"
    // (source: messages/en.json `enhancedDocRetrievalLabel`); the SDK switch
    // appends the state, so the aria-label reads "Enhanced document retrieval
    // enabled" / "... disabled". Anchored at the start so it does not also
    // match the sibling "Smart document retrieval" switch.
    this.enhanceDocumentRetrievalToggle = dialog.getByRole('switch', {
      name: /^Enhanced document retrieval\b/i,
    });
    this.enhanceDocumentRetrievalTooltipTrigger = dialog.getByRole('button', {
      name: 'More info about enhanced document retrieval',
    });
    // Capabilities sub-tab. Label: "Enable prompt caching".
    this.promptCachingToggle = dialog.getByRole('switch', {
      name: /enable prompt caching/i,
    });
    this.promptCachingTooltipTrigger = dialog.getByRole('button', {
      name: 'More info about enable prompt caching',
    });
    this.useFunctionCallingForRagToggle = dialog.getByTestId(
      'settings-use-function-calling-for-rag-switch',
    );
    // Capabilities sub-tab. Labelled "Enable file attachments" (feat/1902).
    this.allowFileAttachmentsToggle = dialog.getByRole('switch', {
      name: /enable file attachments/i,
    });
    this.categoryTrigger = dialog.getByRole('combobox', {
      name: 'Select a category',
      exact: true,
    });
    this.categorySearchInput = dialog.getByPlaceholder('Search category...');
    this.categoryEmptyState = dialog.getByText('No Category found.', {
      exact: true,
    });
  }

  /**
   * Reads the current on/off state of a Radix Switch via its
   * `aria-checked` attribute. Defaults to `false` when the attribute is
   * missing (e.g. the toggle isn't rendered yet) so callers can use this
   * as a precondition probe without try/catch.
   */
  private async readSwitchState(toggle: Locator): Promise<boolean> {
    const attr = await toggle.getAttribute('aria-checked').catch(() => null);
    return attr === 'true';
  }

  /** Whether the "Enable smart document retrieval" toggle is currently on. */
  async isUseFunctionCallingForRagEnabled(): Promise<boolean> {
    return this.readSwitchState(this.useFunctionCallingForRagToggle);
  }

  /** Idempotently toggle "Enable smart document retrieval" + Save. */
  async setUseFunctionCallingForRagAndSave(target: boolean): Promise<void> {
    // Lives in the Capabilities sub-tab — switch there before interacting.
    await this.selectSubTab('Capabilities');
    await expect(this.useFunctionCallingForRagToggle).toBeVisible({
      timeout: 10_000,
    });
    const isOn = await this.isUseFunctionCallingForRagEnabled();
    if (isOn === target) return;

    await this.useFunctionCallingForRagToggle.click();
    await expect(this.useFunctionCallingForRagToggle).toHaveAttribute(
      'aria-checked',
      String(target),
      { timeout: 10_000 },
    );

    await expect(this.saveButton).toBeEnabled({ timeout: 10_000 });
    await this.saveButton.click();
    await expect(
      this.page.getByText(/agent updated successfully/i).first(),
    ).toBeVisible({ timeout: 30_000 });
  }

  /**
   * Settings is now split into Basic / Discovery / Capabilities sub-tabs.
   * Each interaction below auto-switches to the right sub-tab so callers
   * don't have to know the layout. No-op when already on the target tab.
   *
   * The parent category Tabs use distinct names (Configurations /
   * Integrations / Analytics), so an exact-name role match is sufficient
   * to target only the inner sub-tab without extra filters.
   */
  async selectSubTab(
    name: 'Basic' | 'Discovery' | 'Capabilities',
  ): Promise<void> {
    // Restore the Settings segment first — a preceding page-object call may
    // have switched the modal to another category (LtiTab activates
    // Integrations), unmounting these sub-tab triggers entirely.
    if (this.navigateToTab) {
      await this.navigateToTab('Settings');
    }
    const tab = this.dialog.getByRole('tab', { name, exact: true });
    await expect(tab).toBeVisible({ timeout: 10_000 });
    const selected = await tab.getAttribute('aria-selected').catch(() => null);
    if (selected !== 'true') {
      await tab.click();
      await expect(tab).toHaveAttribute('aria-selected', 'true', {
        timeout: 5_000,
      });
    }
  }

  async copyUniqueId(): Promise<void> {
    await expect(this.copyButton).toBeVisible({ timeout: 10_000 });
    await this.copyButton.click();
  }

  async setVisibility(label: string): Promise<void> {
    await this.selectSubTab('Discovery');
    await expect(this.visibilityCombobox).toBeVisible({ timeout: 5_000 });
    await this.visibilityCombobox.click();
    // Use the Radix UI option (div[role="option"]) rather than native <option>
    const opt = this.page.locator('div[role="option"]').filter({
      hasText: new RegExp(`^${label}$`, 'i'),
    });
    const radixVisible = await isVisibleWithin(opt.first(), 3_000);
    if (radixVisible) {
      await opt.first().click();
    } else {
      // Fallback: try any role="option" with matching text
      const fallback = this.page.getByRole('option', {
        name: new RegExp(label, 'i'),
      });
      await expect(fallback.first()).toBeVisible({ timeout: 5_000 });
      await fallback.first().click();
    }
  }

  async setVisibilityAnyone(): Promise<void> {
    await this.setVisibility('Anyone');
  }

  async setChatAccess(label: string): Promise<void> {
    await this.selectSubTab('Discovery');
    await expect(this.chatAccessCombobox).toBeVisible({ timeout: 5_000 });
    await this.chatAccessCombobox.click();
    const opt = this.page.locator('div[role="option"]').filter({
      hasText: new RegExp(`^${label}$`, 'i'),
    });
    const radixVisible = await isVisibleWithin(opt.first(), 3_000);
    if (radixVisible) {
      await opt.first().click();
    } else {
      const fallback = this.page.getByRole('option', {
        name: new RegExp(label, 'i'),
      });
      await expect(fallback.first()).toBeVisible({ timeout: 5_000 });
      await fallback.first().click();
    }
  }

  async setChatAccessAnyone(): Promise<void> {
    await this.setChatAccess('Anyone');
  }

  async enableAllowCopies(): Promise<void> {
    await this.setAllowCopies(true);
  }

  async disableAllowCopies(): Promise<void> {
    await this.setAllowCopies(false);
  }

  /**
   * Toggles the Copies switch to the desired state and waits until the
   * mutation is fully observable — the success toast must appear AND the next
   * mentor settings refetch has to settle, otherwise the Copy button on the
   * subsequent reopen can lag behind the form's toggle state by several
   * seconds (the cache invalidation is propagated async by RTK Query).
   */
  private async setAllowCopies(target: boolean): Promise<void> {
    await this.selectSubTab('Capabilities');
    await expect(this.allowCopiesToggle).toBeVisible({ timeout: 10_000 });
    const isChecked =
      (await this.allowCopiesToggle.getAttribute('aria-checked')) === 'true';
    if (isChecked === target) {
      return;
    }
    await this.allowCopiesToggle.click();
    await expect(this.allowCopiesToggle).toHaveAttribute(
      'aria-checked',
      String(target),
      { timeout: 30_000 },
    );
    await expect(this.saveButton).toBeEnabled({ timeout: 30_000 });
    await this.saveButton.click();
    // Block until the backend confirms the write — the success toast is the
    // earliest reliable signal that the mutation resolved and RTK Query has
    // started invalidating the mentor cache. Don't wait for networkidle here:
    // the app fires a periodic analytics heartbeat (~every 30s) so networkidle
    // can hang indefinitely in steady state.
    await expect(
      this.page.getByText(/Agent updated successfully/i).first(),
    ).toBeVisible({ timeout: 30_000 });
    // Small buffer to let the post-mutation refetch land and React re-render
    // with fresh mentor data before the caller closes/reopens the dialog.
    await this.page.waitForTimeout(500);
  }

  /**
   * Returns true when the Enable verbose reasoning toggle is ON (aria-checked="true").
   */
  async isVerboseReasoningEnabled(): Promise<boolean> {
    await this.selectSubTab('Capabilities');
    await expect(this.verboseReasoningToggle).toBeVisible({ timeout: 10_000 });
    return (
      (await this.verboseReasoningToggle
        .getAttribute('aria-checked')
        .catch(() => 'false')) === 'true'
    );
  }

  /**
   * Sets the Enable verbose reasoning toggle to the desired state and saves the form.
   * A no-op if the toggle is already in the desired state. Save is called
   * internally (same as setMemoryEnabled) and we block on the success toast so
   * callers can immediately send a chat message that relies on the new setting.
   */
  async setVerboseReasoning(target: boolean): Promise<void> {
    await this.selectSubTab('Capabilities');
    await expect(this.verboseReasoningToggle).toBeVisible({ timeout: 10_000 });
    const isChecked =
      (await this.verboseReasoningToggle.getAttribute('aria-checked')) ===
      'true';
    if (isChecked === target) {
      return;
    }
    await this.verboseReasoningToggle.click();
    await expect(this.verboseReasoningToggle).toHaveAttribute(
      'aria-checked',
      String(target),
      { timeout: 10_000 },
    );
    await expect(this.saveButton).toBeEnabled({ timeout: 10_000 });
    await this.saveButton.click();
    await expect(
      this.page.getByText(/Agent updated successfully/i).first(),
    ).toBeVisible({ timeout: 30_000 });
    // Small buffer for RTK Query cache invalidation before the caller closes
    // or re-opens the dialog.
    await this.page.waitForTimeout(500);
  }

  async isEnhanceDocumentRetrievalEnabled(): Promise<boolean> {
    await this.selectSubTab('Capabilities');
    await expect(this.enhanceDocumentRetrievalToggle).toBeVisible({
      timeout: 10_000,
    });
    return (
      (await this.enhanceDocumentRetrievalToggle.getAttribute(
        'aria-checked',
      )) === 'true'
    );
  }

  async enableEnhanceDocumentRetrieval(): Promise<void> {
    await this.selectSubTab('Capabilities');
    await expect(this.enhanceDocumentRetrievalToggle).toBeVisible({
      timeout: 10_000,
    });
    const isChecked = await this.isEnhanceDocumentRetrievalEnabled();
    if (!isChecked) {
      await this.enhanceDocumentRetrievalToggle.click();
    }
    await expect(this.saveButton).toBeEnabled({ timeout: 5_000 });
    await this.saveButton.click();
    // Bounded + non-fatal: the periodic analytics heartbeat (~30s) means
    // the network may never idle, so cap networkidle so it can't hang.
    await this.page
      .waitForLoadState('networkidle', { timeout: 15_000 })
      .catch(() => {});
    await this.page.waitForTimeout(1_000);
  }

  async disableEnhanceDocumentRetrieval(): Promise<void> {
    await this.selectSubTab('Capabilities');
    await expect(this.enhanceDocumentRetrievalToggle).toBeVisible({
      timeout: 10_000,
    });
    const isChecked = await this.isEnhanceDocumentRetrievalEnabled();
    if (isChecked) {
      await this.enhanceDocumentRetrievalToggle.click();
    }
    await expect(this.saveButton).toBeEnabled({ timeout: 5_000 });
    await this.saveButton.click();
    // Bounded + non-fatal: the periodic analytics heartbeat (~30s) means
    // the network may never idle, so cap networkidle so it can't hang.
    await this.page
      .waitForLoadState('networkidle', { timeout: 15_000 })
      .catch(() => {});
    await this.page.waitForTimeout(1_000);
  }

  async isPromptCachingEnabled(): Promise<boolean> {
    await this.selectSubTab('Capabilities');
    await expect(this.promptCachingToggle).toBeVisible({ timeout: 10_000 });
    return (
      (await this.promptCachingToggle
        .getAttribute('aria-checked')
        .catch(() => 'false')) === 'true'
    );
  }

  /**
   * Sets the Prompt Caching toggle to the desired state and saves the form.
   * Waits for the success toast before returning so callers can rely on the
   * persisted state immediately (e.g. close → reopen → assert).
   */
  async setPromptCaching(target: boolean): Promise<void> {
    await this.selectSubTab('Capabilities');
    await expect(this.promptCachingToggle).toBeVisible({ timeout: 10_000 });
    const isChecked =
      (await this.promptCachingToggle.getAttribute('aria-checked')) === 'true';
    if (isChecked !== target) {
      await this.promptCachingToggle.click();
      await expect(this.promptCachingToggle).toHaveAttribute(
        'aria-checked',
        String(target),
        { timeout: 10_000 },
      );
    }
    await expect(this.saveButton).toBeEnabled({ timeout: 10_000 });
    await this.saveButton.click();
    await expect(
      this.page.getByText(/Agent updated successfully/i).first(),
    ).toBeVisible({ timeout: 30_000 });
    // Buffer for RTK Query cache invalidation: the mutation response triggers
    // an invalidate tag, but the refetch is async. 2 s is enough for the
    // follow-on GET to land and React to re-render before close+reopen.
    await this.page.waitForTimeout(2_000);
  }

  /**
   * Enables "Enable file attachments" and saves the form.
   * A no-op if the toggle is already on. (feat/1902)
   */
  async enableFileAttachments(): Promise<void> {
    await this.selectSubTab('Capabilities');
    await expect(this.allowFileAttachmentsToggle).toBeVisible({
      timeout: 10_000,
    });
    const isChecked =
      (await this.allowFileAttachmentsToggle
        .getAttribute('aria-checked')
        .catch(() => 'false')) === 'true';
    if (!isChecked) {
      await this.allowFileAttachmentsToggle.click();
      await expect(this.allowFileAttachmentsToggle).toHaveAttribute(
        'aria-checked',
        'true',
        { timeout: 10_000 },
      );
      await expect(this.saveButton).toBeEnabled({ timeout: 10_000 });
      await this.saveButton.click();
      await expect(
        this.page.getByText(/agent updated successfully/i).first(),
      ).toBeVisible({ timeout: 30_000 });
      await this.page.waitForTimeout(500);
    }
  }

  /**
   * Disables "Enable file attachments" and saves the form.
   * A no-op if the toggle is already off. (feat/1902)
   */
  async disableFileAttachments(): Promise<void> {
    await this.selectSubTab('Capabilities');
    await expect(this.allowFileAttachmentsToggle).toBeVisible({
      timeout: 10_000,
    });
    const isChecked =
      (await this.allowFileAttachmentsToggle
        .getAttribute('aria-checked')
        .catch(() => 'false')) === 'true';
    if (isChecked) {
      await this.allowFileAttachmentsToggle.click();
      await expect(this.allowFileAttachmentsToggle).toHaveAttribute(
        'aria-checked',
        'false',
        { timeout: 10_000 },
      );
      await expect(this.saveButton).toBeEnabled({ timeout: 10_000 });
      await this.saveButton.click();
      await expect(
        this.page.getByText(/agent updated successfully/i).first(),
      ).toBeVisible({ timeout: 30_000 });
      await this.page.waitForTimeout(500);
    }
  }

  /**
   * Opens the Category combobox (Basic sub-tab).
   *
   * Regression coverage for iblai-platform#2289: the popover previously
   * PAINTED its options while being un-hit-testable — it inherited
   * `pointer-events: none` from the host Dialog because the SDK ships its
   * own copy of `@radix-ui/react-dismissable-layer`, and the host's focus
   * trap stole focus from the search box. Every helper below drives a REAL
   * click/keystroke through Playwright's actionability checks; callers must
   * never pass `{ force: true }` to a click on anything this returns — that
   * would mask exactly the bug this coverage exists to catch.
   */
  async openCategoryPopover(): Promise<void> {
    await this.selectSubTab('Basic');
    await expect(this.categoryTrigger).toBeVisible({ timeout: 10_000 });
    await this.categoryTrigger.click();
    await expect(this.categorySearchInput).toBeVisible({ timeout: 10_000 });
  }

  /**
   * Locator for a single Category option by its exact visible name.
   *
   * #2289 has two independent fixes: (1) `PopoverContent portalled={false}`
   * so the popover is hit-testable inside the dialog instead of an inert
   * body-level portal — landed, and reliable on a plain (never-copied)
   * mentor; (2) scoring cmdk's search against `category.name` instead of the
   * numeric id, so typing a name actually filters the list. The bundled SDK
   * source still shows `CommandItem value={category.id.toString()}`, which
   * predicts name-search should NOT filter — but empirically (cat-02 in
   * journeys/07-mentor-settings-tab-unique-id.spec.ts) it does, reliably, on
   * a plain mentor. Separately, on a COPIED mentor, `editMentorPage.open()`
   * itself has been observed to time out reopening the Edit Agent dialog
   * right after the copy redirect — a stale Radix Dialog overlay
   * (`aria-hidden="true"` but still `fixed inset-0 z-50`, presumably left
   * behind by the first Edit Agent dialog used to trigger the copy) blocks
   * the navbar dropdown click for the full 30s actionability timeout, so
   * this locator (and `openCategoryPopover()` below) is never reached on the
   * copy in current runs — see the copy-scenario test in
   * journeys/36-copy-mentor.spec.ts. That looks like the client's originally
   * reported #2289 scenario still reproducing in that specific flow.
   */
  categoryOption(name: string): Locator {
    return this.dialog.getByRole('option', { name, exact: true });
  }

  /**
   * The trailing `Check` icon inside a Category option: `opacity-100` when
   * that option is the currently-selected value, `opacity-0` otherwise.
   * cmdk gives options no `aria-selected` for "this is the chosen value"
   * (only for keyboard/mouse highlight), so the check mark's opacity class
   * is the only reliable "is this one selected" signal.
   */
  categoryOptionCheck(name: string): Locator {
    return this.categoryOption(name).locator('svg').last();
  }

  /**
   * Reads every currently-rendered Category option's visible name. Used so
   * tests adapt to whatever categories the live tenant actually has
   * configured instead of hardcoding a name that may not exist.
   */
  async getCategoryOptionNames(): Promise<string[]> {
    const options = this.dialog.getByRole('option');
    const count = await options.count();
    const names: string[] = [];
    for (let i = 0; i < count; i++) {
      names.push((await options.nth(i).innerText()).trim());
    }
    return names;
  }

  async deleteMentor(): Promise<void> {
    await expect(this.deleteButton).toBeVisible({ timeout: 10_000 });
    await this.deleteButton.click();
    const confirmDialog = this.page.getByRole('alertdialog', {
      name: /delete agent/i,
    });
    await expect(confirmDialog).toBeVisible({ timeout: 5_000 });
    const confirmButton = confirmDialog.getByRole('button', {
      name: /^delete$|confirm/i,
    });
    await expect(confirmButton).toBeEnabled({ timeout: 5_000 });
    // Stacked Radix dialogs leave overlapping overlays that intercept
    // pointer events; activate via keyboard instead of click.
    await confirmButton.focus();
    await confirmButton.press('Enter');
  }
}
