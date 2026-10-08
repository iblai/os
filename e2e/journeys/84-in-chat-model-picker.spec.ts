/**
 * Journey 84 — In-chat model picker (iblai/iblai-platform#2633)
 *
 * With the agent's "Allow in-chat model change" setting on, a user can pick
 * another model for the current chat only: "+" › Model › provider › model.
 * Each turn then carries `llm_provider` + `llm_name` on the chat socket; a
 * chip names the picked model and its × goes back to the agent's model; a
 * new chat starts on the agent's model again.
 *
 * One throw-away agent (on the cheap ibl.ai model) is shared by the serial
 * checkpoints; it is cleaned up by the resource tracker. Only ibl.ai models
 * are picked, so every turn stays on the cheap provider. icm-06..09 mock the
 * mentor-llms catalogue or the chat socket to reach states the tenant can't
 * produce on demand (per-model keys, one provider, a rejected model).
 * icm-10..13 repeat the picker as a non-admin (student) on the same agent.
 */

import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures/mentor-test';
import { MENTOR_NEXTJS_HOST, generateMentorName } from '../fixtures/test-data';
import {
  navigateToMentorApp,
  checkAdminStatus,
  getPlatformContext,
} from '../utils/auth';
import { waitForPageReady } from '../utils/resilient';

const PROVIDER = 'iblai';
const AGENT_MODEL = 'iblai-fast';
const PICKED_MODEL = 'iblai-pro';

type Frame = Record<string, unknown>;

/** The socket frame that sent `prompt`, once it has gone out. */
async function frameFor(frames: Frame[], prompt: string): Promise<Frame> {
  await expect
    .poll(() => frames.some((frame) => frame.prompt === prompt), {
      timeout: 15_000,
    })
    .toBe(true);
  return frames.find((frame) => frame.prompt === prompt)!;
}

type StudentModel = { provider: string; llmName: string; label: string };

/**
 * The first model the student's own catalogue offers as usable, other than
 * the agent's. A student's `mentor-llms` list is scoped by the backend and
 * can differ from the admin's (it need not include the agent's provider), so
 * student checkpoints pick from it rather than from a hard-coded model.
 */
async function studentModel(
  page: Page,
  open: () => Promise<void>,
): Promise<StudentModel> {
  const response = page.waitForResponse(
    (res) => /\/mentor-llms\/\?.*mentor_id=/.test(res.url()) && res.ok(),
    { timeout: 30_000 },
  );
  await open();
  const rows = (await (await response).json()) as {
    name: string;
    chat_models?: {
      llm_name: string;
      display_name?: string | null;
      availability?: { requires_credential?: boolean } | null;
    }[];
  }[];
  for (const row of rows) {
    for (const model of row.chat_models ?? []) {
      if (model.availability?.requires_credential) continue;
      if (row.name === PROVIDER && model.llm_name === AGENT_MODEL) continue;
      return {
        provider: row.name,
        llmName: model.llm_name,
        label: model.display_name || model.llm_name,
      };
    }
  }
  throw new Error('the student catalogue offers no usable model to pick');
}

