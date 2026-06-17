import { describe, it, expect, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';

import { useIsIframed } from '../use-is-iframed';

const originalTop = window.top;

function setWindowTop(value: Window | null) {
  Object.defineProperty(window, 'top', {
    configurable: true,
    get: () => value,
  });
}

describe('useIsIframed', () => {
  afterEach(() => {
    Object.defineProperty(window, 'top', {
      configurable: true,
      get: () => originalTop,
    });
  });

  it('returns false when window.self === window.top (top-level page)', () => {
    setWindowTop(window);
    const { result } = renderHook(() => useIsIframed());
    expect(result.current).toBe(false);
  });

  it('returns true when window.self !== window.top (iframed page)', () => {
    setWindowTop({} as Window);
    const { result } = renderHook(() => useIsIframed());
    expect(result.current).toBe(true);
  });

  it('returns true when window.top is null (cross-origin sandboxed iframe)', () => {
    setWindowTop(null);
    const { result } = renderHook(() => useIsIframed());
    expect(result.current).toBe(true);
  });
});
