import { configureStore } from '@reduxjs/toolkit';
import { act, renderHook } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { chatSliceReducerShared } from '@iblai/iblai-js/web-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  resetCodePermissionsForTests,
  useCodePermissionRequests,
} from '@/components/chat/code-permission-card';
import { useBrowseRun } from '@/hooks/use-browse-run';

let postMessage: ReturnType<typeof vi.fn>;
let store: ReturnType<typeof makeStore>;

const makeStore = () =>
  configureStore({ reducer: { chatSliceShared: chatSliceReducerShared } });

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <Provider store={store}>{children}</Provider>
);

const render = () =>
  renderHook(
    () => ({ browse: useBrowseRun(), prompts: useCodePermissionRequests() }),
    { wrapper },
  );

/** Deliver a worker frame the way the panel relays it. */
const frame = (payload: unknown, source: unknown = window.parent) =>
  window.dispatchEvent(
    new MessageEvent('message', {
      data: { type: 'MENTOR:BROWSE_EVENT', payload },
      source: source as Window,
    }),
  );

const state = () =>
  store.getState().chatSliceShared as {
    chats: Record<string, Array<{ role: string; content: string }>>;
    activeTab: string;
    status: string;
    currentStreamingMessage: {
      id: string;
      content: string;
      toolCalls: Array<{ log: string; result: string }>;
    };
  };

const messages = () => state().chats[state().activeTab] ?? [];
const sent = () => postMessage.mock.calls.map((call) => call[0]);

beforeEach(() => {
  store = makeStore();
  postMessage = vi.fn();
  Object.defineProperty(window, 'parent', {
    value: { postMessage },
    configurable: true,
    writable: true,
  });
  resetCodePermissionsForTests();
});

afterEach(() => {
  Object.defineProperty(window, 'parent', {
    value: window,
    configurable: true,
    writable: true,
  });
});

