/**
 * Real mouse and keyboard input through the DevTools protocol: trusted events,
 * which widgets that ignore scripted ones still see. Chrome shows its "is
 * debugging this browser" bar on the tab for as long as a run is attached.
 */
const PROTOCOL_VERSION = '1.3';

export interface RealInput {
  click(x: number, y: number): Promise<void>;
  insertText(text: string): Promise<void>;
  pressEnter(): Promise<void>;
}

const send = (tabId: number, method: string, params: Record<string, unknown>) =>
  chrome.debugger.sendCommand({ tabId }, method, params);

export function attach(tabId: number): Promise<void> {
  return chrome.debugger.attach({ tabId }, PROTOCOL_VERSION);
}

/** Never throws: by the time this runs the user may have detached already. */
export async function detach(tabId: number): Promise<void> {
  try {
    await chrome.debugger.detach({ tabId });
  } catch {
    // Already gone — closed from the bar, or the tab itself was closed.
  }
}

/** Fires when the tab's debugger goes away; returns the unsubscribe. */
export function onDetach(tabId: number, listener: () => void): () => void {
  const handler = (source: chrome.debugger.Debuggee) => {
    if (source.tabId === tabId) listener();
  };
  chrome.debugger.onDetach.addListener(handler);
  return () => chrome.debugger.onDetach.removeListener(handler);
}

export function realInput(tabId: number): RealInput {
  // Viewport CSS pixels, which is what `locate` measures.
  const mouse = (type: string, x: number, y: number, pressing = false) =>
    send(tabId, 'Input.dispatchMouseEvent', {
      type,
      x,
      y,
      ...(pressing ? { button: 'left', clickCount: 1 } : {}),
    });
  const enter = (type: 'keyDown' | 'keyUp') =>
    send(tabId, 'Input.dispatchKeyEvent', {
      type,
      key: 'Enter',
      code: 'Enter',
      windowsVirtualKeyCode: 13,
      text: '\r',
    });
  return {
    async click(x, y) {
      await mouse('mouseMoved', x, y);
      await mouse('mousePressed', x, y, true);
      await mouse('mouseReleased', x, y, true);
    },
    async insertText(text) {
      await send(tabId, 'Input.insertText', { text });
    },
    async pressEnter() {
      await enter('keyDown');
      await enter('keyUp');
    },
  };
}
