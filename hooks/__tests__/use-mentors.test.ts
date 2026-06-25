import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useAiSearchMentorsWithPagination,
  useMentorsWithPagination,
} from '../use-mentors';

// Mock next/navigation
const mockUseParams = vi.fn();
vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
}));

// Mock use-debounce
vi.mock('use-debounce', () => ({
  useDebounce: (value: string) => [value],
}));

// Mock use-user
const mockUseUsername = vi.fn();
vi.mock('@/hooks/use-user', () => ({
  useUsername: () => mockUseUsername(),
}));

// Mock data-layer hooks
const mockUseGetMentorsQuery = vi.fn();
const mockUseGetPublicMentorsQuery = vi.fn();
const mockUseGetAiSearchMentorsQuery = vi.fn();
vi.mock('@iblai/iblai-js/data-layer', () => ({
  useGetMentorsQuery: (...args: unknown[]) => mockUseGetMentorsQuery(...args),
  useGetPublicMentorsQuery: (...args: unknown[]) =>
    mockUseGetPublicMentorsQuery(...args),
  useGetAiSearchMentorsQuery: (...args: unknown[]) =>
    mockUseGetAiSearchMentorsQuery(...args),
}));

describe('useMentorsWithPagination', () => {
  const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseParams.mockReturnValue({ tenantKey: 'tenant-1' });
    mockUseUsername.mockReturnValue('testuser');
    mockUseGetMentorsQuery.mockReturnValue({
      data: { results: [], count: 0 },
      isLoading: false,
      isFetching: false,
      error: null,
    });
    mockUseGetPublicMentorsQuery.mockReturnValue({
      data: { results: [], count: 0 },
      isLoading: false,
      isFetching: false,
      error: null,
    });
  });

  describe('initial state', () => {
    it('should return initial state values', () => {
      const { result } = renderHook(() => useMentorsWithPagination());

      expect(result.current.searchQuery).toBe('');
      expect(result.current.currentPage).toBe(1);
      expect(result.current.itemsPerPage).toBe(5);
    });

    it('should accept custom items per page', () => {
      const { result } = renderHook(() => useMentorsWithPagination(10));

      expect(result.current.itemsPerPage).toBe(10);
    });
  });

  describe('authenticated user', () => {
    it('should use mentors data when user is authenticated', () => {
      mockUseGetMentorsQuery.mockReturnValue({
        data: { results: [{ id: 1, name: 'Mentor 1' }], count: 1 },
        isLoading: false,
        isFetching: false,
        error: null,
      });

      const { result } = renderHook(() => useMentorsWithPagination());

      expect(result.current.mentors).toEqual([{ id: 1, name: 'Mentor 1' }]);
      expect(result.current.totalCount).toBe(1);
      expect(result.current.isLoading).toBe(false);
    });

    it('should skip getMentors query when tenantKey is missing', () => {
      mockUseParams.mockReturnValue({});

      renderHook(() => useMentorsWithPagination());

      expect(mockUseGetMentorsQuery).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ skip: true }),
      );
    });

    it('should skip getMentors query when username is missing', () => {
      mockUseUsername.mockReturnValue(null);

      renderHook(() => useMentorsWithPagination());

      expect(mockUseGetMentorsQuery).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ skip: true }),
      );
    });
  });

  describe('unauthenticated user', () => {
    beforeEach(() => {
      mockUseUsername.mockReturnValue(null);
    });

    it('should use public mentors data when user is not authenticated', () => {
      mockUseGetPublicMentorsQuery.mockReturnValue({
        data: { results: [{ id: 2, name: 'Public Mentor' }], count: 1 },
        isLoading: false,
        isFetching: false,
        error: null,
      });

      const { result } = renderHook(() => useMentorsWithPagination());

      expect(result.current.mentors).toEqual([
        { id: 2, name: 'Public Mentor' },
      ]);
      expect(result.current.totalCount).toBe(1);
    });
  });

  describe('setSearchQuery', () => {
    it('should update search query', () => {
      const { result } = renderHook(() => useMentorsWithPagination());

      act(() => {
        result.current.setSearchQuery('test search');
      });

      expect(result.current.searchQuery).toBe('test search');
    });
  });

  describe('handlePageChange', () => {
    it('should update current page', () => {
      const { result } = renderHook(() => useMentorsWithPagination());

      act(() => {
        result.current.handlePageChange(2);
      });

      expect(result.current.currentPage).toBe(2);
    });

    it('should scroll to top when changing pages', () => {
      const { result } = renderHook(() => useMentorsWithPagination());

      act(() => {
        result.current.handlePageChange(2);
      });

      expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
    });
  });

  describe('pagination calculation', () => {
    it('should calculate total pages correctly', () => {
      mockUseGetMentorsQuery.mockReturnValue({
        data: { results: [], count: 25 },
        isLoading: false,
        isFetching: false,
        error: null,
      });

      const { result } = renderHook(() => useMentorsWithPagination(5));

      expect(result.current.totalPages).toBe(5);
    });

    it('should return 0 total pages when no data', () => {
      mockUseGetMentorsQuery.mockReturnValue({
        data: null,
        isLoading: false,
        isFetching: false,
        error: null,
      });

      const { result } = renderHook(() => useMentorsWithPagination());

      expect(result.current.totalPages).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should return error from mentors query for authenticated user', () => {
      mockUseGetMentorsQuery.mockReturnValue({
        data: null,
        isLoading: false,
        isFetching: false,
        error: { message: 'API error' },
      });

      const { result } = renderHook(() => useMentorsWithPagination());

      expect(result.current.error).toEqual({ message: 'API error' });
    });

    it('should return error from public mentors query for unauthenticated user', () => {
      mockUseUsername.mockReturnValue(null);
      mockUseGetPublicMentorsQuery.mockReturnValue({
        data: null,
        isLoading: false,
        isFetching: false,
        error: { message: 'Public API error' },
      });

      const { result } = renderHook(() => useMentorsWithPagination());

      expect(result.current.error).toEqual({ message: 'Public API error' });
    });
  });

  describe('loading states', () => {
    it('should return isLoading from mentors query for authenticated user', () => {
      mockUseGetMentorsQuery.mockReturnValue({
        data: null,
        isLoading: true,
        isFetching: false,
        error: null,
      });

      const { result } = renderHook(() => useMentorsWithPagination());

      expect(result.current.isLoading).toBe(true);
    });

    it('should return isFetching from mentors query for authenticated user', () => {
      mockUseGetMentorsQuery.mockReturnValue({
        data: null,
        isLoading: false,
        isFetching: true,
        error: null,
      });

      const { result } = renderHook(() => useMentorsWithPagination());

      expect(result.current.isFetching).toBe(true);
    });
  });

  describe('queryParams', () => {
    it('should return query params', () => {
      const { result } = renderHook(() => useMentorsWithPagination());

      expect(result.current.queryParams).toEqual({
        limit: 5,
        offset: 0,
        query: '',
        orderBy: 'created_at',
        orderDirection: 'desc',
      });
    });
  });
});

