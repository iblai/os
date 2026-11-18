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

  test('admin searches the Create Agent category list by name, clears the search and picks a category, which closes the list', async ({
    createMentorPage,
  }) => {
    const list = createMentorPage.categoryList;
    const options = list.getByRole('option');
    const search = createMentorPage.categorySearchInput;

    const total = await options.count();
    const height = await list.evaluate((el) => el.clientHeight);
    const name = (await options.last().innerText()).trim();
    const match = list.getByRole('option', { name, exact: true });

    await search.fill(name);
    await expect(match).toBeVisible();
    await expect.poll(() => options.count()).toBeLessThan(total);
    expect(await list.evaluate((el) => el.clientHeight)).toBe(height);

    await search.fill('');
    await expect(options).toHaveCount(total);
    expect(await list.evaluate((el) => el.clientHeight)).toBe(height);

    await search.fill(name);
    await match.click();
    await expect(search).toBeHidden();
    await expect(createMentorPage.categoryCombobox).toContainText(name);
  });
});

/**
 * Create Agent prompt popup Save (issue #2758, now in the wizard's Prompts
 * step, iblai-platform#2853): the System / Proactive prompt popup has a Save
 * button that saves it and the step shows the saved text.
 */

test.describe('Journey 88: Create Agent prompt popup Save', () => {
  test.beforeEach(async ({ page, createAgentWizardPage: wizard }) => {
    await navigateToMentorApp(page);
    await waitForPageReady(page);
    await wizard.open();
    await wizard.createAgent(`E2E Prompt Save ${Date.now()}`);
    await wizard.goToPromptsStep();
  });

  test('admin edits the System Prompt in Create Agent, clicks Save and Close and the step shows the saved text', async ({
    createAgentWizardPage: wizard,
  }) => {
    const text = `System text ${Date.now()}`;
    const popup = await wizard.openPromptPopupAndType('system', text);
    const save = popup.getByRole('button', { name: 'Save', exact: true });
    await expect(save).toBeVisible();
    await save.click();
    await popup
      .getByRole('button', { name: 'Close', exact: true })
      .first()
      .click();
    await expect(popup).toBeHidden({ timeout: 15_000 });
    await expect(wizard.promptContent('system')).toHaveText(text, {
      timeout: 15_000,
    });
    await expect(wizard.dialog).toBeVisible();
  });

  test('admin edits the proactive prompt in Create Agent and Save keeps the text in the step', async ({
    createAgentWizardPage: wizard,
  }) => {
    const text = `proactive text ${Date.now()}`;
    const popup = await wizard.openPromptPopupAndType('proactive', text);
    await popup.getByRole('button', { name: 'Save', exact: true }).click();
    await popup
      .getByRole('button', { name: 'Close', exact: true })
      .first()
      .click();
    await expect(popup).toBeHidden({ timeout: 15_000 });
    await expect(wizard.promptContent('proactive')).toHaveText(text, {
      timeout: 15_000,
    });
  });

  test('admin presses Escape in the System Prompt popup and the popup closes', async ({
    page,
    createAgentWizardPage: wizard,
  }) => {
    const popup = await wizard.openPromptPopupAndType(
      'system',
      `Escape text ${Date.now()}`,
    );
    await page.keyboard.press('Escape');
    await expect(popup).toBeHidden({ timeout: 10_000 });
    await expect(wizard.dialog).toBeVisible();
  });
});
