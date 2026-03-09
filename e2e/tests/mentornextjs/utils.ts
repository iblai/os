import { Page, Locator, expect } from '@playwright/test';
import { logger } from '@iblai/iblai-js/playwright';
const EMBED_URL = process.env.EMBED_URL || '';
import AxeBuilder from '@axe-core/playwright';
import { MENTOR_NEXTJS_HOST } from '../utils';
import {
  closeWithEsc,
  safeWaitForURL,
} from '@iblai/iblai-js/playwright';
import type { Page } from '@playwright/test';

/** Mentor-specific: toggle the instructor/learner mode switch in the nav bar */
export async function switchInstructorLearnerMode(page: Page) {
  const switchButton = page.getByRole('navigation').getByRole('switch');
  await switchButton.click();
  await page.waitForTimeout(500);
}
import type { RuleObject } from 'axe-core';
const test_settings = {
  test_user_email: process.env.PLAYWRIGHT_USERNAME || '',
  test_user_password: process.env.PLAYWRIGHT_PASSWORD || '',
  auth_url: process.env.AUTH_HOST || '',
};
const STUDENT_MODE = 'student';
const INSTRUCTOR_MODE = 'instructor';
let isAdmin = false;
let currentMode = STUDENT_MODE;

export async function authenticate(
  page: Page,
  initialUrl: string = '/',
  email: string = test_settings.test_user_email,
  password: string = test_settings.test_user_password,
  navigateToAuthPage = true
) {
  if (navigateToAuthPage) {
    // Navigate to the specified page
    await page.goto(initialUrl, { waitUntil: 'domcontentloaded' });
    // Wait for auth page to be ready by checking for the login button
    await expect(
      page.getByRole('button', { name: 'Continue with Password' })
    ).toBeVisible({ timeout: 30000 });
  }

  // Check if we were redirected to the auth page
  const currentUrl = page.url();

  if (currentUrl.includes(test_settings.auth_url)) {
    // Click the "Continue with Password" button first
    await page.click('button:has-text("Continue with Password")');

    // Wait for the password form to appear (state-based wait instead of arbitrary timeout)
    await expect(page.locator('input[type="email"]')).toBeVisible({
      timeout: 10000,
    });

    // Fill in the login credentials
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);

    // Click the login button
    await page.click('button:has-text("Continue")');

    // Wait for the login to complete
    await safeWaitForURL(page, `${test_settings.auth_url}/login/complete`, {
      timeout: 60000,
    });

    // Wait for the SSO redirect - use a more flexible pattern that doesn't depend on specific domain
    logger.info('Waiting for SSO redirect...');
    await safeWaitForURL(page, '**/sso-login-complete?data=*', {
      timeout: 60000,
    });

    // Wait for the final redirect to the platform page - use a more flexible pattern
    logger.info('Waiting for platform redirect...');
    await safeWaitForURL(page, '**/platform/*/*', { timeout: 60000 });
    // Wait for the mentor settings dropdown to confirm platform is ready
    await expect(
      page.getByRole('button', { name: 'Selected mentor dropdown button' })
    ).toBeVisible({ timeout: 30000 });

    logger.info('Authentication completed successfully');
  }
}

/**
 * Re-authenticate on a page that has already been redirected to the auth SPA
 * (e.g. because stored tokens expired mid-test-run).
 *
 * Unlike {@link authenticate}, this only waits for the final /platform URL
 * and does not assert intermediate SSO redirect URLs, making it resilient
 * to differences in the redirect chain between initial login and re-login.
 */
export async function reAuthenticate(
  page: Page,
  platformUrl: string
): Promise<void> {
  logger.info('[reAuthenticate] Tokens expired – re-authenticating…');
  await page.click('button:has-text("Continue with Password")');
  await expect(page.locator('input[type="email"]')).toBeVisible({
    timeout: 10000,
  });
  await page.fill('input[type="email"]', test_settings.test_user_email);
  await page.fill('input[type="password"]', test_settings.test_user_password);
  await page.click('button:has-text("Continue")');
  await safeWaitForURL(page, (url) => url.href.startsWith(platformUrl), {
    timeout: 80000,
  });
  logger.info('[reAuthenticate] Re-authentication completed');
}

// ===== RELIABLE ELEMENT INTERACTION HELPERS =====

/**
 * Wait for element to be visible and stable before interacting
 */
export async function waitForElementStable(
  page: Page,
  locator: Locator,
  timeout: number = 10000
): Promise<Locator> {
  // Wait for element to be attached to DOM
  await locator.waitFor({ state: 'attached', timeout });

  // Wait for element to be visible
  await expect(locator).toBeVisible({ timeout });

  // Wait for element to be stable (not moving/changing)
  await page.waitForTimeout(500);

  return locator;
}

/**
 * Click element with retry logic and proper waiting
 */
export async function reliableClick(
  page: Page,
  locator: Locator,
  timeout: number = 10000,
  maxRetries: number = 3
): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Wait for element to be stable
      await waitForElementStable(page, locator, timeout);

      // Scroll into view if needed
      await locator.scrollIntoViewIfNeeded();

      // Wait a bit more for any animations
      await page.waitForTimeout(200);

      // Click with force if needed
      await locator.click({ force: true });

      // Success - break out of retry loop
      break;
    } catch (error) {
      console.log(`Click attempt ${attempt} failed:`, error.message);

      if (attempt === maxRetries) {
        throw new Error(
          `Failed to click element after ${maxRetries} attempts: ${error.message}`
        );
      }

      // Wait before retry
      await page.waitForTimeout(1000);
    }
  }
}

/**
 * Fill input with retry logic and validation
 */
export async function reliableFill(
  page: Page,
  locator: Locator,
  value: string,
  timeout: number = 10000,
  maxRetries: number = 3
): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Wait for element to be stable
      await waitForElementStable(page, locator, timeout);

      // Clear the field first
      await locator.clear();

      // Fill the value
      await locator.fill(value);

      // Verify the value was set correctly
      const actualValue = await locator.inputValue();
      if (actualValue !== value) {
        throw new Error(
          `Value mismatch: expected "${value}", got "${actualValue}"`
        );
      }

      // Success - break out of retry loop
      break;
    } catch (error) {
      console.log(`Fill attempt ${attempt} failed:`, error.message);

      if (attempt === maxRetries) {
        throw new Error(
          `Failed to fill element after ${maxRetries} attempts: ${error.message}`
        );
      }

      // Wait before retry
      await page.waitForTimeout(1000);
    }
  }
}

/**
 * Wait for dialog to be fully loaded and stable
 */
export async function waitForDialogReady(
  page: Page,
  dialogLocator: Locator,
  timeout: number = 15000
): Promise<Locator> {
  // Wait for dialog to appear
  await expect(dialogLocator).toBeVisible({ timeout });

  // Wait for dialog content to be loaded by checking for common dialog elements
  // This is more reliable than networkidle for SPAs
  await page.waitForLoadState('domcontentloaded', { timeout });

  // Wait for any animations to complete
  await page.waitForTimeout(1000);

  return dialogLocator;
}

/**
 * Select date from calendar with robust logic
 */