test.describe.serial('Journey 84: In-chat model picker', () => {
  test.setTimeout(240_000);

  let mentorUrl = '';

  test('icm-01: admin turns on "Allow in-chat model change" under Settings › Capabilities and Save sends enable_in_chat_llm_change=true', async ({
    page,
    editMentorPage,
    createMentorPage,
  }) => {
    await navigateToMentorApp(page);
    if (!(await checkAdminStatus(page))) {
      test.skip(true, 'Requires admin access');
      return;
    }

    await createMentorPage.openAndCreate(generateMentorName());
    await waitForPageReady(page);
    const { tenantKey, mentorId } = await getPlatformContext(page);
    mentorUrl = `${MENTOR_NEXTJS_HOST}/platform/${tenantKey}/${mentorId}`;

    await editMentorPage.open('LLM');
    await waitForPageReady(page);
    await editMentorPage.llm.selectProviderAndModel('ibl.ai', AGENT_MODEL);

    await editMentorPage.open('Settings');
    await waitForPageReady(page);
    const body = await editMentorPage.settings.setInChatModelChange(true);
    expect(body, 'the toggle starts off on a new agent').not.toBeNull();
    expect(body).toMatch(
      /name="enable_in_chat_llm_change"\r?\n\r?\ntrue|"enable_in_chat_llm_change"\s*:\s*true/,
    );
    await editMentorPage.close();

    await navigateToMentorApp(page, mentorUrl);
    await editMentorPage.open('Settings');
    await waitForPageReady(page);
    await editMentorPage.settings.selectSubTab('Capabilities');
    await expect(
      editMentorPage.settings.inChatModelChangeToggle,
    ).toHaveAttribute('aria-checked', 'true', { timeout: 10_000 });
    await editMentorPage.close();
  });

  test("icm-02: user picks a model via + › Model › provider › model; later turns carry it, a chip and a 'Switched to' notice show it", async ({
    page,
    chatPage,
  }) => {
    test.skip(!mentorUrl, 'icm-01 setup did not run');
    const frames = chatPage.recordChatFrames();
    await navigateToMentorApp(page, mentorUrl);
    await waitForPageReady(page);

    await chatPage.openPlusMenu();
    await expect(chatPage.modelMenuTrigger).toContainText('ibl.ai Fast');
    await chatPage.closePlusMenu();

    const first = 'Reply with the single word: one';
    await chatPage.sendMessage(first);
    expect(await frameFor(frames, first)).not.toHaveProperty('llm_name');
    await chatPage.waitForStreamingComplete();

    await chatPage.pickChatModel(PROVIDER, PICKED_MODEL);
    await expect(chatPage.modelChip).toBeVisible();
    await expect(chatPage.modelChip).toContainText('ibl.ai Pro');
    await expect(chatPage.modelSwitchNotices.last()).toHaveText(
      'Switched to ibl.ai Pro for this chat',
    );

    const second = 'Reply with the single word: two';
    await chatPage.sendMessage(second);
    expect(await frameFor(frames, second)).toMatchObject({
      llm_provider: PROVIDER,
      llm_name: PICKED_MODEL,
    });
    await chatPage.waitForStreamingComplete();
  });

  test("icm-03: the chip's × goes back to the agent model, sent explicitly on the next turn; a new chat starts on the agent model", async ({
    page,
    chatPage,
  }) => {
    test.skip(!mentorUrl, 'icm-01 setup did not run');
    const frames = chatPage.recordChatFrames();
    await navigateToMentorApp(page, mentorUrl);
    await waitForPageReady(page);

    await chatPage.sendMessage('Reply with the single word: three');
    await chatPage.waitForStreamingComplete();
    await chatPage.pickChatModel(PROVIDER, PICKED_MODEL);
    await expect(chatPage.modelChip).toBeVisible();

    await chatPage.modelChip
      .getByRole('button', { name: 'Back to ibl.ai Fast' })
      .click();
    await expect(chatPage.modelChip).toHaveCount(0);
    await expect(chatPage.modelSwitchNotices.last()).toHaveText(
      'Switched to ibl.ai Fast for this chat',
    );

    const back = 'Reply with the single word: four';
    await chatPage.sendMessage(back);
    // The backend keeps a session's last pick, so the way back is explicit.
    expect(await frameFor(frames, back)).toMatchObject({
      llm_provider: PROVIDER,
      llm_name: AGENT_MODEL,
    });
    await chatPage.waitForStreamingComplete();

    await chatPage.pickChatModel(PROVIDER, PICKED_MODEL);
    await expect(chatPage.modelChip).toBeVisible();
    await chatPage.startNewChat();
    await expect(chatPage.modelChip).toHaveCount(0, { timeout: 15_000 });
    await expect(chatPage.modelSwitchNotices).toHaveCount(0);
    await chatPage.openPlusMenu();
    await expect(chatPage.modelMenuTrigger).toContainText('ibl.ai Fast');
    await chatPage.closePlusMenu();

    const fresh = 'Reply with the single word: five';
    await chatPage.sendMessage(fresh);
    expect(await frameFor(frames, fresh)).not.toHaveProperty('llm_name');
    await chatPage.waitForStreamingComplete();
  });

  test('icm-04: on a phone the + sheet goes Model › provider page › model, and the chip shows', async ({
    page,
    chatPage,
  }) => {
    test.skip(!mentorUrl, 'icm-01 setup did not run');
    await page.setViewportSize({ width: 390, height: 844 });
    await navigateToMentorApp(page, mentorUrl);
    await waitForPageReady(page);

    await chatPage.openPlusMenu();
    await chatPage.modelMenuTrigger.click();
    await expect(
      page.getByRole('heading', { name: 'Model for this chat' }),
    ).toBeVisible();
    await page.getByTestId(`composer-model-provider-${PROVIDER}`).click();
    await expect(page.getByRole('heading', { name: 'ibl.ai' })).toBeVisible();
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(
      page.getByRole('heading', { name: 'Model for this chat' }),
    ).toBeVisible();
    await page.getByTestId(`composer-model-provider-${PROVIDER}`).click();
    await page
      .locator(
        `[data-testid="composer-model-item"][data-model="${PICKED_MODEL}"]`,
      )
      .click();
    await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 5_000 });
    await expect(chatPage.modelChip).toContainText('ibl.ai Pro');
  });

  test('icm-10: a student picks a model from their catalogue; turns carry it, and × goes back to the agent model', async ({
    nonadminPage,
    nonadminChatPage,
  }) => {
    test.skip(!mentorUrl, 'icm-01 setup did not run');
    const frames = nonadminChatPage.recordChatFrames();
    const target = await studentModel(nonadminPage, async () => {
      await navigateToMentorApp(nonadminPage, mentorUrl);
      await waitForPageReady(nonadminPage);
    });

    await nonadminChatPage.pickChatModel(target.provider, target.llmName);
    await expect(nonadminChatPage.modelChip).toContainText(target.label);

    const picked = 'Reply with the single word: student';
    await nonadminChatPage.sendMessage(picked);
    expect(await frameFor(frames, picked)).toMatchObject({
      llm_provider: target.provider,
      llm_name: target.llmName,
    });
    await nonadminChatPage.waitForStreamingComplete();
    await expect(
      nonadminPage.getByText('The selected model is not available.'),
      'the backend accepts a student-picked model',
    ).toHaveCount(0);

    // The student's catalogue lacks the agent model, so this label comes
    // from the agent settings' llm_config, never the raw llm_name.
    await nonadminChatPage.modelChip
      .getByRole('button', { name: 'Back to ibl.ai Fast', exact: true })
      .click();
    await expect(nonadminChatPage.modelChip).toHaveCount(0);

    const back = 'Reply with the single word: back';
    await nonadminChatPage.sendMessage(back);
    expect(await frameFor(frames, back)).toMatchObject({
      llm_provider: PROVIDER,
      llm_name: AGENT_MODEL,
    });
    await nonadminChatPage.waitForStreamingComplete();
  });

  test("icm-11: a student's pick stays in their chat: their new chat and the admin's chat both start on the agent model", async ({
    page,
    chatPage,
    nonadminPage,
    nonadminChatPage,
  }) => {
    test.skip(!mentorUrl, 'icm-01 setup did not run');
    const frames = nonadminChatPage.recordChatFrames();
    const target = await studentModel(nonadminPage, async () => {
      await navigateToMentorApp(nonadminPage, mentorUrl);
      await waitForPageReady(nonadminPage);
    });

    await nonadminChatPage.pickChatModel(target.provider, target.llmName);
    await expect(nonadminChatPage.modelChip).toBeVisible();
    await nonadminChatPage.startNewChat();
    await expect(nonadminChatPage.modelChip).toHaveCount(0, {
      timeout: 15_000,
    });

    const fresh = 'Reply with the single word: fresh';
    await nonadminChatPage.sendMessage(fresh);
    expect(await frameFor(frames, fresh)).not.toHaveProperty('llm_name');
    await nonadminChatPage.waitForStreamingComplete();

    await navigateToMentorApp(page, mentorUrl);
    await waitForPageReady(page);
    await expect(chatPage.modelChip).toHaveCount(0);
    await chatPage.openPlusMenu();
    await expect(chatPage.modelMenuTrigger).toContainText('ibl.ai Fast');
    await chatPage.closePlusMenu();
  });

  test('icm-12: on a phone a student picks a model through the + sheet', async ({
    nonadminPage,
    nonadminChatPage,
  }) => {
    test.skip(!mentorUrl, 'icm-01 setup did not run');
    await nonadminPage.setViewportSize({ width: 390, height: 844 });
    const target = await studentModel(nonadminPage, async () => {
      await navigateToMentorApp(nonadminPage, mentorUrl);
      await waitForPageReady(nonadminPage);
    });

    await nonadminChatPage.pickChatModel(target.provider, target.llmName);
    await expect(nonadminPage.getByRole('dialog')).toHaveCount(0, {
      timeout: 5_000,
    });
    await expect(nonadminChatPage.modelChip).toContainText(target.label);
  });

  test('icm-06: a model that needs a key is disabled with its reason, and a usable one in the same provider still picks (#2638)', async ({
    page,
    chatPage,
  }) => {
    test.skip(!mentorUrl, 'icm-01 setup did not run');
    const reason = 'Add your ibl.ai API key to use this model.';
    await page.route('**/mentor-llms/**', async (route) => {
      const response = await route.fetch();
      const providers = (await response.json()) as {
        name: string;
        chat_models?: Record<string, unknown>[];
      }[];
      for (const provider of providers) {
        if (provider.name !== PROVIDER) continue;
        for (const model of provider.chat_models ?? []) {
          model.availability =
            model.llm_name === PICKED_MODEL
              ? {
                  status: 'byok_missing',
                  requires_credential: true,
                  message: reason,
                }
              : { status: 'gateway_credits', requires_credential: false };
        }
      }
      await route.fulfill({ response, json: providers });
    });
    await navigateToMentorApp(page, mentorUrl);
    await waitForPageReady(page);

    await chatPage.openPlusMenu();
    await chatPage.modelMenuTrigger.click();
    await page.getByTestId(`composer-model-provider-${PROVIDER}`).click();
    const needsKey = page
      .locator(
        `[data-testid="composer-model-item"][data-model="${PICKED_MODEL}"]`,
      )
      .last();
    await expect(needsKey).toBeVisible({ timeout: 10_000 });
    await expect(needsKey).toHaveAttribute('data-unavailable', 'true');
    await expect(needsKey).toHaveAttribute('data-disabled', '');
    await expect(needsKey).toContainText(reason);
    await expect(
      page
        .locator(
          `[data-testid="composer-model-item"][data-model="${AGENT_MODEL}"]`,
        )
        .last(),
    ).toHaveAttribute('data-unavailable', 'false');
    await needsKey.click({ force: true });
    await expect(chatPage.modelChip).toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.unroute('**/mentor-llms/**');
  });

  test('icm-07: a tenant with a single usable provider lists its models straight away, with no provider step', async ({
    page,
    chatPage,
  }) => {
    test.skip(!mentorUrl, 'icm-01 setup did not run');
    await page.route('**/mentor-llms/**', async (route) => {
      const response = await route.fetch();
      const providers = (await response.json()) as { name: string }[];
      await route.fulfill({
        response,
        json: providers.filter((provider) => provider.name === PROVIDER),
      });
    });
    await navigateToMentorApp(page, mentorUrl);
    await waitForPageReady(page);

    await chatPage.openPlusMenu();
    await chatPage.modelMenuTrigger.click();
    await expect(
      page
        .locator(
          `[data-testid="composer-model-item"][data-model="${PICKED_MODEL}"]`,
        )
        .last(),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.locator('[data-testid^="composer-model-provider-"]'),
    ).toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.unroute('**/mentor-llms/**');
  });

  test('icm-08: a provider whose every model needs a key is left out of the provider list (#2638)', async ({
    page,
    chatPage,
  }) => {
    test.skip(!mentorUrl, 'icm-01 setup did not run');
    const blocked = 'e2e_blocked_provider';
    await page.route('**/mentor-llms/**', async (route) => {
      const response = await route.fetch();
      const providers = (await response.json()) as Record<string, unknown>[];
      providers.push({
        name: blocked,
        display_name: 'Blocked Provider',
        has_credentials: true,
        chat_models: [
          {
            llm_name: 'blocked-model',
            display_name: 'Blocked Model',
            has_credentials: false,
            availability: {
              status: 'byok_missing',
              requires_credential: true,
              message: 'Add a key.',
            },
          },
        ],
      });
      await route.fulfill({ response, json: providers });
    });
    await navigateToMentorApp(page, mentorUrl);
    await waitForPageReady(page);

    await chatPage.openPlusMenu();
    await chatPage.modelMenuTrigger.click();
    await expect(
      page.getByTestId(`composer-model-provider-${PROVIDER}`).last(),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByTestId(`composer-model-provider-${blocked}`),
    ).toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.unroute('**/mentor-llms/**');
  });

  test('icm-09: when the backend rejects the picked model, the chat shows the error, goes back to the previous model and keeps the message text', async ({
    page,
    chatPage,
  }) => {
    test.skip(!mentorUrl, 'icm-01 setup did not run');
    const rejected = 'Reply with the single word: rejected';
    await page.routeWebSocket(/\/ws\/langflow\//, (socket) => {
      const server = socket.connectToServer();
      socket.onMessage((message) => {
        const frame = (() => {
          try {
            return JSON.parse(String(message)) as Record<string, unknown>;
          } catch {
            return null;
          }
        })();
        if (frame?.prompt === rejected && frame.llm_name === PICKED_MODEL) {
          socket.send(
            JSON.stringify({
              type: 'error',
              error: 'The selected model is not available.',
              developer_error: 'e2e: model rejected',
              status_code: 400,
            }),
          );
          return;
        }
        server.send(message);
      });
    });
    await navigateToMentorApp(page, mentorUrl);
    await waitForPageReady(page);

    await chatPage.pickChatModel(PROVIDER, PICKED_MODEL);
    await expect(chatPage.modelChip).toContainText('ibl.ai Pro');

    await chatPage.sendMessage(rejected);
    await expect(
      page.getByText('The selected model is not available.').first(),
    ).toBeVisible({ timeout: 15_000 });
    await expect(chatPage.modelChip).toHaveCount(0, { timeout: 10_000 });
    await expect(chatPage.getComposerTextarea()).toHaveValue(rejected, {
      timeout: 10_000,
    });
    await chatPage.openPlusMenu();
    await expect(chatPage.modelMenuTrigger).toContainText('ibl.ai Fast');
    await chatPage.closePlusMenu();
  });

  test('icm-05: with the setting off, the + menu has no Model row', async ({
    page,
    chatPage,
    editMentorPage,
  }) => {
    test.skip(!mentorUrl, 'icm-01 setup did not run');
    await navigateToMentorApp(page, mentorUrl);
    await editMentorPage.open('Settings');
    await waitForPageReady(page);
    const body = await editMentorPage.settings.setInChatModelChange(false);
    expect(body).toMatch(
      /name="enable_in_chat_llm_change"\r?\n\r?\nfalse|"enable_in_chat_llm_change"\s*:\s*false/,
    );
    await editMentorPage.close();

    await navigateToMentorApp(page, mentorUrl);
    await waitForPageReady(page);
    await chatPage.openPlusMenu();
    await expect(
      page.getByTestId('composer-model-trigger'),
      'no Model row once the agent disallows it',
    ).toHaveCount(0);
    await chatPage.closePlusMenu();
  });

  test('icm-13: with the setting off, a student has no Model row either', async ({
    nonadminPage,
    nonadminChatPage,
  }) => {
    test.skip(!mentorUrl, 'icm-01 setup did not run');
    // Relies on icm-05 having turned the setting off.
    await navigateToMentorApp(nonadminPage, mentorUrl);
    await waitForPageReady(nonadminPage);
    await nonadminChatPage.openPlusMenu();
    await expect(
      nonadminPage.getByTestId('composer-model-trigger'),
    ).toHaveCount(0);
    await nonadminChatPage.closePlusMenu();
  });
});
