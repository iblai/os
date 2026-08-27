/**
 * Journey 71: VM Sandbox File Artifact — Canvas Preview
 *
 * End-to-end, LIVE-LLM coverage of the VM-sandbox file-sharing pipeline that
 * journey 44 (CLAW Advanced Sandbox) exercises only at the settings-toggle
 * level: select the "Virtual Machine Shell" sandbox kind on a mentor, ask
 * the agent (over a real chat turn) to create and share a plain-text file,
 * and verify the agent replies with the file — the artifact chip appears in
 * chat and the canvas shows the file's content.
 *
 * A .txt file was chosen deliberately over a binary format (pdf/xlsx): the
 * VM can produce it with plain shell tooling, no libraries to install, so
 * the journey verifies the sandbox→share_files→artifact pipeline itself
 * without also gambling on the LLM assembling a valid binary file. Text
 * files stream as regular text artifacts (`is_binary: false`, content in
 * the events), so the expected surface is the editable text canvas — NOT
 * the read-only binary viewer, which this spec asserts stays absent. The
 * binary-canvas surfaces (pdf iframe, image preview, no-preview fallback)
 * remain unit-covered only — see cvs-12/cvs-13/cvs-15 in coverage.json.
 *
 * ── Why a dedicated mentor + serial mode ──────────────────────────────────
 *
 * Selecting a sandbox kind is a destructive mutation of mentor settings (see
 * `SandboxTab` — the three kinds are mutually exclusive and at least one is
 * always active, and this journey's whole point is to actually USE the
 * selected kind against a live LLM). Per this project's
 * shared-mentor-isolation convention, that must never run against the
 * account-wide most-recently-accessed mentor other journeys depend on
 * (`navigateToMentorApp` lands there, and journeys like 06/07 mutate/read
 * its settings expecting no interference). This file creates its own
 * mentor, tracks it with `MentorTracker`, and deletes it in `afterAll` —
 * mirroring journey 44's per-suite pattern. `test.describe.configure({
 * mode: 'serial' })` keeps the whole file in one worker so two live-LLM
 * generation flows never run concurrently in the same CI shard.
 *
 * ── Timing ────────────────────────────────────────────────────────────────
 *
 * VM boot + a real generation turn is slow — `test.slow()` triples the
 * suite's default test timeout, and the chip wait below carries its own
 * generous multi-minute timeout. Unrelated assertions (canvas render,
 * content) keep normal timeouts — only the live-generation step is
 * inflated.
 */

import { test, expect } from '../fixtures/mentor-test';
import {
  navigateToMentorApp,
  checkAdminStatus,
  getPlatformContext,
} from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';
import { MentorTracker } from '../utils/mentor-cleanup';
import { SandboxTab } from '../page-objects/edit-mentor/sandbox.tab';

const FILE_MARKER = 'Hello from the sandbox VM';

test.describe.configure({ mode: 'serial' });

test.describe('Journey 71: VM Sandbox File Artifact — Canvas Preview', () => {
  const tracker = new MentorTracker();

  test.beforeEach(async ({ page, createMentorPage, editMentorPage }) => {
    await navigateToMentorApp(page);
    const isAdmin = await checkAdminStatus(page);
    if (!isAdmin) {
      test.skip(true, 'VM sandbox requires admin access');
      return;
    }

    // Dedicated mentor — see the file header for why this can't be the
    // shared admin mentor.
    await createMentorPage.openAndCreate();
    const { mentorId } = await getPlatformContext(page);
    tracker.add(mentorId);

    // Select the Virtual Machine Shell sandbox kind. `selectKind` delegates
    // to the page object's local toggle — the three kinds are mutually
    // exclusive and at least one is always active, so selecting VM
    // atomically deactivates whichever kind the fresh mentor defaulted to;
    // no explicit "disable" step is needed or possible.
    await editMentorPage.open('Settings');
    await editMentorPage.navigateToTab('Sandbox');
    await waitForPageReady(page);
    const sandbox = new SandboxTab(page, editMentorPage.dialog);
    await sandbox.selectKind('virtual-machine');
    expect(await sandbox.isKindEnabled('virtual-machine')).toBe(true);
    await editMentorPage.close();
  });

  test('admin enables the VM sandbox kind, asks the agent for a txt file, and the canvas shows its content', async ({
    page,
    chatPage,
    editMentorPage,
  }) => {
    // VM boot + a real generation turn is slow — extend the test-level
    // timeout (not just individual waits) so Playwright's own timeout
    // doesn't fire mid-generation.
    test.slow();

    try {
      // The artifact pipeline is inert unless the composer's Canvas tool is
      // active for the session — without it the agent's reply never becomes
      // an artifact chip, and the 4-minute chip wait below times out (seen
      // on stg2, where a fresh mentor starts with the tool off; some envs
      // default it on, which is why enableCanvasTool is idempotent).
      await chatPage.enableCanvasTool();

      await chatPage.sendMessage(
        `Create a plain text file named hello.txt whose content is exactly the line '${FILE_MARKER}', and share the file with me.`,
      );

      // vmc-01: the agent's reply carries the file as an artifact — the chat
      // chip (CanvasMessagePreview) appears with its Open Canvas action. VM
      // boot + file generation is the slow part of this whole journey —
      // budget generously here specifically.
      await expect(chatPage.canvasMessagePreview.first()).toBeVisible({
        timeout: 240_000,
      });

      // Text artifacts stream into the canvas and auto-open it at stream
      // start (components/chat/index.tsx's handleArtifactStreamStart) —
      // tolerate either that having happened already or needing the chip's
      // Open Canvas click.
      try {
        await chatPage.canvasEditor.waitFor({
          state: 'visible',
          timeout: 10_000,
        });
      } catch {
        await expect(chatPage.canvasOpenButton.first()).toBeEnabled({
          timeout: 30_000,
        });
        await chatPage.canvasOpenButton.first().click();
      }

      // vmc-02: the canvas shows the shared file's actual content. A .txt
      // artifact takes the TEXT canvas path (is_binary: false — content
      // streams in the artifact events), so the editable editor must render
      // with the file text and the read-only binary viewer must stay absent.
      await expect(chatPage.canvasEditor).toBeVisible({ timeout: 30_000 });
      await expect(chatPage.canvasEditor).toContainText(FILE_MARKER, {
        timeout: 120_000,
      });
      await expect(chatPage.binaryCanvas).toHaveCount(0);
    } finally {
      // Switch the mentor's sandbox kind away from VM. There is no
      // "disable" operation (at least one kind is always active) — this
      // just leaves Computational Runtime active instead. Not strictly
      // necessary before the afterAll delete (the mentor is destroyed
      // regardless), but cheap and matches how other destructive-setting
      // specs (journey 44) restore state — worth doing in case a slow/flaky
      // afterAll delete ever leaves this mentor alive longer than expected.
      try {
        await editMentorPage.open('Settings');
        await editMentorPage.navigateToTab('Sandbox');
        await waitForPageReady(page);
        const sandbox = new SandboxTab(page, editMentorPage.dialog);
        await sandbox.selectKind('computational-runtime');
        await editMentorPage.close();
      } catch {
        // Best-effort — the mentor is deleted in afterAll regardless.
      }
    }
  });

  test.afterAll(async ({ browser }, testInfo) => {
    await tracker.deleteAll(browser, testInfo);
  });
});
