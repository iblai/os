// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

import { useAllowFullscreen } from '../use-allow-fullscreen';
import { EMBED_CONTEXT_KEYS } from '@/lib/embed-context';

const mockGet = vi.fn();
vi.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: mockGet,
  }),
}));

function params(values: Record<string, string>) {
  mockGet.mockImplementation((key: string) => values[key] ?? null);
}

function framed() {
  Object.defineProperty(window, 'top', {
    value: { name: 'host-page' },
    configurable: true,
  });
}

function topLevel() {
  Object.defineProperty(window, 'top', { value: window, configurable: true });
}

function storeContext(ctx: Record<string, string>) {
  window.sessionStorage.setItem('ibl:embed-context', JSON.stringify(ctx));
}

beforeEach(() => {
  mockGet.mockReset();
  mockGet.mockReturnValue(null);
  window.sessionStorage.clear();
  window.history.replaceState({}, '', '/');
  topLevel();
});

describe('useAllowFullscreen', () => {
  it('is off when the param is absent', () => {
    params({ embed: 'true' });
    const { result } = renderHook(() => useAllowFullscreen());
    expect(result.current).toBe(false);
  });

  it('is on when allow-fullscreen=true', () => {
    params({ embed: 'true', 'allow-fullscreen': 'true' });
    const { result } = renderHook(() => useAllowFullscreen());
    expect(result.current).toBe(true);
  });

  it('is off for any other value', () => {
    params({ embed: 'true', 'allow-fullscreen': 'yes' });
    const { result } = renderHook(() => useAllowFullscreen());
    expect(result.current).toBe(false);
  });

  it('recovers the flag from the persisted embed context after navigation', () => {
    framed();
    storeContext({ embed: 'true', 'allow-fullscreen': 'true' });
    const { result } = renderHook(() => useAllowFullscreen());
    expect(result.current).toBe(true);
  });

  it('ignores the persisted context when not framed', () => {
    storeContext({ embed: 'true', 'allow-fullscreen': 'true' });
    const { result } = renderHook(() => useAllowFullscreen());
    expect(result.current).toBe(false);
  });

  it('prefers the search params over the persisted context', () => {
    framed();
    storeContext({ embed: 'true', 'allow-fullscreen': 'true' });
    params({ 'allow-fullscreen': 'false' });
    const { result } = renderHook(() => useAllowFullscreen());
    expect(result.current).toBe(false);
  });

  it('is persisted as part of the embed context', () => {
    expect(EMBED_CONTEXT_KEYS).toContain('allow-fullscreen');
  });
});
