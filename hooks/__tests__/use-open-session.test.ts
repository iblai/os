// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const mockDispatch = vi.fn();
const emit = vi.fn();

vi.mock('@/lib/hooks', () => ({
  useAppDispatch: () => mockDispatch,
}));

vi.mock('@iblai/iblai-js/web-utils', () => ({
  clearFiles: (payload: unknown) => ({ type: 'files/clear', payload }),
  chatActions: {
    resetIsTyping: (p: unknown) => ({ type: 'chat/resetIsTyping', payload: p }),
    setStreaming: (p: unknown) => ({ type: 'chat/setStreaming', payload: p }),
    resetCurrentStreamingMessage: (p: unknown) => ({
      type: 'chat/resetCurrentStreamingMessage',
      payload: p,
    }),
    setActiveTab: (p: unknown) => ({ type: 'chat/setActiveTab', payload: p }),
    updateSessionIds: (p: unknown) => ({
      type: 'chat/updateSessionIds',
      payload: p,
    }),
    setShouldStartNewChat: (p: unknown) => ({
      type: 'chat/setShouldStartNewChat',
      payload: p,
    }),
  },
}));

vi.mock('@/lib/eventBus', () => ({
  default: { emit: (...args: unknown[]) => emit(...args) },
  RemoteEvents: { stopChatGenerating: 'stopChatGenerating' },
}));

// Backed by a real object so a write is observable the way the component sees
// it — this map is what the SDK's loader effect watches.
let stored: Record<string, string> = {};
const saveStored = vi.fn((value: Record<string, string>) => {
  stored = value;
});
vi.mock('@/hooks/use-local-storage', () => ({
  useLocalStorage: () => [stored, saveStored],
}));

import { selectChatSession, useOpenSessionFromUrl } from '../use-open-session';

const types = () => mockDispatch.mock.calls.map(([action]) => action.type);

beforeEach(() => {
  vi.clearAllMocks();
  stored = {};
});

describe('selectChatSession', () => {
  const select = (sessionId = 'session-1') =>
    selectChatSession({
      sessionId,
      tenantKey: 'acme',
      mentorId: 'agent-1',
      dispatch: mockDispatch,
      cachedSessionIds: stored,
      saveCachedSessionIds: saveStored,
    });

  /**
   * The write the SDK's loader watches. Without it the chat keeps showing
   * the previous conversation while the store claims a different session.
   */
  it('caches the session under this tenant and agent', () => {
    select();

    expect(saveStored).toHaveBeenCalledWith({ 'acme:agent-1': 'session-1' });
  });

  it('points the chat at the session and stops it starting a new one', () => {
    select();

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'chat/updateSessionIds',
      payload: 'session-1',
    });
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'chat/setShouldStartNewChat',
      payload: false,
    });
  });

  // Leaving the previous chat's streaming attached to the new session is the
  // failure this ordering exists to prevent.
  it('tears the previous chat down before switching', () => {
    select();

    const order = types();
    expect(order).toContain('files/clear');
    expect(order).toContain('chat/setStreaming');
    expect(order).toContain('chat/resetCurrentStreamingMessage');
    expect(emit).toHaveBeenCalledWith('stopChatGenerating');
    expect(order.indexOf('chat/updateSessionIds')).toBeGreaterThan(
      order.indexOf('chat/setStreaming'),
    );
  });

  it("keeps other agents' cached sessions", () => {
    stored = { 'acme:other-agent': 'session-9' };

    select();

    expect(saveStored).toHaveBeenCalledWith({
      'acme:other-agent': 'session-9',
      'acme:agent-1': 'session-1',
    });
  });
});

describe('useOpenSessionFromUrl', () => {
  // Not default parameters: an explicit `undefined` would fall back to them,
  // so the "waits until X is known" cases below would silently pass.
  const render = (
    args: Partial<Parameters<typeof useOpenSessionFromUrl>[0]> & {
      sessionId: string | null;
    },
  ) =>
    renderHook(() =>
      useOpenSessionFromUrl({
        tenantKey: 'acme',
        mentorId: 'agent-1',
        ...args,
      }),
    );

  it('opens the session the host named', () => {
    render({ sessionId: 'session-1' });

    expect(saveStored).toHaveBeenCalledWith({ 'acme:agent-1': 'session-1' });
  });

  it('does nothing when the host named none', () => {
    render({ sessionId: null });

    expect(saveStored).not.toHaveBeenCalled();
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it.each([
    ['tenant', { tenantKey: undefined }],
    ['agent', { mentorId: undefined }],
  ])('waits until the %s is known', (_label, missing) => {
    render({ sessionId: 'session-1', ...missing });

    expect(saveStored).not.toHaveBeenCalled();
  });

  // Re-running would tear down a chat that is already the right one.
  it('leaves an already-open session alone', () => {
    stored = { 'acme:agent-1': 'session-1' };

    render({ sessionId: 'session-1' });

    expect(saveStored).not.toHaveBeenCalled();
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  /**
   * Otherwise every re-render would drag the user back to the embedded
   * session the moment they picked a different chat from the sidebar.
   */
  it('applies a session once, not on every render', () => {
    const { rerender } = render({ sessionId: 'session-1' });
    saveStored.mockClear();

    rerender();
    rerender();

    expect(saveStored).not.toHaveBeenCalled();
  });
});
