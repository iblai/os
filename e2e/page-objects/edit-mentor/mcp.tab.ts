import { Page, Locator, expect } from '@playwright/test';

export class McpTab {
  readonly page: Page;
  readonly dialog: Locator;

  readonly addConnectorButton: Locator;
  readonly connectorRows: Locator;
  readonly emptyState: Locator;
  readonly deleteButtons: Locator;

  constructor(page: Page, dialog: Locator) {
    this.page = page;
    this.dialog = dialog;
    this.addConnectorButton = dialog.getByRole('button', {
      name: /add connector/i,
    });
    this.connectorRows = dialog.locator(
      '[class*="connector"], [data-testid*="connector"]',
    );
    this.emptyState = dialog.getByText('No connectors configured');
    this.deleteButtons = dialog.getByRole('button', { name: /delete/i });
  }

  async addConnector(name: string, serverUrl: string): Promise<void> {
    await expect(this.addConnectorButton).toBeVisible({ timeout: 10_000 });
    await this.addConnectorButton.click();

    const connectorDialog = this.page
      .getByRole('dialog')
      .filter({ hasText: /connector/i })
      .last();
    await expect(connectorDialog).toBeVisible({ timeout: 10_000 });

    const nameInput = connectorDialog.getByPlaceholder('Enter connector name');
    await expect(nameInput).toBeVisible({ timeout: 5_000 });
    await nameInput.fill(name);

    const urlInput = connectorDialog.getByPlaceholder(/https:\/\//i);
    await expect(urlInput).toBeVisible({ timeout: 5_000 });
    await urlInput.fill(serverUrl);

    const saveButton = connectorDialog
      .getByRole('button', { name: /save|add|create/i })
      .last();
    await expect(saveButton).toBeEnabled({ timeout: 5_000 });
    await saveButton.click();
    await expect(connectorDialog).not.toBeVisible({ timeout: 10_000 });
  }

  async deleteFirst(): Promise<void> {
    const btn = this.deleteButtons.first();
    const visible = await btn.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!visible) {
      const optionsBtn = this.dialog
        .getByRole('button', { name: /options|more/i })
        .first();
      await expect(optionsBtn).toBeVisible({ timeout: 5_000 });
      await optionsBtn.click();
      await expect(
        this.page.getByRole('menuitem', { name: /delete/i }),
      ).toBeVisible({ timeout: 3_000 });
      await this.page.getByRole('menuitem', { name: /delete/i }).click();
    } else {
      await btn.click();
    }

    const confirmDialog = this.page
      .getByRole('dialog')
      .filter({ hasText: /delete|confirm/i })
      .last();
    const confirmVisible = await confirmDialog
      .isVisible({ timeout: 3_000 })
      .catch(() => false);
    if (confirmVisible) {
      await confirmDialog
        .getByRole('button', { name: /delete|confirm/i })
        .last()
        .click();
    }
  }

  async hasConnectors(): Promise<boolean> {
    const empty = await this.emptyState
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    return !empty;
  }
}
