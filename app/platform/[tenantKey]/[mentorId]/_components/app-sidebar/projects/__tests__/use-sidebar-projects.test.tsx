/**
 * useSidebarProjects — the infinite-scroll projects hook powering the
 * sidebar Projects section.
 *
 * The hook owns the growing query `limit`, derives `projects`/`hasMore`
 * from the RTK Query payload, and exposes an `onScroll` handler plus a
 * bootstrap effect that keeps loading until the list overflows. This file
 * covers everything reachable WITHOUT a real DOM element attached to
 * `scrollRef` (the overflow-measurement path where `scrollRef.current` is a
 * live node is covered in `sidebar-projects-section.test.tsx`).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Records every `useGetUserProjectsQuery` call so tests can assert the
// growing `limit` and the skip option.
const getUserProjectsArgsMock = vi.fn();
let mockData: unknown;
let mockIsFetching = false;

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useGetUserProjectsQuery: (args: unknown, options?: { skip?: boolean }) => {
    getUserProjectsArgsMock(args, options);
    if (options?.skip) {
      return { data: undefined, isFetching: false };
    }
    return { data: mockData, isFetching: mockIsFetching };
  },
}));

import { useSidebarProjects } from '../use-sidebar-projects';

function makeProjects(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    name: `P${i + 1}`,
  }));
}

const baseArgs = {
  tenantKey: 'tenant-a',
  username: 'admin-user',
  open: true,
  collapsed: false,
};

beforeEach(() => {
  getUserProjectsArgsMock.mockClear();
  mockData = { results: makeProjects(10), count: 25 };
  mockIsFetching = false;
  // Run rAF synchronously so the bootstrap effect's measurement executes in
  // the test tick. In `renderHook` the ref is never attached, so the inner
  // guard `el && ...` short-circuits (covering the null-element branch)
  // without ever bumping the limit here.
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(0);
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function lastLimit() {
  const calls = getUserProjectsArgsMock.mock.calls;
  const last = calls[calls.length - 1][0] as { params: { limit: number } };
  return last.params.limit;
}

describe('useSidebarProjects — query wiring', () => {
  it('sends the initial page size (limit 10) and the tenant/username', () => {
    renderHook(() => useSidebarProjects(baseArgs));
    expect(getUserProjectsArgsMock).toHaveBeenCalled();
    const [args, options] = getUserProjectsArgsMock.mock.calls[0];
    expect(args).toMatchObject({
      tenantKey: 'tenant-a',
      username: 'admin-user',
      params: { limit: 10 },
    });
    expect(options?.skip).toBe(false);
  });

  it('skips the query when tenantKey is missing', () => {
    renderHook(() => useSidebarProjects({ ...baseArgs, tenantKey: '' }));
    expect(getUserProjectsArgsMock.mock.calls[0][1]?.skip).toBe(true);
  });

  it('skips the query when username is missing', () => {
    renderHook(() => useSidebarProjects({ ...baseArgs, username: '' }));
    expect(getUserProjectsArgsMock.mock.calls[0][1]?.skip).toBe(true);
  });
});

describe('useSidebarProjects — derived state', () => {
  it('derives projects, and hasMore=true when loaded < count', () => {
    const { result } = renderHook(() => useSidebarProjects(baseArgs));
    expect(result.current.projects).toHaveLength(10);
    expect(result.current.hasMore).toBe(true);
    expect(result.current.isFetching).toBe(false);
  });

  it('hasMore=false once the loaded count reaches the total', () => {
    mockData = { results: makeProjects(10), count: 10 };
    const { result } = renderHook(() => useSidebarProjects(baseArgs));
    expect(result.current.hasMore).toBe(false);
  });

  it('defaults count to 0 when the payload omits it (hasMore=false)', () => {
    mockData = { results: makeProjects(3) };
    const { result } = renderHook(() => useSidebarProjects(baseArgs));
    expect(result.current.hasMore).toBe(false);
  });

  it('defaults projects to [] when results is missing', () => {
    mockData = { count: 5 };
    const { result } = renderHook(() => useSidebarProjects(baseArgs));
    expect(result.current.projects).toEqual([]);
    // count 5 > 0 loaded → still "more" to fetch.
    expect(result.current.hasMore).toBe(true);
  });

  it('returns [] projects when the query is skipped (no data)', () => {
    const { result } = renderHook(() =>
      useSidebarProjects({ ...baseArgs, tenantKey: '' }),
    );
    expect(result.current.projects).toEqual([]);
    expect(result.current.hasMore).toBe(false);
  });
});

describe('useSidebarProjects — onScroll', () => {
  function scrollEvent(metrics: {
    scrollHeight: number;
    scrollTop: number;
    clientHeight: number;
  }) {
    return {
      currentTarget: metrics,
    } as unknown as React.UIEvent<HTMLUListElement>;
  }

  it('bumps the limit by a page when scrolled near the bottom and more remain', () => {
    const { result } = renderHook(() => useSidebarProjects(baseArgs));
    // scrollHeight - scrollTop - clientHeight = 100 - 60 - 50 = -10 (< 48)
    act(() => {
      result.current.onScroll(
        scrollEvent({ scrollHeight: 100, scrollTop: 60, clientHeight: 50 }),
      );
    });
    expect(lastLimit()).toBe(20);
  });

  it('does NOT bump when the user is far from the bottom', () => {
    const { result } = renderHook(() => useSidebarProjects(baseArgs));
    // 1000 - 0 - 50 = 950 (>= 48) → no bump.
    act(() => {
      result.current.onScroll(
        scrollEvent({ scrollHeight: 1000, scrollTop: 0, clientHeight: 50 }),
      );
    });
    expect(lastLimit()).toBe(10);
  });

  it('does NOT bump when there is nothing more to load', () => {
    mockData = { results: makeProjects(10), count: 10 }; // hasMore false
    const { result } = renderHook(() => useSidebarProjects(baseArgs));
    act(() => {
      result.current.onScroll(
        scrollEvent({ scrollHeight: 100, scrollTop: 60, clientHeight: 50 }),
      );
    });
    expect(lastLimit()).toBe(10);
  });

  it('does NOT bump while a fetch is already in flight', () => {
    mockIsFetching = true;
    const { result } = renderHook(() => useSidebarProjects(baseArgs));
    act(() => {
      result.current.onScroll(
        scrollEvent({ scrollHeight: 100, scrollTop: 60, clientHeight: 50 }),
      );
    });
    expect(lastLimit()).toBe(10);
  });
});

describe('useSidebarProjects — bootstrap effect early returns', () => {
  it('does not bump when collapsed (effect returns before measuring)', () => {
    renderHook(() => useSidebarProjects({ ...baseArgs, collapsed: true }));
    expect(lastLimit()).toBe(10);
  });

  it('does not bump when the section is closed', () => {
    renderHook(() => useSidebarProjects({ ...baseArgs, open: false }));
    expect(lastLimit()).toBe(10);
  });

  it('does not bump when there is nothing more to load', () => {
    mockData = { results: makeProjects(10), count: 10 };
    renderHook(() => useSidebarProjects(baseArgs));
    expect(lastLimit()).toBe(10);
  });

  it('does not throw and does not bump when the scroll ref is unattached (null element)', () => {
    // rAF runs synchronously here; with no attached element the inner
    // `el && ...` guard short-circuits — the measurement path is exercised
    // but no bump occurs.
    const { result } = renderHook(() => useSidebarProjects(baseArgs));
    expect(result.current.scrollRef.current).toBeNull();
    expect(lastLimit()).toBe(10);
  });
});
