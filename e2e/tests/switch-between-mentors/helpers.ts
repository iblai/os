import { expect, Page } from '@playwright/test';

export { navigateToMentorApp } from '../profile/helpers';

/**
 * Extracts mentor ID from URL if it matches the expected format
 * Handles URLs with or without trailing slash and with query parameters
 * @returns mentor ID or null if URL doesn't match
 */
function extractMentorIdFromUrl(url: string): string | null {
  const mentorUrlPattern =
    /\/platform\/[^/]+\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\/.*)?(?:\?.*)?$/;
  const match = url.match(mentorUrlPattern);
  return match ? match[1] : null;
}

/**
 * Verifies that a mentor chat session exists and has at least one message
 * @throws Error if URL format is invalid, session ID is missing, or no chat messages exist
 */
async function verifyMentorChatSession(page: Page): Promise<string> {
  const currentUrl = page.url();
  const mentorId = extractMentorIdFromUrl(currentUrl);

  if (!mentorId) {
    throw new Error(
      `Expected URL to match format /platform/{tenant}/{mentor-id}, but got: ${currentUrl}`
    );
  }

  // Read session_id from localStorage
  const sessionIdJson = await page.evaluate(() => {
    return localStorage.getItem('session_id');
  });

  if (!sessionIdJson) {
    throw new Error('session_id not found in localStorage');
  }

  let sessionIdMap: Record<string, string>;
  try {
    sessionIdMap = JSON.parse(sessionIdJson);
  } catch {
    throw new Error(
      `Failed to parse session_id from localStorage: ${sessionIdJson}`
    );
  }

  const sessionId = sessionIdMap[mentorId];
  if (!sessionId) {
    throw new Error(
      `No session ID found for mentor ${mentorId}. Available mentors: ${Object.keys(sessionIdMap).join(', ')}`
    );
  }

  // Verify there's at least one chat message in the UI
  const chatMessage = page.locator('div.chat-ai-message-response').first();
  await expect(chatMessage).toBeVisible({ timeout: 20000 });

  return mentorId;
}

/**
 * Helper function to get the current mentor name from the main heading
 */
export async function getCurrentMentorName(page: Page): Promise<string> {
  // Try to find the heading first
  const isHeadingVisible = await page
    .locator('h1')
    .isVisible({ timeout: 60000 })
    .catch(() => false);

  if (isHeadingVisible) {
    // Re-locate element and get inner text to avoid stale element reference
    const mentorName = await page.locator('h1').innerText();
    return mentorName.trim();
  }

  // If heading not found, verify we're on a valid mentor chat page and return the mentor ID
  const mentorId = await verifyMentorChatSession(page);
  return mentorId;
}

/**
 * Helper function to send a chat message to the mentor
 */
export async function chatWithMentor(
  page: Page,
  message: string = 'Hello'
): Promise<void> {
  // Locate the textarea for chat input
  const chatTextarea = page.getByPlaceholder('Ask anything', { exact: true });

  // Wait for textarea to be visible
  await expect(chatTextarea).toBeVisible();

  // Fill in the message
  await chatTextarea.fill(message);

  // Locate and click the send message button
  const sendButton = page.getByRole('button', { name: 'Send message' });
  await expect(sendButton).toBeEnabled({ timeout: 15000 });
  // Wait for the reducers to be stable (to be improved)
  await page.waitForTimeout(5000);
  await sendButton.click();
}

/**
 * Helper function to verify mentor has responded to the chat
 */
export async function verifyMentorResponse(page: Page): Promise<void> {
  // Locate the mentor response container
  const mentorResponse = page
    .locator('div.flex.items-start >> div:has(p)')
    .last();

  // Wait for mentor response to be visible
  await expect(mentorResponse).toBeVisible({ timeout: 30000 });

  // Verify the response contains content
  const responseText = await mentorResponse.innerText();
  expect(responseText.length).toBeGreaterThan(0);
}

/**
 * Helper function to open My Mentors modal
 */
export async function openMyMentorsModal(page: Page): Promise<void> {
  // Locate the "My Mentors" button by its tooltip and image
  const myMentorsButton = page.getByRole('button', {
    name: 'My Mentors',
    exact: true,
  });
  // Wait for button to be visible
  await expect(myMentorsButton).toBeVisible();

  // Click the button to open modal
  await myMentorsButton.click();

  // Wait for modal to be fully visible by checking for the heading
  const modalHeading = page
    .getByRole('dialog')
    .filter({ hasText: 'My Mentors' });
  await expect(modalHeading).toBeVisible();
}

/**
 * Helper function to select a different mentor from My Mentors modal
 */
export async function selectDifferentMentorFromModal(
  page: Page,
  currentMentorName: string
): Promise<string> {
  // Locate all mentor cards in the modal
  const mentorCards = page.locator('.grid .flex.cursor-pointer.flex-col');

  // Wait for mentor cards to be visible
  await expect(mentorCards.first()).toBeVisible();

  // Get count of available mentors
  const mentorCount = await mentorCards.count();

  // Find a mentor different from the current one
  let selectedMentorName = '';
  for (let i = 0; i < mentorCount; i++) {
    const mentorCard = mentorCards.nth(i);
    const mentorNameElement = mentorCard.locator('h3');
    const mentorName = await mentorNameElement.innerText();

    // Select the first mentor that's different from current
    if (mentorName.trim() !== currentMentorName) {
      selectedMentorName = mentorName.trim();
      await mentorCard.click();
      break;
    }
  }

  // Wait for mentor heading to update to the selected mentor
  await expect(
    page.getByRole('heading', { name: selectedMentorName, level: 1 })
  ).toBeVisible({ timeout: 15000 });
  // Ensure we selected a different mentor
  expect(selectedMentorName).toBeTruthy();
  expect(selectedMentorName).not.toBe(currentMentorName);

  return selectedMentorName;
}

