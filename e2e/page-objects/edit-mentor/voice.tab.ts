import { Page, Locator, expect } from '@playwright/test';
import {
  VOICE_LABELS,
  switchToVoiceTab,
  switchToVoiceSubTab,
  isVoiceTabVisible,
  getVoiceProviderCard,
  selectVoiceProvider,
  expectVoiceProviderSelected,
  getCallConfigForm,
  expectCallConfigVisible,
  selectCallMode,
  saveVoiceSettings,
} from '@iblai/iblai-js/playwright';

export type VoiceProviderId = Parameters<typeof selectVoiceProvider>[1];
export type VoiceCapability = 'voice-calls' | 'dictation';
export type VoiceSurface = 'in-app' | 'embed';

const SURFACE_SWITCH = {
  'voice-calls': {
    name: 'Voice Calls',
    'in-app': 'voice-capability-toggle',
    embed: 'voice-capability-toggle-embed',
  },
  dictation: {
    name: 'Dictation',
    'in-app': 'voice-record-capability-toggle',
    embed: 'voice-record-capability-toggle-embed',
  },
} as const;

const SURFACE_NAME: Record<VoiceSurface, string> = {
  'in-app': 'In-App Chat',
  embed: 'Embed Widget',
};

/**
 * Page object for the Voice tab inside the Edit Mentor dialog.
 *
 * The tab is rendered by the SDK's `AgentVoiceTab` component
 * (`@iblai/iblai-js/web-containers/next`). Provider / call-config selectors
 * come from the Playwright helpers re-exported by `@iblai/iblai-js/playwright`.
 * The surface switches and the Dictation sub-tab are driven by test id here
 * because the installed helpers predate them.
 *
 * Three sub-tabs, all always usable:
 *   - "Voice" — provider cards + voice picker; drives Read Aloud, no switch
 *   - "Calls" — In-App Chat / Embed Widget switches + call configuration
 *   - "Dictation"   — In-App Chat / Embed Widget switches + language and hints
 *
 * Each switch only exists while its own sub-tab is open, so every switch
 * method opens that sub-tab itself.
 */
export class VoiceTab {
  readonly page: Page;
  readonly dialog: Locator;

  /** Voice tab label rendered in the modal sidebar. */
  readonly tabLink: Locator;
  /** Heading at the top of the tab panel. */
  readonly heading: Locator;
  /** The segmented sub-tab control. */
  readonly subTabs: Locator;
  /** Info box above the sub-tabs. */
  readonly infoBox: Locator;
  /** Sub-tab pill "Voice" (provider + picker). */
  readonly voiceSubTab: Locator;
  /** Sub-tab pill "Calls" (switches + call configuration). */
  readonly callConfigSubTab: Locator;
  /** Sub-tab pill "Dictation" (switches + language and hints). */
  readonly dictationSubTab: Locator;
  /**
   * Voice Calls, In-App Chat switch (`show_voice_call`). Saves on click; only
   * mounted while the Calls sub-tab is open.
   */
  readonly capabilityToggle: Locator;
  /** Gated content of the open Voice Calls / Dictation sub-tab; `data-enabled` is on while either surface is on. */
  readonly capabilityContent: Locator;
  /** Hint shown while both surfaces of the open sub-tab are off. */
  readonly capabilityOffHint: Locator;
  /** "Smart Document Retrieval" (`use_function_calling_for_rag`), saved by the Save button in the tab's bottom bar. */
  readonly smartDocumentRetrievalToggle: Locator;
  readonly callConfigSaveButton: Locator;

