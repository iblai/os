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

    // Open the Edit Agent modal to the Settings tab first, not directly to
    // Voice. The Voice tab is admin-gated by the segments hook (userTypes:
    // [FREE_TRIAL, ADMIN] with no rbacResource), so it only mounts after the
    // mentor-settings + RBAC queries have hydrated. Jumping straight to Voice
    // raced that hydration and surfaced as a 30s click-timeout on the sidebar
    // trigger; opening Settings first gives the modal a stable mount target
    // while the rest of the sidebar fills in.
    await editMentorPage.open('Settings');
    await waitForPageReady(page);

    // Defensive: if the Voice sidebar trigger is missing (e.g. an env
    // configuration hid it), fall back to flipping "Enable voice calls" ON
    // in Capabilities and re-verify. Voice tab visibility is admin-gated by
    // the segments hook — verified in-browser that the toggle itself does
    // NOT hide the sidebar tab — but this is the closest user-facing lever
    // for an admin to nudge the modal back into a usable state without
    // restarting the suite.
    const voiceTabVisible = await editMentorPage.voice.tabLink
      .isVisible({ timeout: 15_000 })
      .catch(() => false);
    if (!voiceTabVisible) {
      // `enableVoiceCall` switches to the Capabilities sub-tab internally
      // and Saves the form, so the mentor settings cache is invalidated and
      // the segment list re-evaluates on the next render.
      await editMentorPage.settings.enableVoiceCall();
      await expect(editMentorPage.voice.tabLink).toBeVisible({
        timeout: 15_000,
      });
    }

    // Navigate to Voice via the page-object's robust sidebar-trigger
    // locator (filters to :visible + waits for the trigger to mount).
    await editMentorPage.navigateToTab('Voice');
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

  // VO-08: Switching between the Realtime and Step-by-step call modes
  // keeps the Voice call configuration form rendered. The SDK no longer
  // surfaces standalone TTS / STT selects — those providers are now
  // auto-derived from the chosen LLM provider — so this checkpoint
  // exercises the mode round-trip instead, which is the user-visible
  // contract that survives the SDK collapse.
  test('switching between Realtime and Step-by-step call modes keeps the form rendered', async ({
    editMentorPage,
  }) => {
    await editMentorPage.voice.switchToCallConfigSubTab();
    await editMentorPage.voice.expectCallConfigVisible();

    await editMentorPage.voice.selectCallMode('realtime');
    await editMentorPage.voice.expectCallConfigVisible();

    await editMentorPage.voice.selectCallMode('inference');
    await editMentorPage.voice.expectCallConfigVisible();

    await editMentorPage.close();
  });

  // VO-09: The two voice-call toggles ("Look things up only when needed"
  // and "Allow screen sharing on a call") are surfaced in the Settings
  // tab so admins can toggle them without leaving the main configuration
  // panel. They still write to the CallConfiguration endpoint under the
  // hood — see CallConfigSection in the SDK for the canonical fields.
  //
  // Locators come from the SettingsTab page object, which resolves both
  // toggles by `data-testid` — keeping the test independent of any
  // future label tweaks the host might apply.
  test('admin sees the voice-call toggles surfaced in the Settings tab', async ({
    editMentorPage,
  }) => {
    await editMentorPage.navigateToTab('Settings');
    // Both toggles live in the Capabilities sub-tab. Panels are forceMounted
    // but CSS-hidden when inactive, so switch there before asserting on
    // visibility.
    await editMentorPage.settings.selectSubTab('Capabilities');

    await expect(
      editMentorPage.settings.useFunctionCallingForRagToggle,
    ).toBeVisible({ timeout: 10_000 });
    await expect(editMentorPage.settings.enableVideoToggle).toBeVisible({
      timeout: 5_000,
    });

    await editMentorPage.close();
  });

  // VO-10: Flipping the "Look things up only when needed" toggle in
  // Settings and clicking Save surfaces the "Agent updated successfully"
  // toast — proving the Settings-side Save handler routes the
  // call-configurations mutation alongside the mentor-settings mutation
  // without erroring. Restores to the original state so the suite stays
  // idempotent regardless of fixture defaults.
  test('toggling the voice-call switches and saving succeeds end-to-end', async ({
    editMentorPage,
  }) => {
    await editMentorPage.navigateToTab('Settings');

    const wasEnabled =
      await editMentorPage.settings.isUseFunctionCallingForRagEnabled();

    await editMentorPage.settings.setUseFunctionCallingForRagAndSave(
      !wasEnabled,
    );

    // Restore so subsequent tests start from the same state.
    await editMentorPage.settings.setUseFunctionCallingForRagAndSave(
      wasEnabled,
    );

    await editMentorPage.close();
  });

  // VO-11: The Voice top-level tab is gated on the "Enable voice calls"
  // toggle (`show_voice_call`). Turning voice calls off in Settings hides
  // the Voice tab from the sidebar entirely — even across reloads, because
  // the gate reads from the persisted mentor settings. Mirrors the
  // Screen Share gating in journey 47. The beforeEach opens the Voice tab,
  // so voice calls are on at the start; we restore to on at the end to keep
  // the suite idempotent (the next beforeEach needs the Voice tab present).
  test('Voice tab is hidden when "Enable voice calls" is off', async ({
    editMentorPage,
  }) => {
    await editMentorPage.navigateToTab('Settings');
    await editMentorPage.settings.disableVoiceCall();

    await expect(editMentorPage.voice.tabLink).not.toBeVisible({
      timeout: 10_000,
    });

    // Restore so subsequent tests (and their beforeEach) see the Voice tab.
    await editMentorPage.settings.enableVoiceCall();

    await editMentorPage.close();
  });

  // VO-12: Re-enabling "Enable voice calls" brings the Voice tab back into
  // the sidebar after the mentor-settings refetch completes.
  test('enabling "Enable voice calls" reveals the Voice tab', async ({
    editMentorPage,
  }) => {
    await editMentorPage.navigateToTab('Settings');

    // Drive to a known-off state first, confirm the tab is gone, then flip
    // it back on and assert it returns.
    await editMentorPage.settings.disableVoiceCall();
    await expect(editMentorPage.voice.tabLink).not.toBeVisible({
      timeout: 10_000,
    });

    await editMentorPage.settings.enableVoiceCall();
    await expect(editMentorPage.voice.tabLink).toBeVisible({ timeout: 15_000 });

    await editMentorPage.close();
  });
});
