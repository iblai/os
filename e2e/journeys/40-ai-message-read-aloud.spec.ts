import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp } from '../utils/auth';
import type { Page } from '@playwright/test';

/**
 * Stub window.speechSynthesis so clicking the Read Aloud button never
 * actually plays audio (which would fail in headless CI) and so we can
 * drive the utterance's onend callback from the test.
 *
 * Must be installed before page.goto via addInitScript.
 */
async function mockSpeechSynthesis(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // @ts-expect-error test shim
    window.__speakCalls = [];
    // @ts-expect-error test shim
    window.__cancelCalls = 0;

    class StubUtterance {
      text: string;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(text: string) {
        this.text = text;
      }
    }

    const synth = {
      speak: (u: StubUtterance) => {
        // @ts-expect-error test shim
        window.__speakCalls.push(u);
      },
      cancel: () => {
        // @ts-expect-error test shim
        window.__cancelCalls += 1;
      },
      getVoices: () => [],
      pause: () => {},
      resume: () => {},
      pending: false,
      speaking: false,
      paused: false,
      onvoiceschanged: null,
    };

    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: synth,
    });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      configurable: true,
      value: StubUtterance,
    });
  });
}

test.describe('Journey 40: AI Message Read Aloud', () => {
  test.beforeEach(async ({ page }) => {
    await mockSpeechSynthesis(page);
    await navigateToMentorApp(page);
  });

  test('admin sends a message and sees the Read Aloud button on the AI response', async ({
    page,
    chatPage,
  }) => {
    await chatPage.sendMessage('Hello, can you help me?');
    await chatPage.waitForAIResponse();

    const speakButton = page
      .getByRole('button', { name: 'Read Aloud' })
      .first();
    await expect(speakButton).toBeVisible({ timeout: 15_000 });
    await expect(speakButton).toHaveAttribute('aria-pressed', 'false');
  });

  test('admin clicks the Read Aloud button and the button toggles to Stop Reading Aloud', async ({
    page,
    chatPage,
  }) => {
    await chatPage.sendMessage('Say something I can listen to.');
    await chatPage.waitForAIResponse();

    const speakButton = page
      .getByRole('button', { name: 'Read Aloud' })
      .first();
    await expect(speakButton).toBeVisible({ timeout: 15_000 });
    await speakButton.click();

    const stopButton = page
      .getByRole('button', { name: 'Stop Reading Aloud' })
      .first();
    await expect(stopButton).toBeVisible({ timeout: 5_000 });
    await expect(stopButton).toHaveAttribute('aria-pressed', 'true');

    const speakCalls = await page.evaluate(
      // @ts-expect-error test shim
      () => window.__speakCalls?.length ?? 0,
    );
    expect(speakCalls).toBeGreaterThanOrEqual(1);
  });

  test('admin clicks Stop Reading Aloud and the button returns to Read Aloud and cancels speech', async ({
    page,
    chatPage,
  }) => {
    await chatPage.sendMessage('Another message for read aloud toggle.');
    await chatPage.waitForAIResponse();

    const speakButton = page
      .getByRole('button', { name: 'Read Aloud' })
      .first();
    await expect(speakButton).toBeVisible({ timeout: 15_000 });
    await speakButton.click();

    const stopButton = page
      .getByRole('button', { name: 'Stop Reading Aloud' })
      .first();
    await expect(stopButton).toBeVisible({ timeout: 5_000 });
    await stopButton.click();

    const resetButton = page
      .getByRole('button', { name: 'Read Aloud' })
      .first();
    await expect(resetButton).toBeVisible({ timeout: 5_000 });
    await expect(resetButton).toHaveAttribute('aria-pressed', 'false');

    const cancelCalls = await page.evaluate(
      // @ts-expect-error test shim
      () => window.__cancelCalls ?? 0,
    );
    expect(cancelCalls).toBeGreaterThanOrEqual(1);
  });
});
