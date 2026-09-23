import { vi } from 'vitest';
import en from '../../public/_locales/en/messages.json';

type Listener = (...args: unknown[]) => void;

interface Message {
  message: string;
  placeholders?: Record<string, { content: string }>;
}

/** Substitutes `$NAME$` placeholders the way Chrome does, from the English catalogue. */
export function englishMessage(
  key: string,
  substitutions?: string | string[],
): string {
  const entry = (en as Record<string, Message>)[key];
  if (!entry) return '';
  const values = Array.isArray(substitutions)
    ? substitutions
    : substitutions
      ? [substitutions]
      : [];
  let text = entry.message;
  for (const [name, { content }] of Object.entries(entry.placeholders ?? {})) {
    const index = Number(content.replace('$', '')) - 1;
    text = text.replace(`$${name.toUpperCase()}$`, values[index] ?? '');
  }
  return text;
}

export function sessionRedirect(session: Record<string, string>): string {
  return `https://abc.chromiumapp.org/?data=${encodeURIComponent(JSON.stringify(session))}`;
}

export const SESSION = {
  axd_token: 'axd',
  axd_token_expires: '2099-01-01T00:00:00Z',
  dm_token: 'dm',
  dm_token_expires: '2099-01-01T00:00:00Z',
  userData: JSON.stringify({ user_nicename: 'jane' }),
  tenant: 'acme',
  current_tenant: JSON.stringify({ key: 'acme', name: 'Acme' }),
};

/** A minimal `chrome.*` for the panel code; every function is a vi.fn. */
export function installChromeStub() {
  const store: Record<string, unknown> = {};
  const activated = new Set<Listener>();
  const updated = new Set<Listener>();
  const connected = new Set<Listener>();
  const stub = {
    identity: {
      getRedirectURL: vi.fn(() => 'https://abc.chromiumapp.org/'),
      launchWebAuthFlow: vi.fn(async () => sessionRedirect(SESSION)),
    },
    tabs: {
      query: vi.fn(async () => [
        { id: 7, url: 'https://app.acme.com/', active: true },
      ]),
      get: vi.fn(async (id: number) => ({
        id,
        url: 'https://app.acme.com/',
        status: 'complete',
      })),
      update: vi.fn(async () => ({})),
      goBack: vi.fn(async () => undefined),
      onActivated: {
        addListener: vi.fn((listener: Listener) => activated.add(listener)),
        removeListener: vi.fn((listener: Listener) =>
          activated.delete(listener),
        ),
      },
      onUpdated: {
        addListener: vi.fn((listener: Listener) => updated.add(listener)),
        removeListener: vi.fn((listener: Listener) => updated.delete(listener)),
      },
    },
    scripting: {
      // One result, tagged with the frame it was asked for: the page (frame 0)
      // unless the injection named another. Tests stack more frames on top.
      executeScript: vi.fn(
        async ({
          target,
          func,
          args = [],
        }: {
          target?: { frameIds?: number[]; allFrames?: boolean };
          func: (...a: unknown[]) => unknown;
          args?: unknown[];
        }) => [
          { frameId: target?.frameIds?.[0] ?? 0, result: await func(...args) },
        ],
      ),
    },
    storage: {
      local: {
        get: vi.fn(async (key: string) =>
          key in store ? { [key]: store[key] } : {},
        ),
        set: vi.fn(async (items: Record<string, unknown>) => {
          Object.assign(store, items);
        }),
      },
    },
    i18n: {
      getMessage: vi.fn(englishMessage),
      getAcceptLanguages: vi.fn(async () => ['en-GB', 'en']),
      getUILanguage: vi.fn(() => 'en-US'),
    },
    runtime: {
      connect: vi.fn((info: { name: string }) => fakePort(info.name)),
      onConnect: {
        addListener: vi.fn((listener: Listener) => connected.add(listener)),
      },
      onInstalled: { addListener: vi.fn() },
      onStartup: { addListener: vi.fn() },
    },
    sidePanel: { setPanelBehavior: vi.fn(async () => undefined) },
    // The panel's own window: what it uses to find the tab to drive, instead of
    // asking for the last-focused window (which can be DevTools).
    windows: { getCurrent: vi.fn(async () => ({ id: 1 })) },
  };
  (globalThis as { chrome?: unknown }).chrome = stub;
  return { stub, store, activated, updated, connected };
}

/**
 * Both ends of a `chrome.runtime` port. `sent` is what this end posted; `emit`
 * plays a message back as if the other end had posted it.
 */
export function fakePort(name = 'browse') {
  const messageListeners = new Set<Listener>();
  const disconnectListeners = new Set<Listener>();
  const sent: unknown[] = [];
  return {
    name,
    sent,
    postMessage: vi.fn((message: unknown) => sent.push(message)),
    disconnect: vi.fn(() => {
      for (const listener of [...disconnectListeners]) listener();
    }),
    onMessage: {
      addListener: vi.fn((listener: Listener) =>
        messageListeners.add(listener),
      ),
    },
    onDisconnect: {
      addListener: vi.fn((listener: Listener) =>
        disconnectListeners.add(listener),
      ),
    },
    emit: (message: unknown) => {
      for (const listener of [...messageListeners]) listener(message);
    },
    close: () => {
      for (const listener of [...disconnectListeners]) listener();
    },
  };
}

export type FakePort = ReturnType<typeof fakePort>;

export type ChromeStub = ReturnType<typeof installChromeStub>;