export async function selectDateFromCalendar(
  page: Page,
  dialogLocator: Locator,
  targetDate: Date,
  timeout: number = 15000
): Promise<void> {
  // Format date for calendar (DD/MM/YYYY)
  const dd = String(targetDate.getDate()).padStart(2, '0');
  const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
  const yyyy = targetDate.getFullYear();
  const formattedDate = `${dd}/${mm}/${yyyy}`;

  console.log(`Attempting to select date: ${formattedDate}`);

  // Wait for calendar to be ready
  const calendar = dialogLocator.locator('[data-slot="calendar"]');
  await calendar.waitFor({ state: 'visible', timeout });
  await page.waitForTimeout(1000); // Extra time for calendar rendering

  // Try multiple date formats if the first doesn't work
  const dateFormats = [
    formattedDate, // DD/MM/YYYY
    `${mm}/${dd}/${yyyy}`, // MM/DD/YYYY
    `${yyyy}-${mm}-${dd}`, // YYYY-MM-DD
  ];

  let dayButton: Locator | null = null;

  for (const format of dateFormats) {
    dayButton = dialogLocator.locator(
      `button[data-day="${format}"]:not([disabled])`
    );

    if (await dayButton.isVisible()) {
      console.log(`Found date with format: ${format}`);
      break;
    }
  }

  // If date not found, try navigating months
  if (!dayButton || !(await dayButton.isVisible())) {
    console.log('Date not in current month, attempting navigation...');

    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      // Try next month
      const nextMonthButton = dialogLocator.getByRole('button', {
        name: /next month/i,
      });
      if (await nextMonthButton.isVisible()) {
        await reliableClick(page, nextMonthButton);
        await page.waitForTimeout(1000);

        // Re-check for the date button with all formats
        for (const format of dateFormats) {
          dayButton = dialogLocator.locator(
            `button[data-day="${format}"]:not([disabled])`
          );
          if (await dayButton.isVisible()) {
            console.log(`Found date after navigation with format: ${format}`);
            break;
          }
        }

        if (dayButton && (await dayButton.isVisible())) {
          break;
        }
      } else {
        console.log('Next month button not available');
        break;
      }

      attempts++;
    }
  }

  // Final verification and selection
  if (!dayButton || !(await dayButton.isVisible())) {
    // Debug: Log all available dates
    const allDates = await dialogLocator.locator('button[data-day]').all();
    console.log('Available dates:');
    for (const date of allDates) {
      const dateAttr = await date.getAttribute('data-day');
      const disabled = await date.getAttribute('disabled');
      const visible = await date.isVisible();
      console.log({ date: dateAttr, disabled, visible });
    }

    throw new Error(
      `Could not find selectable date button for ${formattedDate}`
    );
  }

  // Select the date
  await reliableClick(page, dayButton);
  console.log(`Successfully selected date: ${formattedDate}`);
}

/**
   * Waits for a page to be fully ready before running further tests or interactions.
   *
   * This is designed for modern SPAs (like Next.js) where network requests
   * can continue indefinitely (polling, analytics, streaming data).
   *
   * Why this approach is better than waiting for 'networkidle':
   * 1. SPAs may keep making background requests; 'networkidle' can timeout and fail tests.
   * 2. DOM readiness is deterministic and stable: once `document.readyState === 'complete'`,
   *    the main page content is fully loaded.
   * 3. A small extra wait ensures animations, lazy-loaded content, or dynamic rendering are visible.
   *
   * Benefits:
   * - Reliable across browsers and SPA pages.
   * - Avoids flaky tests caused by long-running or repeated network calls.
   * - Simple and predictable for other developers to understand.
   *

   */
export async function waitForPageReady(
  page: Page,
  timeout: number = 30000
): Promise<void> {
  // Step 1: Wait for the DOM to be fully loaded
  // This ensures all HTML, scripts, and synchronous resources are finished loading
  await page.waitForFunction(() => document.readyState === 'complete', {
    timeout,
  });

  // Step 2: Optional wait for animations or lazy-loaded elements
  // Some components (like modals, cards, or skeleton loaders) may render slightly later
  await page.waitForTimeout(2000);
}

/**
 * Check if user is admin with proper error handling
 */

export async function checkAdminStatus(page: Page): Promise<boolean> {
  try {
    await page.waitForFunction(
      () => {
        return window.localStorage.getItem('current_tenant') !== null;
      },
      { timeout: 10000 }
    );

    const isAdmin = await page.evaluate(() => {
      const raw = window.localStorage.getItem('current_tenant');
      if (!raw) return false;
      try {
        const parsed = JSON.parse(raw);
        return parsed.is_admin === true;
      } catch {
        return false;
      }
    });

    console.log('Admin status check result:', isAdmin);
    return isAdmin;
  } catch (error) {
    console.log('Error checking admin status:', error.message);
    return false;
  }
}

export async function getCurrentTenant() {
  try {
    return window.localStorage.getItem('tenant');
  } catch (error) {
    console.log('Error getting current tenant:', error.message);
    return false;
  }
}

export async function getCurrentPlatformName(page: Page) {
  // Get platform name from localStorage
  return await page.evaluate(() => {
    const currentTenant = localStorage.getItem('current_tenant');
    if (currentTenant) {
      try {
        const tenant = JSON.parse(currentTenant);
        return tenant?.platform_name;
      } catch (e) {
        return null;
      }
    }
    return null;
  });
}

