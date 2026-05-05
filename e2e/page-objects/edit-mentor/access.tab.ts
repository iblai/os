import { Page, Locator, expect } from '@playwright/test';

export class AccessTab {
  readonly page: Page;
  readonly dialog: Locator;

  /** "Access control" heading rendered at the top of the tab panel. */
  readonly heading: Locator;
  /** Description line below the heading. */
  readonly description: Locator;
  /** "Create role access" trigger button (only visible when availableRoles.length > 0). */
  readonly createRoleAccessButton: Locator;
  /** The roles table rendered when policies exist. */
  readonly rolesTable: Locator;
  /** All data rows inside the roles table (excludes the header row). */
  readonly policyRows: Locator;
  /** Empty state when no policies exist but mentor context is resolved. */
  readonly noPoliciesEmptyState: Locator;
  /** Error state shown when the RBAC fetch fails. */
  readonly errorState: Locator;
  /** "Try again" button inside the error state. */
  readonly tryAgainButton: Locator;
  /** "Access management is unavailable" state (canManageAccess === false). */
  readonly unavailableState: Locator;

  constructor(page: Page, dialog: Locator) {
    this.page = page;
    this.dialog = dialog;
    this.heading = dialog.getByRole('heading', { name: 'Access control' });
    this.description = dialog.getByText(
      /Manage which users can view or edit this agent by role\./i,
    );
    this.createRoleAccessButton = dialog.getByRole('button', {
      name: /create role access/i,
    });
    this.rolesTable = dialog.getByRole('table');
    this.policyRows = dialog
      .getByRole('table')
      .getByRole('row')
      .filter({ hasNot: dialog.getByRole('columnheader') });
    this.noPoliciesEmptyState = dialog.getByText(
      /No roles available for this agent\./i,
    );
    this.errorState = dialog.getByText(/Unable to load agent access\./i);
    this.tryAgainButton = dialog.getByRole('button', { name: /try again/i });
    this.unavailableState = dialog.getByText(
      /Access management is unavailable\./i,
    );
  }

  /** Returns true when at least one policy row is rendered in the table. */
  async hasPolicies(): Promise<boolean> {
    let visible = false;
    try {
      await this.rolesTable.waitFor({ state: 'visible', timeout: 8_000 });
      visible = true;
    } catch {
      visible = false;
    }
    if (!visible) return false;
    const count = await this.policyRows.count().catch(() => 0);
    return count > 0;
  }

  /** Returns the number of policy rows currently rendered. */
  async getPolicyCount(): Promise<number> {
    return this.policyRows.count().catch(() => 0);
  }

  /**
   * Opens the "Create mentor role access" dialog by clicking the trigger button.
   * Resolves once the dialog is visible.
   */
  async openCreateRoleAccessDialog(): Promise<Locator> {
    await expect(this.createRoleAccessButton).toBeVisible({ timeout: 10_000 });
    await this.createRoleAccessButton.click();
    const createDialog = this.page
      .getByRole('dialog')
      .filter({ hasText: /Create agent role access/i })
      .last();
    await expect(createDialog).toBeVisible({ timeout: 10_000 });
    return createDialog;
  }

  /**
   * Clicks the Pencil edit button on the row matching the given policy row index
   * (0-based) and returns the resulting "Manage … access" dialog locator.
   */
  async clickEditButton(rowIndex = 0): Promise<Locator> {
    const row = this.policyRows.nth(rowIndex);
    await expect(row).toBeVisible({ timeout: 10_000 });
    // The edit button's aria-label is "Edit <Role Name> access"
    const editBtn = row.getByRole('button', { name: /^Edit .+ access$/i });
    await expect(editBtn).toBeVisible({ timeout: 5_000 });
    await editBtn.click();
    const manageDialog = this.page
      .getByRole('dialog')
      .filter({ hasText: /Manage .+ access/i })
      .last();
    await expect(manageDialog).toBeVisible({ timeout: 10_000 });
    return manageDialog;
  }

  /** Returns the formatted role name text of the given policy row (0-based). */
  async getRoleName(rowIndex = 0): Promise<string> {
    const row = this.policyRows.nth(rowIndex);
    // Role name lives inside the first TableCell in each row.
    const cell = row.getByRole('cell').first();
    return (await cell.textContent().catch(() => ''))?.trim() ?? '';
  }

  /** Returns the numeric user count badge value for the given row (0-based). */
  async getUserCount(rowIndex = 0): Promise<number> {
    const row = this.policyRows.nth(rowIndex);
    // The badge is a <span> with variant="outline"; it renders just the number.
    const badge = row.locator('span.bg-blue-50');
    const text = (await badge.textContent().catch(() => '0'))?.trim() ?? '0';
    return parseInt(text, 10) || 0;
  }
}
