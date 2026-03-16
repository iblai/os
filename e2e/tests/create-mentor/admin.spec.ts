import { test, expect, Page } from '@playwright/test';
import {
  MENTOR_NEXTJS_HOST,
  NEW_MENTOR_DESCRIPTION,
  EMBED_URL,
  AUTH_HOST,
} from '../utils';
import { checkAdminStatus, selectDropdownWorksCorrectly } from '../utils';
import { NEW_MENTOR_NAME } from '../utils';
import { logger } from '@iblai/iblai-js/playwright';
import { navigateToLLMTab } from '../utils/navigate/navigate-to-llm-tab';
import { checkStudentDropdownMenu } from '../utils/check-student-dropdown-menu';
import {
  clickAndAssert,
  EditMentor,
  testEmbedWithCss,
  testEmbedWithJs,
} from '../subscription/utils';
import { navigateToMentorApp } from '../profile/helpers';
import { fillCreateMentorForm } from '../utils/create-mentor';

const password: string = process.env.PLAYWRIGHT_PASSWORD || '';
const username: string = process.env.PLAYWRIGHT_USERNAME || '';
const ADVANCED_CSS_COLOR1 = `.chat-submit-message-button {
  background-color: red !important;
  background-image: none !important;
}`;

const mentorName = `mentor-${Date.now()}`;

const EXPECTED_BUTTON_COLOR1 = 'rgb(255, 0, 0)';
const MODERATION_PROMPT_EDIT =
  'You are a moderator. Mark a user’s prompt as inappropriate if it contains abusive language, harmful content, or promotes illegal activity. Otherwise, mark it as appropriate.';
const ADVANCED_CSS_COLOR2 = ' ';

// Advanced JavaScript test constants
const ADVANCED_JS_VALID = `(function() {
  console.log('Custom mentor script loaded');
  alert('Custom JavaScript Loaded Successfully');
})();`;

const ADVANCED_JS_WITH_WARNINGS = `(function() {
  console.log('Script with warnings');
  var result = eval('1 + 1');
  document.body.innerHTML = '<div>Test</div>';
})();`;

const ADVANCED_JS_EMPTY = ' ';
const AddNewPromptText =
  'Help me create a daily study timetable for preparing for exams in two weeks.';
const systemPromptEdit =
  'You are a strict but kind mentor. Always explain step by step and ask if the student has understood before moving on.';

