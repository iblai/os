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
} from '@iblai/iblai-js/playwright';

/**
 * Page object for the Voice tab inside the Edit Mentor dialog.
 *
 * The tab is rendered by the SDK's `AgentVoiceTab` component
 * (`@iblai/iblai-js/web-containers/next`). All selectors come from the official
 * Playwright helpers re-exported by `@iblai/iblai-js/playwright` —
 * keeping the labels and `data-testid` hooks in lock-step with the SDK.
 *
 * The tab contains two sub-tabs:
 *   - "Voice"               — provider cards + voice picker (mentor settings)
 *   - "Voice call"          — full TTS/STT/LLM stack (call-configurations API)
 *
 * If the host overrides labels via the `labels` prop, update VOICE_LABELS
 * imports per spec; do NOT add ad-hoc selectors here.
 */
export class VoiceTab {
  readonly page: Page;
  readonly dialog: Locator;

  /** Voice tab label rendered in the modal sidebar. */
  readonly tabLink: Locator;
  /** Heading at the top of the tab panel. */
  readonly heading: Locator;
  /** The segmented sub-tab control (Voice / Voice call). */
  readonly subTabs: Locator;
  /** Sub-tab pill for the Voice (provider + picker) sub-tab. */
  readonly voiceSubTab: Locator;
  /** Sub-tab pill for the Voice call (call configuration) sub-tab. */
  readonly callConfigSubTab: Locator;
  /**
   * "Enable voice calls" (`show_voice_call`) master toggle. Used to live in
   * Settings → Capabilities and gate the whole tab's visibility; it now lives
   * inline at the top of this tab via the shared `CapabilityGate` and the
   * Voice tab is always mounted (`hooks/use-mentor-segments.ts` no longer
   * gates it). Toggling auto-saves (`AgentVoiceTab`'s `handleToggleVoiceCall`
   * calls `editMentor` directly with optimistic local state) — no footer
   * Save button involved.
   */
  readonly capabilityToggle: Locator;
  /** Wrapper around the gated Voice/Voice-call sub-tabs — `data-enabled` mirrors the toggle. */
  readonly capabilityContent: Locator;
  /** Hint shown next to the description while the capability is off. */
  readonly capabilityOffHint: Locator;

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
    this.capabilityToggle = dialog.getByTestId('voice-capability-toggle');
    // `:visible` scopes to the currently-active tab's gate — top-level tab
    // panels can stay force-mounted (CSS-hidden) while inactive, and every
    // gated tab renders its own `capability-gate-content` wrapper.
    this.capabilityContent = dialog.locator(
      '[data-testid="capability-gate-content"]:visible',
    );
    this.capabilityOffHint = dialog.locator(
      '[data-testid="capability-gate-off-hint"]:visible',
    );
  }

  // ── Tab navigation ────────────────────────────────────────────────────────

  async isVisible(): Promise<boolean> {
    return isVoiceTabVisible(this.page);
  }

  // ── Capability gate ───────────────────────────────────────────────────────

  /** Whether the "Enable voice calls" capability toggle is currently on. */
  async isCapabilityEnabled(): Promise<boolean> {
    const attr = await this.capabilityToggle
      .getAttribute('aria-checked')
      .catch(() => null);
    return attr === 'true';
  }

  /**
   * Idempotently set the "Enable voice calls" capability toggle to the
   * target state. Auto-saves on click (optimistic local state) — no footer
   * Save button involved. Waits for both the toggle's `aria-checked` and the
   * gated content's `data-enabled` attribute to reflect the target state.
   */
  async setCapabilityEnabled(target: boolean): Promise<void> {
    await expect(this.capabilityToggle).toBeVisible({ timeout: 10_000 });
    const isOn = await this.isCapabilityEnabled();
    if (isOn === target) return;

    await this.capabilityToggle.click();
    await expect(this.capabilityToggle).toHaveAttribute(
      'aria-checked',
      String(target),
      { timeout: 15_000 },
    );
    await expect(this.capabilityContent).toHaveAttribute(
      'data-enabled',
      String(target),
      { timeout: 15_000 },
    );
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

  /** Trigger that opens the modal voice picker for the mentor voice. */
  readonly mentorVoiceTriggerOpen = () =>
    this.dialog.getByTestId('mentor-voice-trigger-open');

  // ── Call configuration sub-tab ────────────────────────────────────────────

  callConfigForm(): Locator {
    return getCallConfigForm(this.dialog);
  }

  async expectCallConfigVisible(): Promise<void> {
    await expectCallConfigVisible(this.dialog);
  }

  async selectCallMode(mode: 'realtime' | 'inference'): Promise<void> {
    await selectCallMode(this.dialog, mode);
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