export async function injectAndVerifyChatWidget(page: Page) {
  const codeDialog = page.locator(
    'div[role="dialog"]:has-text("Embedded Code")'
  );
  await expect(codeDialog).toBeVisible();
  const preLocator = codeDialog.locator('pre');
  await expect(preLocator).toBeVisible({ timeout: 15000 });
  const copyButton = codeDialog
    .locator('button[data-slot="button"] svg.lucide-copy')
    .locator('..');
  await expect(copyButton).toBeVisible();
  await copyButton.click();
  const embedCode = (await preLocator.textContent()) || '';

  const extractedEmbedCode = embedCode.match(
    /window\.onload\s*=\s*function\s*\(\)\s*{([\s\S]*?)}\s*;?\s*<\/script>/i
  );
  const extractedScriptBody = extractedEmbedCode?.[1]?.trim();
  if (!extractedScriptBody) {
    throw new Error('Failed to extract content from window.onload');
  }

  logger.info('Extracted Script Content Length:', extractedScriptBody.length);

  // Step 3: Open a new page and inject the script
  const newPage = await page.context().newPage();
  await newPage.goto(EMBED_URL, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await newPage.waitForTimeout(2000);
  //injecting the extracted code in the diaplyed UI
  await newPage.addScriptTag({
    content: `(function() {\n${extractedScriptBody}\n})();`,
  });

  await newPage.waitForTimeout(10000);
  // Step 4: Wait for chat button to appear and click it
  await newPage.waitForSelector('.ibl-chat-bubble', { timeout: 10000 });
  const chatButton = newPage.getByRole('button', {
    name: 'Open chat assistant',
  });
  await expect(chatButton).toBeVisible({ timeout: 30000 });
  await chatButton.click();

  console.info('✅ Chat button clicked');

  await newPage.waitForTimeout(2000);

  // Step 5: Validate the chat widget container
  const widget = newPage.locator('#ibl-chat-widget-container');
  await expect(widget).toBeVisible();

  const secondIframe = widget.frameLocator('iframe').nth(0);

  // Step 7: Validate elements inside the iframe
  const navName = secondIframe.locator('nav h1');
  await expect(navName).toBeVisible({ timeout: 10000 });

  const closeButton = secondIframe.getByRole('button', { name: /close chat/i });
  await expect(closeButton).toBeVisible();

  const bodyName = secondIframe.locator('.chat-main-content-area h1');
  await expect(bodyName).toBeVisible();

  const bodyText = await bodyName.textContent();
  const navText = await navName.textContent();

  expect(navText?.trim()).toBe(bodyText?.trim());

  logger.info(' Chat loaded and text content verified');

  const text = 'hellow whats IBL all about?';

  const textArea = secondIframe.locator(
    'textarea[placeholder]:not([placeholder=""])'
  );
  await expect(textArea).toBeVisible();
  await expect(textArea).toHaveAttribute('placeholder', /.+/);
  const sendButton = secondIframe.getByRole('button', {
    name: /send message/i,
  });

  await textArea.fill(text);
  await expect(sendButton).toBeEnabled();
  // Wait for the reducers to be stable (to be improved)
  await newPage.waitForTimeout(5000);
  await sendButton.click();
  await newPage.waitForTimeout(5000);

  const userMessage = secondIframe.locator('.chat-user-message-query', {
    hasText: text,
  });
  const mentorResponse = secondIframe.locator('.chat-ai-message-response');
  await expect(userMessage).toBeVisible({ timeout: 10000 });
  await expect(mentorResponse).toBeVisible({ timeout: 20000 });

  // 5. Check user message layout
  const userLayout = await userMessage.evaluate((el) => {
    const elem = el as HTMLElement;
    return {
      scrollWidth: elem.scrollWidth,
      clientWidth: elem.clientWidth,
      height: elem.offsetHeight,
      overflows: elem.scrollWidth > elem.clientWidth,
    };
  });

  expect(userLayout.overflows).toBe(false);
  expect(userLayout.height).toBeGreaterThan(10);

  // 6. Check mentor message layout
  const mentorLayout = await mentorResponse.evaluate((el) => {
    const elem = el as HTMLElement;
    return {
      scrollWidth: elem.scrollWidth,
      clientWidth: elem.clientWidth,
      height: elem.offsetHeight,
      overflows: elem.scrollWidth > elem.clientWidth,
    };
  });

  expect(mentorLayout.overflows).toBe(false);
  expect(mentorLayout.height).toBeGreaterThan(10);

  await closeButton.click();
  await expect(widget).not.toBeVisible({ timeout: 30_000 });
  return newPage;
}

export async function openEmbedDialog(page: Page) {
  // Click Embed menu item
  const apiMenuItem = page.getByRole('menuitem', { name: 'Embed' });
  await expect(apiMenuItem).toBeVisible();
  await apiMenuItem.click();

  // Validate dialog and iframe
  const embedDialog = page.locator('div[role="dialog"]');
  await expect(embedDialog).toBeVisible();
  const iframe = embedDialog.frameLocator('iframe');
  await expect(iframe.locator('body')).toBeVisible({ timeout: 10000 });
  const placeholder = await iframe.getAttribute('placeholder');
  expect(placeholder && placeholder.length > 3).toBeTruthy();

  // Check send button is disabled
  const sendButton = iframe.locator('button[aria-label="Send message"]');
  await expect(sendButton).toBeDisabled({ timeout: 120000 });

  // Validate "Who Can Chat?" dropdown and set to "Anyone" (anonymous mode)
  const whoCanChatSelect = embedDialog.getByRole('combobox', {
    name: 'Select who can chat',
  });
  await expect(whoCanChatSelect).toBeVisible();

  // Click to open the dropdown
  await whoCanChatSelect.click();

  // Select "Anyone" option (this enables anonymous mode)
  const anyoneOption = page.getByRole('option', { name: 'Anyone' });
  await expect(anyoneOption).toBeVisible();
  await anyoneOption.click();

  // Click Create Embed button
  const createEmbedBtn = page.getByRole('button', { name: 'Create Embed' });
  await expect(createEmbedBtn).toBeEnabled();
  await createEmbedBtn.click();
}

export async function expectNoAccessibilityViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .options({
      rules: {
        'color-contrast': { enabled: false },
      },
    })
    .analyze();

  expect(results.violations).toEqual([]);
}

export async function expectNoAccessibilityViolationsOnDialogs(
  page: Page,
  rules?: RuleObject,
  exclude: string[] = ['#embed-mentor-preview']
) {
  // Wait for dialog to be visible before running AxeBuilder to avoid
  // "No elements found for include in page Context" error
  const dialogLocator = page.locator('[role="dialog"]');
  try {
    await expect(dialogLocator.first()).toBeVisible({ timeout: 10000 });
  } catch {
    // Log debugging info to help identify the issue
    const pageUrl = page.url();
    const dialogCount = await dialogLocator.count();
    console.log(`[expectNoAccessibilityViolationsOnDialogs] Debug info:
      - Page URL: ${pageUrl}
      - Dialog count: ${dialogCount}`);
    throw new Error(
      'expectNoAccessibilityViolationsOnDialogs: No visible element with [role="dialog"] found on page. ' +
        `Page URL: ${pageUrl}. Ensure the dialog is visible and has role="dialog" attribute.`
    );
  }

  const results = await new AxeBuilder({ page })
    .include('[role="dialog"]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .options({
      rules: {
        'color-contrast': { enabled: false },
        ...rules,
      },
    })
    .exclude(exclude)
    .analyze();
  expect(results.violations).toEqual([]);
}

export async function expectMentorTextsVisible(page: Page) {
  await expect(
    page.getByRole('heading', {
      name: 'Discover and create academic mentors that combine',
    })
  ).toBeVisible({ timeout: 15000 });

  await expect(
    page.getByText(
      'subject expertise, educational resources, and teaching skills'
    )
  ).toBeVisible({ timeout: 15000 });
}

export async function toggleSidebar(page: Page) {
  const menuButton = page.getByRole('button', {
    name: /(Close|Open) sidebar/i,
  });
  await page.waitForLoadState('domcontentloaded');
  await expect(menuButton).toBeVisible({ timeout: 30_000 });
  await menuButton.click();

  const sideBarDialog = page.getByRole('dialog');
  return sideBarDialog;
}

