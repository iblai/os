import { Page, Locator, expect } from '@playwright/test';
import { isVisibleWithin } from '../../utils/resilient';

export class EmbedTab {
  readonly page: Page;
  readonly dialog: Locator;

  readonly embedCodeBlock: Locator;
  readonly copyButton: Locator;
  readonly voiceCallToggle: Locator;
  readonly voiceRecordToggle: Locator;
  readonly attachmentToggle: Locator;
  readonly showCatalogueToggle: Locator;
  readonly optimizePageContextToggle: Locator;
  readonly websiteUrlInput: Locator;
  readonly websiteUrlError: Locator;
  readonly shareableLinkToggle: Locator;
  readonly regenerateShareableLinkButton: Locator;
  readonly submitButton: Locator;
  readonly embedCodeDialog: Locator;
  readonly shareableLinkUrlBlock: Locator;
  readonly whoCanViewSelect: Locator;
  readonly whoCanChatSelect: Locator;
  readonly footer: Locator;
  readonly iconSelectionSelect: Locator;
  readonly iconEditorButton: Locator;
  readonly iconEditorDialog: Locator;
  readonly iconEditorContentTabTrigger: Locator;
  readonly iconTitleInput: Locator;
  readonly iconSubtitleInput: Locator;
  readonly iconImageInput: Locator;
  readonly iconPreviewImage: Locator;
  readonly removeImageButton: Locator;
  readonly livePreviewImage: Locator;

  constructor(page: Page, dialog: Locator) {
    this.page = page;
    this.dialog = dialog;
    this.embedCodeBlock = dialog.locator('pre').first();
    // A successful submit opens a portal-rendered dialog with the generated
    // snippet. It is a modal, so it renders the Edit Agent dialog inert.
    this.embedCodeDialog = page.getByRole('dialog', { name: /embedded code/i });
    // The footer submit button reads "Create Embed" (or "Generating Embed"
    // while the form is submitting). Clicking it triggers form.handleSubmit().
    this.submitButton = dialog.getByRole('button', {
      name: /create embed|generating embed/i,
    });
    this.copyButton = dialog.getByRole('button', { name: /copy/i }).first();
    this.voiceCallToggle = dialog.getByRole('switch', { name: /voice call/i });
    this.voiceRecordToggle = dialog.getByRole('switch', {
      name: /voice record|voice input/i,
    });
    this.attachmentToggle = dialog.getByRole('switch', {
      name: /attachment|attach/i,
    });
    this.showCatalogueToggle = dialog.getByRole('switch', {
      name: /show catalogue/i,
    });
    this.optimizePageContextToggle = dialog.getByRole('switch', {
      name: /optimize page context tokens/i,
    });
    // The Website URL input is required when the mentor is not anonymous; filling
    // it satisfies the URL-validation guard in syncEmbedSettings() so submit()
    // proceeds without needing to change the mentor's visibility settings.
    // The input has placeholder "https://ibl.ai" — match by placeholder since it
    // has no accessible label (the heading "Website URL" is not associated via
    // aria-labelledby / htmlFor).
    this.websiteUrlInput = dialog.locator(
      'input[placeholder="https://ibl.ai"]',
    );
    // Spurious validation error surfaced under the Website URL field (issue
    // #2153) when it should not run at all in response to shareable-link
    // actions. The string is a literal (non-translated) constant set by
    // syncEmbedSettings() in useEmbedTab.ts.
    this.websiteUrlError = dialog.getByText(
      'Please specify a valid Website URL',
      { exact: true },
    );
    // aria-label toggles between "...enabled" / "...disabled" (see
    // shareableLinkEnabled / shareableLinkDisabled i18n keys) — match the
    // stable shared prefix.
    this.shareableLinkToggle = dialog.getByRole('switch', {
      name: /Generate \/ Revoke shareable link/i,
    });
    // The regenerate control is an icon-only RefreshCw with no accessible
    // name; fall back to its lucide CSS class.
    this.regenerateShareableLinkButton = dialog.locator('.lucide-refresh-cw');
    // The generated URL (`{origin}/platform/{tenantKey}/{mentorId}?token=...`)
    // renders in a CopyCodeBlock <pre>. The tab has other <pre> blocks (main
    // embed snippet, SSO redirect token), so filter on the querystring shape
    // rather than relying on DOM order.
    this.shareableLinkUrlBlock = dialog.locator('pre').filter({
      hasText: '?token=',
    });
    // "Who Can View?" — bound to `mentor_visibility` (tabsEmbedTab.
    // selectWhoCanViewAriaLabel = "Select who can view").
    this.whoCanViewSelect = dialog.getByRole('combobox', {
      name: /select who can view/i,
    });
    // "Who Can Chat?" — bound to `allow_anonymous` (tabsEmbedTab.
    // selectWhoCanChatAriaLabel = "Select who can chat").
    this.whoCanChatSelect = dialog.getByRole('combobox', {
      name: /select who can chat/i,
    });
    // The footer holds exactly one button ("Create Embed" / "Generating
    // Embed") — the Save button was removed from here (issue #789 follow-up).
    // It has no accessible role/name of its own, so scope by walking up from
    // the submit button to its immediate parent <div> (the footer wrapper —
    // see the `justify-end border-t ... px-3 py-4` div in embed-tab.tsx) rather
    // than `.filter({ has })`, whose inner locator carries the `dialog` root
    // through into the :has() check and never matches. The Advanced CSS /
    // Advanced JS "Save"/"Saving..." buttons live elsewhere in the form and
    // must NOT match this locator.
    this.footer = this.submitButton.locator('xpath=..');
    // Icon Selection and Mode Selection are two separate Radix comboboxes that
    // share the same aria-label ("Select an embed mode" — selectEmbedModeAriaLabel).
    // Icon Selection is the first one to appear in the form (above the "Mode
    // Selection" <hr> divider); disambiguate by position, not aria-label.
    this.iconSelectionSelect = dialog
      .getByRole('combobox', { name: /select an embed mode/i })
      .first();
    this.iconEditorButton = dialog.getByRole('button', {
      name: /icon editor/i,
    });
    // The Icon Editor renders as a second, portal-mounted dialog (nested on top
    // of the Edit Agent dialog) — scope to the page, not `dialog`.
    this.iconEditorDialog = page.getByRole('dialog', { name: /icon editor/i });
    this.iconEditorContentTabTrigger = this.iconEditorDialog.getByRole('tab', {
      name: /content/i,
    });
    this.iconTitleInput = this.iconEditorDialog.locator('#title');
    this.iconSubtitleInput = this.iconEditorDialog.locator('#subtitle');
    this.iconImageInput = this.iconEditorDialog.locator('#iconImage');
    this.iconPreviewImage = this.iconEditorDialog.getByAltText(
      'Chat icon preview',
      { exact: true },
    );
    this.removeImageButton = this.iconEditorDialog.getByRole('button', {
      name: /remove image/i,
    });
    // The Live Preview image is rendered both inline (Icon Selection = Custom,
    // outside the editor) and inside the Icon Editor dialog itself. Scope to
    // whichever ancestor is relevant at call time via `.last()` — the Icon
    // Editor's own Live Preview is what a caller inside that dialog wants.
    this.livePreviewImage = page.getByAltText('Chat icon', { exact: true });
  }

