import { Page, Locator, expect } from '@playwright/test';
import {
  SCREENSHARE_LABELS,
  expectScreenShareDisabledHint,
} from '@iblai/iblai-js/playwright';

/**
 * Page object for the Screen Share top-level tab inside the Edit Mentor
 * dialog.
 *
 * Rendered by the SDK's `AgentScreenShareTab`
 * (`@iblai/iblai-js/web-containers/next`) and gated in the host by
 * `call_configuration.enable_video` — the toggle that lives on the
 * Settings tab. The tab edits the two screensharing prompts on the
 * mentor's CallConfiguration; everything else (mode, providers, voice
 * picker) stays on the Voice tab.
 *
 * Selector policy (do not regress):
 *   1. Tab trigger in the host sidebar → `[role="tab"][aria-controls="panel-screenshare"]`.
 *      Mirrors the Voice tab pattern. `aria-controls` is unique to the
 *      host's TabsTrigger; the SDK panel never re-uses the `panel-…`
 *      id space, so we won't collide with anything the SDK renders.
 *   2. Tab panel body (SDK-owned) → `data-testid="screenshare-tab-body"`.
 *   3. Off-state hint → `data-testid="screenshare-disabled-hint"` via the
 *      SDK helper `expectScreenShareDisabledHint`.
 *   4. Save button → `data-testid="screenshare-save-button"`.
 *   5. Heading → `role="heading"` filtered by SDK label (`SCREENSHARE_LABELS.headerTitle`).
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
  /** Off-state hint shown when `enable_video` is false. */
  readonly disabledHint: Locator;

  constructor(page: Page, dialog: Locator) {
    this.page = page;
    this.dialog = dialog;

    this.tabLink = dialog.locator(
      '[role="tab"][aria-controls="panel-screenshare"]',
    );
    this.body = dialog.getByTestId('screenshare-tab-body');
    this.heading = dialog.getByRole('heading', {
      name: SCREENSHARE_LABELS.headerTitle,
    });
    this.saveButton = dialog.getByTestId('screenshare-save-button');
    this.disabledHint = dialog.getByTestId('screenshare-disabled-hint');
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

  async expectDisabledHint(visible: boolean): Promise<void> {
    await expectScreenShareDisabledHint(this.dialog, visible);
  }
}