export async function searchMentor(page: Page) {
  const searchInput = page.getByRole('textbox', { name: 'Search mentors' });
  await expect(searchInput).toBeVisible({ timeout: 10000 });

  // Perform search with an existing mentor name
  const searchQuery = 'mentor';
  await searchInput.fill(searchQuery);

  //name should start with Explore mentor: and
  const resultsCard = page
    .getByRole('listitem', {
      name: new RegExp(`^Explore mentor:.*$`),
    })
    .first();
  await expect(resultsCard).toBeVisible({ timeout: 60000 });

  // Clear the search
  await searchInput.clear();
  // Wait for the mentor cards to reappear after clearing search
  await expect(
    page.getByLabel('Mentor exploration page').locator('h3').first()
  ).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(1000);

  // Verify initial display is restored (mentors list should be back)
  const afterClearMentorCards = page
    .getByLabel('Mentor exploration page')
    .locator('h3');
  const afterClearCount = await afterClearMentorCards.count();
  expect(afterClearCount).toBeGreaterThan(0);

  // Verify the search input is empty
  const searchValue = await searchInput.inputValue();
  expect(searchValue).toBe('');
}

export async function switchBetweenTabs(page: Page) {
  await expect(page.getByRole('heading', { name: 'All Mentors' })).toBeVisible({
    timeout: 10000,
  });

  // Switch to Learning tab
  await page.getByRole('tab', { name: 'Learning' }).click();
  await page.waitForTimeout(3000); // allow transition
  // Wait for tab content to load - either mentors or "no mentors" message
  await page.waitForLoadState('domcontentloaded');

  const hasNoMentorsMessage = page
    .locator('div')
    .filter({
      hasText: /^Sorry, no mentors found!$/,
    })
    .first();

  // Verify Learning Mentors content
  const learningMentors = page.locator('text=Learning Mentors');
  const hasLearningMentors = await learningMentors
    .waitFor({ state: 'visible', timeout: 20000 })
    .catch(() => false)
    .then(() => true);

  if (!hasLearningMentors) {
    await expect(hasNoMentorsMessage).toBeVisible();
    console.log('No mentors found message is visible');
  }

  // Switch to Advising tab
  await page.getByRole('tab', { name: 'Advising' }).click();
  await page.waitForTimeout(1000); // allow transition
  // Wait for tab content to load
  await page.waitForLoadState('domcontentloaded');

  // Safely check for Advising mentors or fallback message
  const advisingMentors = page.locator('text=Advising Mentors');

  const hasAdvisingMentors = await advisingMentors
    .waitFor({ state: 'visible', timeout: 15000 })
    .then(() => true)
    .catch(() => false);

  if (!hasAdvisingMentors) {
    await expect(hasNoMentorsMessage).toBeVisible();
    console.log('No mentors found message is visible');
  }
}

export async function mentorCardDisplay(page: Page) {
  // Wait for the "All Mentors" section to be visible first
  const allMentorsHeading = page.getByRole('heading', { name: 'All Mentors' });
  await expect(allMentorsHeading).toBeVisible({ timeout: 30000 });

  // Wait for the mentor list to be populated
  const mentorsList = page.getByLabel('All mentors');
  await expect(mentorsList).toBeVisible({ timeout: 30000 });

  const mentorsCards = page.getByRole('listitem', {
    name: new RegExp(`^Explore mentor:.*$`),
  });

  await expect(mentorsCards.first()).toBeVisible({ timeout: 60000 });

  const count = await mentorsCards.count();

  for (let i = 0; i < count; i++) {
    const card = mentorsCards.nth(i);
    await expect(card).toBeVisible({ timeout: 10000 });
    const cardH3 = card.locator('h3');
    const cardH3Text = (await cardH3.textContent()) || '';
    await expect(cardH3).toBeVisible({ timeout: 10000 });

    const cardImageIsVisible = await card.locator('img').isVisible();
    const cardImageTextFallbackIsVisible = await card
      .getByText(cardH3Text.substring(0, 2).toUpperCase(), {
        exact: true,
      })
      .isVisible();

    const cardImageContentIsVisible =
      cardImageIsVisible || cardImageTextFallbackIsVisible;

    expect(cardImageContentIsVisible).toBe(true);

    // We expect at least 2 paragraphs in the card
    // 1. Description
    // 2. Recently accessed at (optional)
    const paragraphs = card.locator('p');
    const numberOfParagraphsInCard = await paragraphs.count();
    expect(numberOfParagraphsInCard).toBeGreaterThan(0);
    expect(numberOfParagraphsInCard).toBeLessThan(3);
  }
}

export async function loadMoreMentors(page: Page) {
  // Wait for the "All Mentors" section to be visible first
  const allMentorsHeading = page.getByRole('heading', { name: 'All Mentors' });
  await expect(allMentorsHeading).toBeVisible({ timeout: 30000 });

  // Wait for the mentor list to be populated
  const mentorsList = page.getByLabel('All mentors');
  await expect(mentorsList).toBeVisible({ timeout: 30000 });

  // On the explore page, mentor cards are listitem elements
  const mentorsCards = page.getByRole('listitem', {
    name: new RegExp(`^Explore mentor:.*$`),
  });

  // Wait for the first mentor card to be visible
  await expect(mentorsCards.first()).toBeVisible({ timeout: 30000 });

  const initialCount = await mentorsCards.count();
  expect(initialCount).toBeGreaterThan(0);

  const seeMoreBtn = page.getByRole('button', { name: /see more/i }).last();

  const showMoreButtonIsVisible = await seeMoreBtn.isVisible();

  if (showMoreButtonIsVisible) {
    await expect(seeMoreBtn).toBeVisible();
    await seeMoreBtn.click();

    // Wait for mentors count to increase
    await expect(async () => {
      const updatedCount = await mentorsCards.count();
      expect(updatedCount).toBeGreaterThan(initialCount);
    }).toPass({ timeout: 30_000 });

    const finalCount = await mentorsCards.count();
    console.log('New mentors count:', finalCount);
  }
}

export async function NavigateToMentorPageOnClickingMentorCard(page: Page) {
  const mentorsCards = page.getByRole('button', {
    name: new RegExp(`^Explore mentor:.*$`),
  });
  const mentorCard = mentorsCards.first();
  const mentorName = await mentorCard.locator('h3').first().textContent();
  await expect(mentorCard).toBeVisible({ timeout: 10000 });
  await expect(mentorCard).toBeEnabled();

  await mentorCard.click();
  console.log('Mentor card clicked');
  await safeWaitForURL(page, /\/platform\/[^/]+\/[^/]+$/, { timeout: 15000 });

  await expect(page).toHaveURL(
    new RegExp(`^${MENTOR_NEXTJS_HOST}/platform/[^/]+/[^/]+$`),
    { timeout: 5000 }
  );

  await expect(
    page.getByRole('heading', { name: new RegExp(`^${mentorName}$`), level: 1 })
  ).toBeVisible({ timeout: 5000 });
}

/**
 * Test LLM Provider filter functionality
 */
