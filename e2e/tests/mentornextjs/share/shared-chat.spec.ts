// import { test, expect, Browser } from '@playwright/test';

// import { AUTH_HOST, MENTOR_NEXTJS_HOST } from '../../utils';
// import { authenticate, waitForPageReady } from '../utils';

// test.describe('Shared Chat Functionality', () => {
//   /**
//    * Creates a shared chat URL by logging in, starting a chat, and copying the share link
//    */
//   async function createSharedChatUrl(browser: Browser): Promise<string> {
//     // Step 1: Login into the mentor application
//     const context = await browser.newContext();
//     const page = await context.newPage();

//     await page.goto(MENTOR_NEXTJS_HOST, {
//       waitUntil: 'networkidle',
//       timeout: 60000,
//     });

//     await authenticate(page, MENTOR_NEXTJS_HOST);
//     await waitForPageReady(page);

//     // Step 2: Start a chat with the mentor
//     const chatTextarea = page.getByRole('textbox', { name: 'Ask anything' });
//     await expect(chatTextarea).toBeVisible({ timeout: 120000 });

//     const sendButton = page.getByRole('button', { name: 'Send message' });
//     await expect(sendButton).toBeVisible();

//     const testMessage = 'Hello, this is a test message for sharing';
//     await chatTextarea.fill(testMessage);
//     await sendButton.click();

//     // Step 3: Get the shared link by clicking the share button and reading from clipboard
//     const shareButton = page.getByRole('button', { name: 'Share this chat' });
//     await expect(shareButton).toBeVisible({ timeout: 120000 });

//     // Grant clipboard permissions (handle Safari compatibility)
//     try {
//       await context.grantPermissions(['clipboard-read', 'clipboard-write']);
//     } catch (error) {
//       // Safari doesn't support clipboard-write permission, only clipboard-read
//       try {
//         await context.grantPermissions(['clipboard-read']);
//       } catch (safariError) {
//         console.warn(
//           'Could not grant clipboard permissions:',
//           safariError.message
//         );
//       }
//     }

//     await shareButton.click();

//     // Wait for the share action to complete and URL to be copied to clipboard
//     await page.waitForTimeout(2000);

//     // Get the URL from clipboard
//     const clipboardText = await page.evaluate(async () => {
//       try {
//         return await navigator.clipboard.readText();
//       } catch (err) {
//         console.error('Failed to read clipboard:', err);
//         return null;
//       }
//     });

//     if (!clipboardText || !clipboardText.includes('/share/chat/')) {
//       throw new Error(
//         'Failed to get shared chat URL from clipboard or URL format is invalid'
//       );
//     }

//     console.log('Shared chat URL copied from clipboard:', clipboardText);

//     await context.close();
//     return clipboardText;
//   }

//   test('should create shared chat URL successfully', async ({
//     browser,
//     browserName,
//   }) => {
//     // Skip test on Safari due to clipboard API limitations
//     test.skip(
//       browserName === 'webkit',
//       'Skipping on Safari due to clipboard API limitations'
//     );

//     // Test that the createSharedChatUrl function works
//     const sharedChatUrl = await createSharedChatUrl(browser);

//     // Verify we got a valid URL
//     expect(sharedChatUrl).toBeTruthy();
//     expect(sharedChatUrl).toContain('/share/chat/');
//     console.log('✅ Successfully created shared chat URL:', sharedChatUrl);
//   });

//   test('should display "Chat for Free" button and redirect to auth SPA', async ({
//     browser,
//     browserName,
//   }) => {
//     // Skip test on Safari due to clipboard API limitations
//     test.skip(
//       browserName === 'webkit',
//       'Skipping on Safari due to clipboard API limitations'
//     );

//     // Get the shared chat URL
//     const sharedChatUrl = await createSharedChatUrl(browser);

//     // Step 4: Open new browser context with cleared cookies/localStorage
//     const context = await browser.newContext({
//       storageState: { cookies: [], origins: [] },
//     });
//     const page = await context.newPage();

//     // Step 5: Navigate to the shared link
//     await page.goto(sharedChatUrl, {
//       waitUntil: 'networkidle',
//       timeout: 60000,
//     });

//     await waitForPageReady(page);

//     // Step 6a: Confirm "Chat for Free" button is visible and redirects to auth SPA
//     const chatForFreeButton = page.getByRole('button', {
//       name: 'Chat for Free',
//     });
//     await expect(chatForFreeButton).toBeVisible({ timeout: 10000 });

//     await chatForFreeButton.click();

//     // Expect to be redirected to the auth platform
//     await page.waitForURL(
//       (url) =>
//         url.href.includes(AUTH_HOST) && url.href.includes(MENTOR_NEXTJS_HOST),
//       { timeout: 60000 }
//     );

//     expect(page.url()).toContain(AUTH_HOST);

//     await context.close();
//   });

//   test('should not display the text area when in share chat page', async ({
//     browser,
//     browserName,
//   }) => {
//     // Skip test on Safari due to clipboard API limitations
//     test.skip(
//       browserName === 'webkit',
//       'Skipping on Safari due to clipboard API limitations'
//     );

//     // Get the shared chat URL
//     const sharedChatUrl = await createSharedChatUrl(browser);

//     // Step 4: Open new browser context with cleared cookies/localStorage
//     const context = await browser.newContext({
//       storageState: { cookies: [], origins: [] },
//     });
//     const page = await context.newPage();

//     // Step 5: Navigate to the shared link
//     await page.goto(sharedChatUrl, {
//       waitUntil: 'networkidle',
//       timeout: 60000,
//     });

//     await waitForPageReady(page);

//     // Step 6b: Confirm that the text area is not visible
//     const chatTextarea = page.getByRole('textbox', { name: 'Ask anything' });

//     await expect(chatTextarea).not.toBeVisible();

//     await context.close();
//   });

//   test('should display shared chat content correctly', async ({
//     browser,
//     browserName,
//   }) => {
//     // Skip test on Safari due to clipboard API limitations
//     test.skip(
//       browserName === 'webkit',
//       'Skipping on Safari due to clipboard API limitations'
//     );

//     // Get the shared chat URL
//     const sharedChatUrl = await createSharedChatUrl(browser);

//     // Additional test to verify the shared chat displays properly
//     const context = await browser.newContext({
//       storageState: { cookies: [], origins: [] },
//     });
//     const page = await context.newPage();

//     await page.goto(sharedChatUrl, {
//       waitUntil: 'networkidle',
//       timeout: 60000,
//     });

//     await waitForPageReady(page);

//     // Verify basic elements are present
//     const chatForFreeButton = page.getByRole('button', {
//       name: 'Chat for Free',
//     });
//     await expect(chatForFreeButton).toBeVisible();

//     // Verify chat messages are displayed (if any)
//     const chatMessages = page
//       .locator('[data-testid="chat-messages"]')
//       .or(page.locator('.chat-message'));

//     // This might be visible or not depending on the shared chat implementation
//     // We'll just check it doesn't cause errors
//     const hasMessages = (await chatMessages.count()) > 0;
//     if (hasMessages) {
//       console.log('Shared chat messages are visible');
//     } else {
//       console.log('No shared chat messages visible');
//     }

//     await context.close();
//   });
// });