describe('useBrowseRun', () => {
  it('sends the goal to the worker and shows it as the user turn', () => {
    const { result } = render();
    act(() => result.current.browse.run('open billing'));

    expect(sent()).toEqual([
      { type: 'MENTOR:BROWSE_RUN', goal: 'open billing', auto: true },
    ]);
    expect(result.current.browse.isRunning).toBe(true);
    expect(messages().at(-1)).toMatchObject({
      role: 'user',
      content: 'open billing',
    });
  });

  it('streams text into one assistant turn and commits it on done', () => {
    const { result } = render();
    act(() => result.current.browse.run('go'));
    act(() =>
      frame({ type: 'event', event: { type: 'text', text: 'Opened ' } }),
    );
    act(() =>
      frame({ type: 'event', event: { type: 'text', text: 'billing.' } }),
    );

    expect(state().currentStreamingMessage.content).toBe('Opened billing.');

    act(() => frame({ type: 'done', text: 'Opened billing.' }));

    const last = messages().at(-1)!;
    expect(last.role).toBe('assistant');
    expect(last.content).toBe('Opened billing.');
    // Exactly one assistant message — the per-delta ensure must not append twice.
    expect(messages().filter((m) => m.role === 'assistant')).toHaveLength(1);
    expect(result.current.browse.isRunning).toBe(false);
  });

  it('lists each action as a tool call on the turn', () => {
    const { result } = render();
    act(() => result.current.browse.run('go'));
    act(() => frame({ type: 'log', text: 'Click [1] button "Pay"', ok: true }));
    act(() => frame({ type: 'log', text: 'Type into [2] textbox', ok: false }));

    expect(state().currentStreamingMessage.toolCalls).toMatchObject([
      { log: 'Click [1] button "Pay"', result: 'ok' },
      { log: 'Type into [2] textbox', result: 'failed' },
    ]);
  });

  it('says which cap ended the run', () => {
    const { result } = render();
    act(() => result.current.browse.run('go'));
    act(() =>
      frame({ type: 'event', event: { type: 'text', text: 'Partly.' } }),
    );
    act(() =>
      frame({
        type: 'done',
        text: 'Partly.',
        note: 'Stopped after the maximum number of steps.',
      }),
    );

    expect(messages().at(-1)!.content).toBe(
      'Partly.\n\nStopped after the maximum number of steps.',
    );
  });

  it('ends the turn with the error when one arrives', () => {
    const { result } = render();
    act(() => result.current.browse.run('go'));
    act(() => frame({ type: 'error', message: 'Not enough credits.' }));

    expect(messages().at(-1)).toMatchObject({
      role: 'assistant',
      content: 'Not enough credits.',
    });
    expect(result.current.browse.isRunning).toBe(false);
  });

  it('raises a prompt for a confirmation and answers the worker', () => {
    const { result } = render();
    act(() => result.current.browse.run('go'));
    act(() =>
      frame({ type: 'confirm', id: 4, description: 'Click [1] button "Pay"' }),
    );

    expect(result.current.prompts).toHaveLength(1);
    const request = result.current.prompts[0];
    expect(request.title).toBe('Click [1] button "Pay"');

    act(() => request.respond!('allow'));
    expect(sent().at(-1)).toEqual({
      type: 'MENTOR:BROWSE_CONFIRM',
      id: 4,
      ok: true,
    });

    act(() =>
      frame({
        type: 'confirm',
        id: 5,
        description: 'Click [2] button "Delete"',
      }),
    );
    act(() => result.current.prompts[0].respond!('deny'));
    expect(sent().at(-1)).toEqual({
      type: 'MENTOR:BROWSE_CONFIRM',
      id: 5,
      ok: false,
    });
  });

  // A prompt nobody can answer any more would sit there forever.
  it('withdraws an unanswered prompt when the run ends', () => {
    const { result } = render();
    act(() => result.current.browse.run('go'));
    act(() => frame({ type: 'confirm', id: 1, description: 'Click' }));
    expect(result.current.prompts).toHaveLength(1);

    act(() => frame({ type: 'done', text: 'Stopped.' }));
    expect(result.current.prompts).toHaveLength(0);
  });

  it('stops only while a run is in flight', () => {
    const { result } = render();
    act(() => result.current.browse.stop());
    expect(sent()).toEqual([]);

    act(() => result.current.browse.run('go'));
    act(() => result.current.browse.stop());
    expect(sent().at(-1)).toEqual({ type: 'MENTOR:BROWSE_STOP' });
  });

  it('carries the approvals choice, read at the moment the run starts', () => {
    window.localStorage.setItem('ibl_cowork_approvals', 'manual');
    const { result } = render();
    act(() => result.current.browse.run('one'));
    expect(sent().at(-1)).toMatchObject({ auto: false });

    window.localStorage.removeItem('ibl_cowork_approvals');
    act(() => frame({ type: 'done', text: 'ok' }));
    act(() => result.current.browse.run('two'));
    expect(sent().at(-1)).toMatchObject({ auto: true });
  });

  it('refuses a second run while one is in flight', () => {
    const { result } = render();
    act(() => result.current.browse.run('one'));
    act(() => result.current.browse.run('two'));
    expect(sent()).toHaveLength(1);
  });

  it('ignores frames from anything but the panel, and before a run', () => {
    const { result } = render();
    act(() => frame({ type: 'event', event: { type: 'text', text: 'early' } }));
    expect(state().currentStreamingMessage.content).toBe('');

    act(() => result.current.browse.run('go'));
    act(() =>
      frame(
        { type: 'event', event: { type: 'text', text: 'nope' } },
        {
          postMessage: vi.fn(),
        },
      ),
    );
    expect(state().currentStreamingMessage.content).toBe('');
  });

  // The bug this exists for: the run dispatched `setStreaming`, whose field
  // nothing reads. `status` is what `selectStreaming` / `selectIsPending` derive
  // from, so leaving it at 'idle' hid the working indicator, hid the streaming
  // bubble carrying every log line, left Send in place of Stop, and left the
  // guided prompts on screen for the whole run.
  it('drives the status field the chat reads, and returns it to idle', () => {
    const { result } = render();
    expect(state().status).toBe('idle');

    act(() => result.current.browse.run('go'));
    expect(state().status).toBe('streaming');

    act(() => frame({ type: 'done', text: 'done' }));
    expect(state().status).toBe('idle');
  });

  // No silence timer: a page snapshot plus time-to-first-token is legitimately
  // long, and the previous 30s watchdog killed healthy runs while the worker
  // carried on driving the tab. Death has real signals — the panel's ack, the
  // port dropping, and Stop.
  it('does not end a run that has simply gone quiet', () => {
    vi.useFakeTimers();
    try {
      const { result } = render();
      act(() => result.current.browse.run('go'));
      act(() => vi.advanceTimersByTime(300_000));
      expect(result.current.browse.isRunning).toBe(true);
      expect(state().status).toBe('streaming');
    } finally {
      vi.useRealTimers();
    }
  });

  it('treats the panel ack as a sign of life and shows nothing for it', () => {
    const { result } = render();
    act(() => result.current.browse.run('go'));
    const before = messages().length;
    act(() => frame({ type: 'ack' }));
    expect(messages()).toHaveLength(before);
    expect(result.current.browse.isRunning).toBe(true);
  });

  // `addUserMessage` spreads `state.chats[tab]`; a missing bucket threw, and a
  // throw inside handleSubmit loses the text the user typed.
  it('still shows the goal when the active tab has no messages yet', () => {
    // No array for the active tab: addUserMessage's spread throws, and the text
    // must survive that.
    store.dispatch({ type: 'chat/setChats', payload: {} });
    const { result } = render();
    act(() => result.current.browse.run('open billing'));
    expect(messages().at(-1)).toMatchObject({
      role: 'user',
      content: 'open billing',
    });
  });
});
