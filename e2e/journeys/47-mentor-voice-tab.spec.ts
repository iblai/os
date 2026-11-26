import { test, expect } from '../fixtures/mentor-test';
import {
  navigateToMentorApp,
  checkAdminStatus,
  getPlatformContext,
} from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';
import { MentorTracker } from '../utils/mentor-cleanup';

/**
 * Journey 47 — Mentor Voice Tab.
 *
 * The Voice tab is rendered by `AgentVoiceTab` from `@iblai/iblai-js/web-containers`.
 * All selectors flow through the SDK's official Playwright helpers
 * (re-exported by `@iblai/iblai-js/playwright`) via the VoiceTab page
 * object. If the host overrides VoiceTabLabels, update the constants
 * imported by the page object — never patch a selector in this file.
 *
 * Tab layout (three always-usable sub-tabs and an info box above them):
 *   • "Voice" → 3 provider cards (Browser / OpenAI / Google). Choosing
 *                      OpenAI / Google reveals the picker trigger; Browser
 *                      hides it. No switch: it drives Read Aloud.
 *   • "Calls"       → In-App Chat / Embed Widget switches (save on click),
 *                      then the call-configuration form.
 *   • "Dictation"   → In-App Chat / Embed Widget switches (save on click),
 *                      then language and transcription hints.
 *
 * A sub-tab's content is inert only while BOTH of its switches are off.
 */

// Run the WHOLE file serially in a single worker AND give every test its own
// freshly-created mentor. The four voice switches are persisted SERVER-SIDE
// per mentor, and every worker shares the same admin storageState + default
// selected agent — so without isolation a concurrent flip in another test or
// journey could change a flag inside a sibling's negative-assertion window.
// File-level serial (NOT per-describe — separate serial describes still run in
// parallel across workers) pins the file to one worker; the per-test dedicated
// mentor in beforeEach guarantees no other test or worker can touch it.
// Mirrors journey 44's enable_claw isolation.
test.describe.configure({ mode: 'serial' });

