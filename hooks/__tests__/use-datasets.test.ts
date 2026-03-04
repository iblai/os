import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useDatasetsWithPagination } from '../use-datasets';

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

// Mock user-navigate
const mockGetMentorId = vi.fn();
vi.mock('@/hooks/user-navigate', () => ({
  useNavigate: () => ({
    getMentorId: () => mockGetMentorId(),
  }),
}));

// Mock data-layer hooks
const mockUseGetTrainingDocumentsQuery = vi.fn();
vi.mock('@iblai/iblai-js/data-layer', () => ({
  useGetTrainingDocumentsQuery: (...args: unknown[]) => mockUseGetTrainingDocumentsQuery(...args),
}));

describe('useDatasetsWithPagination', () => {
  const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseParams.mockReturnValue({ tenantKey: 'tenant-1', mentorId: 'mentor-1' });
    mockUseUsername.mockReturnValue('testuser');
    mockGetMentorId.mockReturnValue(null);
    mockUseGetTrainingDocumentsQuery.mockReturnValue({
      data: { results: [], count: 0 },
      isLoading: false,
      isFetching: false,
    });
  });

  describe('initial state', () => {
    it('should return initial state values', () => {
      const { result } = renderHook(() => useDatasetsWithPagination());

      expect(result.current.searchQuery).toBe('');
      expect(result.current.currentPage).toBe(1);
    });

    it('should accept custom items per page', () => {
      renderHook(() => useDatasetsWithPagination(10));

      expect(mockUseGetTrainingDocumentsQuery).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 10 }),
        expect.anything(),
      );
    });

    it('should use default items per page of 5', () => {
      renderHook(() => useDatasetsWithPagination());

      expect(mockUseGetTrainingDocumentsQuery).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 5 }),
        expect.anything(),
      );
    });
  });

  describe('mentor ID resolution', () => {
    it('should use getMentorId when available', () => {
      mockGetMentorId.mockReturnValue('override-mentor-id');

      renderHook(() => useDatasetsWithPagination());

      expect(mockUseGetTrainingDocumentsQuery).toHaveBeenCalledWith(
        expect.objectContaining({ pathway: 'override-mentor-id' }),
        expect.anything(),
      );
    });

    it('should fallback to mentorId from params when getMentorId returns null', () => {
      mockGetMentorId.mockReturnValue(null);

      renderHook(() => useDatasetsWithPagination());

      expect(mockUseGetTrainingDocumentsQuery).toHaveBeenCalledWith(
        expect.objectContaining({ pathway: 'mentor-1' }),
        expect.anything(),
      );
    });
  });

  describe('skip behavior', () => {
    it('should skip query when activeMentorId is falsy', () => {
      mockUseParams.mockReturnValue({ tenantKey: 'tenant-1', mentorId: '' });
      mockGetMentorId.mockReturnValue(null);

      renderHook(() => useDatasetsWithPagination());

      expect(mockUseGetTrainingDocumentsQuery).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ skip: true }),
      );
    });

    it('should not skip query when activeMentorId exists', () => {
      renderHook(() => useDatasetsWithPagination());

      expect(mockUseGetTrainingDocumentsQuery).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ skip: false }),
      );
    });
  });

  describe('datasets data', () => {
    it('should return datasets data', () => {
      const mockDatasets = {
        results: [{ id: 1, name: 'Dataset 1' }],
        count: 1,
      };
      mockUseGetTrainingDocumentsQuery.mockReturnValue({
        data: mockDatasets,
        isLoading: false,
        isFetching: false,
      });

      const { result } = renderHook(() => useDatasetsWithPagination());

      expect(result.current.datasets).toEqual(mockDatasets);
    });
  });

  describe('loading states', () => {
    it('should return isLoading from query', () => {
      mockUseGetTrainingDocumentsQuery.mockReturnValue({
        data: null,
        isLoading: true,
        isFetching: false,
      });

      const { result } = renderHook(() => useDatasetsWithPagination());

      expect(result.current.isDatasetsLoading).toBe(true);
    });

    it('should return isFetching from query', () => {
      mockUseGetTrainingDocumentsQuery.mockReturnValue({
        data: null,
        isLoading: false,
        isFetching: true,
      });

      const { result } = renderHook(() => useDatasetsWithPagination());

      expect(result.current.isDatasetsFetching).toBe(true);
    });
  });

  describe('setSearchQuery', () => {
    it('should update search query', () => {
      const { result } = renderHook(() => useDatasetsWithPagination());

      act(() => {
        result.current.setSearchQuery('test search');
      });

      expect(result.current.searchQuery).toBe('test search');
    });

    it('should reset to page 1 when search changes', async () => {
      const { result } = renderHook(() => useDatasetsWithPagination());

      // First change to page 2
      act(() => {
        result.current.handlePageChange(2);
      });

      expect(result.current.currentPage).toBe(2);

      // Then change search
      act(() => {
        result.current.setSearchQuery('new search');
      });

      await waitFor(() => {
        expect(result.current.currentPage).toBe(1);
      });
    });
  });

  describe('handlePageChange', () => {
    it('should update current page', () => {
      const { result } = renderHook(() => useDatasetsWithPagination());

      act(() => {
        result.current.handlePageChange(3);
      });

      expect(result.current.currentPage).toBe(3);
    });

    it('should scroll to top when changing pages', () => {
      const { result } = renderHook(() => useDatasetsWithPagination());

      act(() => {
        result.current.handlePageChange(2);
      });

      expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
    });

    it('should update offset based on page', async () => {
      const { result } = renderHook(() => useDatasetsWithPagination(5));

      act(() => {
        result.current.handlePageChange(3);
      });

      await waitFor(() => {
        expect(mockUseGetTrainingDocumentsQuery).toHaveBeenCalledWith(
          expect.objectContaining({ offset: 10 }),
          expect.anything(),
        );
      });
    });
  });

  describe('pagination calculation', () => {
    it('should calculate total pages correctly', () => {
      mockUseGetTrainingDocumentsQuery.mockReturnValue({
        data: { results: [], count: 25 },
        isLoading: false,
        isFetching: false,
      });

      const { result } = renderHook(() => useDatasetsWithPagination(5));

      expect(result.current.totalPages).toBe(5);
    });

    it('should return 0 total pages when no data', () => {
      mockUseGetTrainingDocumentsQuery.mockReturnValue({
        data: null,
        isLoading: false,
        isFetching: false,
      });

      const { result } = renderHook(() => useDatasetsWithPagination());

      expect(result.current.totalPages).toBe(0);
    });

    it('should round up total pages', () => {
      mockUseGetTrainingDocumentsQuery.mockReturnValue({
        data: { results: [], count: 12 },
        isLoading: false,
        isFetching: false,
      });

      const { result } = renderHook(() => useDatasetsWithPagination(5));

      expect(result.current.totalPages).toBe(3);
    });
  });

  describe('training status polling', () => {
    it('should enable polling when dataset is training', async () => {
      mockUseGetTrainingDocumentsQuery.mockReturnValue({
        data: {
          results: [{ id: 1, training_status: 'pending' }],
          count: 1,
        },
        isLoading: false,
        isFetching: false,
      });

      renderHook(() => useDatasetsWithPagination());

      await waitFor(() => {
        expect(mockUseGetTrainingDocumentsQuery).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({ pollingInterval: 2000 }),
        );
      });
    });

    it('should disable polling when no datasets are training', async () => {
      mockUseGetTrainingDocumentsQuery.mockReturnValue({
        data: {
          results: [{ id: 1, training_status: 'completed' }],
          count: 1,
        },
        isLoading: false,
        isFetching: false,
      });

      renderHook(() => useDatasetsWithPagination());

      await waitFor(() => {
        expect(mockUseGetTrainingDocumentsQuery).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({ pollingInterval: 0 }),
        );
      });
    });

    it('should not update training status while fetching', async () => {
      mockUseGetTrainingDocumentsQuery.mockReturnValue({
        data: {
          results: [{ id: 1, training_status: 'pending' }],
          count: 1,
        },
        isLoading: false,
        isFetching: true,
      });

      renderHook(() => useDatasetsWithPagination());

      // Initial call should have polling interval 0 (default isTraining is false)
      expect(mockUseGetTrainingDocumentsQuery).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ pollingInterval: 0 }),
      );
    });

    it('should handle undefined results', async () => {
      mockUseGetTrainingDocumentsQuery.mockReturnValue({
        data: {
          results: undefined,
          count: 0,
        },
        isLoading: false,
        isFetching: false,
      });

      const { result } = renderHook(() => useDatasetsWithPagination());

      // Should not throw and should remain functional
      expect(result.current).toBeDefined();
    });
  });

  describe('query parameters', () => {
    it('should pass correct params to query', () => {
      renderHook(() => useDatasetsWithPagination());

      expect(mockUseGetTrainingDocumentsQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          org: 'tenant-1',
          pathway: 'mentor-1',
          userId: 'testuser',
          limit: 5,
          offset: 0,
          search: '',
        }),
        expect.anything(),
      );
    });

    it('should pass search query to query params', async () => {
      const { result } = renderHook(() => useDatasetsWithPagination());

      act(() => {
        result.current.setSearchQuery('test');
      });

      await waitFor(() => {
        expect(mockUseGetTrainingDocumentsQuery).toHaveBeenCalledWith(
          expect.objectContaining({ search: 'test' }),
          expect.anything(),
        );
      });
    });
  });

  describe('username handling', () => {
    it('should use empty string when username is null', () => {
      mockUseUsername.mockReturnValue(null);

      renderHook(() => useDatasetsWithPagination());

      expect(mockUseGetTrainingDocumentsQuery).toHaveBeenCalledWith(
        expect.objectContaining({ userId: '' }),
        expect.anything(),
      );
    });
  });
});
