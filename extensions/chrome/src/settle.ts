import { waitForQuiet } from './page-scripts';

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export interface SettleOptions {
  /** How long to watch for a navigation that an action may have started. */
  graceMs?: number;
  /** Cap on waiting for a started navigation to complete. */
  navMs?: number;
  quietMs?: number;
  capMs?: number;
}

/**
 * Waits for the page to settle after an action: a navigation the action started
 * (seen as `status: 'loading'` on the tab) must complete, then the DOM must be
 * quiet for a moment. No `webNavigation` permission needed.
 */
export async function settle(
  tabId: number,
  options: SettleOptions = {},
): Promise<void> {
  const { graceMs = 300, navMs = 10000, quietMs = 500, capMs = 3000 } = options;
  const started = Date.now();
  let navigating = false;
  for (;;) {
    const tab = await chrome.tabs.get(tabId);
    if (tab.status === 'loading') navigating = true;
    const elapsed = Date.now() - started;
    if (tab.status === 'complete' && (navigating || elapsed >= graceMs)) break;
    if (elapsed >= navMs) break;
    await sleep(100);
  }
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: waitForQuiet,
      args: [quietMs, capMs],
    });
  } catch {
    // The frame was replaced mid-injection; the snapshot that follows re-reads it.
  }
}
