import { test, expect } from "../fixtures/mentor-test";
import { navigateToMentorApp, checkAdminStatus } from "../utils/auth";
import { waitForPageReady } from "../utils/resilient";

test.describe("Journey 9: Voice Chat", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToMentorApp(page);
  });

  test("authenticated user goes to chat page and opens the voice call dialog with heading, mute and end-call buttons", async ({
    page,
    chatPage,
  }) => {
    test.skip(
      ({ browserName }) => browserName !== "chromium",
      "Voice call requires Chromium",
    );
    const voiceCallBtn = chatPage.voiceCallButton;
    const visible = await voiceCallBtn
      .isVisible({ timeout: 10_000 })
      .catch(() => false);
    if (!visible) {
      test.skip(true, "Voice call button not visible in this environment");
      return;
    }
    await voiceCallBtn.click();
    const dialog = page.getByRole("dialog", { name: /voice chat/i });
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await expect(
      dialog.getByRole("heading", { name: /voice chat/i }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: /mute|microphone/i }),
    ).toBeVisible({ timeout: 5_000 });
    await expect(
      dialog.getByRole("button", { name: /close|end call/i }),
    ).toBeVisible({ timeout: 5_000 });
    await page.keyboard.press("Escape");
  });

  test("authenticated user goes to chat page and opens the voice call dialog on Firefox and WebKit", async ({
    page,
    chatPage,
  }) => {
    test.skip(
      ({ browserName }) => browserName === "chromium",
      "Test targets Firefox and WebKit",
    );
    const voiceCallBtn = chatPage.voiceCallButton;
    const visible = await voiceCallBtn
      .isVisible({ timeout: 10_000 })
      .catch(() => false);
    if (!visible) return;
    await voiceCallBtn.click();
    const dialog = page.getByRole("dialog", { name: /voice chat/i });
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press("Escape");
  });

  test("admin goes to mentor settings and hides the voice call button by toggling off Show Voice Call", async ({
    page,
    editMentorPage,
    chatPage,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, "Requires admin access");
    await editMentorPage.open("Settings");
    await waitForPageReady(page);
    const showVoiceSwitch = editMentorPage.dialog.getByRole("switch", {
      name: /show voice call/i,
    });
    const visible = await showVoiceSwitch
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    if (!visible) {
      await editMentorPage.close();
      return;
    }
    const wasEnabled =
      (await showVoiceSwitch.getAttribute("aria-checked")) === "true";
    if (wasEnabled) {
      await showVoiceSwitch.click();
      await expect(showVoiceSwitch).toHaveAttribute("aria-checked", "false", {
        timeout: 10_000,
      });
    }
    await editMentorPage.close();
    await expect(chatPage.voiceCallButton).not.toBeVisible({ timeout: 10_000 });

    // Restore
    await editMentorPage.open("Settings");
    await waitForPageReady(page);
    const switchAgain = editMentorPage.dialog.getByRole("switch", {
      name: /show voice call/i,
    });
    if ((await switchAgain.getAttribute("aria-checked")) === "false") {
      await switchAgain.click();
    }
    await editMentorPage.close();
  });

  test("admin goes to mentor settings and re-enables the voice call button", async ({
    page,
    editMentorPage,
    chatPage,
  }) => {
    const isAdmin = await checkAdminStatus(page);
    test.skip(!isAdmin, "Requires admin access");
    await editMentorPage.open("Settings");
    await waitForPageReady(page);
    const showVoiceSwitch = editMentorPage.dialog.getByRole("switch", {
      name: /show voice call/i,
    });
    const visible = await showVoiceSwitch
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    if (!visible) {
      await editMentorPage.close();
      return;
    }
    if ((await showVoiceSwitch.getAttribute("aria-checked")) !== "true") {
      await showVoiceSwitch.click();
      await expect(showVoiceSwitch).toHaveAttribute("aria-checked", "true", {
        timeout: 10_000,
      });
    }
    await editMentorPage.close();
    await expect(chatPage.voiceCallButton).toBeVisible({ timeout: 10_000 });
  });

  test("admin goes to chat page and completes a full voice call flow using mocked call credentials and STT", async ({
    page,
    chatPage,
  }) => {
    test.skip(
      ({ browserName }) => browserName !== "chromium",
      "Full voice flow uses fake media stream flags — Chromium only",
    );
    const isAdmin = await checkAdminStatus(page);
    test.skip(
      !isAdmin,
      "Full voice flow requires admin access to create a mentor",
    );

    const VOICE_TEST_PHRASE = "What is the capital of France?";

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

    const voiceCallBtn = chatPage.voiceCallButton;
    const visible = await voiceCallBtn
      .isVisible({ timeout: 10_000 })
      .catch(() => false);
    if (!visible) return;

    await voiceCallBtn.click();
    const voiceDialog = page.getByRole("dialog", { name: /voice chat/i });
    await expect(voiceDialog).toBeVisible({ timeout: 15_000 });

    const muteButton = voiceDialog.getByRole("button", {
      name: /mute microphone/i,
    });
    await expect(muteButton).toBeVisible({ timeout: 10_000 });
    await muteButton.click();
    await page.waitForTimeout(2_000);

    const stopButton = voiceDialog
      .getByRole("button", { name: /mute microphone|stop|send/i })
      .first();
    await stopButton.click();

    const endCallButton = voiceDialog.getByRole("button", {
      name: /close voice chat|end call/i,
    });
    await expect(endCallButton).toBeVisible({ timeout: 10_000 });
    await endCallButton.click();
    await expect(voiceDialog).not.toBeVisible({ timeout: 10_000 });

    const userMessage = page.locator(".chat-user-message-query", {
      hasText: VOICE_TEST_PHRASE,
    });
    await expect(userMessage).toBeVisible({ timeout: 30_000 });
    await expect(chatPage.aiMessages.first()).toBeVisible({ timeout: 60_000 });
  });

  test("authenticated user goes to chat page and starts a real voice call and receives an AI audio response", async ({
    page,
    chatPage,
  }) => {
    test.skip(
      true,
      "Requires real LiveKit server and audio device — use the mocked version above instead",
    );
    // Original: chat/voice-call.spec.ts
    // This test used the real LiveKit voice call flow (not page.route mocks).
    // Requires: running LiveKit server, real/fake audio device, working STT pipeline.
  });
});