  constructor(page: Page, dialog: Locator) {
    this.page = page;
    this.dialog = dialog;

    // Filter by `aria-controls="panel-voice"` to disambiguate the host's
    // sidebar tab from the SDK's "Voice" sub-tab pill inside the panel —
    // both have role="tab" and accessible name "Voice", so a plain
    // getByRole match raises a strict-mode violation once the panel is
    // active. The sidebar trigger uniquely owns `panel-voice`.
    //
    // `:visible` additionally excludes the host's hidden responsive twin —
    // the sidebar is rendered twice (desktop `#desktop-tab-voice` + compact
    // `#tab-voice`), both owning `aria-controls="panel-voice"`, so a bare CSS
    // match (which ignores visibility) still resolves 2 elements.
    this.tabLink = dialog.locator(
      '[role="tab"][aria-controls="panel-voice"]:visible',
    );
    this.heading = dialog.getByRole('heading', {
      name: VOICE_LABELS.headerTitle,
    });
    this.subTabs = dialog.getByTestId('voice-sub-tabs');
    this.voiceSubTab = dialog.getByTestId('voice-sub-tab-voice');
    this.callConfigSubTab = dialog.getByTestId('voice-sub-tab-call-config');
    this.dictationSubTab = dialog.getByTestId('voice-sub-tab-settings');
    this.infoBox = dialog.getByTestId('voice-info-box');
    this.capabilityToggle = dialog.getByTestId('voice-capability-toggle');
    // `:visible` skips the gates of other top-level tabs, which can stay
    // force-mounted (CSS-hidden) while inactive.
    this.capabilityContent = dialog.locator(
      '[data-testid="capability-gate-content"]:visible',
    );
    this.capabilityOffHint = dialog.locator(
      '[data-testid="capability-gate-off-hint"]:visible',
    );
    this.smartDocumentRetrievalToggle = dialog.getByTestId(
      'call-config-smart-document-retrieval-toggle',
    );
    this.callConfigSaveButton = dialog
      .getByTestId('voice-tab-footer')
      .getByRole('button', { name: 'Save', exact: true });
  }

  // ── Tab navigation ────────────────────────────────────────────────────────

  async isVisible(): Promise<boolean> {
    return isVoiceTabVisible(this.page);
  }

  // ── Surface switches ──────────────────────────────────────────────────────

  /** One of the four In-App Chat / Embed Widget switches. */
  surfaceSwitch(capability: VoiceCapability, surface: VoiceSurface): Locator {
    return this.dialog.getByTestId(SURFACE_SWITCH[capability][surface]);
  }

  private async openSubTab(pill: Locator): Promise<void> {
    await expect(pill).toBeVisible({ timeout: 10_000 });
    if ((await pill.getAttribute('aria-selected')) !== 'true') {
      await pill.click();
    }
    await expect(pill).toHaveAttribute('aria-selected', 'true', {
      timeout: 10_000,
    });
  }

  async switchToDictationSubTab(): Promise<void> {
    await this.openSubTab(this.dictationSubTab);
  }

  /** Opens the sub-tab that owns the capability and returns its switch. */
  private async openSurfaceSwitch(
    capability: VoiceCapability,
    surface: VoiceSurface,
  ): Promise<Locator> {
    await this.openSubTab(
      capability === 'voice-calls'
        ? this.callConfigSubTab
        : this.dictationSubTab,
    );
    const toggle = this.surfaceSwitch(capability, surface);
    await expect(toggle).toBeVisible({ timeout: 10_000 });
    return toggle;
  }

  async isSurfaceSwitchOn(
    capability: VoiceCapability,
    surface: VoiceSurface,
  ): Promise<boolean> {
    const toggle = await this.openSurfaceSwitch(capability, surface);
    return (await toggle.getAttribute('aria-checked')) === 'true';
  }

