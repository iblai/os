import type { ModelMessage } from 'ai';
import {
  buildModel,
  isMissingCredential,
  listModels,
  MISSING_CREDENTIAL,
  MODEL_PREFERENCE,
  pickModel,
  pruneOldSnapshots,
  runAgent,
  wantsPicture,
  type AgentEvent,
  type Credentials,
} from './agent';
import { startHud, type Hud } from './hud';
import {
  HUD_STOP,
  RECORDER_STEP,
  unwatchPage,
  watchPage,
  type RecordedEvent,
} from './page-scripts';
import { Recording } from './recorder';
import { SECRET_FIELDS } from './secret-fields';
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
  /** The tab the live run is driving; only its overlay may end that run. */
  let drivenTab: number | null = null;
  const pending = new Map<number, (ok: boolean) => void>();
  let nextConfirm = 0;
  // Set per run from the app's Approvals setting. Automatic means no card is
  // ever raised — the action is still logged, so the user sees it happen.
  let autoApprove = false;

  const send = (outbound: OutboundMessage) => port.postMessage(outbound);

  // Stop pressed on the page itself. The page cannot reach this channel —
  // there is no externally_connectable — so the sender is one of our own
  // injected scripts; the tab check is what keeps an overlay another run left
  // behind from ending this one.
  const onStopFromPage = (
    message: unknown,
    sender: chrome.runtime.MessageSender,
  ): void => {
    if ((message as { type?: string } | null)?.type !== HUD_STOP) return;
    if (sender.id !== chrome.runtime.id) return;
    if (drivenTab === null || sender.tab?.id !== drivenTab) return;
    controller?.abort();
  };
  chrome.runtime.onMessage.addListener(onStopFromPage);

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
    let hud: Hud | null = null;
    try {
      const settings = await loadSettings();
      // A model cached under a different preference is stale, not a choice: the
      // user has no way to pick one, so the cache exists only to save a round
      // trip.
      const preference = MODEL_PREFERENCE[0];
      let unusable = settings.unusable ?? [];
      let listed: string[] = [];
      let model =
        settings.preference === preference && !unusable.includes(settings.model)
          ? settings.model
          : '';
      if (!model) {
        listed = await listModels(creds, apiBases());
        model = pickModel(listed, unusable);
        if (!model) {
          send({ type: 'error', message: translate('noModels') });
          return;
        }
        await saveSettings({ model, preference, unusable });
      }
      /**
       * What to try after `failed` turned out to have no key behind it, or ''
       * when this organization has nothing else to offer. The list is fetched
       * here only when the cache answered earlier, since such a run has never
       * seen one.
       */
      const insteadOf = async (failed: string): Promise<string> => {
        unusable = [...unusable, failed];
        if (!listed.length) listed = await listModels(creds, apiBases());
        const next = pickModel(listed, unusable);
        await saveSettings({ model: next, preference, unusable });
        return next;
      };
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
      // Up alongside Chrome's own debug bar, and down in the `finally` below:
      // between the two the user can see on the page itself which tab is
      // being driven, what it is doing, and how to end it.
      drivenTab = tabId;
      hud = startHud(tabId);
      /**
       * Models this run has found it cannot call. A list that advertises a
       * provider with no key behind it is the ordinary shape of a
       * half-configured organization, and calling it is the only way to find
       * out — so the run moves to the next model rather than ending on an
       * error the user can do nothing about.
       */
      const tried: string[] = [];
      let result: Awaited<ReturnType<typeof runAgent>>;
      for (;;) {
        const withPicture = wantsPicture(model);
        const { tools, snapshot, picture } = createBrowserTools({
          tabId,
          confirm,
          log: (entry) =>
            send({ type: 'log', text: logLine(entry), ok: entry.ok }),
          withPicture,
          real: realInput(tabId),
          signal: controller.signal,
          hud,
        });
        // The run's first sign of life. Reading the page and then waiting for
        // the model's first token is the longest stretch of a run with nothing to
        // show, and a message on the port is also what resets the worker's idle
        // timer while it waits.
        if (!tried.length)
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
        try {
          result = await runAgent({
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
            // A refused call is a row in the action list, like every action;
            // only a failed model call ends the turn.
            onEvent: (event) => {
              // A model with no key behind it is about to be swapped for the
              // next one, so the user never sees the platform's wording for it.
              if (
                event.type === 'error' &&
                MISSING_CREDENTIAL.test(event.message)
              )
                return;
              if (event.type === 'error')
                send({ type: 'error', message: describeRunError(event) });
              else if (event.type === 'tool-error')
                send({
                  type: 'log',
                  text: logLine({
                    tool: event.toolName,
                    target: '',
                    ok: false,
                  }),
                  ok: false,
                });
              else send({ type: 'event', event });
            },
          });
          break;
        } catch (err) {
          if (!isMissingCredential(err)) throw err;
          tried.push(model);
          const next = await insteadOf(model);
          if (!next) {
            send({ type: 'error', message: translate('errorModelNoKey') });
            return;
          }
          model = next;
        }
      }
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
      // Never conditional on how the run ended: an overlay left behind would
      // tell the user their page is still being driven when it is not.
      await hud?.stop();
      drivenTab = null;
      await detach(tabId);
      controller = null;
    }
  };

  /**
   * Recording is not a run: nothing drives the page, so there is no debugger,
   * no model and no abort — only a watcher in every frame and a tally of what
   * the person did.
   */
  let recording: Recording | null = null;
  let recordedTab: number | null = null;
  let stopWatchingNavigation: (() => void) | undefined;

  const watch = async (tabId: number) => {
    try {
      await chrome.scripting.executeScript({
        target: { tabId, allFrames: true },
        func: watchPage,
        args: [SECRET_FIELDS],
      });
    } catch {
      // A frame that cannot be injected into is one the recording misses;
      // the others still report.
    }
  };

  const onRecorderStep = (
    message: unknown,
    sender: chrome.runtime.MessageSender,
  ): void => {
    const frame = message as { type?: string; step?: RecordedEvent } | null;
    if (frame?.type !== RECORDER_STEP || !frame.step) return;
    if (sender.id !== chrome.runtime.id) return;
    if (!recording || sender.tab?.id !== recordedTab) return;
    recording.add(frame.step, Date.now());
    send({ type: 'recording', steps: recording.steps().length });
  };

  const startRecording = async (tabId: number) => {
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (!tab || !injectable(tab.url)) {
      send({
        type: 'error',
        message: blockedByBrowser(tab?.url)
          ? translate('noScriptablePage')
          : translate('noActiveTab', tab?.url ?? ''),
      });
      return;
    }
    recording = new Recording();
    recordedTab = tabId;
    chrome.runtime.onMessage.addListener(onRecorderStep);
    await watch(tabId);
    // An injected watcher dies with the page, so every navigation of the
    // recorded tab gets a new one — without this everything after the first
    // page is lost, silently.
    const onUpdated = (
      updatedTabId: number,
      change: { url?: string; status?: string },
    ) => {
      if (updatedTabId !== recordedTab || !recording) return;
      if (change.url) recording.navigated(change.url, Date.now(), tab.title);
      if (change.status === 'complete') void watch(updatedTabId);
    };
    chrome.tabs.onUpdated.addListener(onUpdated);
    stopWatchingNavigation = () =>
      chrome.tabs.onUpdated.removeListener(onUpdated);
    send({ type: 'recording', steps: 0 });
  };

  const stopRecording = async () => {
    if (!recording) return;
    const steps = recording.steps();
    recording = null;
    stopWatchingNavigation?.();
    stopWatchingNavigation = undefined;
    chrome.runtime.onMessage.removeListener(onRecorderStep);
    if (recordedTab !== null) {
      await chrome.scripting
        .executeScript({
          target: { tabId: recordedTab, allFrames: true },
          func: unwatchPage,
        })
        .catch(() => undefined);
    }
    recordedTab = null;
    send({ type: 'recorded', steps });
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
      case 'record:start':
        void startRecording(inbound.tabId);
        break;
      case 'record:stop':
        void stopRecording();
        break;
    }
  });

  // Closing the panel drops the port, which both ends the run and lets the
  // worker be torn down; leaving the abort out would strand the loop.
  port.onDisconnect.addListener(() => {
    chrome.runtime.onMessage.removeListener(onStopFromPage);
    chrome.runtime.onMessage.removeListener(onRecorderStep);
    stopWatchingNavigation?.();
    controller?.abort();
    for (const settle of [...pending.values()]) settle(false);
  });
}

export function registerBrowsePort(): void {
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name === BROWSE_PORT) handleBrowsePort(port);
  });
}
