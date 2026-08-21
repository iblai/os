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
 * Tab layout:
 *   • Sub-tab "Voice"      → 3 provider cards (Browser / OpenAI / Google).
 *                             Choosing OpenAI / Google reveals the picker
 *                             trigger; Browser hides it.
 *   • Sub-tab "Voice call" → Full call-configuration form (mode, language,
 *                             LLM/TTS/STT providers, function-calling and
 *                             screen-share toggles).
 *
 * ── Capability-gate refactor ─────────────────────────────────────────────
 *
 * The "Enable voice calls" (`show_voice_call`) toggle used to live in
 * Settings → Capabilities and gate the Voice top-level tab's visibility. It
 * now lives inline at the top of the Voice tab itself via the shared
 * `CapabilityGate` component (`data-testid="voice-capability-toggle"`), and
 * `hooks/use-mentor-segments.ts` no longer gates the Voice segment at all —
 * the tab is ALWAYS mounted. Both sub-tabs render inside a grayed + inert
 * `data-testid="capability-gate-content"` wrapper while the toggle is off.
 *
 * ── Voice Instructions ────────────────────────────────────────────────────
 *
 * A "Voice Instructions" prompt card (`data-testid="voice-instructions-card"`)
 * renders below the voice picker whenever the OpenAI or Google provider is
 * selected — never for Browser. It follows the same PromptCard + shared
 * `EditPromptModal` pattern as Prompts / Screen share: an "Edit Voice
 * Instructions" button opens the rich-text editor, and saving IT only writes
 * local form state — the Voice sub-tab's own Save button
 * (`data-testid="voice-save-button"`, `VoiceTab.saveVoiceSettings()`) is what
 * persists `voice_instructions` (and `voice_provider`) to mentor settings via
 * `editMentor`, with a "Voice saved" success toast. A `{len}/1000` counter
 * (`data-testid="voice-instructions-counter"`) turns red over the 1000-char
 * soft cap and disables that Save button — no truncation happens client-side.
 * See `VoiceTab.setVoiceInstructions` for why the page object reimplements
 * the SDK's helper of the same name instead of delegating to it (a
 * dialog-scoping hazard where the Edit Agent modal is itself `role="dialog"`).
 */

