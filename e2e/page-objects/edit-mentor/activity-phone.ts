import { expect, Locator, Page } from '@playwright/test';

/**
 * Phone-sized context options shared by the Tasks / Support / Evals phone
 * checkpoints. 375x812 is below the SDK's 768px card breakpoint
 * (`useActivityPhone`: `(max-width: 767px)`).
 */
export const PHONE_CONTEXT = {
  viewport: { width: 375, height: 812 },
  isMobile: true,
  hasTouch: true,
} as const;

/**
 * Phone view of the Activity tabs (Tasks, Support, Evals) inside the Edit
 * Agent dialog. Wraps the SDK's shared phone pieces (`activity-phone`): the
 * full-screen dialog, the header info button, bottom sheets
 * (`role="dialog"` named by title, rendered inside the Edit Agent dialog),
 * full-screen detail screens with a Back button, and the compact pager.
 */
export class ActivityPhoneView {
  constructor(
    readonly page: Page,
    readonly dialog: Locator,
  ) {}

  /** The Edit Agent dialog covers the whole viewport on a phone. */
  async expectDialogFillsViewport(): Promise<void> {
    const viewport = this.page.viewportSize();
    expect(viewport).not.toBeNull();
    await expect
      .poll(
        async () => {
          const box = await this.dialog.boundingBox();
          if (!box || !viewport) return false;
          return (
            box.x <= 1 &&
            box.y <= 1 &&
            box.width >= viewport.width - 1 &&
            box.height >= viewport.height - 1
          );
        },
        { timeout: 10_000, message: 'Edit Agent dialog should fill the phone' },
      )
      .toBe(true);
  }

  async expectNoHorizontalScroll(): Promise<void> {
    const { scrollWidth, innerWidth } = await this.page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
  }

  // Info button + sheet --------------------------------------------------

  infoButton(): Locator {
    return this.dialog.getByRole('button', {
      name: 'About This Tab',
      exact: true,
    });
  }

  /** A bottom sheet, matched by its title. */
  sheet(title: string | RegExp): Locator {
    return this.dialog.getByRole('dialog', { name: title });
  }

  /** The full-screen backdrop button behind a sheet ("Close"). */
  private sheetBackdrop(sheet: Locator): Locator {
    return sheet.locator('xpath=../button');
  }

  /** Tap the dimmed area above the sheet; the panel covers the centre. */
  async closeSheetByBackdrop(sheet: Locator): Promise<void> {
    await this.sheetBackdrop(sheet).click({ position: { x: 5, y: 5 } });
    await expect(sheet).toBeHidden({ timeout: 5_000 });
  }

  /** Open the info sheet, check its title and text, close it again. */
  async openAndCloseInfoSheet(title: string | RegExp): Promise<void> {
    await expect(this.infoButton()).toBeVisible({ timeout: 10_000 });
    await this.infoButton().click();
    const sheet = this.sheet(title);
    await expect(sheet).toBeVisible({ timeout: 5_000 });
    await expect(sheet.locator('p')).not.toBeEmpty();
    await this.closeSheetByBackdrop(sheet);
  }

  // Detail screen --------------------------------------------------------

  screen(): Locator {
    return this.dialog.getByTestId('activity-screen');
  }

  screenTitle(title: string): Locator {
    return this.screen().getByRole('heading', { name: title, exact: true });
  }

  async goBack(): Promise<void> {
    await this.screen()
      .getByRole('button', { name: 'Back', exact: true })
      .click();
    await expect(this.screen()).toBeHidden({ timeout: 5_000 });
  }

  // Pager ----------------------------------------------------------------

  pager(): Locator {
    return this.dialog.getByTestId('activity-pager');
  }
}
