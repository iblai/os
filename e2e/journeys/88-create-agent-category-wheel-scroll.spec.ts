import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp } from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';

/**
 * Journey 88: Create Agent category list scrolls with the mouse wheel
 *
 * Regression: the Category popover portals to document.body, outside the
 * Create Agent Radix Dialog, so the dialog's scroll lock preventDefault()ed
 * every wheel event over the list (scrollbar dragging still worked). The fix
 * makes that popover modal so the list is part of the allowed scroll surface.
 * Pre-fix, wheeling 400px left scrollTop at 0.
 */
test.use({ viewport: { width: 1440, height: 900 } });

test.describe('Journey 88: Create Agent category wheel scroll', () => {
  test.beforeEach(async ({ page, createMentorPage }) => {
    await navigateToMentorApp(page);
    await waitForPageReady(page);
    await createMentorPage.open();
    await expect(createMentorPage.nameInput).toBeEnabled({ timeout: 60_000 });
    await createMentorPage.categoryCombobox.click();
    await expect(page.getByRole('option').first()).toBeVisible({
      timeout: 30_000,
    });
  });

  test('admin opens Create Agent category picker, wheels the list and a lower category becomes selectable', async ({
    page,
    createMentorPage,
  }) => {
    const list = createMentorPage.categoryList;
    const options = list.getByRole('option');

    await expect
      .poll(() => list.evaluate((el) => el.scrollHeight - el.clientHeight), {
        message: 'category list must overflow to be scrollable',
      })
      .toBeGreaterThan(0);
    expect(await list.evaluate((el) => el.scrollTop)).toBe(0);

    const box = await list.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + 40);
    await page.mouse.wheel(0, 400);

    await expect
      .poll(() => list.evaluate((el) => el.scrollTop), {
        message: 'mouse wheel must scroll the category list',
      })
      .toBeGreaterThan(0);

    const last = options.last();
    await expect(last).toBeInViewport();
    const name = (await last.innerText()).trim();
    await last.click();
    await expect(createMentorPage.categoryCombobox).toContainText(name);
  });
});