// Run the WHOLE file serially in a single worker AND give every test its own
// freshly-created mentor. `show_voice_call` is persisted SERVER-SIDE per
// mentor, and every worker shares the same admin storageState + default
// selected agent — so without isolation a concurrent capability-toggle flip
// in another test or journey (this file's own VO-11/VO-12, or journey 09's
// Admin voice tests) could flip the flag back inside a sibling's
// negative-assertion window. File-level serial (NOT per-describe — separate
// serial describes still run in parallel across workers) pins the file to
// one worker; the per-test dedicated mentor in beforeEach guarantees no
// other test or worker can touch this mentor's show_voice_call. Mirrors
// journey 44's enable_claw isolation.
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

    // Create a fresh, dedicated mentor for every test so each show_voice_call
    // mutation runs against a mentor no other test/worker can select.
    await createMentorPage.openAndCreate();
    const { mentorId } = await getPlatformContext(page);
    tracker47.add(mentorId);

    // Voice is always mounted now — open straight to it.
    await editMentorPage.open('Voice');
    await waitForPageReady(page);

    // New mentors default show_voice_call ON, so the capability is usually
    // already enabled. Defensive fallback: ensure it's on so the sub-tabs
    // are interactive for tests that need them.
    const capabilityOn = await editMentorPage.voice.isCapabilityEnabled();
    if (!capabilityOn) {
      await editMentorPage.voice.setCapabilityEnabled(true);
    }
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

  // VO-09: The "Enable smart document retrieval" voice-call toggle is
  // surfaced in the Settings tab so admins can toggle it without leaving
  // the main configuration panel. It still writes to the CallConfiguration
  // endpoint under the hood — see CallConfigSection in the SDK for the
  // canonical fields. ("Enable screen sharing" moved off Settings — it now
  // lives on the Screen Share tab's own capability toggle; see journey 48.)
  test('admin sees the smart-document-retrieval voice-call toggle surfaced in the Settings tab', async ({
    editMentorPage,
  }) => {
    await editMentorPage.navigateToTab('Settings');
    // Lives in the Capabilities sub-tab. Panels are forceMounted but
    // CSS-hidden when inactive, so switch there before asserting visibility.
    await editMentorPage.settings.selectSubTab('Capabilities');

    await expect(
      editMentorPage.settings.useFunctionCallingForRagToggle,
    ).toBeVisible({ timeout: 10_000 });

    await editMentorPage.close();
  });

  // VO-10: Flipping the "Enable smart document retrieval" toggle in
  // Settings and clicking Save surfaces the "Agent updated successfully"
  // toast — proving the Settings-side Save handler routes the
  // call-configurations mutation alongside the mentor-settings mutation
  // without erroring. Restores to the original state so the suite stays
  // idempotent regardless of fixture defaults.
  test('toggling the voice-call switch and saving succeeds end-to-end', async ({
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

  // VO-11: The Voice top-level tab is now ALWAYS visible — the
  // `is_lti_accessible`-style gate on "Enable voice calls" was removed from
  // `hooks/use-mentor-segments.ts`. Turning voice calls off in the Voice
  // tab's own capability toggle grays/inerts the sub-tabs instead of hiding
  // the whole tab. Each test runs against its own freshly created mentor
  // (see the beforeEach + file-level serial note), so this disable can
  // never be stomped by a parallel writer re-enabling the flag.
  test('Voice tab stays visible and its content grays when "Enable voice calls" is off', async ({
    editMentorPage,
  }) => {
    await expect(editMentorPage.voice.tabLink).toBeVisible({ timeout: 5_000 });

    await editMentorPage.voice.setCapabilityEnabled(false);

    await expect(editMentorPage.voice.tabLink).toBeVisible({ timeout: 5_000 });
    await expect(editMentorPage.voice.capabilityContent).toHaveAttribute(
      'data-enabled',
      'false',
      { timeout: 10_000 },
    );

    // Restore so subsequent tests see the capability enabled.
    await editMentorPage.voice.setCapabilityEnabled(true);

    await editMentorPage.close();
  });

  // VO-12: Re-enabling "Enable voice calls" ungates the sub-tab content.
  test('enabling "Enable voice calls" ungates the Voice tab content', async ({
    editMentorPage,
  }) => {
    // Drive to a known-off state first, confirm the content is grayed, then
    // flip it back on and assert it ungates.
    await editMentorPage.voice.setCapabilityEnabled(false);
    await expect(editMentorPage.voice.capabilityContent).toHaveAttribute(
      'data-enabled',
      'false',
      { timeout: 10_000 },
    );

    await editMentorPage.voice.setCapabilityEnabled(true);
    await expect(editMentorPage.voice.capabilityContent).toHaveAttribute(
      'data-enabled',
      'true',
      { timeout: 15_000 },
    );

    await editMentorPage.close();
  });

  // VO-13: The Voice Instructions card (+ its char counter and all three
  // preset chips) is gated purely by which provider is currently selected —
  // local form state, no save required to observe it. OpenAI/Google reveal
  // it; Browser hides it again.
  test('selecting the OpenAI provider reveals the Voice Instructions card and preset chips', async ({
    editMentorPage,
  }) => {
    await editMentorPage.voice.switchToVoiceSubTab();

    await editMentorPage.voice.selectProvider('openai');
    await editMentorPage.voice.expectProviderSelected('openai');

    await expect(editMentorPage.voice.voiceInstructionsCard).toBeVisible({
      timeout: 10_000,
    });
    await expect(editMentorPage.voice.voiceInstructionsCounter).toBeVisible({
      timeout: 5_000,
    });
    for (const preset of ['warm', 'calm', 'energetic'] as const) {
      await expect(
        editMentorPage.voice.voiceInstructionsPresetChip(preset),
      ).toBeVisible({ timeout: 5_000 });
    }

    // Switching back to Browser hides the card (and everything inside it).
    await editMentorPage.voice.selectProvider('browser');
    await editMentorPage.voice.expectProviderSelected('browser');
    await expect(editMentorPage.voice.voiceInstructionsCard).not.toBeVisible({
      timeout: 5_000,
    });

    await editMentorPage.close();
  });

  // VO-14: Applying a preset chip fills the card with canned copy, the
  // counter reflects the new non-zero length, and the tab-level Save button
  // enables (the form is now dirty). Saving persists it and surfaces the
  // "Voice saved" toast (`labels.toasts.voiceSaved` — distinct from the
  // generic "Agent updated successfully" toast used by the Settings tab's
  // own save handler).
  //
  // Preset text comes straight from `AGENT_VOICE_TAB_LABELS.mentorVoice
  // .instructions.presets.warm.text` in the SDK bundle
  // (.yalc/@iblai/web-containers/dist/next/index.esm.js):
  //   "Speak slowly in a warm, encouraging tone, like a patient tutor."
  // We assert on the distinctive trailing phrase "like a patient tutor"
  // rather than the whole sentence, so a copy tweak elsewhere in the string
  // doesn't break this checkpoint.
  test('applying the "warm" Voice Instructions preset fills the card and saves', async ({
    editMentorPage,
  }) => {
    await editMentorPage.voice.switchToVoiceSubTab();
    await editMentorPage.voice.selectProvider('openai');
    await expect(editMentorPage.voice.voiceInstructionsCard).toBeVisible({
      timeout: 10_000,
    });

    await editMentorPage.voice.applyVoiceInstructionsPreset('warm');
    await editMentorPage.voice.expectVoiceInstructionsValue(
      'like a patient tutor',
    );
    await expect(editMentorPage.voice.voiceInstructionsCounter).toHaveText(
      /^[1-9]\d*\/1000$/,
      { timeout: 5_000 },
    );

    const saveButton = editMentorPage.dialog.getByTestId('voice-save-button');
    await expect(saveButton).toBeEnabled({ timeout: 10_000 });

    await editMentorPage.voice.saveVoiceSettings();
    await expect(
      editMentorPage.page.getByText(/voice saved/i).first(),
    ).toBeVisible({ timeout: 15_000 });

    await editMentorPage.close();
  });

  // VO-15: The true persistence round-trip. Set custom instructions via the
  // page object's editor flow, save, close the Edit Agent modal entirely,
  // then reopen it fresh to the Voice tab and confirm the value loads from
  // mentor settings rather than surviving as leftover in-memory form state.
  //
  // No need to re-select the OpenAI provider on reopen: `handleSaveVoice`
  // always sends `voice_provider` alongside `voice_instructions`, so the
  // save in this test already persisted `voice_provider: 'openai'` — the
  // card renders on its own once the tab remounts with the saved settings.
  test('custom Voice Instructions persist across a modal close and reopen', async ({
    page,
    editMentorPage,
  }) => {
    const uniqueText = `e2e-voice-instr-${Date.now()}`;

    await editMentorPage.voice.switchToVoiceSubTab();
    await editMentorPage.voice.selectProvider('openai');
    await expect(editMentorPage.voice.voiceInstructionsCard).toBeVisible({
      timeout: 10_000,
    });

    await editMentorPage.voice.setVoiceInstructions(uniqueText);
    await editMentorPage.voice.expectVoiceInstructionsValue(uniqueText);

    await editMentorPage.voice.saveVoiceSettings();
    await expect(
      editMentorPage.page.getByText(/voice saved/i).first(),
    ).toBeVisible({ timeout: 15_000 });

    await editMentorPage.close();

    // Reopen fresh — the mentor dropdown → Settings/Modify flow, not a
    // resumed dialog — and land back on the Voice tab.
    await editMentorPage.open('Voice');
    await waitForPageReady(page);
    await editMentorPage.voice.switchToVoiceSubTab();

    await expect(editMentorPage.voice.voiceInstructionsCard).toBeVisible({
      timeout: 15_000,
    });
    await editMentorPage.voice.expectVoiceInstructionsValue(uniqueText);

    await editMentorPage.close();
  });

  // NOTE: an over-cap (>1000 chars) checkpoint is intentionally NOT covered
  // here. Typing past the cap through the real editor requires
  // `pressSequentially` one character at a time (no paste/fill shortcut for
  // the ProseMirror contenteditable used by the shared prompt editor), which
  // is prohibitively slow for 1000+ characters in a per-test suite. The
  // over-cap behavior (counter turns red, tab-level Save disables, no
  // client-side truncation) is documented but left to manual/SDK-level
  // verification.

  test.afterAll(async ({ browser }, testInfo) => {
    await tracker47.deleteAll(browser, testInfo);
  });
});
