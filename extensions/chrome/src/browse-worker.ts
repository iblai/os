import type { ModelMessage } from 'ai';
import {
  buildModel,
  listModels,
  MODEL_PREFERENCE,
  pickModel,
  pruneOldSnapshots,
  runAgent,
  wantsPicture,
  type AgentEvent,
  type Credentials,
} from './agent';
import { attach, detach, onDetach, realInput } from './real-input';
import { t as translate, userLanguage } from './i18n';
import { userTurn } from './prompt';
import {
  apiBases,
  completionsBase,
  blockedByBrowser,
  injectable,
  loadSettings,
  saveSettings,
} from './settings';
import {
  BROWSE_PORT,
  type InboundMessage,
  type OutboundMessage,
} from './browse-protocol';
import { logLine } from './log-line';
import { createBrowserTools } from './tools';

// Open the side panel when the toolbar icon is clicked.
// (setPanelBehavior is the supported MV3 way to bind the action to the panel.)
export function enablePanelOnActionClick(): void {
  if (!chrome.sidePanel?.setPanelBehavior) return;
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((err) => console.error('[ibl.ai] setPanelBehavior failed:', err));
}

const message = (err: unknown) =>
  translate('errorGeneric', err instanceof Error ? err.message : String(err));

/**
 * The two statuses worth their own wording: the model is reachable but the
 * platform is out of credits (402), or the session has expired (401). Anything
 * else keeps the provider's own message.
 */
function describeRunError(event: AgentEvent & { type: 'error' }): string {
  if (event.statusCode === 402) return translate('errorCredits');
  if (event.statusCode === 401) return translate('errorAccess');
  return translate('errorGeneric', event.message);
}

/** Why a run ended early, when it did — otherwise the limit is invisible. */
const stopNote = (stoppedBy: 'time' | null) =>
  stoppedBy === 'time' ? translate('timeLimit') : undefined;

/**
 * One browse session per connected port. The port is what keeps this worker
 * alive: MV3 tears an idle worker down after ~30s, and every message over an
 * open port resets that timer, so a run survives only while the panel holding
 * the port stays open — which is exactly as long as the user is watching.
 */
