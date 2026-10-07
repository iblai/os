// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

import { useIsLtiLaunch } from '../use-is-lti-launch';
import { persistEmbedContextFromUrl } from '@/lib/embed-context';

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
    value: { name: 'lms-course-page' },
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

describe('useIsLtiLaunch', () => {
  it('is false by default (no params)', () => {
    const { result } = renderHook(() => useIsLtiLaunch());
    expect(result.current).toBe(false);
  });

  it('is true when the launch URL carries lti=true', () => {
    params({ embed: 'true', lti: 'true' });
    const { result } = renderHook(() => useIsLtiLaunch());
    expect(result.current).toBe(true);
  });

  it('is false when the value is present but not exactly "true"', () => {
    for (const value of ['false', 'TRUE', '1', '']) {
      params({ embed: 'true', lti: value });
      const { result } = renderHook(() => useIsLtiLaunch());
      expect(result.current).toBe(false);
    }
  });

  it('recovers the flag from the persisted embed context after the query is dropped', () => {
    framed();
    // First (embedded) load persists the context, `lti` included.
    window.history.replaceState({}, '', '/?embed=true&lti=true');
    persistEmbedContextFromUrl();
    // A later in-app navigation drops the query string.
    window.history.replaceState({}, '', '/platform/t/m');

    const { result } = renderHook(() => useIsLtiLaunch());
    expect(result.current).toBe(true);
  });

  it('ignores a stored context when the page is not framed', () => {
    window.sessionStorage.setItem(
      'ibl:embed-context',
      JSON.stringify({ embed: 'true', lti: 'true' }),
    );
    const { result } = renderHook(() => useIsLtiLaunch());
    expect(result.current).toBe(false);
  });
});