test.describe('Admin Activities', () => {
  test.setTimeout(300000);
  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
  });

  /* test.only('Create API Key dialog behaves correctly', async ({ page }) => {
    const btn =  page.locator('button[aria-label="Selected mentor dropdown button"]');
    await expect(btn).toBeVisible({timeout:15000});
    await btn.click();
    await expect(page.getByRole("menuitem", {name:"New chat"})).toBeVisible({ timeout: 10000 });
  
    const apiMenuItem = page.getByRole('menuitem', { name: 'API' });
    await apiMenuItem.click();
    await expect(page.getByText('Create New')).toBeVisible({ timeout: 10000 });
  
    await page.locator('button[data-slot="button"]:has-text("Create New")').click();
    const dialog = page.getByRole('dialog', { name: 'Create API Key' });
    await expect(dialog).toBeVisible({ timeout: 10000 });
  
    const nameInput = dialog.getByPlaceholder('API Key Name');
    const apiName = `AutomationKey${Date.now()}`;
    await nameInput.fill(apiName);
  
    
    const pickDateButton = dialog.getByRole('button', { name: /pick a date/i });
    await expect(pickDateButton).toBeVisible()
    await pickDateButton.click();

    // Calculate target date (today + 3 days)
    const today = new Date();
    console.log("###############current date", today)
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + 3);

    // Format to match the calendar's data-day format: DD/MM/YYYY
    const dd = String(targetDate.getDate()).padStart(2, '0');
    const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
    const yyyy = targetDate.getFullYear();
    const formattedDate = `${dd}/${mm}/${yyyy}`;

    console.log(`Looking for date button with data-day="${formattedDate}"`);

    // Wait for calendar to be ready
    const calendar = dialog.locator('[data-slot="calendar"]');
    await calendar.waitFor({ state: 'visible' });
    await page.waitForTimeout(500); // Give calendar time to fully render

    // Try to find the date button
    let dayButton = dialog.locator(`button[data-day="${formattedDate}"]:not([disabled])`);
    
    // If date not found, try navigating months
    let attempts = 0;
    const maxAttempts = 3;
    
    while (!(await dayButton.isVisible()) && attempts < maxAttempts) {
      console.log(`Attempt ${attempts + 1}: Date not in current month, navigating to next month`);
      
      // Check if next month button is available
      if (await dialog.getByRole('button', { name: /next month/i }).isVisible()) {
        // Re-locate element immediately before clicking to avoid stale element reference
        await dialog.getByRole('button', { name: /next month/i }).click();
        await page.waitForTimeout(500); // Wait for calendar to update
        
        // Re-check for the date button
        dayButton = dialog.locator(`button[data-day="${formattedDate}"]:not([disabled])`);
      } else {
        console.log('Next month button not available');
        break;
      }
      
      attempts++;
    }

    // Verify the date button is now visible
    if (!(await dayButton.isVisible())) {
      console.log('Failed to find date button after navigation attempts');
      
      // Debug: Log all available dates
      const allDates = await dialog.locator('button[data-day]').all();
      for (const date of allDates) {
        console.log({
          date: await date.getAttribute('data-day'),
          disabled: await date.getAttribute('disabled'),
          visible: await date.isVisible()
        });
      }
      
      throw new Error(`Could not find selectable date button for ${formattedDate}`);
    }

    // Final selection
    await dayButton.waitFor({ state: 'visible' });
    await dayButton.scrollIntoViewIfNeeded();
    await dayButton.click();
    
    console.log(`Successfully selected date: ${formattedDate}`);
  
    const submitButton = dialog.getByRole('button', { name: 'Submit' });
    await expect(submitButton).toBeEnabled();
    await submitButton.click();
  
    const apiKeyDialog = page.getByRole('dialog').filter({ hasText: 'API Key' });
    await expect(apiKeyDialog).toBeVisible({ timeout: 10000 });
  
    const closeButton = apiKeyDialog.getByRole('button', {
      name: 'Close',
      exact: true,
    }).or(apiKeyDialog.locator('button:has(svg.lucide-x)'));
  
    await closeButton.click();
  
    await expect(dialog.getByRole('button', { name: /close/i })).toBeVisible({ timeout: 5000 });
    await dialog.getByRole('button', { name: /close/i }).click();
    await expect(dialog).toBeHidden({ timeout: 5000 });
  
    await expect(page.getByText(apiName)).toBeVisible({ timeout: 10000 });
  });*/

  // This button was removed from the v3 from v0 (v0 the vercel application)
  // test('Admin in a tenant can create a mentor from the header', async ({
  //   page,
  // }) => {
  //   await page.waitForFunction(
  //     () => {
  //       return window.localStorage.getItem('current_tenant') !== null;
  //     },
  //     { timeout: 10000 }
  //   );

  //   // Debug: Log tenant info to verify admin status in CI logs
  //   const tenantRaw = await page.evaluate(() =>
  //     window.localStorage.getItem('current_tenant')
  //   );
  //   console.log('Tenant raw:', tenantRaw);

  //   const isAdmin = await page.evaluate(() => {
  //     const raw = window.localStorage.getItem('current_tenant');
  //     if (!raw) return false;
  //     try {
  //       const parsed = JSON.parse(raw);
  //       return parsed.is_admin === true;
  //     } catch {
  //       return false;
  //     }
  //   });

  //   console.log('Is Admin:', isAdmin);

  //   if (isAdmin) {
  //     const createBtn = page.getByRole('button', { name: 'Create' });
  //     await expect(createBtn).toBeVisible({ timeout: 10000 });
  //     await createBtn.click();
  //     await page
  //       .locator('text=Create Mentor')
  //       .waitFor({ state: 'visible', timeout: 10000 });
  //     const heading = page.getByRole('heading', { name: 'Create Mentor' });
  //     await heading.waitFor({ state: 'attached', timeout: 10000 });
  //     await heading.waitFor({ state: 'visible', timeout: 10000 });
  //     await fillMentorForm(page);
  //   } else {
  //     const createBtn = page.getByRole('button', { name: 'Create' });
  //     await expect(createBtn).not.toBeVisible({ timeout: 5000 });
  //   }
  // });

  test('Admin can update mentor profile, save and close modal', async ({
    page,
  }) => {
    const isAdmin = await checkAdminStatus(page);

    if (isAdmin) {
      await fillCreateMentorForm({ page });
      await selectDropdownWorksCorrectly(page);
      const settings = page.getByRole('menuitem', { name: 'Settings' });
      await expect(settings).toBeVisible({ timeout: 10000 });
      await settings.click();
      // Wait for settings dialog to appear
      await page.waitForTimeout(2000);

      const settingsDialog = page
        .locator('div[role="dialog"]')
        .filter({ hasText: 'Edit Mentor' });
      await expect(settingsDialog).toBeVisible({ timeout: 15000 });
      // Assume the modal is already open
      const nameInput = settingsDialog.getByPlaceholder('Mentor Name');
      const descriptionInput =
        settingsDialog.getByPlaceholder('Mentor Description');
      const saveButton = settingsDialog.getByRole('button', { name: 'Save' });
      const closeButton = settingsDialog.getByRole('button', {
        name: 'Close',
        exact: true,
      });

      await nameInput.fill('');
      for (const char of NEW_MENTOR_NAME) {
        await nameInput.type(char);
        await page.waitForTimeout(1000);
      }

      await descriptionInput.fill('');
      for (const char of NEW_MENTOR_DESCRIPTION) {
        await descriptionInput.type(char);
        await page.waitForTimeout(1000);
      }

      const categoryDropdown = page.getByRole('combobox', {
        name: 'Select a category',
      });
      await expect(categoryDropdown).toBeVisible({ timeout: 5000 });
      await categoryDropdown.click();
      const firstCategoryOption = page.locator('div[role="option"]').first();
      await expect(firstCategoryOption).toBeVisible({ timeout: 5000 });
      await firstCategoryOption.waitFor({ state: 'visible' });
      await firstCategoryOption.click();
      const firstCategoryOptionLabel = await firstCategoryOption.textContent();

      await expect(categoryDropdown).toHaveText(firstCategoryOptionLabel || '');
      await page.keyboard.press('Escape');

      const visibilityDropdown = page.getByRole('combobox', {
        name: 'Select Who Can View',
      });
      await expect(visibilityDropdown).toBeVisible({ timeout: 120_000 });
      await visibilityDropdown.click();

      const studentsOption = page.locator('div[role="option"]', {
        hasText: 'Students',
      });
      await expect(studentsOption).toBeVisible({ timeout: 5000 });
      await studentsOption.waitFor({ state: 'visible' });
      await studentsOption.click();
      await expect(visibilityDropdown).toHaveText(/Students/);
      await saveButton.click();

      await page.waitForTimeout(3000);

      await expect(nameInput).toHaveValue(NEW_MENTOR_NAME);
      await expect(descriptionInput).toHaveValue(NEW_MENTOR_DESCRIPTION);

      await closeButton.click();

      await expect(settingsDialog).toBeHidden({ timeout: 120000 });
    } else {
      await selectDropdownWorksCorrectly(page);
      await expect(
        page.getByRole('menuitem', { name: 'Settings' })
      ).not.toBeVisible();
    }
  });

  test('Admin can change LLM configuration', async ({ page }) => {
    const isAdmin = await checkAdminStatus(page);

    if (isAdmin) {
      // Navigate to the LLM tab
      await navigateToLLMTab({ page });
      // Click on the OpenAI provider
      const openAIProvider = page.getByText('OpenAI');
      await expect(openAIProvider).toBeVisible({ timeout: 60_000 });
      await openAIProvider.click();

      const llmProviderSelectionModal = page.getByRole('dialog', {
        name: 'LLM Selection',
      });
      await expect(llmProviderSelectionModal).toBeVisible();

      const modelsThatCanBeSelected = llmProviderSelectionModal.locator(
        'button.cursor-pointer'
      );

      const modelsThatCanBeSelectedCount =
        await modelsThatCanBeSelected.count();

      // Click the first non-disabled button
      for (let i = 0; i < modelsThatCanBeSelectedCount; i++) {
        const modelThatCanBeSelected = modelsThatCanBeSelected.nth(i);
        if (!(await modelThatCanBeSelected.isDisabled())) {
          await modelThatCanBeSelected.click();

          await expect(modelThatCanBeSelected).toHaveClass(/border-blue-500/, {
            timeout: 60_000,
          });

          await expect(modelThatCanBeSelected).toHaveClass(/bg-blue-50/, {
            timeout: 10_000,
          });
          break;
        }
      }

      const closeButton = page.getByRole('button', { name: 'Close' });
      await expect(closeButton).toBeVisible();

      await closeButton.click();

      const llmTabHeading = page.getByRole('heading', {
        name: 'LLM Configuration',
      });

      await expect(llmTabHeading).toBeVisible();
    } else {
      await checkStudentDropdownMenu({ page });
    }
  });
});

