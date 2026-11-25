import type { Locator } from '@playwright/test';
import { test, expect } from '../fixtures/mentor-test';
import { getPlatformContext, navigateToMentorApp } from '../utils/auth';
import { MentorTracker } from '../utils/mentor-cleanup';
import { generateMentorName } from '../fixtures/test-data';

/**
 * Journey 107 — Retry only on the newest answer (iblai/iblai-platform#2975).
 *
 * "Retry for a new response" used to show on every answer; on an earlier one
 * it re-asked the newest question and appended the reply at the end. Now only
 * the latest answer carries it, and it re-sends the question that answer
 * replied to as a new question and answer pair at the bottom. Real chat on a
 * throwaway agent (the ibl.ai Fast pin of createWithName), tracked for cleanup.
 */

const Q1 = 'What is the capital of France? Answer in one short sentence.';
const Q2 = 'What is the capital of Japan? Answer in one short sentence.';

async function expectBelow(button: Locator, answer: Locator): Promise<void> {
  const buttonBox = await button.boundingBox();
  const answerBox = await answer.boundingBox();
  expect(buttonBox!.y).toBeGreaterThanOrEqual(answerBox!.y);
}

test.describe.configure({ mode: 'serial', timeout: 240_000 });

test.describe('Journey 107: Retry only on the newest answer', () => {
  const tracker = new MentorTracker();

  test.afterAll(async ({ browser }, testInfo) => {
    await tracker.deleteAll(browser, testInfo);
  });

  test("rla-01: Retry shows only on the newest answer and re-sends that answer's question at the bottom, not an earlier one", async ({
    page,
    chatPage,
    createMentorPage,
  }) => {
    await navigateToMentorApp(page);
    await createMentorPage.openAndCreate(generateMentorName());
    const { mentorId } = await getPlatformContext(page);
    tracker.add(mentorId);

    const retry = page.getByRole('button', {
      name: 'Retry for a new response',
    });

    await chatPage.sendMessage(Q1);
    await expect(chatPage.aiMessages).toHaveCount(1, { timeout: 90_000 });
    await chatPage.waitForStreamingComplete();
    await chatPage.sendMessage(Q2);
    await expect(chatPage.aiMessages).toHaveCount(2, { timeout: 90_000 });
    await chatPage.waitForStreamingComplete();

    await expect(retry).toHaveCount(1);
    await chatPage.aiMessages.first().hover();
    await expect(retry).toHaveCount(1);
    await chatPage.aiMessages.last().hover();
    await expect(retry).toBeVisible();
    await expectBelow(retry, chatPage.aiMessages.nth(1));

    await retry.click();
    await expect(chatPage.aiMessages).toHaveCount(3, { timeout: 90_000 });
    await chatPage.waitForStreamingComplete();

    expect(await chatPage.getUserBubbleCount(Q1)).toBe(1);
    expect(await chatPage.getUserBubbleCount(Q2)).toBe(2);
    await expect(chatPage.userMessages.last()).toContainText(Q2);

    await expect(retry).toHaveCount(1);
    await chatPage.aiMessages.nth(1).hover();
    await expect(retry).toHaveCount(1);
    await chatPage.aiMessages.last().hover();
    await expect(retry).toBeVisible();
    await expectBelow(retry, chatPage.aiMessages.last());
  });
});
