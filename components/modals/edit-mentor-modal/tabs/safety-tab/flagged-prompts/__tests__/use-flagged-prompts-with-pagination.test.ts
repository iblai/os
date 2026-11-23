import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useFlaggedPromptsWithPagination } from '../use-flagged-prompts-with-pagination';

const mockUseGetModerationLogsQuery = vi.fn();
const mockUseGetSafetyLogsQuery = vi.fn();

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useGetModerationLogsQuery: (...args: unknown[]) =>
    mockUseGetModerationLogsQuery(...args),
  useGetSafetyLogsQuery: (...args: unknown[]) =>
    mockUseGetSafetyLogsQuery(...args),
}));

vi.mock('use-debounce', () => ({
  useDebounce: (value: unknown) => [value],
}));

const HOUR = 60 * 60 * 1000;

const log = (id: number, hoursAgo: number, username = 'jane') => ({
  id,
  username,
  prompt: `prompt ${id}`,
  reason: `reason ${id}`,
  date_created: new Date(Date.now() - hoursAgo * HOUR).toISOString(),
});

const page = (results: ReturnType<typeof log>[], count = results.length) => ({
  data: { count, next: null, previous: null, results },
  isLoading: false,
});

const params = { tenantKey: 'acme', username: 'admin', mentorId: 'm1' };

const lastArgs = (hook: ReturnType<typeof vi.fn>) =>
  hook.mock.calls.at(-1) as [Record<string, unknown>, Record<string, unknown>];

const rows = (prompts: { id: string; type: string }[]) =>
  prompts.map((p) => [p.id, p.type]);