  /** Returns the currently selected label of the Icon Selection combobox ("Default" / "Custom"). */
  async getIconSelectionValue(): Promise<string> {
    await expect(this.iconSelectionSelect).toBeVisible({ timeout: 10_000 });
    return (await this.iconSelectionSelect.textContent())?.trim() ?? '';
  }

  /** Selects an option ("Default" / "Custom") in the Icon Selection Radix Select. */
  async setIconSelection(label: 'Default' | 'Custom'): Promise<void> {
    await expect(this.iconSelectionSelect).toBeVisible({ timeout: 10_000 });
    await this.iconSelectionSelect.click();
    await this.selectRadixOption(label);
  }

  /** Opens the Icon Editor dialog (only available when Icon Selection = Custom). */
  async openIconEditor(): Promise<void> {
    await expect(this.iconEditorButton).toBeVisible({ timeout: 10_000 });
    await this.iconEditorButton.click();
    await expect(this.iconEditorDialog).toBeVisible({ timeout: 10_000 });
  }

  /** Switches the Icon Editor to its "Content" tab, where the image controls live. */
  async goToIconEditorContentTab(): Promise<void> {
    await expect(this.iconEditorContentTabTrigger).toBeVisible({
      timeout: 10_000,
    });
    await this.iconEditorContentTabTrigger.click();
    await expect(this.iconImageInput).toBeVisible({ timeout: 10_000 });
  }

  /** Uploads a local image file via the Icon Editor's Content tab file input. */
  async uploadIconImage(filePath: string): Promise<void> {
    await expect(this.iconImageInput).toBeVisible({ timeout: 10_000 });
    await this.iconImageInput.setInputFiles(filePath);
    await expect(this.iconPreviewImage).toBeVisible({ timeout: 10_000 });
  }