test.describe.serial('Mentor Tools Tab', () => {
  test.setTimeout(200000);
  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
  });

  test('Activate tools and close modal', async ({ page }) => {
    const isAdmin = await checkAdminStatus(page);

    const TIMEOUT = process.env.CI ? 15000 : 5000;

    if (isAdmin) {
      await selectDropdownWorksCorrectly(page);

      const tools = page.getByRole('menuitem', { name: 'Tools' });
      await tools.click();

      const modal = page.getByRole('heading', { name: 'Edit Mentor' });
      await expect(modal).toBeVisible({ timeout: TIMEOUT });

      const toolsToActivate = [
        // 'Wikipedia Search',
        // 'Web Search',
        // 'Code Interpreter',
        // 'MCP',
      ];

      for (const toolName of toolsToActivate) {
        const toggleSwitch = page.getByRole('switch', {
          name: new RegExp(toolName),
        });

        // Wait for switch to be visible and enabled
        const isAvailable = await toggleSwitch.isVisible().catch(() => false);
        if (!isAvailable) {
          console.log(`Skipping ${toolName} - not available on page`);
          continue;
        }

        await toggleSwitch.waitFor({ state: 'visible', timeout: TIMEOUT });

        // Helper function for clicking and waiting for state
        const clickAndAssert = async (expected: boolean) => {
          await toggleSwitch.click();
          await expect(toggleSwitch).toHaveAttribute(
            'aria-checked',
            String(expected),
            {
              timeout: TIMEOUT,
            }
          );
          if (expected) {
            await expect(toggleSwitch).toHaveClass(/bg-blue-500/, {
              timeout: TIMEOUT,
            });
          }
        };

        // Check current state and toggle accordingly
        const isChecked =
          (await toggleSwitch.getAttribute('aria-checked')) === 'true';

        if (!isChecked) {
          await clickAndAssert(true); // turn on
          await clickAndAssert(false); // turn off
        } else {
          await clickAndAssert(false); // turn off
          await clickAndAssert(true); // turn on
        }
      }
      const closeButton = page.getByRole('button', { name: 'Close' });
      await closeButton.click();
      await expect(modal).toBeHidden({ timeout: TIMEOUT });
    } else {
      await selectDropdownWorksCorrectly(page);
      await expect(
        page.getByRole('menuitem', { name: 'Tools' })
      ).not.toBeVisible({ timeout: TIMEOUT });
    }
  });

  test.skip('mentor can generate image if image generation tool is enabled', async ({
    page,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    const TIMEOUT = process.env.CI ? 15000 : 5000;

    if (isAdmin) {
      // Open mentor dropdown menu
      const mentorMenuItems = page.getByRole('button', {
        name: 'Selected mentor dropdown',
      });
      await expect(mentorMenuItems).toBeVisible({ timeout: 20000 });
      await mentorMenuItems.click();

      // Select LLM provider tab
      const llmProviderTab = page.getByRole('menuitem', { name: 'LLM' });
      await expect(llmProviderTab).toBeVisible();
      await llmProviderTab.click();

      // Select OpenAI llm
      const openaiModelButton = page
        .locator('div')
        .filter({ hasText: /^OpenAI$/ })
        .first();
      await expect(openaiModelButton).toBeVisible();
      await openaiModelButton.click();

      // Select the OpenAI GPT model
      const llmModel = page.getByRole('button', {
        name: 'OpenAI icon gpt-4o-mini',
      });
      await expect(llmModel).toBeVisible();

      // Check if model is already selected
      const modelIsAlreadySelected = await llmModel.isDisabled();

      // Click to select model if not already selected
      if (!modelIsAlreadySelected) {
        await llmModel.click();
      }

      // Close LLM modal

      const closeButton = page.getByRole('button', { name: 'Close' });
      await expect(closeButton).toBeVisible();
      await closeButton.click();

      // Close menuItem modal
      await closeButton.click();

      // Reopen mentor dropdown menu
      await mentorMenuItems.click();

      // Navigate to Tools tab
      const toolsButton = page.getByRole('menuitem', { name: 'Tools' });
      await toolsButton.click();

      // Wait for Edit Mentor modal to appear
      const modal = page.getByRole('heading', { name: 'Edit Mentor' });
      await expect(modal).toBeVisible({ timeout: TIMEOUT });

      // Locate Image Generation toggle switch
      const toggleImageGenerationSwitch = page.getByRole('switch', {
        name: 'Image Generation',
      });
      await expect(toggleImageGenerationSwitch).toBeVisible();

      // Check if Image Generation tool is enabled
      const isChecked =
        (await toggleImageGenerationSwitch.getAttribute('aria-checked')) ===
        'true';

      // Enable Image Generation if disabled
      if (!isChecked) {
        await clickAndAssert(true, toggleImageGenerationSwitch);
      }

      // Close Edit Mentor modal

      await closeButton.click();
      await expect(modal).toBeHidden();

      // Locate Image button and check span color
      const imageButton = page
        .getByRole('button', { name: 'Image', exact: true })
        .first();
      const span = imageButton.locator('span');
      const requiredColor = 'oklch(0.446 0.03 256.802)';

      const currentColor = await span.evaluate(
        (el) => window.getComputedStyle(el).color
      );
      console.log('Current span color:', currentColor);

      // Click Image button if span color is not as required
      if (currentColor === requiredColor) {
        console.log('✅ Span already has the required color, skipping click.');
      } else {
        console.log('🔄 Span color not as required, clicking the button...');
        await imageButton.click();

        await expect(async () => {
          const newColor = await span.evaluate(
            (el) => window.getComputedStyle(el).color
          );
          expect(newColor).toBe(requiredColor);
        }).toPass({ timeout: 25000 });

        console.log('✅ Span color changed to required color after click.');
      }

      // Fill in prompt to generate image
      const textarea = page.getByRole('textbox');
      await expect(textarea).toBeVisible({ timeout: 10000 });
      await textarea.fill('generate an image of a teacher in class');

      // Click Send button
      const sendButton = page.getByRole('button', { name: /send/i });
      await expect(sendButton).toBeEnabled({ timeout: 5000 });
      await sendButton.click();

      // Wait for generated image to appear in chat reply
      const replyLocator = page
        .locator('div.flex.items-start >> div:has(p)')
        .last();
      const imageLocator = replyLocator.locator('p img');
      await expect(imageLocator).toBeVisible({ timeout: 120000 });
    } else {
      // Non-admin users should not see Tools option
      await expect(
        page.getByRole('menuitem', { name: 'Tools' })
      ).not.toBeVisible({ timeout: TIMEOUT });
    }
  });

  //Add new prompt has been commented out since the updates omn the UI has not been adjusted yet

  /*test("test: Add New Prompt", async({page})=>{
    const isAdmin = await checkAdminStatus(page);
    await selectDropdownWorksCorrectly(page);
    if(isAdmin){
      await MenuItem(page, "Prompts");
      const grid = page.locator('div.grid');
      const addNewPrompt = grid.getByRole("button", {name:"Add New Prompt"});
      await expect(addNewPrompt).toBeVisible();
      await addNewPrompt.click();
      const addNewPromptModal = page.getByRole("dialog").filter({hasText:"Add New Prompt"});
      await addNewPromptModal.getByRole('combobox', { name: 'Select a category' }).click();
      await page.getByRole("option", {name:"Students"}).click(); 
      await addNewPromptModal.getByText("Add New Prompt").click()
      const editor = page.locator('div[contenteditable="true"]');
      await editor.focus();
      await editor.type(AddNewPromptText);
      await addNewPromptModal.getByRole('button', { name: 'Submit' }).click();
      await page.waitForTimeout(5000);
      await expect(editor).toHaveText(AddNewPromptText);
      await addNewPromptModal.getByRole('button', {name:"Close"}).click();
      await expect(addNewPromptModal).not.toBeVisible({timeout:5000})
    }
  });*/
  test('Advanced Css works correctly', async ({ page }) => {
    await testEmbedWithCss(page, ADVANCED_CSS_COLOR1, EXPECTED_BUTTON_COLOR1);
  });

  test('Reset advanced css updates', async ({ page }) => {
    await testEmbedWithCss(page, ADVANCED_CSS_COLOR2, 'rgba(0, 0, 0, 0)');
  });

  test('Advanced JavaScript works correctly', async ({ page }) => {
    await testEmbedWithJs(page, ADVANCED_JS_VALID, {
      expectValidation: true,
      expectAlert: true,
      expectedAlertMessage: 'Custom JavaScript Loaded Successfully',
    });
  });

  test('Advanced JavaScript shows warnings for risky patterns', async ({
    page,
  }) => {
    await testEmbedWithJs(page, ADVANCED_JS_WITH_WARNINGS, {
      expectValidation: true,
      expectWarnings: true,
    });
  });

  test('Reset advanced JavaScript updates', async ({ page }) => {
    await testEmbedWithJs(page, ADVANCED_JS_EMPTY);
  });

  test('user can edit prompt', async ({ page }) => {
    await EditMentor(page, 'Prompts', systemPromptEdit, 'Edit System Prompt');
  });

  test.skip('Update user management', async ({ page }) => {
    const isAdmin = await checkAdminStatus(page);
    const profileBtn = page.locator('nav button[aria-haspopup="menu"]').last();
    if (isAdmin) {
      await profileBtn.waitFor();
      await profileBtn.click();
      await expect(
        page.getByRole('menuitem', { name: 'Profile' })
      ).toBeVisible();
      const tenantBtn = page.getByRole('menuitem').nth(1);
      await expect(tenantBtn).toBeVisible();
      await tenantBtn.click();
      const dialog = page
        .getByRole('dialog')
        .filter({ hasText: 'organization' });
      await expect(dialog).toBeVisible();
      await page.getByRole('button', { name: 'Management' }).click();
      const userGrids = page.locator('.divide-y .grid.grid-cols-1');
      await expect(userGrids.first()).toBeVisible();
      const filteredUserGrids = userGrids.filter({ hasNotText: username });
      const gridCount = await filteredUserGrids.count();

      if (gridCount > 0) {
        const grid = await filteredUserGrids.first();
        const roleButton = grid.getByRole('combobox').nth(0);
        const roleBefore = await roleButton.locator('span').innerText();

        await roleButton.click();
        const newRole = roleBefore === 'Admin' ? 'Student' : 'Admin';
        await page.locator(`role=option[name="${newRole}"]`).click();
        await page.waitForTimeout(2000);
        await expect(roleButton).toContainText(newRole);

        // Toggle switch off
        const toggle = grid.locator('button[role="switch"]').first();
        await toggle.click();

        // Wait for THIS specific grid to be detached
        await expect(grid)
          .toBeHidden({ timeout: 5000 })
          .catch(() => {
            console.log(`Row did not hide, continuing...`);
          });
      }
    }
  });
});
