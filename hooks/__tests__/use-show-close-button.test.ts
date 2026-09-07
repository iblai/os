// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

import { useShowCloseButton } from '../use-show-close-button';

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

beforeEach(() => {
  mockGet.mockReset();
  mockGet.mockReturnValue(null);
  window.sessionStorage.clear();
  window.history.replaceState({}, '', '/');
  topLevel();
});

describe('useShowCloseButton', () => {
  describe('bubble embed (no mode param)', () => {
    it('shows the close affordance when no embed params are present', () => {
      const { result } = renderHook(() => useShowCloseButton());
      expect(result.current).toBe(true);
    });

    it('shows the close affordance for the bubble embed URL', () => {
      params({ embed: 'true', 'extra-body-classes': 'iframed-externally' });
      const { result } = renderHook(() => useShowCloseButton());
      expect(result.current).toBe(true);
    });

    it('shows the close affordance when mode is some other value', () => {
      params({ embed: 'true', mode: 'default' });
      const { result } = renderHook(() => useShowCloseButton());
      expect(result.current).toBe(true);
    });
  });

  describe('agent-ai embed (mode=anonymous)', () => {
    it('hides the close affordance by default', () => {
      params({
        embed: 'true',
        mode: 'anonymous',
        'extra-body-classes': 'iframed-externally',
      });
      const { result } = renderHook(() => useShowCloseButton());
      expect(result.current).toBe(false);
    });

    it('shows the close affordance when the host opts in', () => {
      params({ embed: 'true', mode: 'anonymous', 'show-close-button': 'true' });
      const { result } = renderHook(() => useShowCloseButton());
      expect(result.current).toBe(true);
    });

    it('stays hidden when the opt-in value is not exactly "true"', () => {
      for (const value of ['false', 'TRUE', '1', '', 'yes']) {
        params({
          embed: 'true',
          mode: 'anonymous',
          'show-close-button': value,
        });
        const { result } = renderHook(() => useShowCloseButton());
        expect(result.current).toBe(false);
      }
    });

    it('shows the close affordance inside the Embed tab preview', () => {
      params({
        embed: 'true',
        mode: 'anonymous',
        internalPreview: 'true',
      });
      const { result } = renderHook(() => useShowCloseButton());
      expect(result.current).toBe(true);
    });
  });

  describe('persisted embed-context fallback', () => {
    it('falls back to the live URL when useSearchParams is momentarily empty', () => {
      window.history.replaceState(
        {},
        '',
        '/platform/acme/bot-1?embed=true&mode=anonymous',
      );
      const { result } = renderHook(() => useShowCloseButton());
      expect(result.current).toBe(false);
    });

    it('stays hidden after a navigation drops the params, via sessionStorage', () => {
      framed();
      window.sessionStorage.setItem(
        'ibl:embed-context',
        JSON.stringify({ embed: 'true', mode: 'anonymous' }),
      );
      const { result } = renderHook(() => useShowCloseButton());
      expect(result.current).toBe(false);
    });

    it('recovers the opt-in from the persisted context', () => {
      framed();
      window.sessionStorage.setItem(
        'ibl:embed-context',
        JSON.stringify({
          embed: 'true',
          mode: 'anonymous',
          'show-close-button': 'true',
        }),
      );
      const { result } = renderHook(() => useShowCloseButton());
      expect(result.current).toBe(true);
    });

    it('prefers the search params over the persisted context', () => {
      framed();
      window.sessionStorage.setItem(
        'ibl:embed-context',
        JSON.stringify({ embed: 'true', mode: 'anonymous' }),
      );
      params({ mode: 'default' });
      const { result } = renderHook(() => useShowCloseButton());
      expect(result.current).toBe(true);
    });
  });

  it('updates when the search params change', () => {
    params({ embed: 'true', mode: 'anonymous' });
    const { result, rerender } = renderHook(() => useShowCloseButton());
    expect(result.current).toBe(false);

    params({ embed: 'true', mode: 'anonymous', 'show-close-button': 'true' });
    rerender();
    expect(result.current).toBe(true);
  });
});