  /**
   * Clicks "Remove Image" on the Icon Editor's Content tab. Persists
   * immediately via its own PUT (does not require Create Embed) — see
   * removeCustomImage() in useEmbedTab.ts (issue #789 fix).
   */
  async removeImage(): Promise<void> {
    await expect(this.removeImageButton).toBeVisible({ timeout: 10_000 });
    await this.removeImageButton.click();
  }

  /** Closes the Icon Editor dialog via Escape. */
  async closeIconEditor(): Promise<void> {
    await this.page.keyboard.press('Escape');
    await expect(this.iconEditorDialog).toBeHidden({ timeout: 5_000 });
  }

  /**
   * Fills the Website URL field in the embed form. Required when the mentor is
   * not anonymous — without a valid URL, "Create Embed" returns early with a
   * validation error and the settings are never persisted.
   */
  async fillWebsiteUrl(url: string): Promise<void> {
    await expect(this.websiteUrlInput).toBeVisible({ timeout: 10_000 });
    await this.websiteUrlInput.fill(url);
  }

  async getEmbedCode(): Promise<string> {
    await expect(this.embedCodeBlock).toBeVisible({ timeout: 10_000 });
    return (await this.embedCodeBlock.textContent()) ?? '';
  }

  async copyEmbedCode(): Promise<void> {
    await expect(this.copyButton).toBeVisible({ timeout: 5_000 });
    await this.copyButton.click();
  }

  /** Returns true when the Show Catalogue switch is in the checked/enabled state. */
  async getShowCatalogueState(): Promise<boolean> {
    await expect(this.showCatalogueToggle).toBeVisible({ timeout: 10_000 });
    return (
      (await this.showCatalogueToggle.getAttribute('aria-checked')) === 'true'
    );
  }

  /** Clicks the Show Catalogue switch to toggle its state. */
  async toggleShowCatalogue(): Promise<void> {
    await expect(this.showCatalogueToggle).toBeVisible({ timeout: 10_000 });
    await this.showCatalogueToggle.click();
  }

  /** Ensures the Show Catalogue switch matches `enabled`, toggling if needed. */
  async setShowCatalogue(enabled: boolean): Promise<void> {
    if ((await this.getShowCatalogueState()) !== enabled) {
      await this.toggleShowCatalogue();
      await expect(this.showCatalogueToggle).toHaveAttribute(
        'aria-checked',
        enabled ? 'true' : 'false',
        { timeout: 5_000 },
      );
    }
  }

  /**
   * Clicks the "Create Embed" footer button to submit/persist the form, then
   * dismisses the resulting "Embedded Code" dialog so the parent editor is no
   * longer inert and can be closed/reopened.
   */
  async submit(): Promise<void> {
    await expect(this.submitButton).toBeVisible({ timeout: 10_000 });
    await this.submitButton.click();
    await this.dismissEmbedCodeDialog();
  }

  /** Returns true when the Optimize Page Context Tokens switch is in the checked/enabled state. */
  async getOptimizePageContextState(): Promise<boolean> {
    await expect(this.optimizePageContextToggle).toBeVisible({
      timeout: 10_000,
    });
    return (
      (await this.optimizePageContextToggle.getAttribute('aria-checked')) ===
      'true'
    );
  }

  /** Ensures the Optimize Page Context Tokens switch matches `enabled`, toggling if needed. */
  async setOptimizePageContext(enabled: boolean): Promise<void> {
    if ((await this.getOptimizePageContextState()) !== enabled) {
      await this.optimizePageContextToggle.click();
      await expect(this.optimizePageContextToggle).toHaveAttribute(
        'aria-checked',
        enabled ? 'true' : 'false',
        { timeout: 5_000 },
      );
    }
  }

  /** Returns true when the Shareable Link switch is in the checked/enabled state. */
  async getShareableLinkState(): Promise<boolean> {
    await expect(this.shareableLinkToggle).toBeVisible({ timeout: 15_000 });
    return (
      (await this.shareableLinkToggle.getAttribute('aria-checked')) === 'true'
    );
  }

  /**
   * Clicks the Shareable Link switch to toggle it. This fires the
   * create/enable/disable shareable-link mutation directly against the
   * backend (see handleShareableTokenToggle in embed-tab.tsx) — it does NOT
   * go through the embed form's submit/save flow.
   */
  async toggleShareableLink(): Promise<void> {
    await expect(this.shareableLinkToggle).toBeVisible({ timeout: 15_000 });
    await this.shareableLinkToggle.click();
  }