describe('useAiSearchMentorsWithPagination', () => {
  const scrollToSpy = window.scrollTo as unknown as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseParams.mockReturnValue({ tenantKey: 'tenant-1' });
    mockUseGetAiSearchMentorsQuery.mockReturnValue({
      data: { results: [], count: 0 },
      isLoading: false,
      isFetching: false,
      error: null,
    });
  });

  it('returns initial state values with the default items per page', () => {
    const { result } = renderHook(() => useAiSearchMentorsWithPagination());

    expect(result.current.searchQuery).toBe('');
    expect(result.current.currentPage).toBe(1);
    expect(result.current.itemsPerPage).toBe(8);
  });

  it('accepts a custom items per page', () => {
    const { result } = renderHook(() => useAiSearchMentorsWithPagination(12));

    expect(result.current.itemsPerPage).toBe(12);
  });

  it('maps results and count from the ai-search response', () => {
    mockUseGetAiSearchMentorsQuery.mockReturnValue({
      data: {
        results: [{ unique_id: 'a1', name: 'Agent 1' }],
        count: 1,
      },
      isLoading: false,
      isFetching: false,
      error: null,
    });

    const { result } = renderHook(() => useAiSearchMentorsWithPagination());

    expect(result.current.mentors).toEqual([
      { unique_id: 'a1', name: 'Agent 1' },
    ]);
    expect(result.current.totalCount).toBe(1);
  });

  it('returns empty mentors and zero count when there is no data', () => {
    mockUseGetAiSearchMentorsQuery.mockReturnValue({
      data: null,
      isLoading: false,
      isFetching: false,
      error: null,
    });

    const { result } = renderHook(() => useAiSearchMentorsWithPagination());

    expect(result.current.mentors).toEqual([]);
    expect(result.current.totalCount).toBe(0);
    expect(result.current.totalPages).toBe(0);
  });

  it('passes the platform_key and query args to the ai-search query', () => {
    renderHook(() => useAiSearchMentorsWithPagination(8));

    expect(mockUseGetAiSearchMentorsQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        platform_key: 'tenant-1',
        query: undefined,
        limit: 8,
        offset: 0,
      }),
      expect.objectContaining({
        skip: false,
        refetchOnMountOrArgChange: true,
      }),
    );
  });

  it('skips the query when tenantKey is missing', () => {
    mockUseParams.mockReturnValue({});

    renderHook(() => useAiSearchMentorsWithPagination());

    expect(mockUseGetAiSearchMentorsQuery).toHaveBeenCalledWith(
      expect.objectContaining({ platform_key: '' }),
      expect.objectContaining({ skip: true }),
    );
  });

  it('computes total pages from the count and items per page', () => {
    mockUseGetAiSearchMentorsQuery.mockReturnValue({
      data: { results: [], count: 25 },
      isLoading: false,
      isFetching: false,
      error: null,
    });

    const { result } = renderHook(() => useAiSearchMentorsWithPagination(5));

    expect(result.current.totalPages).toBe(5);
  });

  it('passes through isLoading and isFetching', () => {
    mockUseGetAiSearchMentorsQuery.mockReturnValue({
      data: null,
      isLoading: true,
      isFetching: true,
      error: { message: 'boom' },
    });

    const { result } = renderHook(() => useAiSearchMentorsWithPagination());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isFetching).toBe(true);
    expect(result.current.error).toEqual({ message: 'boom' });
  });

  it('sends the debounced query as the search arg when set', () => {
    const { result } = renderHook(() => useAiSearchMentorsWithPagination());

    act(() => {
      result.current.setSearchQuery('design');
    });

    expect(result.current.searchQuery).toBe('design');
    expect(mockUseGetAiSearchMentorsQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({ query: 'design' }),
      expect.anything(),
    );
  });

  it('resets to the first page and offset when the search changes', () => {
    const { result } = renderHook(() => useAiSearchMentorsWithPagination(5));

    act(() => {
      result.current.handlePageChange(3);
    });
    expect(result.current.currentPage).toBe(3);
    expect(result.current.queryParams.offset).toBe(10);

    act(() => {
      result.current.setSearchQuery('newterm');
    });

    expect(result.current.currentPage).toBe(1);
    expect(result.current.queryParams.offset).toBe(0);
    expect(result.current.queryParams.query).toBe('newterm');
  });

  it('updates the offset when the page changes', () => {
    const { result } = renderHook(() => useAiSearchMentorsWithPagination(8));

    act(() => {
      result.current.handlePageChange(2);
    });

    expect(result.current.currentPage).toBe(2);
    expect(result.current.queryParams.offset).toBe(8);
  });

  it('scrolls to the top when changing pages', () => {
    const { result } = renderHook(() => useAiSearchMentorsWithPagination());

    act(() => {
      result.current.handlePageChange(2);
    });

    expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });
});