  /**
   * Idempotently sets one switch. It saves on click, so this waits for the
   * switch state and the "<Name> turned on/off for <Surface>" toast.
   */
  async setSurfaceSwitch(
    capability: VoiceCapability,
    surface: VoiceSurface,
    target: boolean,
  ): Promise<void> {
    const toggle = await this.openSurfaceSwitch(capability, surface);
    if (((await toggle.getAttribute('aria-checked')) === 'true') === target) {
      return;
    }
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', String(target), {
      timeout: 15_000,
    });
    const toast = `${SURFACE_SWITCH[capability].name} turned ${target ? 'on' : 'off'} for ${SURFACE_NAME[surface]}`;
    await expect(this.page.getByText(toast).first()).toBeVisible({
      timeout: 15_000,
    });
  }

  /** Whether Voice Calls is on for In-App Chat. */
  async isCapabilityEnabled(): Promise<boolean> {
    return this.isSurfaceSwitchOn('voice-calls', 'in-app');
  }

  /** Sets Voice Calls for In-App Chat; the Embed Widget switch is left alone. */
  async setCapabilityEnabled(target: boolean): Promise<void> {
    await this.setSurfaceSwitch('voice-calls', 'in-app', target);
  }

  async switchToVoiceTab(): Promise<void> {
    await switchToVoiceTab(this.page);
  }

  async switchToVoiceSubTab(): Promise<void> {
    await switchToVoiceSubTab(this.dialog, 'voice');
  }

  async switchToCallConfigSubTab(): Promise<void> {
    await switchToVoiceSubTab(this.dialog, 'callConfig');
  }

  // ── Voice sub-tab (provider + picker) ─────────────────────────────────────

  providerCard(provider: 'browser' | 'openai' | 'google'): Locator {
    return getVoiceProviderCard(this.dialog, provider);
  }

  async selectProvider(
    provider: 'browser' | 'openai' | 'google',
  ): Promise<void> {
    await selectVoiceProvider(this.dialog, provider);
  }

  async expectProviderSelected(
    provider: 'browser' | 'openai' | 'google',
  ): Promise<void> {
    await expectVoiceProviderSelected(this.dialog, provider);
  }

  /** Provider ids in the order their cards render. */
  async availableProviders(): Promise<VoiceProviderId[]> {
    const cards = this.dialog.locator(
      '[role="radiogroup"] [data-voice-provider]',
    );
    await expect(cards.first()).toBeVisible({ timeout: 10_000 });
    const ids = await cards.evaluateAll((els) =>
      els.map((el) => el.getAttribute('data-voice-provider') ?? ''),
    );
    // The SDK's VoiceProvider union lags the cards it renders (ibl.ai is
    // missing), so trust the DOM over the type.
    return ids.filter(Boolean) as VoiceProviderId[];
  }

  async saveVoiceSettings(): Promise<void> {
    await saveVoiceSettings(this.dialog);
    await expect(this.page.getByText('Voice saved').first()).toBeVisible({
      timeout: 15_000,
    });
  }

  /** Trigger that opens the modal voice picker for the mentor voice. */
  readonly mentorVoiceTriggerOpen = () =>
    this.dialog.getByTestId('mentor-voice-trigger-open');

  // ── Calls sub-tab (call configuration) ────────────────────────────────────────────

  callConfigForm(): Locator {
    return getCallConfigForm(this.dialog);
  }

  async expectCallConfigVisible(): Promise<void> {
    await expectCallConfigVisible(this.dialog);
  }

  async selectCallMode(mode: 'realtime' | 'inference'): Promise<void> {
    await selectCallMode(this.dialog, mode);
  }

  async isSmartDocumentRetrievalOn(): Promise<boolean> {
    await expect(this.smartDocumentRetrievalToggle).toBeVisible({
      timeout: 10_000,
    });
    return (
      (await this.smartDocumentRetrievalToggle.getAttribute('aria-checked')) ===
      'true'
    );
  }

  /**
   * Sets the Smart Document Retrieval switch on the Calls sub-tab and
   * saves it with the section's Save button. No-op when already at the target.
   */
  async setSmartDocumentRetrievalAndSave(target: boolean): Promise<void> {
    if ((await this.isSmartDocumentRetrievalOn()) === target) return;
    await this.smartDocumentRetrievalToggle.click();
    await expect(this.smartDocumentRetrievalToggle).toHaveAttribute(
      'aria-checked',
      String(target),
      { timeout: 10_000 },
    );
    await expect(this.callConfigSaveButton).toBeEnabled({ timeout: 10_000 });
    await this.callConfigSaveButton.click();
    await expect(
      this.page.getByText('Voice call settings saved').first(),
    ).toBeVisible({ timeout: 30_000 });
  }

  /**
   * Convenience assertion used by the cross-tab smoke checkpoint — verifies
   * both the parent tab label and the sub-tab segmented control are visible.
   */
  async expectFullyRendered(): Promise<void> {
    await expect(this.tabLink).toBeVisible({ timeout: 10_000 });
    await expect(this.subTabs).toBeVisible({ timeout: 10_000 });
  }
}