export async function testLLMProviderFilter(page: Page) {
  // Click on LLM Provider filter button
  if (
    await page
      .getByRole('button', { name: 'LLM Provider' })
      .isVisible({ timeout: 10000 })
      .catch(() => false)
  ) {
    // Re-locate element immediately before clicking to avoid stale element reference
    await page.getByRole('button', { name: 'LLM Provider' }).click();
  } else {
    console.log('LLM Provider button not found - skipping');
    return;
  }

  // Wait for dropdown menu to appear
  const dropdownMenu = page.getByRole('menu', { name: 'LLM Provider' });
  await expect(dropdownMenu).toBeVisible({ timeout: 5000 });

  // Get available options
  const menuItems = dropdownMenu.getByRole('menuitem');
  const itemCount = await menuItems.count();
  expect(itemCount).toBeGreaterThan(0);

  // Click on first available option (e.g., 'openai')
  const firstOption = menuItems.first();
  const optionName = await firstOption.textContent();
  await firstOption.click();

  //press escape to close the dropdown
  await page.keyboard.press('Escape');

  // Verify filter is active - button should now show the selected option
  await expect(
    page
      .getByRole('button', {
        name: optionName?.trim() || 'LLM Provider',
        exact: true,
      })
      .first()
  ).toBeVisible({ timeout: 5000 });

  // Verify Clear All button appears
  const clearAllButton = page.getByRole('button', { name: 'Clear All' });
  await expect(clearAllButton).toBeVisible({ timeout: 5000 });

  // Clear the filter
  await clearAllButton.click();

  // Verify filter is reset
  /*   await expect(page.getByRole('button', { name: 'LLM Provider' })).toBeVisible({
    timeout: 5000,
  }); */

  // Verify Clear All button is gone
  await expect(clearAllButton).not.toBeVisible({ timeout: 3000 });
}

/**
 * Test CreatedBy filter - Me option
 */
export async function testCreatedByFilterMe(page: Page) {
  // Click on Created By filter button
  if (
    await page
      .getByRole('button', { name: 'Created By' })
      .isVisible({ timeout: 10000 })
      .catch(() => false)
  ) {
    // Re-locate element immediately before clicking to avoid stale element reference
    await page.getByRole('button', { name: 'Created By' }).click();
  } else {
    console.log('Created By button not found - skipping');
    return;
  }

  // Wait for dropdown menu to appear
  const dropdownMenu = page.getByRole('menu', {
    name: /Created By|Me|My Organization|Community/,
  });
  await expect(dropdownMenu).toBeVisible({ timeout: 5000 });

  // Check if 'Me' option exists
  const meOptionVisible = await page
    .getByRole('menuitem', { name: 'Me' })
    .isVisible()
    .catch(() => false);

  if (meOptionVisible) {
    // Re-locate element immediately before clicking to avoid stale element reference
    await page.getByRole('menuitem', { name: 'Me' }).click();
    await page.keyboard.press('Escape');

    // Wait for filter to be applied by checking for the 'Me' button
    await expect(
      page.getByRole('button', { name: 'Me', exact: true })
    ).toBeVisible({ timeout: 10000 });

    await page.keyboard.press('Escape');

    // Verify 'Me' filter is active
    await expect(
      page.getByRole('button', { name: 'Me', exact: true })
    ).toBeVisible({
      timeout: 5000,
    });

    // Verify only Custom section is visible (Featured and All Mentors should be hidden)
    await expect(
      page.getByRole('heading', { name: 'Custom', exact: true })
    ).toBeVisible({
      timeout: 10000,
    });

    await expect(
      page.getByRole('heading', { name: 'All Mentors', exact: true })
    ).not.toBeVisible({
      timeout: 10000,
    });

    await expect(
      page.getByRole('heading', { name: 'Featured', exact: true })
    ).not.toBeVisible({
      timeout: 10000,
    });

    // Verify Clear All button appears
    const clearAllButton = page.getByRole('button', { name: 'Clear All' });
    await expect(clearAllButton).toBeVisible({ timeout: 5000 });

    // Clear the filter
    await clearAllButton.click();
    // Wait for the Created By button to reappear after clearing filters
    await expect(page.getByRole('button', { name: 'Created By' })).toBeVisible({
      timeout: 10000,
    });
  } else {
    // Close dropdown if 'Me' option is not available
    await page.keyboard.press('Escape');
    console.log("'Me' option not available in CreatedBy filter - skipping");
  }
}

/**
 * Test CreatedBy filter - Community option
 */
export async function testCreatedByFilterCommunity(page: Page) {
  // Click on Created By filter button
  const createdByButton = page.getByRole('button', { name: 'Created By' });
  if (await createdByButton.isVisible({ timeout: 10000 }).catch(() => false)) {
    await createdByButton.click();
  } else {
    console.log('Created By button not found - skipping');
    return;
  }

  // Wait for dropdown menu to appear
  const dropdownMenu = page.getByRole('menu', {
    name: /Created By|Me|My Organization|Community/,
  });
  await expect(dropdownMenu).toBeVisible({ timeout: 5000 });

  // Click on 'Community' option
  const communityOption = page.getByRole('menuitem', { name: 'Community' });
  await expect(communityOption).toBeVisible({ timeout: 5000 });
  await communityOption.click();
  await page.keyboard.press('Escape');

  // Wait for filter to be applied by checking for the 'Community' button
  await expect(page.getByRole('button', { name: 'Community' })).toBeVisible({
    timeout: 10000,
  });

  await page.keyboard.press('Escape');

  // Verify 'Community' filter is active
  await expect(page.getByRole('button', { name: 'Community' })).toBeVisible({
    timeout: 5000,
  });

  // Verify only All Mentors section is visible
  await expect(page.getByRole('heading', { name: 'All Mentors' })).toBeVisible({
    timeout: 10000,
  });

  // Verify Clear All button appears
  const clearAllButton = page.getByRole('button', { name: 'Clear All' });
  await expect(clearAllButton).toBeVisible({ timeout: 5000 });

  // Clear the filter
  await clearAllButton.click();

  // Verify filter is reset
  /*   await expect(page.getByRole('button', { name: 'Created By' })).toBeVisible({
    timeout: 5000,
  }); */
}

/**
 * Test star/unstar mentor functionality
 * Enhanced to verify newly starred mentor appears after pagination
 */
export async function testStarUnstarMentor(page: Page) {
  // Wait for the "All Mentors" section to be visible first
  const allMentorsHeading = page.getByRole('heading', { name: 'All Mentors' });
  await expect(allMentorsHeading).toBeVisible({ timeout: 30000 });

  // Find a mentor with "Add to favorites" button in All Mentors section
  const allMentorsSection = page
    .getByRole('heading', { name: 'All Mentors' })
    .first();

  //From playwright trace view the all mentors section took logger time to load

  expect(allMentorsSection).toBeVisible({ timeout: 120_000 });

  const mentorsCards = allMentorsSection.getByRole('listitem', {
    name: new RegExp(`^Explore mentor:.*$`),
  });

  // Wait for the first mentor card to be visible
  await expect(mentorsCards.first()).toBeVisible({ timeout: 30000 });

  const count = await mentorsCards.count();

  if (count === 0) {
    console.log('No mentors found - skipping');
    return;
  }

  // if count is greater than 0 then we expect the assertion to passs

  expect(count).toBeGreaterThan(0);

  const mentorCard = mentorsCards.first();
  const mentorName = await mentorCard.locator('h3').first().textContent();
  const addToFavoritesButton = mentorCard.getByRole('button', {
    name: 'Add to favorites',
  });

  const isMentorUnstarred = await addToFavoritesButton
    .isVisible({ timeout: 5000 })
    .catch(() => false);
  if (isMentorUnstarred) {
    const starButton = mentorCard.getByLabel('Add to favorites');
    await starButton.click();
    // Wait for the button to change to "Remove from favorites"
    const unstarButton = mentorCard.getByRole('button', {
      name: 'Remove from favorites',
    });
    await expect(unstarButton).toBeVisible({ timeout: 10000 });

    //Unstar now
    await unstarButton.click();
    // Wait for the button to change back to "Add to favorites"
    await expect(mentorCard.getByLabel('Add to favorites')).toBeVisible({
      timeout: 10000,
    });
  } else {
    const unstarButton = mentorCard.getByRole('button', {
      name: 'Remove from favorites',
    });
    await unstarButton.click();
    // Wait for the button to change to "Add to favorites"
    const starButton = mentorCard.getByLabel('Add to favorites');
    await expect(starButton).toBeVisible({ timeout: 10000 });

    //Star now
    await starButton.click();
    // Wait for the button to change to "Remove from favorites"
    await expect(
      mentorCard.getByRole('button', { name: 'Remove from favorites' })
    ).toBeVisible({ timeout: 10000 });
  }
}