test.describe('Journey 47: Mentor Voice Tab', () => {
  const tracker47 = new MentorTracker();

  test.beforeEach(async ({ page, editMentorPage, createMentorPage }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      test.skip(true, 'Voice tab requires admin access');
      return;
    }

    // Fresh, dedicated mentor per test; see the file-level serial note.
    await createMentorPage.openAndCreate();
    const { mentorId } = await getPlatformContext(page);
    tracker47.add(mentorId);

    await editMentorPage.open('Voice');
    await waitForPageReady(page);
  });

  // VO-01: Voice tab is visible in the modal sidebar (always mounted now)
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

  // VO-03: the three sub-tab pills render
  test('admin sees the Voice, Calls and Dictation sub-tabs', async ({
    editMentorPage,
  }) => {
    await expect(editMentorPage.voice.subTabs).toBeVisible({ timeout: 10_000 });
    await expect(editMentorPage.voice.voiceSubTab).toBeVisible({
      timeout: 5_000,
    });
    await expect(editMentorPage.voice.callConfigSubTab).toBeVisible({
      timeout: 5_000,
    });
    await expect(editMentorPage.voice.dictationSubTab).toBeVisible({
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

  // VO-09: The "Smart Document Retrieval" switch lives in the Voice call
  // sub-tab's call settings (it moved out of Settings > Capabilities).
  test('admin sees the Smart Document Retrieval switch in the Voice call settings', async ({
    editMentorPage,
  }) => {
    await editMentorPage.voice.switchToCallConfigSubTab();
    await editMentorPage.voice.expectCallConfigVisible();

    await expect(editMentorPage.voice.smartDocumentRetrievalToggle).toBeVisible(
      { timeout: 10_000 },
    );
    await expect(
      editMentorPage.voice.smartDocumentRetrievalToggle,
    ).toHaveAccessibleName(/^Smart Document Retrieval\b/);

    await editMentorPage.close();
  });

  // VO-10: Flipping the "Smart Document Retrieval" switch and clicking the
  // call settings' Save button shows the success toast (the switch is saved
  // by that section's Save, not on the click). Restores the original state so
  // the suite stays idempotent regardless of fixture defaults.
  test('toggling Smart Document Retrieval and saving the call settings succeeds', async ({
    editMentorPage,
  }) => {
    await editMentorPage.voice.switchToCallConfigSubTab();
    await editMentorPage.voice.expectCallConfigVisible();

    const wasOn = await editMentorPage.voice.isSmartDocumentRetrievalOn();
    await editMentorPage.voice.setSmartDocumentRetrievalAndSave(!wasOn);
    await editMentorPage.voice.setSmartDocumentRetrievalAndSave(wasOn);

    await editMentorPage.close();
  });

  // VO-11: The Voice Calls In-App Chat switch turns off and on and saves on
  // click. While the Embed Widget switch is still on the call settings stay
  // usable; with both off they grey out, and either one brings them back.
  test('admin turns the Voice Calls In-App Chat switch off and on, and the call settings grey out only when both surfaces are off', async ({
    editMentorPage,
  }) => {
    const voice = editMentorPage.voice;
    await expect(voice.tabLink).toBeVisible({ timeout: 5_000 });
    const wasInApp = await voice.isSurfaceSwitchOn('voice-calls', 'in-app');
    const wasEmbed = await voice.isSurfaceSwitchOn('voice-calls', 'embed');

    await voice.setSurfaceSwitch('voice-calls', 'embed', true);
    await voice.setSurfaceSwitch('voice-calls', 'in-app', false);
    await expect(voice.capabilityToggle).toHaveAttribute(
      'aria-checked',
      'false',
    );
    await expect(voice.capabilityContent).toHaveAttribute(
      'data-enabled',
      'true',
      { timeout: 10_000 },
    );

    await voice.setSurfaceSwitch('voice-calls', 'embed', false);
    await expect(voice.capabilityContent).toHaveAttribute(
      'data-enabled',
      'false',
      { timeout: 10_000 },
    );
    await expect(voice.capabilityOffHint).toBeVisible({ timeout: 10_000 });

    await voice.setSurfaceSwitch('voice-calls', 'in-app', true);

    await voice.setSurfaceSwitch('voice-calls', 'in-app', wasInApp);
    await voice.setSurfaceSwitch('voice-calls', 'embed', wasEmbed);
    await editMentorPage.close();
  });

  // VO-12: Either Voice Calls switch alone ungates the call settings again.
  test('turning either Voice Calls switch back on ungates the call settings', async ({
    editMentorPage,
  }) => {
    const voice = editMentorPage.voice;
    const wasInApp = await voice.isSurfaceSwitchOn('voice-calls', 'in-app');
    const wasEmbed = await voice.isSurfaceSwitchOn('voice-calls', 'embed');

    await voice.setSurfaceSwitch('voice-calls', 'in-app', false);
    await voice.setSurfaceSwitch('voice-calls', 'embed', false);
    await expect(voice.capabilityContent).toHaveAttribute(
      'data-enabled',
      'false',
      { timeout: 10_000 },
    );

    await voice.setSurfaceSwitch('voice-calls', 'embed', true);
    await expect(voice.capabilityContent).toHaveAttribute(
      'data-enabled',
      'true',
      { timeout: 15_000 },
    );

    await voice.setSurfaceSwitch('voice-calls', 'in-app', true);
    await voice.setSurfaceSwitch('voice-calls', 'embed', false);
    await expect(voice.capabilityContent).toHaveAttribute(
      'data-enabled',
      'true',
      { timeout: 15_000 },
    );

    await voice.setSurfaceSwitch('voice-calls', 'in-app', wasInApp);
    await voice.setSurfaceSwitch('voice-calls', 'embed', wasEmbed);
    await editMentorPage.close();
  });

  // VO-13: Smart Document Retrieval is a call setting: it is not offered in
  // Settings > Capabilities, and the Voice call form keeps its state after a
  // save and reopen.
  test('Smart Document Retrieval is absent from Settings and persists in the Voice call settings', async ({
    page,
    editMentorPage,
  }) => {
    await editMentorPage.voice.switchToCallConfigSubTab();
    await editMentorPage.voice.expectCallConfigVisible();
    const wasOn = await editMentorPage.voice.isSmartDocumentRetrievalOn();

    await editMentorPage.voice.setSmartDocumentRetrievalAndSave(!wasOn);
    await editMentorPage.close();

    await editMentorPage.open('Settings');
    await editMentorPage.settings.selectSubTab('Capabilities');
    await expect(
      editMentorPage.dialog.getByText('Smart Document Retrieval'),
    ).toHaveCount(0);
    await editMentorPage.close();

    await editMentorPage.open('Voice');
    await waitForPageReady(page);
    await editMentorPage.voice.switchToCallConfigSubTab();
    await editMentorPage.voice.expectCallConfigVisible();
    expect(await editMentorPage.voice.isSmartDocumentRetrievalOn()).toBe(
      !wasOn,
    );

    await editMentorPage.voice.setSmartDocumentRetrievalAndSave(wasOn);
    await editMentorPage.close();
  });

  // VO-14: With Voice Calls off for both surfaces the pills still open every
  // sub-tab and Voice stays usable (it has no switch and no gate).
  test('The Voice sub-tab and the pills stay usable while Voice Calls is off for both surfaces', async ({
    editMentorPage,
  }) => {
    const voice = editMentorPage.voice;
    const wasInApp = await voice.isSurfaceSwitchOn('voice-calls', 'in-app');
    const wasEmbed = await voice.isSurfaceSwitchOn('voice-calls', 'embed');

    await voice.setSurfaceSwitch('voice-calls', 'in-app', false);
    await voice.setSurfaceSwitch('voice-calls', 'embed', false);
    await expect(voice.capabilityContent).toHaveAttribute(
      'data-enabled',
      'false',
      { timeout: 10_000 },
    );

    await voice.switchToVoiceSubTab();
    await expect(voice.capabilityContent).toHaveCount(0);
    await expect(voice.providerCard('browser')).toBeVisible({
      timeout: 10_000,
    });
    await voice.selectProvider('openai');
    await voice.expectProviderSelected('openai');

    await voice.switchToDictationSubTab();
    await expect(voice.surfaceSwitch('dictation', 'in-app')).toBeVisible({
      timeout: 10_000,
    });

    await voice.setSurfaceSwitch('voice-calls', 'in-app', wasInApp);
    await voice.setSurfaceSwitch('voice-calls', 'embed', wasEmbed);
    await editMentorPage.close();
  });

  // VO-15: The Dictation In-App Chat switch saves on click and keeps its
  // state after the dialog is closed and the page reloaded.
  test('Dictation In-App Chat switch saves on click and survives a reload', async ({
    page,
    editMentorPage,
  }) => {
    const voice = editMentorPage.voice;
    const was = await voice.isSurfaceSwitchOn('dictation', 'in-app');

    await voice.setSurfaceSwitch('dictation', 'in-app', !was);
    await editMentorPage.close();
    await page.reload();
    await waitForPageReady(page);

    await editMentorPage.open('Voice');
    await waitForPageReady(page);
    expect(await voice.isSurfaceSwitchOn('dictation', 'in-app')).toBe(!was);

    await voice.setSurfaceSwitch('dictation', 'in-app', was);
    await editMentorPage.close();
  });

  // VO-16: The Voice Calls Embed Widget switch saves on click and survives a
  // reload, independently of the In-App Chat switch.
  test('Voice Calls Embed Widget switch saves on click and survives a reload', async ({
    page,
    editMentorPage,
  }) => {
    const voice = editMentorPage.voice;
    const was = await voice.isSurfaceSwitchOn('voice-calls', 'embed');
    const inAppBefore = await voice.isSurfaceSwitchOn('voice-calls', 'in-app');

    await voice.setSurfaceSwitch('voice-calls', 'embed', !was);
    await editMentorPage.close();
    await page.reload();
    await waitForPageReady(page);

    await editMentorPage.open('Voice');
    await waitForPageReady(page);
    expect(await voice.isSurfaceSwitchOn('voice-calls', 'embed')).toBe(!was);
    expect(await voice.isSurfaceSwitchOn('voice-calls', 'in-app')).toBe(
      inAppBefore,
    );

    await voice.setSurfaceSwitch('voice-calls', 'embed', was);
    await editMentorPage.close();
  });

  // VO-17: Settings > Capabilities no longer offers voice switches; File
  // Attachments is still there.
  test('Settings > Capabilities shows File Attachments and no voice rows', async ({
    editMentorPage,
  }) => {
    await editMentorPage.close();
    await editMentorPage.open('Settings');
    await editMentorPage.settings.selectSubTab('Capabilities');

    await expect(
      editMentorPage.settings.capabilityMatrixRowAttachment,
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      editMentorPage.dialog.getByTestId('capability-matrix-row-voice-call'),
    ).toHaveCount(0);
    await expect(
      editMentorPage.dialog.getByTestId('capability-matrix-row-voice-record'),
    ).toHaveCount(0);
    await editMentorPage.close();
  });

  // VO-18: The info box and the three pill names read as the product copy.
  test('Voice tab shows the info box and the Voice, Calls and Dictation pills', async ({
    editMentorPage,
  }) => {
    const voice = editMentorPage.voice;
    await expect(voice.infoBox).toBeVisible({ timeout: 10_000 });
    await expect(voice.infoBox).toContainText('Voice sets the voice');
    await expect(voice.voiceSubTab).toHaveText('Voice');
    await expect(voice.callConfigSubTab).toHaveText('Calls');
    await expect(voice.dictationSubTab).toHaveText('Dictation');
    await editMentorPage.close();
  });

  test.afterAll(async ({ browser }, testInfo) => {
    await tracker47.deleteAll(browser, testInfo);
  });
});