export function handleBrowsePort(port: chrome.runtime.Port): void {
  let controller: AbortController | null = null;
  let history: ModelMessage[] = [];
  const pending = new Map<number, (ok: boolean) => void>();
  let nextConfirm = 0;
  // Set per run from the app's Approvals setting. Automatic means no card is
  // ever raised — the action is still logged, so the user sees it happen.
  let autoApprove = false;

  const send = (outbound: OutboundMessage) => port.postMessage(outbound);

  const confirm = (description: string, signal?: AbortSignal) =>
    autoApprove
      ? Promise.resolve(true)
      : new Promise<boolean>((resolve) => {
          const id = nextConfirm++;
          const settle = (ok: boolean) => {
            if (pending.delete(id)) resolve(ok);
          };
          pending.set(id, settle);
          signal?.addEventListener('abort', () => settle(false), {
            once: true,
          });
          send({ type: 'confirm', id, description });
        });

  const run = async (
    goal: string,
    creds: Credentials,
    tabId: number,
    auto: boolean,
  ) => {
    if (controller) {
      send({ type: 'error', message: translate('errorRunInProgress') });
      return;
    }
    controller = new AbortController();
    autoApprove = auto;
    // The user closed Chrome's debug bar or opened DevTools mid-run: the run
    // is aborted and ends saying so, never quietly on scripted clicks.
    let lostRealInput = false;
    let stopWatching: (() => void) | undefined;
    try {
      const settings = await loadSettings();
      // A model cached under a different preference is stale, not a choice: the
      // user has no way to pick one, so the cache exists only to save a round
      // trip.
      const preference = MODEL_PREFERENCE[0];
      let model = settings.preference === preference ? settings.model : '';
      if (!model) {
        model = pickModel(await listModels(creds, apiBases()));
        if (!model) {
          send({ type: 'error', message: translate('noModels') });
          return;
        }
        await saveSettings({ model, preference });
      }
      // The panel resolved the tab; re-check it because the user can switch
      // tabs between submitting and the run starting.
      const tab = await chrome.tabs.get(tabId).catch(() => null);
      if (!tab || !injectable(tab.url)) {
        // Two different refusals, and the http/https wording is simply untrue
        // for the Web Store — it IS https, Chrome just forbids it.
        send({
          type: 'error',
          message: blockedByBrowser(tab?.url)
            ? translate('noScriptablePage')
            : translate('noActiveTab', tab?.url ?? ''),
        });
        return;
      }
      // Real input for the whole run: Chrome shows its debug bar on the tab
      // until the detach in `finally`.
      try {
        await attach(tabId);
      } catch {
        send({ type: 'error', message: translate('errorRealClicksBusy') });
        return;
      }
      stopWatching = onDetach(tabId, () => {
        lostRealInput = true;
        controller?.abort();
      });
      const withPicture = wantsPicture(model);
      const { tools, snapshot, picture } = createBrowserTools({
        tabId,
        confirm,
        log: (entry) =>
          send({ type: 'log', text: logLine(entry), ok: entry.ok }),
        withPicture,
        real: realInput(tabId),
        signal: controller.signal,
      });
      // The run's first sign of life. Reading the page and then waiting for
      // the model's first token is the longest stretch of a run with nothing to
      // show, and a message on the port is also what resets the worker's idle
      // timer while it waits.
      send({
        type: 'log',
        text: logLine({
          tool: 'read_page',
          target: new URL(tab.url).host,
          ok: true,
        }),
        ok: true,
      });
      const page = await snapshot();
      const result = await runAgent({
        model: buildModel({
          base: completionsBase(),
          model,
          ...creds,
        }),
        messages: [
          ...history,
          { role: 'user', content: userTurn(goal, page.text) },
        ],
        tools,
        signal: controller.signal,
        language: await userLanguage(),
        picture,
        positions: withPicture,
        // Narration and a refused call are rows in the action list, like
        // every action; only a failed model call ends the turn.
        onEvent: (event) => {
          if (event.type === 'error')
            send({ type: 'error', message: describeRunError(event) });
          else if (event.type === 'narration')
            send({ type: 'log', text: event.text, ok: true });
          else if (event.type === 'tool-error')
            send({
              type: 'log',
              text: logLine({ tool: event.toolName, target: '', ok: false }),
              ok: false,
            });
          else send({ type: 'event', event });
        },
      });
      history = pruneOldSnapshots(result.messages);
      if (lostRealInput) {
        send({ type: 'error', message: translate('errorRealClicksOff') });
        return;
      }
      send({
        type: 'done',
        text: result.text,
        note: stopNote(result.stoppedBy),
      });
    } catch (err) {
      send({ type: 'error', message: message(err) });
    } finally {
      stopWatching?.();
      // Ends what the run left going, like a page read waiting to try again.
      controller.abort();
      await detach(tabId);
      controller = null;
    }
  };

  port.onMessage.addListener((inbound: InboundMessage) => {
    switch (inbound.type) {
      case 'run':
        void run(inbound.goal, inbound.creds, inbound.tabId, inbound.auto);
        break;
      case 'stop':
        controller?.abort();
        break;
      case 'confirm':
        pending.get(inbound.id)?.(inbound.ok);
        break;
    }
  });

  // Closing the panel drops the port, which both ends the run and lets the
  // worker be torn down; leaving the abort out would strand the loop.
  port.onDisconnect.addListener(() => {
    controller?.abort();
    for (const settle of [...pending.values()]) settle(false);
  });
}

export function registerBrowsePort(): void {
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name === BROWSE_PORT) handleBrowsePort(port);
  });
}
