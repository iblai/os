/**
 * Full voice call flow — user speaks, AI returns audio response.
 *
 * Strategy (network-level mocking):
 *   1. Intercept the call-credentials API that returns { ws_url, participant_token }
 *      and return a fake payload — this prevents the LiveKit Room.connect() from
 *      attempting a real WebSocket connection.
 *   2. Intercept the audio-to-text (STT) API and return a known transcription
 *      so the fake mic recording is treated as a real message.
 *   3. The chat message dispatch, LLM call, and AI response rendering are already
 *      covered by the existing chat tests — here we only verify the voice-specific
 *      path: modal opens → mic button starts/stops recording → transcription is
 *      submitted → AI response appears in the chat.
 *
 * Chromium only (fake media stream flags required for getUserMedia()).
 */

import { test, expect } from "@playwright/test";
import { navigateToMentorApp } from "../profile/helpers";
import { checkAdminStatus } from "../utils";
import { createMentorAndVerify } from "./voice-chat-helpers";

// Chromium-only: fake audio device so getUserMedia() works without hardware
test.use({
  launchOptions: {
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  },
});

test.describe("Voice Chat — Full Flow (mocked APIs)", () => {
  test.setTimeout(300_000);

  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "Fake media stream flags are Chromium-only",
  );

  test.beforeEach(async ({ page }) => {
    await page.context().grantPermissions(["microphone"]);
    await navigateToMentorApp(page);
  });

  test("user speaks and receives an AI audio response (mocked call credentials + STT)", async ({
    page,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, "Only admins can create mentors");

    await createMentorAndVerify(page);

    // ----------------------------------------------------------------
    // Mock 1: call-credentials endpoint
    //   Returns a fake ws_url and participant_token so Room.connect()
    //   gets a payload but will fail gracefully (no real WS server).
    //   The component handles connection failure — the modal stays open
    //   so we can still test the recording path independently.
    // ----------------------------------------------------------------
    await page.route(
      (url) => url.pathname.includes("/create-call-credentials/"),
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ws_url: "wss://mock-livekit.example.com",
            participant_token: "mock-participant-token-for-e2e-test",
          }),
        });
      },
    );

    // ----------------------------------------------------------------
    // Mock 2: audio-to-text (STT) endpoint
    //   The fake mic records a sine wave. The real STT service would
    //   return an empty string or fail. We intercept and return a
    //   known phrase so the chat message is actually submitted.
    // ----------------------------------------------------------------
    const VOICE_TEST_PHRASE = "What is the capital of France?";
    await page.route(
      (url) => url.pathname.includes("/audio-to-text/"),
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ text: VOICE_TEST_PHRASE }),
        });
      },
    );

    // ----------------------------------------------------------------
    // Step 1: Open the voice call modal
    // ----------------------------------------------------------------
    const voiceCallButton = page.getByRole("button", { name: "Voice call" });
    await expect(voiceCallButton).toBeVisible({ timeout: 15_000 });
    await voiceCallButton.click();

    const voiceChatDialog = page.getByRole("dialog", { name: "Voice Chat" });
    await expect(voiceChatDialog).toBeVisible({ timeout: 15_000 });
    await expect(
      voiceChatDialog.getByRole("heading", { name: "Voice Chat" }),
    ).toBeVisible();

    // ----------------------------------------------------------------
    // Step 2: Start recording (mic button click)
    // ----------------------------------------------------------------
    const muteButton = voiceChatDialog.getByRole("button", {
      name: /mute microphone/i,
    });
    await expect(muteButton).toBeVisible({ timeout: 10_000 });
    await muteButton.click();

    // Recording in progress — button label changes while recording
    await page.waitForTimeout(2_000);

    // ----------------------------------------------------------------
    // Step 3: Stop recording (click again to submit)
    // ----------------------------------------------------------------
    const stopButton = voiceChatDialog
      .getByRole("button", { name: /mute microphone|stop|send/i })
      .first();
    await stopButton.click();

    // ----------------------------------------------------------------
    // Step 4: Close the voice modal — the transcription has been
    //         submitted as a chat message via sendMessage()
    // ----------------------------------------------------------------
    const endCallButton = voiceChatDialog.getByRole("button", {
      name: /close voice chat/i,
    });
    await expect(endCallButton).toBeVisible({ timeout: 10_000 });
    await endCallButton.click();
    await expect(voiceChatDialog).not.toBeVisible({ timeout: 10_000 });

    // ----------------------------------------------------------------
    // Step 5: Verify the transcribed phrase appears as a user message
    //         and that an AI response follows
    // ----------------------------------------------------------------
    const userMessage = page.locator(".chat-user-message-query", {
      hasText: VOICE_TEST_PHRASE,
    });
    await expect(userMessage).toBeVisible({ timeout: 30_000 });

    const aiResponse = page.locator(".chat-ai-message-response").first();
    await expect(aiResponse).toBeVisible({ timeout: 60_000 });

    const responseText = await aiResponse.innerText();
    expect(responseText.trim().length).toBeGreaterThan(0);
  });
});