  /**
   * Clicks the regenerate (refresh) icon next to the Shareable Link switch.
   * Fires handleRegenerateToken() directly against the backend.
   */
  async regenerateShareableLink(): Promise<void> {
    await expect(this.regenerateShareableLinkButton).toBeVisible({
      timeout: 15_000,
    });
    await this.regenerateShareableLinkButton.click();
  }

  /**
   * Returns true if the "Please specify a valid Website URL" error is
   * currently rendered under the Website URL field (issue #2153 regression
   * guard — this must stay false across all shareable-link interactions).
   */
  async hasWebsiteUrlValidationError(): Promise<boolean> {
    let visible = false;
    try {
      await this.websiteUrlError.waitFor({ state: 'visible', timeout: 2_000 });
      visible = true;
    } catch {
      visible = false;
    }
    return visible;
  }

  /** Closes the generated "Embedded Code" dialog if it is showing. */
  async dismissEmbedCodeDialog(): Promise<void> {
    // The embed-code generation API can be slow; use a generous timeout so we
    // don't give up before the dialog appears and leave it open (which would
    // block all subsequent interactions with the Edit Agent dialog).
    const appeared = await this.embedCodeDialog
      .waitFor({ state: 'visible', timeout: 30_000 })
      .then(() => true)
      .catch(() => false);

    if (!appeared) {
      // No dialog appeared (e.g. the submit was rejected by validation or the
      // dialog uses a different accessible name than expected). As a last-resort
      // fallback, press Escape to dismiss any portal dialog that may be blocking
      // the Edit Agent modal, then bail out.
      await this.page.keyboard.press('Escape').catch(() => {});
      await this.page.waitForTimeout(300);
      return;
    }

    // First try clicking the Close button inside the named dialog.
    const closeBtn = this.embedCodeDialog.getByRole('button', {
      name: 'Close',
      exact: true,
    });
    const closeBtnVisible = await isVisibleWithin(closeBtn, 3_000);

    if (closeBtnVisible) {
      await closeBtn.click();
    } else {
      // Fallback: dismiss via Escape (Radix dialogs respond to Escape).
      await this.page.keyboard.press('Escape').catch(() => {});
    }

    await expect(this.embedCodeDialog).toBeHidden({ timeout: 5_000 });
  }

  /**
   * Enables the shareable link if not already on, then waits for the generated
   * URL block to render. Reuses main-side getShareableLinkState/toggleShareableLink.
   */
  async enableShareableLink(): Promise<void> {
    if (await this.getShareableLinkState()) return;
    await this.toggleShareableLink();
    await expect(this.shareableLinkToggle).toHaveAttribute(
      'aria-checked',
      'true',
      { timeout: 20_000 },
    );
    await expect(this.shareableLinkUrlBlock).toBeVisible({ timeout: 15_000 });
  }

  /** Returns the full generated shareable-link URL text. */
  async getShareableLinkUrl(): Promise<string> {
    await expect(this.shareableLinkUrlBlock).toBeVisible({ timeout: 15_000 });
    return (await this.shareableLinkUrlBlock.textContent())?.trim() ?? '';
  }

  /** Extracts just the `token` query-param value from the generated shareable-link URL. */
  async getShareableLinkToken(): Promise<string> {
    const url = await this.getShareableLinkUrl();
    const match = url.match(/[?&]token=([^&\s]+)/);
    if (!match) {
      throw new Error(
        `Shareable link URL did not contain a token query param: ${url}`,
      );
    }
    return match[1];
  }

  /** Selects an option in the "Who Can View?" Radix Select (mentor_visibility). */
  async setWhoCanView(label: string): Promise<void> {
    await expect(this.whoCanViewSelect).toBeVisible({ timeout: 10_000 });
    await this.whoCanViewSelect.click();
    await this.selectRadixOption(label);
  }

  /** Selects an option in the "Who Can Chat?" Radix Select (allow_anonymous). */
  async setWhoCanChat(label: string): Promise<void> {
    await expect(this.whoCanChatSelect).toBeVisible({ timeout: 10_000 });
    await this.whoCanChatSelect.click();
    await this.selectRadixOption(label);
  }

  /** Clicks the open Radix Select popup's option matching `label`. */
  private async selectRadixOption(label: string): Promise<void> {
    const opt = this.page.locator('div[role="option"]').filter({
      hasText: new RegExp(`^${label}$`, 'i'),
    });
    let radixVisible = false;
    try {
      await opt.first().waitFor({ state: 'visible', timeout: 3_000 });
      radixVisible = true;
    } catch {
      radixVisible = false;
    }
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
}
