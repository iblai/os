import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, checkAdminStatus } from '../utils/auth';
import { VirtualMachineAdminPage } from '../page-objects/virtual-machine-admin.page';
import type { Locator } from '@playwright/test';

/**
 * Journey 106: Apps
 *
 * The apps deployed on a platform have a settings page of their own, "Apps":
 * a sidebar footer row between Memory and Advanced, and a rail entry above
 * Advanced. The Advanced page's Domains card is left with the sign-in domain.
 *
 * Read-only: nothing is attached, detached, moved or deleted, so the checks
 * hold whatever apps the test platform has. The backend must serve the apps
 * list: "Apps are not available on this instance yet." fails apps-01.
 */
test.describe('Journey 106: Apps', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
    if (!(await checkAdminStatus(page))) {
      test.skip(true, 'Requires admin access');
    }
  });

  test('apps-01: admin sees Apps between Memory and Advanced in the sidebar footer and it opens the organization Account dialog on the Apps page, which lists the apps or says there are none', async ({
    page,
    sidebarPage,
  }) => {
    await expect(sidebarPage.appsButton).toBeVisible({ timeout: 15_000 });
    // The footer stacks its rows, expanded or collapsed to the rail.
    const top = async (row: Locator) => (await row.boundingBox())?.y ?? NaN;
    const memoryTop = await top(sidebarPage.memoryButton);
    const appsTop = await top(sidebarPage.appsButton);
    const advancedTop = await top(sidebarPage.settingsButton);
    expect(memoryTop).toBeLessThan(appsTop);
    expect(appsTop).toBeLessThan(advancedTop);

    await sidebarPage.appsButton.click();

    const dialog = page.getByRole('dialog', {
      name: 'Organization settings',
      exact: true,
    });
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await expect(
      dialog.getByRole('heading', { name: 'Apps', exact: true }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      dialog.getByRole('paragraph').filter({
        hasText: 'Manage the apps deployed on this platform and their domains.',
      }),
    ).toBeVisible({ timeout: 5_000 });
    await expect(
      dialog
        .getByRole('navigation', { name: 'Organization settings', exact: true })
        .getByRole('button', { name: 'Apps', exact: true }),
    ).toHaveAttribute('aria-current', 'page', { timeout: 10_000 });

    // The apps, or the one sentence a platform with none gets. Any other
    // notice (no permission, not available, could not be loaded) fails.
    const rows = dialog.locator('[data-testid^="app-row-"]');
    const notice = dialog.getByTestId('apps-tab-notice');
    await expect(rows.first().or(notice)).toBeVisible({ timeout: 30_000 });
    if (await notice.isVisible()) {
      await expect(notice).toHaveText('No apps yet.');
    } else {
      await expect(
        rows.first().getByRole('button', { name: /^Delete / }),
      ).toBeVisible({ timeout: 5_000 });
    }
  });

  test('apps-02: admin opens the organization settings from the profile menu and the rail lists Apps above Advanced under System, and Apps opens the Apps page', async ({
    page,
  }) => {
    const settings = new VirtualMachineAdminPage(page);
    await settings.openTenantSettings();

    const system = settings.dialog.getByRole('group', {
      name: 'System',
      exact: true,
    });
    await expect(system.getByRole('button')).toHaveText(['Apps', 'Advanced'], {
      timeout: 10_000,
    });

    const appsEntry = system.getByRole('button', { name: 'Apps', exact: true });
    await appsEntry.click();
    await expect(appsEntry).toHaveAttribute('aria-current', 'page', {
      timeout: 10_000,
    });
    await expect(
      settings.dialog.getByRole('heading', { name: 'Apps', exact: true }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('apps-03: admin opens Advanced, clicks Add on the Domains card and the dialog asks only for a domain for the sign-in site, with no app to choose', async ({
    page,
    sidebarPage,
  }) => {
    await expect(sidebarPage.settingsButton).toBeVisible({ timeout: 15_000 });
    await sidebarPage.settingsButton.click();

    const dialog = page.getByRole('dialog', {
      name: 'Organization settings',
      exact: true,
    });
    await expect(
      dialog.getByRole('heading', { name: 'Advanced', exact: true }),
    ).toBeVisible({ timeout: 15_000 });

    // The Domains card is the innermost box holding its own collapse toggle.
    const domainsCard = dialog
      .locator('div.rounded-lg')
      .filter({
        has: page.getByRole('button', {
          name: /^(Expand|Collapse) domains$/,
        }),
      })
      .last();
    await expect(domainsCard).toBeVisible({ timeout: 20_000 });
    await domainsCard.getByRole('button', { name: 'Add', exact: true }).click();

    const addDialog = page.getByRole('dialog', {
      name: 'Add a domain',
      exact: true,
    });
    await expect(addDialog).toBeVisible({ timeout: 10_000 });
    await expect(
      addDialog.getByText(
        'Point a domain you own at this organization’s sign-in site.',
      ),
    ).toBeVisible({ timeout: 5_000 });
    await expect(
      addDialog.getByRole('textbox', { name: 'Domain', exact: true }),
    ).toBeVisible({ timeout: 5_000 });
    await expect(addDialog.getByRole('textbox')).toHaveCount(1);
    await expect(addDialog.getByRole('combobox')).toHaveCount(0);

    await addDialog
      .getByRole('button', { name: 'Cancel', exact: true })
      .click();
    await expect(addDialog).toBeHidden({ timeout: 10_000 });
  });
});