/**
 * Test mentor card click navigates to chat page and chat works
 */
export async function testMentorCardClickAndChat(
  page: Page,
  initialMentorName: string
) {
  // Find and click on a mentor card (not the star button)
  const allMentorsSection = page.getByLabel('All mentors').first();

  expect(allMentorsSection).toBeVisible({ timeout: 30000 });

  const cardToClick = allMentorsSection
    .getByRole('listitem', {
      name: new RegExp(`^Explore mentor:.*$`),
    })
    .filter({ hasNotText: initialMentorName })
    .first();

  await expect(cardToClick).toBeVisible({ timeout: 10000 });

  // Get mentor name before clicking
  const mentorName = await cardToClick.locator('h3').first().textContent();
  console.log(`Clicking on mentor: ${mentorName}`);

  // Click on the mentor card
  await cardToClick.click();

  // Wait for navigation to chat page
  await safeWaitForURL(page, /\/platform\/[^/]+\/[^/]+/, { timeout: 15000 });

  // Verify the mentor name appears on the chat page (indicates page is ready)
  if (mentorName) {
    const mentorHeading = page.getByRole('heading', {
      name: mentorName.trim(),
      level: 1,
    });
    await expect(mentorHeading).toBeVisible({ timeout: 60_000 });
  }

  // Find the chat input
  const chatInput = page.getByRole('textbox', { name: 'Ask anything' });
  await expect(chatInput).toBeVisible({ timeout: 15000 });

  // Type a message
  const testMessage = 'Hello! How are you?';
  await chatInput.fill(testMessage);

  // Send the message
  const sendButton = page.getByRole('button', { name: 'Send message' });
  await expect(sendButton).toBeEnabled({ timeout: 15000 });
  const mentorSwitchedSuccessfullyToast = page.getByText(
    'Mentor switched successfully'
  );
  await expect(mentorSwitchedSuccessfullyToast).toBeVisible({ timeout: 15000 });
  // Wait for the reducers to be stable (to be improved)
  await page.waitForTimeout(5000);
  await sendButton.click();

  // Wait for AI response to appear (this is more reliable than networkidle for chat)
  // The chat will show the user message first, then the AI response

  // Verify user message appears
  await expect(page.getByText(testMessage)).toBeVisible({ timeout: 30000 });

  // Verify AI response appears (look for any response from the mentor)
  const aiResponse = page
    .locator('.chat-ai-message-response, [class*="response"]')
    .first();
  await expect(aiResponse).toBeVisible({ timeout: 30000 });
  console.log('Chat test completed successfully');
}

/**
 * Test Subject filter functionality
 */
export async function testSubjectFilter(page: Page) {
  // Click on Subject filter button
  const subjectButton = page.getByRole('button', { name: 'Subject' });
  if (await subjectButton.isVisible({ timeout: 10000 }).catch(() => false)) {
    await subjectButton.click();
  } else {
    console.log('Subject button not found - skipping');
    return;
  }

  // Wait for dropdown menu to appear
  const dropdownMenu = page.getByRole('menu', { name: 'Subject' });
  const menuVisible = await dropdownMenu
    .isVisible({ timeout: 5000 })
    .catch(() => false);

  if (!menuVisible) {
    console.log('Subject dropdown menu not available - skipping');
    await page.keyboard.press('Escape');
    return;
  }

  await expect(dropdownMenu).toBeVisible({ timeout: 5000 });

  // Get available options
  const menuItems = dropdownMenu.getByRole('menuitem');
  const itemCount = await menuItems.count();

  if (itemCount === 0) {
    console.log('No Subject options available - skipping');
    await page.keyboard.press('Escape');
    return;
  }

  // Click on first available option
  const firstOption = menuItems.first();
  const optionName = await firstOption.textContent();
  await firstOption.click();

  await page.keyboard.press('Escape');

  // Verify filter is active - button should show the selected option or filter is applied
  await expect(
    page
      .getByRole('button', {
        name: optionName?.trim() || 'Subject',
        exact: true,
      })
      .first()
  ).toBeVisible({ timeout: 5000 });

  // Verify Clear All button appears
  const clearAllButton = page.getByRole('button', { name: 'Clear All' });
  await expect(clearAllButton).toBeVisible({ timeout: 5000 });

  // Clear the filter
  await clearAllButton.click();

  // Verify filter is reset
  /*   await expect(page.getByRole('button', { name: 'Subject' })).toBeVisible({
    timeout: 5000,
  }); */
}

/**
 * Test Type filter functionality
 */
export async function testTypeFilter(page: Page) {
  // Click on Type filter button
  const typeButton = page.getByRole('button', { name: 'Type' });
  if (await typeButton.isVisible({ timeout: 10000 }).catch(() => false)) {
    await typeButton.click();
  } else {
    console.log('Type button not found - skipping');
    return;
  }

  // Wait for dropdown menu to appear
  const dropdownMenu = page.getByRole('menu', { name: 'Type' });
  const menuVisible = await dropdownMenu
    .isVisible({ timeout: 5000 })
    .catch(() => false);

  if (!menuVisible) {
    console.log('Type dropdown menu not available - skipping');
    await page.keyboard.press('Escape');
    return;
  }

  await expect(dropdownMenu).toBeVisible({ timeout: 5000 });

  // Get available options
  const menuItems = dropdownMenu.getByRole('menuitem');
  const itemCount = await menuItems.count();

  if (itemCount === 0) {
    console.log('No Type options available - skipping');
    await page.keyboard.press('Escape');
    return;
  }

  // Click on first available option
  const firstOption = menuItems.first();
  const optionName = await firstOption.textContent();
  await firstOption.click();
  await page.keyboard.press('Escape');

  // Verify filter is active - button should show the selected option or filter is applied
  await expect(
    page
      .getByRole('button', { name: optionName?.trim() || 'Type', exact: true })
      .first()
  ).toBeVisible({ timeout: 5000 });

  // Verify Clear All button appears
  const clearAllButton = page.getByRole('button', { name: 'Clear All' });
  await expect(clearAllButton).toBeVisible({ timeout: 5000 });

  // Clear the filter
  await clearAllButton.click();

  // Verify filter is reset
  /*   await expect(page.getByRole('button', { name: 'Type' })).toBeVisible({
    timeout: 5000,
  }); */
}

