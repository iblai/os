import { test, expect } from '../fixtures/mentor-test';
import { navigateToMentorApp, checkAdminStatus } from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';

/**
 * Journey 46 — Mentor Voice Tab.
 *
 * The Voice tab is rendered by `AgentVoiceTab` from `@iblai/web-containers`.
 * All selectors flow through the SDK's official Playwright helpers
 * (re-exported by `@iblai/iblai-js/playwright`) via the VoiceTab page
 * object. If the host overrides VoiceTabLabels, update the constants
 * imported by the page object — never patch a selector in this file.
 *
 * Tab layout:
 *   • Sub-tab "Voice"      → 3 provider cards (Browser / OpenAI / Google).
 *                             Choosing OpenAI / Google reveals the picker
 *                             trigger; Browser hides it.
 *   • Sub-tab "Voice call" → Full call-configuration form (mode, language,
 *                             LLM/TTS/STT providers, function-calling and
 *                             screen-share toggles).
 */
test.describe('Journey 46: Mentor Voice Tab', () => {
  test.beforeEach(async ({ page, editMentorPage }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      test.skip(true, 'Voice tab requires admin access');
      return;
    }
    await editMentorPage.open('Voice');
    await waitForPageReady(page);
  });

  // VO-01: Voice tab is visible in the modal sidebar
  test('admin sees the Voice tab label in the sidebar', async ({
    editMentorPage,
  }) => {
    await expect(editMentorPage.voice.tabLink).toBeVisible({ timeout: 10_000 });
    await editMentorPage.close();
  });

  // VO-02: Voice header renders
  test('admin opens the Voice tab and sees the heading', async ({
    editMentorPage,
  }) => {
    await expect(editMentorPage.voice.heading).toBeVisible({ timeout: 10_000 });
    await editMentorPage.close();
  });

  // VO-03: Voice / Voice call sub-tab segmented control renders
  test('admin sees both Voice and Voice call sub-tabs', async ({
    editMentorPage,
  }) => {
    await expect(editMentorPage.voice.subTabs).toBeVisible({ timeout: 10_000 });
    await expect(editMentorPage.voice.voiceSubTab).toBeVisible({
      timeout: 5_000,
    });
    await expect(editMentorPage.voice.callConfigSubTab).toBeVisible({
      timeout: 5_000,
    });
    await editMentorPage.close();
  });

  // VO-04: All three provider cards are visible on the Voice sub-tab
  test('admin sees Browser, OpenAI and Google provider cards', async ({
    editMentorPage,
  }) => {
    await editMentorPage.voice.switchToVoiceSubTab();
    await expect(editMentorPage.voice.providerCard('browser')).toBeVisible({
      timeout: 10_000,
    });
    await expect(editMentorPage.voice.providerCard('openai')).toBeVisible({
      timeout: 5_000,
    });
    await expect(editMentorPage.voice.providerCard('google')).toBeVisible({
      timeout: 5_000,
    });
    await editMentorPage.close();
  });

  // VO-05: Selecting OpenAI marks the card as the active provider and
  // reveals the OpenAI voice-picker trigger
  test('selecting the OpenAI provider reveals the OpenAI voice picker trigger', async ({
    editMentorPage,
  }) => {
    await editMentorPage.voice.switchToVoiceSubTab();

    await editMentorPage.voice.selectProvider('openai');
    await editMentorPage.voice.expectProviderSelected('openai');

    await expect(editMentorPage.voice.mentorVoiceTriggerOpen()).toBeVisible({
      timeout: 10_000,
    });

    await editMentorPage.close();
  });

  // VO-06: Selecting the Browser provider hides the picker trigger entirely
  test('selecting the Browser provider hides the voice picker trigger', async ({
    editMentorPage,
  }) => {
    await editMentorPage.voice.switchToVoiceSubTab();

    await editMentorPage.voice.selectProvider('browser');
    await editMentorPage.voice.expectProviderSelected('browser');

    await expect(editMentorPage.voice.mentorVoiceTriggerOpen()).not.toBeVisible(
      { timeout: 5_000 },
    );

    await editMentorPage.close();
  });

  // VO-07: Switching to the Voice call sub-tab renders the call-config form
  test('switching to the Voice call sub-tab renders the call configuration form', async ({
    editMentorPage,
  }) => {
    await editMentorPage.voice.switchToCallConfigSubTab();
    await editMentorPage.voice.expectCallConfigVisible();
    await editMentorPage.close();
  });

  // VO-08: Realtime mode disables the TTS and STT selects (provider is
  // handled inside the LLM combo). This protects against accidental
  // regression of the inference vs realtime branching.
  test('choosing Realtime call mode disables the TTS and STT selects', async ({
    editMentorPage,
  }) => {
    await editMentorPage.voice.switchToCallConfigSubTab();

    await editMentorPage.voice.selectCallMode('realtime');
    await editMentorPage.voice.expectTtsDisabled();
    await editMentorPage.voice.expectSttDisabled();

    await editMentorPage.close();
  });

  // VO-09: The two voice-call toggles ("Look things up only when needed"
  // and "Allow screen sharing on a call") are surfaced in the Settings
  // tab so admins can toggle them without leaving the main configuration
  // panel. They still write to the CallConfiguration endpoint under the
  // hood — see CallConfigSection in the SDK for the canonical fields.
  test('admin sees the voice-call toggles surfaced in the Settings tab', async ({
    editMentorPage,
  }) => {
    await editMentorPage.navigateToTab('Settings');

    const fnCallingToggle = editMentorPage.dialog.getByLabel(
      /Look things up only when needed (enabled|disabled)/i,
    );
    const screenShareToggle = editMentorPage.dialog.getByLabel(
      /Allow screen sharing on a call (enabled|disabled)/i,
    );

    await expect(fnCallingToggle).toBeVisible({ timeout: 10_000 });
    await expect(screenShareToggle).toBeVisible({ timeout: 5_000 });

    await editMentorPage.close();
  });

  // VO-10: Flipping a voice-call toggle in Settings and clicking Save
  // surfaces the standard "Agent updated successfully" toast — proving
  // the Settings-side Save handler routes the call-configurations
  // mutation alongside the mentor-settings mutation without erroring.
  test('toggling the voice-call switches and saving succeeds end-to-end', async ({
    editMentorPage,
    page,
  }) => {
    await editMentorPage.navigateToTab('Settings');

    const fnCallingToggle = editMentorPage.dialog.getByLabel(
      /Look things up only when needed (enabled|disabled)/i,
    );
    await expect(fnCallingToggle).toBeVisible({ timeout: 10_000 });
    const wasEnabled =
      (await fnCallingToggle.getAttribute('aria-checked').catch(() => null)) ===
      'true';

    await fnCallingToggle.click();

    await editMentorPage.dialog
      .getByRole('button', { name: 'Save', exact: true })
      .click();

    await expect(page.getByText('Agent updated successfully')).toBeVisible({
      timeout: 15_000,
    });

    // Restore so subsequent tests start from the same state.
    await fnCallingToggle.click();
    await editMentorPage.dialog
      .getByRole('button', { name: 'Save', exact: true })
      .click();
    await expect(page.getByText('Agent updated successfully')).toBeVisible({
      timeout: 15_000,
    });
    void wasEnabled;

    await editMentorPage.close();
  });
});
