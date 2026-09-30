// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

import { useShowUserProfile } from '../use-show-user-profile';

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

describe('useShowUserProfile', () => {
  it('is hidden by default (no params)', () => {
    const { result } = renderHook(() => useShowUserProfile());
    expect(result.current).toBe(false);
  });

  it('shows the profile when the host opts in via the URL', () => {
    params({ embed: 'true', mode: 'anonymous', 'show-user-profile': 'true' });
    const { result } = renderHook(() => useShowUserProfile());
    expect(result.current).toBe(true);
  });

  it('stays hidden when the value is present but not exactly "true"', () => {
    for (const value of ['false', 'TRUE', '1', '', 'yes']) {
      params({ embed: 'true', 'show-user-profile': value });
      const { result } = renderHook(() => useShowUserProfile());
      expect(result.current).toBe(false);
    }
  });

  it('recovers the opt-in from the persisted embed context', () => {
    framed();
    window.sessionStorage.setItem(
      'ibl:embed-context',
      JSON.stringify({
        embed: 'true',
        mode: 'anonymous',
        'show-user-profile': 'true',
      }),
    );
    const { result } = renderHook(() => useShowUserProfile());
    expect(result.current).toBe(true);
  });

  it('stays hidden when the persisted context has no opt-in', () => {
    framed();
    window.sessionStorage.setItem(
      'ibl:embed-context',
      JSON.stringify({ embed: 'true', mode: 'anonymous' }),
    );
    const { result } = renderHook(() => useShowUserProfile());
    expect(result.current).toBe(false);
  });

  it('prefers the URL param over the persisted context', () => {
    framed();
    window.sessionStorage.setItem(
      'ibl:embed-context',
      JSON.stringify({
        embed: 'true',
        'show-user-profile': 'true',
      }),
    );
    params({ 'show-user-profile': 'false' });
    const { result } = renderHook(() => useShowUserProfile());
    expect(result.current).toBe(false);
  });
});