/**
 * Test Featured section (skip if not available)
 */
export async function testFeaturedSection(page: Page) {
  // Check if Featured section exists
  const featuredHeading = page.getByRole('heading', { name: 'Featured' });
  const featuredVisible = await featuredHeading
    .isVisible({ timeout: 5000 })
    .catch(() => false);

  if (!featuredVisible) {
    console.log('Featured section not available - skipping');
    return;
  }

  await expect(featuredHeading).toBeVisible({ timeout: 10000 });

  // Verify Featured section has mentor cards
  const featuredSection = featuredHeading.locator('..');
  const featuredMentorCards = featuredSection.locator('button');
  const mentorCount = await featuredMentorCards.count();

  if (mentorCount > 0) {
    // Verify at least one mentor card is visible
    await expect(featuredMentorCards.first()).toBeVisible({ timeout: 5000 });
    console.log(`Featured section has ${mentorCount} mentor(s)`);
  } else {
    console.log('Featured section is empty');
  }
}

/**
 * Test Custom mentor creation functionality
 */
export async function testCustomMentorCreation(page: Page) {
  // Check if Custom section exists
  const customHeading = page.getByRole('heading', { name: 'Custom' });
  const customVisible = await customHeading
    .isVisible({ timeout: 5000 })
    .catch(() => false);

  if (!customVisible) {
    console.log('Custom section not available - skipping');
    return;
  }

  // Look for "Create Custom Mentor" button/card
  const createCustomMentorButton = page
    .getByRole('heading', { name: 'Custom' })
    .locator('..')
    .getByRole('heading', { name: 'Create Custom Mentor' })
    .locator('..')
    .locator('button')
    .first();

  const createButtonVisible = await createCustomMentorButton
    .isVisible({ timeout: 5000 })
    .catch(() => false);

  if (!createButtonVisible) {
    console.log(
      'Create Custom Mentor button not available - user may not have RBAC access'
    );
    return;
  }

  // Get initial custom mentors count
  const customMentorsList = page
    .getByRole('heading', { name: 'Custom' })
    .locator('..')
    .getByRole('list', { name: 'Custom mentors' });

  const initialCount = await customMentorsList
    .locator('li')
    .count()
    .catch(() => 0);

  console.log(`Initial custom mentors count: ${initialCount}`);

  // Click on Create Custom Mentor button
  await createCustomMentorButton.click();
  // Wait for either a dialog to open or navigation to complete
  await page.waitForTimeout(2000);

  // Check if a dialog/modal opened for creating mentor
  const createDialog = page.getByRole('dialog');
  const dialogVisible = await createDialog
    .isVisible({ timeout: 5000 })
    .catch(() => false);

  if (dialogVisible) {
    // If dialog opened, we can test the creation flow
    // For now, just verify the dialog is visible and close it
    const closeButton = createDialog.getByRole('button', {
      name: /close|cancel/i,
    });
    const closeButtonVisible = await closeButton
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    if (closeButtonVisible) {
      await closeButton.click();
      // Wait for dialog to close
      await expect(createDialog).not.toBeVisible({ timeout: 5000 });
    } else {
      // Press Escape to close
      await page.keyboard.press('Escape');
      // Wait for dialog to close
      await expect(createDialog).not.toBeVisible({ timeout: 5000 });
    }
  } else {
    // If no dialog, the button might navigate to a different page
    // Wait for navigation by checking the URL or page content

    // If we navigated away, go back to explore page
    const currentUrl = page.url();
    if (!currentUrl.includes('/explore')) {
      // Navigate back to explore
      if (
        await page
          .getByRole('button', { name: 'Mentors' })
          .isVisible({ timeout: 5000 })
          .catch(() => false)
      ) {
        // Re-locate element immediately before clicking to avoid stale element reference
        await page.getByRole('button', { name: 'Mentors' }).click();
        await safeWaitForURL(page, '**/explore', { timeout: 15000 });
        // Wait for the explore page to load
        await expect(
          page.getByRole('heading', { name: 'All Mentors' })
        ).toBeVisible({ timeout: 15000 });
      }
    }
  }

  // Note: Full mentor creation flow would require filling out a form
  // This test verifies the button exists and is clickable
  // The actual creation would be tested in a separate test
  console.log('Create Custom Mentor button is functional');
}

export async function headerComponentsDisplayCorrectly(page: Page) {
  const isAdmin = await checkAdminStatus(page);
  const header = page.getByRole('navigation');
  await expect(header).toBeVisible({ timeout: 15000 });

  let mentorsListModalButton = header.getByRole('button', {
    name: 'My Mentors',
  });
  try {
    await expect(mentorsListModalButton).toBeVisible({ timeout: 15000 });
  } catch {
    mentorsListModalButton = page.getByRole('button', { name: 'My Mentors' });
    await expect(mentorsListModalButton).toBeVisible({ timeout: 15000 });
  }

  if (isAdmin) {
    const switchButton = header.getByRole('switch');
    await expect(switchButton).toBeVisible();

    const switchButtonState = await switchButton.getAttribute('aria-checked');
    if (switchButtonState === 'true') {
      currentMode = INSTRUCTOR_MODE;
    }
    if (currentMode === INSTRUCTOR_MODE) {
      await switchInstructorLearnerMode(page);
      await expect(switchButton).toHaveAttribute('aria-checked', 'false');
      currentMode = STUDENT_MODE;
    }
  }

  // Profile button
  await expect(header.locator('button').last()).toBeVisible();

  // Click My Mentors button and test modal
  await mentorsListModalButton.click();
  const mentorsListModal = page.getByRole('dialog', { name: /^My Mentors/ });
  await expect(mentorsListModal).toBeVisible();

  const mentorsListModalCloseButton = mentorsListModal.getByRole('button', {
    name: 'Close',
  });
  await expect(mentorsListModalCloseButton).toBeVisible();

  await mentorsListModalCloseButton.click();
  await expect(mentorsListModal).not.toBeVisible();

  // Current mentor dropdown button
  const currentMentorDropdownButton =
    header.getByRole('button', { name: 'Selected mentor dropdown button' }) ||
    header.getByRole('button').filter({ hasText: /^$/ }).nth(1);
  await currentMentorDropdownButton.click();
  const mentorMenuParentEl = page.getByRole('menuitem', { name: 'New chat' });
  await expect(mentorMenuParentEl).toBeVisible();

  await closeWithEsc(page);
  await expect(mentorMenuParentEl).not.toBeVisible();

  if (isAdmin) {
    if (currentMode === STUDENT_MODE) {
      await switchInstructorLearnerMode(page);
      currentMode = INSTRUCTOR_MODE;
    }
  }
}

