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
  const removed = new Set<Listener>();
  const connected = new Set<Listener>();
  const detached = new Set<Listener>();
  const messaged = new Set<Listener>();
  /** Which tab sits in which group, as `chrome.tabs.get` reports it. */
  const grouped = new Map<number, number>();
  // The tab groups the stub has handed out, by id, so a test can read the
  // title and colour the overlay asked for.
  const groups = new Map<number, Record<string, unknown>>();
  let nextGroup = 100;
  const stub = {
    identity: {
      getRedirectURL: vi.fn(() => 'https://abc.chromiumapp.org/'),
      // Answers for the organization it was asked for, as the auth app does: a
      // switch to `beta` comes back with a `beta` session. Returning a fixed
      // tenant would let a missing "is this the org I asked for?" check pass.
      launchWebAuthFlow: vi.fn(async (options?: { url?: string }) => {
        let tenant: string | null = null;
        try {
          tenant = new URL(options?.url ?? '').searchParams.get('tenant');
        } catch {
          tenant = null;
        }
        if (!tenant) return sessionRedirect(SESSION);
        return sessionRedirect({
          ...SESSION,
          tenant,
          current_tenant: JSON.stringify({ key: tenant, name: tenant }),
        });
      }),
    },
    tabs: {
      query: vi.fn(async () => [
        { id: 7, url: 'https://app.acme.com/', active: true },
      ]),
      get: vi.fn(
        async (
          id: number,
        ): Promise<{
          id: number;
          url: string;
          status: string;
          active?: boolean;
          windowId?: number;
          groupId?: number;
        }> => ({
          id,
          url: 'https://app.acme.com/',
          status: 'complete',
          active: true,
          windowId: 1,
          groupId: grouped.get(id) ?? -1,
        }),
      ),
      captureVisibleTab: vi.fn(
        async (_windowId: number, _options: unknown) =>
          'data:image/jpeg;base64,xyz',
      ),
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
      // The organization chooser opens in a tab of its own and is watched
      // until the user picks (or closes it).
      create: vi.fn(async ({ url }: { url: string }) => ({ id: 99, url })),
      remove: vi.fn(async (_id: number) => undefined),
      onRemoved: {
        addListener: vi.fn((listener: Listener) => removed.add(listener)),
        removeListener: vi.fn((listener: Listener) => removed.delete(listener)),
      },
      // The tab-strip marker: the driven tab goes into a group of its own for
      // as long as a run is live, and comes back out when it ends.
      group: vi.fn(async ({ tabIds }: { tabIds: number[] }) => {
        const groupId = nextGroup++;
        for (const id of tabIds) grouped.set(id, groupId);
        groups.set(groupId, {});
        return groupId;
      }),
      ungroup: vi.fn(async (tabIds: number[]) => {
        for (const id of tabIds) grouped.delete(id);
      }),
    },
    tabGroups: {
      TAB_GROUP_ID_NONE: -1,
      update: vi.fn(
        async (groupId: number, options: Record<string, unknown>) => {
          groups.set(groupId, { ...groups.get(groupId), ...options });
          return { id: groupId, ...options };
        },
      ),
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
      id: 'ibl-extension',
      connect: vi.fn((info: { name: string }) => fakePort(info.name)),
      sendMessage: vi.fn((message: unknown) => {
        // What Chrome does for an injected script: the message reaches the
        // worker's own onMessage, tagged with the tab it came from.
        for (const listener of [...messaged])
          listener(message, { id: 'ibl-extension', tab: { id: 7 } }, () => {});
      }),
      onConnect: {
        addListener: vi.fn((listener: Listener) => connected.add(listener)),
      },
      onMessage: {
        addListener: vi.fn((listener: Listener) => messaged.add(listener)),
        removeListener: vi.fn((listener: Listener) =>
          messaged.delete(listener),
        ),
      },
      onInstalled: { addListener: vi.fn() },
      onStartup: { addListener: vi.fn() },
    },
    sidePanel: { setPanelBehavior: vi.fn(async () => undefined) },
    // Real clicks: attach/detach bracket a run, sendCommand carries the input.
    debugger: {
      attach: vi.fn(async (_target: unknown, _version: string) => undefined),
      detach: vi.fn(async (_target: unknown) => undefined),
      sendCommand: vi.fn(
        async (_target: unknown, _method: string, _params?: unknown) => ({}),
      ),
      onDetach: {
        addListener: vi.fn((listener: Listener) => detached.add(listener)),
        removeListener: vi.fn((listener: Listener) =>
          detached.delete(listener),
        ),
      },
    },
    // The panel's own window: what it uses to find the tab to drive, instead of
    // asking for the last-focused window (which can be DevTools).
    windows: { getCurrent: vi.fn(async () => ({ id: 1 })) },
  };
  (globalThis as { chrome?: unknown }).chrome = stub;
  return {
    stub,
    store,
    activated,
    updated,
    removed,
    connected,
    detached,
    messaged,
    grouped,
    groups,
  };
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
