import { Page, Locator, expect } from '@playwright/test';
import {
  SCREENSHARE_LABELS,
  expectScreenShareDisabledHint,
} from '@iblai/iblai-js/playwright';

/**
 * Page object for the Screen Share top-level tab inside the Edit Mentor
 * dialog.
 *
 * Rendered by the SDK's `AgentScreenShareTab` (`@iblai/web-containers/next`)
 * and gated in the host by `call_configuration.enable_video` — the toggle
 * that lives on the Settings tab. The tab edits the two screensharing
 * prompts on the mentor's CallConfiguration; everything else (mode,
 * providers, voice picker) stays on the Voice tab.
 *
 * NOTE on the sidebar label: the host renames the SDK's stock "Screen
 * share" → "Screen Share" via the `MENTOR_SEGMENTS` entry. That makes
 * the SDK's stock `switchToScreenShareTab` helper unable to find the
 * sidebar trigger (it queries for "Screen share"), so this page object
 * resolves the tab trigger from the host label directly. The SDK's
 * `headerTitle` and `disabled hint` helpers still apply because they
 * target SDK-rendered DOM inside the panel.
 */
const HOST_TAB_LABEL = 'Screen Share';

export class ScreenShareTab {
  readonly page: Page;
  readonly dialog: Locator;

  /** Screen Share tab label rendered in the modal sidebar (host label). */
  readonly tabLink: Locator;
  /** Heading at the top of the tab panel (SDK-rendered). */
  readonly heading: Locator;

  constructor(page: Page, dialog: Locator) {
    this.page = page;
    this.dialog = dialog;
    this.tabLink = dialog.getByRole('tab', {
      name: HOST_TAB_LABEL,
      exact: true,
    });
    this.heading = dialog.getByRole('heading', {
      name: SCREENSHARE_LABELS.headerTitle,
    });
  }

  async isVisible(): Promise<boolean> {
    return this.tabLink.isVisible({ timeout: 5_000 }).catch(() => false);
  }

  async switchTo(): Promise<void> {
    await expect(this.tabLink).toBeVisible({ timeout: 10_000 });
    await this.tabLink.click();
    await expect(this.heading).toBeVisible({ timeout: 10_000 });
  }

  async expectDisabledHint(visible: boolean): Promise<void> {
    await expectScreenShareDisabledHint(this.dialog, visible);
  }
}