/**
 * Helper function to verify user is on the home page
 */
export async function verifyOnHomePage(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  // Locate the "Explore Mentors" heading
  const exploreMentorsHeading = page.getByRole('heading', {
    name: 'Explore Mentors',
    exact: true,
  });

  // Try to find "Explore Mentors" heading first
  const isExploreMentorsVisible = await exploreMentorsHeading
    .isVisible({ timeout: 60000 })
    .catch(() => false);

  if (isExploreMentorsVisible) {
    return;
  }

  // If "Explore Mentors" not found, verify we're on a valid mentor chat page
  await verifyMentorChatSession(page);
}

/**
 * Helper function to open the Mentors/Explore page from sidebar
 */
export async function openExplorePage(page: Page): Promise<void> {
  // Locate the Mentors/Explore button in the sidebar
  const mentorsButton = page.getByRole('button', {
    name: 'Mentors',
    exact: true,
  });

  // Wait for button to be visible
  await expect(mentorsButton).toBeVisible();

  // Click the button to navigate to Explore page
  await mentorsButton.click();

  // Verify we're on the Explore page by checking for "All Mentors" section
  const allMentorsHeading = page.getByRole('heading', {
    name: 'All Mentors',
    exact: true,
  });
  await expect(allMentorsHeading).toBeVisible({ timeout: 15000 });
}

/**
 * Helper function to select a different mentor from All Mentors section
 */

export async function selectDifferentMentorFromExplore(
  page: Page,
  currentMentorName: string
): Promise<string> {
  // Locate all mentor buttons in the "All Mentors" section
  const mentorButtons = page.locator(
    'ul[data-testid="all-mentors-card-list"] button'
  );

  // Wait for mentor buttons to be visible
  await expect(mentorButtons.first()).toBeVisible();

  // Get count of available mentors
  const mentorCount = await mentorButtons.count();

  // Find a mentor different from the current one
  let selectedMentorName = '';
  for (let i = 0; i < mentorCount; i++) {
    const mentorButton = mentorButtons.nth(i);
    const mentorNameElement = mentorButton.locator('h3');
    const mentorName = await mentorNameElement.innerText();

    // Select the first mentor that's different from current
    if (mentorName.trim() !== currentMentorName) {
      selectedMentorName = mentorName.trim();
      await mentorButton.click();
      break;
    }
  }

  // Wait for mentor heading to update to the selected mentor
  await expect(
    page.getByRole('heading', { name: selectedMentorName, level: 1 })
  ).toBeVisible({ timeout: 15000 });

  // Ensure we selected a different mentor
  expect(selectedMentorName).toBeTruthy();
  expect(selectedMentorName).not.toBe(currentMentorName);

  return selectedMentorName;
}

export async function clickOnNewChatButton(page: Page): Promise<void> {
  // Locate the "New Chat" button on the home page
  const newChatButton = page.getByRole('button', {
    name: 'New Chat',
    exact: true,
  });

  // Wait for button to be visible
  await expect(newChatButton).toBeVisible();

  // Click the button to open a new chat
  await newChatButton.click();
}

export async function verifyNoChatSessionActive(page: Page): Promise<void> {
  // Locate the "Explore Mentors" heading
  const exploreMentorsHeading = page.getByRole('heading', {
    name: 'Explore Mentors',
    exact: true,
  });

  // Wait for heading to be visible
  await expect(exploreMentorsHeading).toBeVisible();
}

export async function selectDifferentMentorFromExploreMentorsSectionOnHomePage(
  page: Page,
  currentMentorName: string
): Promise<string> {
  // Locate all mentor cards - FIXED: Use correct selector
  const mentorCards = page.locator('.block[role="button"]');

  // Wait for mentor cards to be visible
  await expect(mentorCards.first()).toBeVisible();

  // Get count of available mentors
  const mentorCount = await mentorCards.count();

  // Find a mentor different from the current one
  let selectedMentorName = '';
  for (let i = 0; i < mentorCount; i++) {
    const mentorCard = mentorCards.nth(i);

    // FIXED: Use correct selector for mentor name
    const mentorNameElement = mentorCard.locator('h3');
    const mentorName = await mentorNameElement.innerText();

    // Select the first mentor that's different from current
    if (mentorName.trim() !== currentMentorName) {
      selectedMentorName = mentorName.trim();
      await mentorCard.click();
      break;
    }
  }

  // Wait for mentor heading to update to the selected mentor
  await expect(
    page.getByRole('heading', { name: selectedMentorName, level: 1 })
  ).toBeVisible({ timeout: 15000 });

  // Ensure we selected a different mentor
  expect(selectedMentorName).toBeTruthy();
  expect(selectedMentorName).not.toBe(currentMentorName);

  return selectedMentorName;
}
