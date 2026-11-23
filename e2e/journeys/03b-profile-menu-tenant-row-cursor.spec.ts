import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, checkAdminStatus } from '../utils/auth';

// Journey 3b: the tenant (organization) row in the avatar menu opens
// organization settings, so the pointer must show over the whole row
// (iblai-platform#2853). The fix ships in the SDK's UserProfileDropdown;
// this spec passes once the OS pins an @iblai/iblai-js release containing it.
test.describe('Journey 3b: Profile Menu Tenant Row Cursor', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) test.skip(true, 'Requires admin access');
  });

  test('admin opens the profile menu and sees the pointer cursor over the whole organization row', async ({
    page,
    navbarPage,
  }) => {
    await navbarPage.openProfileDropdown();

    // The row is a menuitem only when the person can open organization
    // settings; otherwise it is a plain label, which keeps the default cursor.
    const tenantRow = page.getByRole('menuitem').filter({
      has: page.locator('svg.lucide-building-2'),
    });
    await expect(tenantRow).toBeVisible({ timeout: 10_000 });

    const cursorAt = (x: number, y: number) =>
      page.evaluate(
        ([px, py]) => {
          const el = document.elementFromPoint(px, py);
          return el ? getComputedStyle(el).cursor : null;
        },
        [x, y],
      );

    const box = (await tenantRow.boundingBox())!;
    const icon = (await tenantRow.locator('svg').first().boundingBox())!;
    const text = (await tenantRow.getByText(/\S/).last().boundingBox())!;

    const points = {
      row: [box.x + box.width - 4, box.y + box.height / 2],
      padding: [box.x + 2, box.y + box.height / 2],
      icon: [icon.x + icon.width / 2, icon.y + icon.height / 2],
      name: [text.x + text.width / 2, text.y + text.height / 2],
    } as const;

    await page.mouse.move(points.row[0], points.row[1]);
    const cursors: Record<string, string | null> = {};
    for (const [label, [x, y]] of Object.entries(points)) {
      await page.mouse.move(x, y);
      cursors[label] = await cursorAt(x, y);
    }
    expect(cursors).toEqual({
      row: 'pointer',
      padding: 'pointer',
      icon: 'pointer',
      name: 'pointer',
    });
  });
});
