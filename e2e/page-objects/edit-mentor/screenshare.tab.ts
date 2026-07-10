import { Page, Locator, expect } from '@playwright/test';
import { SCREENSHARE_LABELS } from '@iblai/iblai-js/playwright';

/**
 * Page object for the Screen Share top-level tab inside the Edit Mentor
 * dialog.
 *
 * Rendered by the SDK's `AgentScreenShareTab`
 * (`@iblai/iblai-js/web-containers/next`). The tab is now ALWAYS mounted —
 * `hooks/use-mentor-segments.ts` no longer gates it on
 * `call_configuration.enable_video`. The "Enable screen sharing" master
 * toggle used to live on the Settings tab; it now lives inline at the top of
 * this tab via the shared `CapabilityGate` component, and the two
 * screensharing prompts below are grayed out + inert while the toggle is off.
 *
 * Selector policy (do not regress):
 *   1. Tab trigger in the host sidebar → `[role="tab"][aria-controls="panel-screenshare"]`.
 *      Mirrors the Voice tab pattern. `aria-controls` is unique to the
 *      host's TabsTrigger; the SDK panel never re-uses the `panel-…`
 *      id space, so we won't collide with anything the SDK renders.
 *   2. Tab panel body (SDK-owned) → `data-testid="screenshare-tab-body"`.
 *   3. Capability toggle → `data-testid="screenshare-capability-toggle"`.
 *   4. Off-state hint → `data-testid="capability-gate-off-hint"` (shared
 *      `CapabilityGate` hook — the tab-specific `screenshare-disabled-hint`
 *      testid from the pre-CapabilityGate SDK build no longer renders).
 *   5. Save button → `data-testid="screenshare-save-button"`.
 *   6. Heading → `role="heading"` filtered by SDK label (`SCREENSHARE_LABELS.headerTitle`).
 *
 * Never use class-name selectors or DOM structure positional locators —
 * they all break on the next SDK style refactor.
 */
export class ScreenShareTab {
  readonly page: Page;
  readonly dialog: Locator;

  /** Sidebar tab trigger (host-rendered). */
  readonly tabLink: Locator;
  /** Tab panel body container (SDK-rendered). */
  readonly body: Locator;
  /** Heading at the top of the tab panel (SDK-rendered). */
  readonly heading: Locator;
  /** Save button (SDK-rendered). */
  readonly saveButton: Locator;
  /**
   * "Enable screen sharing" (`enable_video`) master toggle. Auto-saves on
   * click (`AgentScreenShareTab`'s `handleToggleScreenShare` calls
   * `updateCallConfig`/`createCallConfig` directly with optimistic local
   * state) — no footer Save button involved for the toggle itself (the
   * screensharing PROMPTS below still use the tab's own Save button).
   */
  readonly capabilityToggle: Locator;
  /** Wrapper around the gated prompt cards — `data-enabled` mirrors the toggle. */
  readonly capabilityContent: Locator;
  /** Hint shown next to the description while the capability is off. */
  readonly capabilityOffHint: Locator;

  constructor(page: Page, dialog: Locator) {
    this.page = page;
    this.dialog = dialog;

    // `:visible` excludes the host's hidden responsive twin — the sidebar is
    // rendered twice (desktop `#desktop-tab-screenshare` + compact
    // `#tab-screenshare`), both owning `aria-controls="panel-screenshare"`,
    // and only the viewport-appropriate one is visible. Without it a bare CSS
    // match (which ignores visibility) resolves 2 elements → strict-mode fail.
    this.tabLink = dialog.locator(
      '[role="tab"][aria-controls="panel-screenshare"]:visible',
    );
    this.body = dialog.getByTestId('screenshare-tab-body');
    this.heading = dialog.getByRole('heading', {
      name: SCREENSHARE_LABELS.headerTitle,
    });
    this.saveButton = dialog.getByTestId('screenshare-save-button');
    this.capabilityToggle = dialog.getByTestId('screenshare-capability-toggle');
    this.capabilityContent = dialog.locator(
      '[data-testid="capability-gate-content"]:visible',
    );
    this.capabilityOffHint = dialog.locator(
      '[data-testid="capability-gate-off-hint"]:visible',
    );
  }

  async isVisible(): Promise<boolean> {
    return this.tabLink.isVisible({ timeout: 5_000 }).catch(() => false);
  }

  /**
   * Click the sidebar trigger and wait for the SDK-owned body to render.
   * We assert on the body's testid (not the heading) because the heading
   * is what some helpers will assert on later; the body is the canonical
   * "landed on the right pane" signal.
   */
  async switchTo(): Promise<void> {
    await expect(this.tabLink).toBeVisible({ timeout: 10_000 });
    await this.tabLink.click();
    await expect(this.body).toBeVisible({ timeout: 10_000 });
  }

  // ── Capability gate ───────────────────────────────────────────────────────

  /** Whether the "Enable screen sharing" capability toggle is currently on. */
  async isCapabilityEnabled(): Promise<boolean> {
    const attr = await this.capabilityToggle
      .getAttribute('aria-checked')
      .catch(() => null);
    return attr === 'true';
  }

  /**
   * Idempotently set the "Enable screen sharing" capability toggle to the
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

  /** Assert whether the CapabilityGate off-state hint is currently shown. */
  async expectDisabledHint(visible: boolean): Promise<void> {
    if (visible) {
      await expect(this.capabilityOffHint).toBeVisible({ timeout: 10_000 });
    } else {
      await expect(this.capabilityOffHint).toHaveCount(0, { timeout: 10_000 });
    }
  }
}