export async function selectDropdownWorksCorrectly(page: Page) {
  const currentMentorDropdownButton = page.getByRole('button', {
    name: /Selected mentor dropdown button/i,
  });

  await expect(currentMentorDropdownButton).toBeVisible({ timeout: 120000 });
  await currentMentorDropdownButton.click();
  const newChat = page.getByRole('menuitem', { name: 'New chat' });
  await expect(newChat).toBeVisible();
}

export async function userProfileButtonWorksCorrectly(page: Page) {
  const header = page.locator('nav'); // corrected
  const profileButton = header.locator('button').last();
  await expect(profileButton).toBeVisible();

  await profileButton.click();

  const userProfileDropdownEl = page.getByRole('menu', {
    name: 'More options',
  });

  await expect(userProfileDropdownEl).toBeVisible();
  logger.info('Close the user profile dropdown');
  await page.keyboard.press('Escape');
  await expect(userProfileDropdownEl).not.toBeVisible();
}

export async function uploadDataOnTheDataSet(page: Page) {
  const isAdmin = await checkAdminStatus(page);
  if (!isAdmin) {
    console.log("Dropdown isn't visible");
    return;
  }

  // === Navigate to Dataset Modal ===
  const btn = page.getByRole('button', {
    name: 'Selected mentor dropdown button',
  });
  await btn.waitFor({ state: 'visible' });
  await btn.click();
  await expect(page.getByRole('menuitem', { name: 'New chat' })).toBeVisible();

  await page.getByRole('menuitem', { name: 'Datasets' }).click();

  // Wait for Edit Mentor dialog to be visible
  const dialog = page.getByRole('dialog').filter({ hasText: 'Edit Mentor' });
  await expect(dialog).toBeVisible({ timeout: 120_000 });

  const addResourceBtn = dialog.getByRole('button', { name: 'Add Resource' });
  await addResourceBtn.click();

  // Wait for Add Resources dialog to be visible
  const addResourceDialog = page
    .getByRole('dialog')
    .filter({ hasText: 'Add Resources' });
  await expect(addResourceDialog).toBeVisible({ timeout: 60_000 });

  // === Configurable Upload Section ===
  const resources = [
    {
      type: 'PDF',
      path: 'files/testing_folder/0028-oop-object-oriented-programming-using-cpp.pdf',
      name: '0028-oop-object-oriented-programming-using-cpp.pdf',
    },
    {
      type: 'Image',
      path: 'files/testing_folder/acessibility png.png',
      name: 'acessibility png.png',
    },
    {
      type: 'DOCX',
      path: 'files/testing_folder/audrey.docx',
      name: 'audrey.docx',
    },
    {
      type: 'PowerPoint',
      path: 'files/testing_folder/ppt1FC3.pptm',
      name: 'ppt1FC3.pptm',
    },
    {
      type: 'TXT',
      path: 'files/testing_folder/outerHTML.txt',
      name: 'outerHTML.txt',
    },
  ];

  for (const resource of resources) {
    console.log(`Uploading ${resource.type}: ${resource.name}`);

    const uploadBtn = addResourceDialog.getByRole('button', {
      name: resource.type,
    });
    await uploadBtn.click();

    const closeModalButton = page.getByRole('button', { name: 'Close' });

    // Wait for type-specific dialog to be visible
    const typeDialog = page
      .getByRole('dialog')
      .filter({ hasText: resource.type });
    await expect(typeDialog).toBeVisible({ timeout: 60_000 });

    const fileInput = typeDialog.locator('input[type="file"]');
    await fileInput.setInputFiles(resource.path);

    await expect(closeModalButton).toBeVisible();
    await closeModalButton.click();
    await page.waitForTimeout(2000);
  }
}

/**
 * Test: Untrain all datasets and delete them
 * Only runs if the user is an admin
 */
export async function onTrainDataAndDelete(page: Page) {
  // === Check admin status ===
  const isAdmin = await checkAdminStatus(page);
  if (!isAdmin) {
    logger.info('User is not admin - skipping test');
    return;
  }

  // === Navigate to Datasets Modal ===
  await selectDropdownWorksCorrectly(page);
  await page.getByRole('menuitem', { name: 'Datasets' }).click();

  // Wait for Edit Mentor dialog to be visible
  const dialog = page.getByRole('dialog').filter({ hasText: 'Edit Mentor' });
  await expect(dialog).toBeVisible({ timeout: 120_000 });

  // === Wait for loading spinner to disappear ===
  // The datasets tab shows a loading spinner while fetching data
  // We need to wait for it to disappear before checking for datasets
  const loadingSpinner = dialog.locator('.animate-spin').first();
  await loadingSpinner
    .waitFor({ state: 'hidden', timeout: 15000 })
    .catch(() => {
      // Spinner might not exist if data loaded very quickly
      logger.info('Loading spinner not found or already hidden');
    });

  // === Check for empty state ===
  const noDataMessage = dialog.getByText('No datasets found');
  if (await noDataMessage.isVisible()) {
    logger.info('No datasets found - nothing to delete');
    return;
  }

  // === Get all "Enable training for document" switches ===
  const trainingSwitches = dialog.getByRole('switch', {
    name: /training for document/i,
  });
  await expect(trainingSwitches.first()).toBeVisible({ timeout: 5000 });
  let count = await trainingSwitches.count();

  logger.info(`Number of training switches found: ${count}`);

  // === Loop through each switch and delete trained datasets ===
  for (let i = 0; i < count; i++) {
    const toggleButton = trainingSwitches.nth(i);
    const isTrained = await toggleButton.getAttribute('aria-checked');

    if (isTrained === 'true') {
      logger.info(`Untraining dataset #${i + 1}`);
      await toggleButton.click();

      // Handle delete confirmation
      const deleteDialog = page
        .getByRole('dialog')
        .filter({ hasText: 'Delete Dataset' });
      await expect(deleteDialog).toBeVisible({ timeout: 5000 });

      const deleteButton = deleteDialog.getByRole('button', { name: 'Delete' });
      await deleteButton.click();

      // Wait a moment for deletion to complete
      await page.waitForTimeout(500);
    } else {
      logger.info(`Dataset #${i + 1} is not trained - skipping untrain`);
    }
  }

  if (count === 0) {
    // === Verify empty state after all deletions ===
    await expect(noDataMessage).toBeVisible({ timeout: 5000 });
    logger.info('All datasets successfully untrained and deleted');
  } else {
    logger.info('data untrained successfully');
  }
}

export async function DisplayEmbedElements(page: Page) {
  await expect(page.getByRole('button', { name: 'Attach File' })).toBeVisible();
}

type Parsed = { platformKey: string; mentorId: string };

export function parsePlatformUrl(url: string): Parsed {
  const { pathname } = new URL(url);
  const parts = pathname.split('/').filter(Boolean); // ['platform', '<tenantKey>', '<mentorId>']

  if (parts[0] !== 'platform' || parts.length < 3) {
    throw new Error(
      'Unexpected URL format. Expected /platform/{tenantKey}/{mentorId}'
    );
  }

  return {
    platformKey: parts[1],
    mentorId: parts[2],
  };
}
