import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({ useGetModerationLogsQuery: vi.fn() }));

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useGetModerationLogsQuery: mocks.useGetModerationLogsQuery,
}));

// The real one defers by 500ms, which would make every assertion wait.
vi.mock('use-debounce', () => ({
  useDebounce: (value: unknown) => [value],
}));

import { useFlaggedPromptsWithPagination } from '../use-flagged-prompts-with-pagination';

const PARAMS = { tenantKey: 'acme', username: 'ada', mentorId: 'm-1' };

const log = (over: Record<string, unknown> = {}) => ({
  id: 7,
  username: 'bob',
  target_system: 'Moderation System',
  prompt: 'the prompt',
  reason: 'the reason',
  date_created: new Date().toISOString(),
  ...over,
});

const answerWith = (data: unknown, isLoading = false) => {
  mocks.useGetModerationLogsQuery.mockReturnValue({ data, isLoading });
};

const lastQuery = () =>
  mocks.useGetModerationLogsQuery.mock.calls.at(-1)![0] as Record<
    string,
    unknown
  >;

beforeEach(() => {
  vi.clearAllMocks();
  answerWith(undefined);
});

describe('useFlaggedPromptsWithPagination', () => {
  // The endpoint's path is `/orgs/<org>/users/<user_id>/moderation-logs/`.
  // Without `userId` it requested `/users/undefined/`, so the tab could never
  // show anything. `username` stays as the query-side filter.
  it('identifies the user in the path, not only as a filter', () => {
    renderHook(() => useFlaggedPromptsWithPagination(PARAMS));

    expect(lastQuery()).toMatchObject({
      org: 'acme',
      userId: 'ada',
      username: 'ada',
      mentor: 'm-1',
    });
  });

  it('asks for the first page and the given page size', () => {
    renderHook(() =>
      useFlaggedPromptsWithPagination({ ...PARAMS, itemsPerPage: 3 }),
    );

    expect(lastQuery()).toMatchObject({ page: 1, pageSize: 3 });
  });

  it('sends no search, system or date filters until they are set', () => {
    renderHook(() => useFlaggedPromptsWithPagination(PARAMS));

    expect(lastQuery()).toMatchObject({
      search: undefined,
      targetSystem: undefined,
      startTime: undefined,
      endTime: undefined,
    });
  });

  it('maps the filter choice onto the target system', () => {
    const { result } = renderHook(() =>
      useFlaggedPromptsWithPagination(PARAMS),
    );

    act(() => result.current.setFilterType('moderation'));
    expect(lastQuery().targetSystem).toBe('Moderation System');

    act(() => result.current.setFilterType('safety'));
    expect(lastQuery().targetSystem).toBe('Safety System');

    act(() => result.current.setFilterType('all'));
    expect(lastQuery().targetSystem).toBeUndefined();
  });

  it('sends a typed search term', () => {
    const { result } = renderHook(() =>
      useFlaggedPromptsWithPagination(PARAMS),
    );

    act(() => result.current.setSearchQuery('abuse'));

    expect(result.current.searchQuery).toBe('abuse');
    expect(lastQuery().search).toBe('abuse');
  });

  it('sends the chosen date range as a start and end time', () => {
    const { result } = renderHook(() =>
      useFlaggedPromptsWithPagination(PARAMS),
    );
    const from = new Date('2026-01-01T00:00:00.000Z');
    const to = new Date('2026-02-01T00:00:00.000Z');

    act(() => result.current.setDateRange({ from, to }));

    expect(lastQuery()).toMatchObject({
      startTime: from.toISOString(),
      endTime: to.toISOString(),
    });
  });

  it('returns to the first page whenever a filter changes', () => {
    const { result } = renderHook(() =>
      useFlaggedPromptsWithPagination(PARAMS),
    );

    act(() => result.current.handlePageChange(3));
    expect(result.current.currentPage).toBe(3);

    act(() => result.current.setFilterType('safety'));
    expect(result.current.currentPage).toBe(1);
  });

  it('has nothing to show before the first answer arrives', () => {
    const { result } = renderHook(() =>
      useFlaggedPromptsWithPagination(PARAMS),
    );

    expect(result.current.paginatedPrompts).toEqual([]);
    expect(result.current.totalFlagged).toBe(0);
    expect(result.current.totalPages).toBe(0);
  });

  it('passes the loading flag straight through', () => {
    answerWith(undefined, true);
    const { result } = renderHook(() =>
      useFlaggedPromptsWithPagination(PARAMS),
    );

    expect(result.current.isLoading).toBe(true);
  });

  it('counts the pages from the total and the page size', () => {
    answerWith({ count: 11, results: [] });
    const { result } = renderHook(() =>
      useFlaggedPromptsWithPagination({ ...PARAMS, itemsPerPage: 5 }),
    );

    expect(result.current.totalFlagged).toBe(11);
    expect(result.current.totalPages).toBe(3);
  });

  it('presents a log with its reporter, type and dates', () => {
    answerWith({ count: 1, results: [log()] });
    const { result } = renderHook(() =>
      useFlaggedPromptsWithPagination(PARAMS),
    );

    const [prompt] = result.current.paginatedPrompts;
    expect(prompt).toMatchObject({
      id: '7',
      userId: 'bob',
      userEmail: 'bob',
      userFullName: 'bob',
      type: 'Moderation',
      prompt: 'the prompt',
      systemResponse: 'the reason',
      timeAgo: 'just now',
    });
    expect(prompt.timestamp).toEqual(prompt.fullDate);
  });

  it('calls a safety-system log Safety', () => {
    answerWith({
      count: 1,
      results: [log({ target_system: 'Safety System' })],
    });
    const { result } = renderHook(() =>
      useFlaggedPromptsWithPagination(PARAMS),
    );

    expect(result.current.paginatedPrompts[0].type).toBe('Safety');
  });

  it('stands in for a log that names no user', () => {
    answerWith({ count: 1, results: [log({ username: null })] });
    const { result } = renderHook(() =>
      useFlaggedPromptsWithPagination(PARAMS),
    );

    expect(result.current.paginatedPrompts[0]).toMatchObject({
      userId: 'unknown',
      userEmail: 'N/A',
      userFullName: 'Unknown User',
    });
  });

  it.each([
    [2 * 24 * 3600 * 1000, '2 days ago'],
    [24 * 3600 * 1000, '1 day ago'],
    [3 * 3600 * 1000, '3 hours ago'],
    [3600 * 1000, '1 hour ago'],
    [5 * 60 * 1000, '5 minutes ago'],
    [60 * 1000, '1 minute ago'],
    [2000, 'just now'],
  ])('says how long ago a log was flagged', (ago, expected) => {
    answerWith({
      count: 1,
      results: [
        log({ date_created: new Date(Date.now() - ago).toISOString() }),
      ],
    });
    const { result } = renderHook(() =>
      useFlaggedPromptsWithPagination(PARAMS),
    );

    expect(result.current.paginatedPrompts[0].timeAgo).toBe(expected);
  });
});
