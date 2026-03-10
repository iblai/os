import test, { expect } from '@playwright/test';
import {
  chatWithMentor,
  clickOnNewChatButton,
  getCurrentMentorName,
  navigateToMentorApp,
  openExplorePage,
  openMyMentorsModal,
  selectDifferentMentorFromExplore,
  selectDifferentMentorFromExploreMentorsSectionOnHomePage,
  selectDifferentMentorFromModal,
  verifyMentorResponse,
  verifyNoChatSessionActive,
  verifyOnHomePage,
} from './helpers';
import { logger } from '@iblai/iblai-js/playwright';

test.describe('Mentor Switching Tests', () => {
  /**
   * Test Suite: Switch Between Mentors Using My Mentors Modal
   * User navigates to mentor A (chats), then opens My Mentors modal
   * and switches to mentor B, then chats with mentor B
   */
  test.skip('should switch between mentors using My Mentors modal', async ({
    page,
  }) => {
    // Step 1: Navigate to application and wait for page load
    await navigateToMentorApp(page);

    // Step 2: Verify we're on the home page
    await verifyOnHomePage(page);

    // Step 3: Get the current mentor name (Mentor A)
    const mentorA = await getCurrentMentorName(page);
    logger.info(`Current Mentor A: ${mentorA}`);

    // Step 4: Chat with Mentor A
    await chatWithMentor(page, 'Hello');

    // Step 5: Verify Mentor A has responded
    await verifyMentorResponse(page);

    // Step 6: Open My Mentors modal
    await openMyMentorsModal(page);

    // Step 7: Select a different mentor (Mentor B) from the modal
    const mentorB = await selectDifferentMentorFromModal(page, mentorA);
    logger.info(`Selected Mentor B: ${mentorB}`);

    // Step 9: Verify we're on the home page
    await verifyOnHomePage(page);

    // Step 10: Verify the mentor name has changed to Mentor B
    const currentMentor = await getCurrentMentorName(page);
    expect(currentMentor).toBe(mentorB);

    // Step 11: Chat with Mentor B
    await chatWithMentor(page, 'Hello, Mentor B');

    // Step 12: Verify Mentor B has responded
    await verifyMentorResponse(page);
  });

  /**
   * Test Suite: Switch Between Mentors Using Explore Page
   * User navigates to mentor A (chats), then opens Explore page
   * and switches to mentor B, then chats with mentor B
   */
  test.skip('should switch between mentors using Explore page', async ({
    page,
  }) => {
    // Step 1: Navigate to application and wait for page load
    await navigateToMentorApp(page);

    // Step 2: Verify we're on the home page
    await verifyOnHomePage(page);

    // Step 3: Get the current mentor name (Mentor A)
    const mentorA = await getCurrentMentorName(page);
    console.log(`Current Mentor A: ${mentorA}`);

    // Step 4: Chat with Mentor A
    await chatWithMentor(page, 'Hello');

    // Step 5: Verify Mentor A has responded
    await verifyMentorResponse(page);

    // Step 6: Open the Explore page from sidebar
    await openExplorePage(page);

    // Step 7: Select a different mentor (Mentor B) from All Mentors section
    const mentorB = await selectDifferentMentorFromExplore(page, mentorA);
    console.log(`Selected Mentor B: ${mentorB}`);

    // Step 8: Verify we're on the home page after selecting mentor
    await verifyOnHomePage(page);

    // Step 9: Verify the mentor name has changed to Mentor B
    const currentMentor = await getCurrentMentorName(page);
    expect(currentMentor).toBe(mentorB);

    // Step 10: Chat with Mentor B
    await chatWithMentor(page, 'Hello, Mentor B');

    // Step 11: Verify Mentor B has responded
    await verifyMentorResponse(page);
  });

  /**
   * Test Suite: Switch Between Mentors Using Explore Mentors Section on the Home Page
   * User navigates to mentor A (chats), then clicks on the Explore Mentors section on the home page
   * and switches to mentor B, then chats with mentor B
   */
  test.skip('should switch between mentors using the Explore Mentors section on the home page', async ({
    page,
  }) => {
    // Step 1: Navigate to application and wait for page load
    await navigateToMentorApp(page);

    // Step 2: Verify we're on the home page
    await verifyOnHomePage(page);

    // Step 3: Get the current mentor name (Mentor A)
    const mentorA = await getCurrentMentorName(page);
    console.log(`Current Mentor A: ${mentorA}`);

    // Step 4: Chat with Mentor A
    await chatWithMentor(page, 'Hello');

    // Step 5: Verify Mentor A has responded
    await verifyMentorResponse(page);

    // Step 6: Click on the Explore Mentors section on the home page
    await clickOnNewChatButton(page);

    // Step 7: Verify no chat session is active
    await verifyNoChatSessionActive(page);

    // Step 8: Select a different mentor (Mentor B) from All Mentors section
    const mentorB =
      await selectDifferentMentorFromExploreMentorsSectionOnHomePage(
        page,
        mentorA
      );
    console.log(`Selected Mentor B: ${mentorB}`);

    // Step 9: Verify we're on the home page after selecting mentor
    await verifyNoChatSessionActive(page);

    // Step 10: Verify the mentor name has changed to Mentor B
    const currentMentor = await getCurrentMentorName(page);
    expect(currentMentor).toBe(mentorB);

    // Step 11: Chat with Mentor B
    await chatWithMentor(page, 'Hello');

    // Step 12: Verify Mentor B has responded
    await verifyMentorResponse(page);
  });
});
