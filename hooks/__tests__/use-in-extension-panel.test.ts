import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BROWSE_HELLO,
  BROWSE_READY,
  useInExtensionPanel,
} from '@/hooks/use-in-extension-panel';

/** Stand in for the extension panel hosting this app in an iframe. */
function withParent(parent: unknown) {
  Object.defineProperty(window, 'parent', {
    value: parent,
    configurable: true,
    writable: true,
  });
}

const reply = (type: string, source: unknown = window.parent) =>
  window.dispatchEvent(
    new MessageEvent('message', { data: { type }, source: source as Window }),
  );

let postMessage: ReturnType<typeof vi.fn>;
let mockSearchParams = new URLSearchParams();
let mockEmbedContext: Record<string, string> | null = null;

vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
}));

vi.mock('@/lib/embed-context', () => ({
  getEmbedContext: () => mockEmbedContext,
}));

beforeEach(() => {
  vi.useFakeTimers();
  postMessage = vi.fn();
  withParent({ postMessage });
  mockSearchParams = new URLSearchParams();
  mockEmbedContext = null;
});

afterEach(() => {
  vi.useRealTimers();
  withParent(window);
});

describe('useInExtensionPanel', () => {
  // The SDK's Cowork pill reads this once, when it mounts: the flag the panel
  // puts on the iframe URL is there on the first render, with nothing to ask.
  it('says yes at once from the enable-cowork flag, and asks nothing', () => {
    mockSearchParams = new URLSearchParams('embed=true&enable-cowork=true');
    const { result } = renderHook(() => useInExtensionPanel());
    expect(result.current).toBe(true);
    act(() => vi.advanceTimersByTime(2000));
    expect(postMessage).not.toHaveBeenCalled();
  });

  it('keeps saying yes from the embed context once the URL lost the flag', () => {
    mockEmbedContext = { embed: 'true', 'enable-cowork': 'true' };
    const { result } = renderHook(() => useInExtensionPanel());
    expect(result.current).toBe(true);
    expect(postMessage).not.toHaveBeenCalled();
  });

  // An extension from before the flag: the handshake still answers, after mount.
  it('says yes once the panel answers the handshake', () => {
    const { result } = renderHook(() => useInExtensionPanel());
    expect(result.current).toBe(false);
    expect(postMessage).toHaveBeenCalledWith({ type: BROWSE_HELLO }, '*');

    act(() => reply(BROWSE_READY));
    expect(result.current).toBe(true);
  });

  it('stops asking once it has an answer', () => {
    renderHook(() => useInExtensionPanel());
    act(() => reply(BROWSE_READY));
    const asked = postMessage.mock.calls.length;
    act(() => vi.advanceTimersByTime(2000));
    expect(postMessage).toHaveBeenCalledTimes(asked);
  });

  // The app can boot before the panel installs its listener, so the hello is
  // retried — but not forever.
  it('retries a bounded number of times when nothing answers', () => {
    const { result } = renderHook(() => useInExtensionPanel());
    act(() => vi.advanceTimersByTime(10_000));
    expect(result.current).toBe(false);
    expect(postMessage.mock.calls.length).toBeLessThanOrEqual(11);
  });

  it('ignores a ready from anything but the parent, and other frames', () => {
    const { result } = renderHook(() => useInExtensionPanel());
    act(() => reply(BROWSE_READY, { postMessage: vi.fn() }));
    expect(result.current).toBe(false);
    act(() => reply('SOMETHING:ELSE'));
    expect(result.current).toBe(false);
  });

  // A top-level tab has no panel to ask; asking would post to itself.
  it('never asks when there is no parent frame', () => {
    withParent(window);
    const { result } = renderHook(() => useInExtensionPanel());
    expect(result.current).toBe(false);
    expect(postMessage).not.toHaveBeenCalled();
  });

  it('stops listening when unmounted', () => {
    const { result, unmount } = renderHook(() => useInExtensionPanel());
    unmount();
    act(() => reply(BROWSE_READY));
    expect(result.current).toBe(false);
  });
});