describe('useFlaggedPromptsWithPagination', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseGetModerationLogsQuery.mockReturnValue(page([]));
    mockUseGetSafetyLogsQuery.mockReturnValue(page([]));
  });

  describe('request params', () => {
    it('lists every user’s logs: sends the admin as userId and no username filter', () => {
      const { result } = renderHook(() =>
        useFlaggedPromptsWithPagination(params),
      );
      act(() => result.current.setFilterType('safety'));

      for (const hook of [
        mockUseGetModerationLogsQuery,
        mockUseGetSafetyLogsQuery,
      ]) {
        const [args] = lastArgs(hook);
        expect(args).not.toHaveProperty('username');
        expect(args).not.toHaveProperty('targetSystem');
        expect(args).toMatchObject({
          org: 'acme',
          userId: 'admin',
          mentor: 'm1',
          ordering: '-date_created',
        });
      }
    });

    it('refetches on every open so a new block shows without waiting', () => {
      renderHook(() => useFlaggedPromptsWithPagination(params));
      expect(lastArgs(mockUseGetModerationLogsQuery)[1]).toMatchObject({
        refetchOnMountOrArgChange: true,
      });
      expect(lastArgs(mockUseGetSafetyLogsQuery)[1]).toMatchObject({
        refetchOnMountOrArgChange: true,
      });
    });

    it('forwards search and date range', () => {
      const { result } = renderHook(() =>
        useFlaggedPromptsWithPagination(params),
      );
      const from = new Date('2026-01-01T00:00:00Z');
      const to = new Date('2026-01-31T00:00:00Z');
      act(() => {
        result.current.setSearchQuery('hello');
        result.current.setDateRange({ from, to });
      });

      expect(lastArgs(mockUseGetModerationLogsQuery)[0]).toMatchObject({
        search: 'hello',
        startTime: from.toISOString(),
        endTime: to.toISOString(),
      });
    });

    it('omits empty search and dates', () => {
      renderHook(() => useFlaggedPromptsWithPagination(params));
      const [args] = lastArgs(mockUseGetModerationLogsQuery);
      expect(args.search).toBeUndefined();
      expect(args.startTime).toBeUndefined();
      expect(args.endTime).toBeUndefined();
    });
  });

  describe('filter → endpoint', () => {
    it('defaults to moderation logs only', () => {
      mockUseGetModerationLogsQuery.mockReturnValue(page([log(1, 1)], 12));
      mockUseGetSafetyLogsQuery.mockReturnValue(page([log(2, 1)], 3));
      const { result } = renderHook(() =>
        useFlaggedPromptsWithPagination(params),
      );

      expect(result.current.filterType).toBe('moderation');
      expect(lastArgs(mockUseGetModerationLogsQuery)[1].skip).toBe(false);
      expect(lastArgs(mockUseGetSafetyLogsQuery)[1].skip).toBe(true);
      expect(rows(result.current.paginatedPrompts)).toEqual([
        ['1', 'Moderation'],
      ]);
      expect(result.current.totalFlagged).toBe(12);
    });

    it('pages moderation logs on the server, 5 at a time', () => {
      mockUseGetModerationLogsQuery.mockReturnValue(page([log(1, 1)], 12));
      const { result } = renderHook(() =>
        useFlaggedPromptsWithPagination(params),
      );
      act(() => result.current.handlePageChange(3));

      expect(lastArgs(mockUseGetModerationLogsQuery)[0]).toMatchObject({
        page: 3,
        pageSize: 5,
      });
      expect(result.current.totalPages).toBe(3);
    });

    it('"safety" fetches only safety logs, paged on the server', () => {
      mockUseGetModerationLogsQuery.mockReturnValue(page([log(1, 1)], 12));
      mockUseGetSafetyLogsQuery.mockReturnValue(page([log(2, 1)], 3));
      const { result } = renderHook(() =>
        useFlaggedPromptsWithPagination(params),
      );
      act(() => result.current.setFilterType('safety'));

      const [args, options] = lastArgs(mockUseGetSafetyLogsQuery);
      expect(options.skip).toBe(false);
      expect(args).toMatchObject({ page: 1, pageSize: 5 });
      expect(lastArgs(mockUseGetModerationLogsQuery)[1].skip).toBe(true);
      expect(rows(result.current.paginatedPrompts)).toEqual([['2', 'Safety']]);
      expect(result.current.totalFlagged).toBe(3);
      expect(result.current.totalPages).toBe(1);
    });

    it('goes back to page 1 when the filter changes', () => {
      const { result } = renderHook(() =>
        useFlaggedPromptsWithPagination(params),
      );
      act(() => result.current.handlePageChange(3));
      expect(result.current.currentPage).toBe(3);
      act(() => result.current.setFilterType('safety'));
      expect(result.current.currentPage).toBe(1);
      expect(lastArgs(mockUseGetSafetyLogsQuery)[0]).toMatchObject({
        page: 1,
      });
    });
  });

  describe('rows', () => {
    it('shows a guest (empty username) as Unknown User', () => {
      mockUseGetModerationLogsQuery.mockReturnValue(page([log(9, 1, '')]));
      const { result } = renderHook(() =>
        useFlaggedPromptsWithPagination(params),
      );
      expect(result.current.paginatedPrompts[0]).toMatchObject({
        id: '9',
        userId: 'unknown',
        userEmail: 'N/A',
        userFullName: 'Unknown User',
        prompt: 'prompt 9',
        systemResponse: 'reason 9',
      });
    });

    it('labels how long ago each prompt was flagged', () => {
      const minute = 60 * 1000;
      const ago = (ms: number, id: number) => ({
        ...log(id, 0),
        date_created: new Date(Date.now() - ms).toISOString(),
      });
      mockUseGetModerationLogsQuery.mockReturnValue(
        page([
          ago(0, 1),
          ago(1 * minute, 2),
          ago(2 * minute, 3),
          ago(HOUR, 4),
          ago(2 * HOUR, 5),
          ago(24 * HOUR, 6),
          ago(48 * HOUR, 7),
        ]),
      );
      const { result } = renderHook(() =>
        useFlaggedPromptsWithPagination({ ...params, itemsPerPage: 10 }),
      );
      expect(result.current.paginatedPrompts.map((p) => p.timeAgo)).toEqual([
        'just now',
        '1 minute ago',
        '2 minutes ago',
        '1 hour ago',
        '2 hours ago',
        '1 day ago',
        '2 days ago',
      ]);
    });

    it('is empty while loading', () => {
      mockUseGetModerationLogsQuery.mockReturnValue({
        data: undefined,
        isLoading: true,
      });
      const { result } = renderHook(() =>
        useFlaggedPromptsWithPagination(params),
      );
      expect(result.current.paginatedPrompts).toEqual([]);
      expect(result.current.totalFlagged).toBe(0);
      expect(result.current.totalPages).toBe(0);
      expect(result.current.isLoading).toBe(true);
    });
  });

  describe('isLoading', () => {
    it('follows the shown list only', () => {
      mockUseGetSafetyLogsQuery.mockReturnValue({
        data: undefined,
        isLoading: true,
      });
      const { result } = renderHook(() =>
        useFlaggedPromptsWithPagination(params),
      );
      expect(result.current.isLoading).toBe(false);
      act(() => result.current.setFilterType('safety'));
      expect(result.current.isLoading).toBe(true);
    });
  });
});
