import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHistoryWithPagination } from '../use-history';

// Mock constants
vi.mock('@/lib/constants', () => ({
  ANONYMOUS_USERNAME: 'anonymous',
}));

// Mock next/navigation
const mockUseParams = vi.fn();
vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

// Mock use-user
const mockUseUsername = vi.fn();
const mockUseUserIsOnTrial = vi.fn();
vi.mock('@/hooks/use-user', () => ({
  useUsername: () => mockUseUsername(),
  useUserIsOnTrial: () => mockUseUserIsOnTrial(),
}));

// Mock user-navigate
const mockGetMentorId = vi.fn();
vi.mock('@/hooks/user-navigate', () => ({
  useNavigate: () => ({
    getMentorId: () => mockGetMentorId(),
  }),
}));

// Mock data-layer hooks
const mockUseGetChatHistoryFilterQuery = vi.fn();
const mockUseGetChatHistoryQuery = vi.fn();
const mockUseGetMentorPublicSettingsQuery = vi.fn();
vi.mock('@iblai/iblai-js/data-layer', () => ({
  useGetChatHistoryFilterQuery: (...args: unknown[]) =>
    mockUseGetChatHistoryFilterQuery(...args),
  useGetChatHistoryQuery: (...args: unknown[]) =>
    mockUseGetChatHistoryQuery(...args),
  useGetMentorPublicSettingsQuery: (...args: unknown[]) =>
    mockUseGetMentorPublicSettingsQuery(...args),
  useGetClawMentorConfigQuery: () => ({
    data: null,
    isError: false,
    isLoading: false,
  }),
  useUpdateClawMentorConfigMutation: () => [
    () => Promise.resolve({}),
    { isLoading: false },
  ],
}));

describe('useHistoryWithPagination', () => {
  const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseParams.mockReturnValue({
      tenantKey: 'tenant-1',
      mentorId: 'mentor-1',
    });
    mockUseUsername.mockReturnValue('testuser');
    mockUseUserIsOnTrial.mockReturnValue(false);
    mockGetMentorId.mockReturnValue(null);
    mockUseGetMentorPublicSettingsQuery.mockReturnValue({
      data: { mentor_unique_id: 'unique-mentor-id' },
    });
    mockUseGetChatHistoryFilterQuery.mockReturnValue({
      data: { sentiments: [], topics: [], users: [] },
    });
    mockUseGetChatHistoryQuery.mockReturnValue({
      data: { results: [], count: 0 },
      isLoading: false,
      isFetching: false,
    });
  });

  describe('initial state', () => {
    it('should return initial state values', () => {
      const { result } = renderHook(() => useHistoryWithPagination());

      expect(result.current.currentPage).toBe(1);
      expect(result.current.filters).toEqual({
        dateRange: undefined,
        sentiment: undefined,
        topics: undefined,
        users: undefined,
      });
    });

    it('should accept custom items per page', () => {
      renderHook(() => useHistoryWithPagination(20));

      expect(mockUseGetChatHistoryQuery).toHaveBeenCalledWith(
        expect.objectContaining({ pageSize: 20 }),
        expect.anything(),
      );
    });

    it('should use default items per page of 10', () => {
      renderHook(() => useHistoryWithPagination());

      expect(mockUseGetChatHistoryQuery).toHaveBeenCalledWith(
        expect.objectContaining({ pageSize: 10 }),
        expect.anything(),
      );
    });
  });

  describe('mentor ID resolution', () => {
    it('should use getMentorId when available', () => {
      mockGetMentorId.mockReturnValue('override-mentor-id');

      renderHook(() => useHistoryWithPagination());

      expect(mockUseGetMentorPublicSettingsQuery).toHaveBeenCalledWith(
        expect.objectContaining({ mentor: 'override-mentor-id' }),
      );
    });

    it('should fallback to mentorId from params when getMentorId returns null', () => {
      mockGetMentorId.mockReturnValue(null);

      renderHook(() => useHistoryWithPagination());

      expect(mockUseGetMentorPublicSettingsQuery).toHaveBeenCalledWith(
        expect.objectContaining({ mentor: 'mentor-1' }),
      );
    });
  });

  describe('chat history data', () => {
    it('should return chat history data', () => {
      const mockChatHistory = {
        results: [{ id: 1, message: 'test' }],
        count: 1,
      };
      mockUseGetChatHistoryQuery.mockReturnValue({
        data: mockChatHistory,
        isLoading: false,
        isFetching: false,
      });

      const { result } = renderHook(() => useHistoryWithPagination());

      expect(result.current.chatHistory).toEqual(mockChatHistory);
    });

    it('should return chat history filter data', () => {
      const mockFilterData = {
        sentiments: ['positive', 'negative'],
        topics: ['topic1', 'topic2'],
        users: ['user1'],
      };
      mockUseGetChatHistoryFilterQuery.mockReturnValue({
        data: mockFilterData,
      });

      const { result } = renderHook(() => useHistoryWithPagination());

      expect(result.current.chatHistoryFilter).toEqual(mockFilterData);
    });
  });

  describe('loading states', () => {
    it('should return isLoading from chat history query', () => {
      mockUseGetChatHistoryQuery.mockReturnValue({
        data: null,
        isLoading: true,
        isFetching: false,
      });

      const { result } = renderHook(() => useHistoryWithPagination());

      expect(result.current.isChatHistoryLoading).toBe(true);
    });

    it('should return isFetching from chat history query', () => {
      mockUseGetChatHistoryQuery.mockReturnValue({
        data: null,
        isLoading: false,
        isFetching: true,
      });

      const { result } = renderHook(() => useHistoryWithPagination());

      expect(result.current.isChatHistoryFetching).toBe(true);
    });
  });

  describe('handlePageChange', () => {
    it('should update current page', () => {
      const { result } = renderHook(() => useHistoryWithPagination());

      act(() => {
        result.current.handlePageChange(3);
      });

      expect(result.current.currentPage).toBe(3);
    });

    it('should scroll to top when changing pages', () => {
      const { result } = renderHook(() => useHistoryWithPagination());

      act(() => {
        result.current.handlePageChange(2);
      });

      expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
    });
  });

  describe('setFilters', () => {
    it('should update filters', () => {
      const { result } = renderHook(() => useHistoryWithPagination());

      act(() => {
        result.current.setFilters({
          dateRange: undefined,
          sentiment: 'positive',
          topics: 'topic1',
          users: 'user1',
        });
      });

      expect(result.current.filters).toEqual({
        dateRange: undefined,
        sentiment: 'positive',
        topics: 'topic1',
        users: 'user1',
      });
    });

    it('should update filters with date range', () => {
      const { result } = renderHook(() => useHistoryWithPagination());
      const dateRange = {
        from: new Date('2024-01-01'),
        to: new Date('2024-01-31'),
      };

      act(() => {
        result.current.setFilters({
          dateRange,
          sentiment: undefined,
          topics: undefined,
          users: undefined,
        });
      });

      expect(result.current.filters.dateRange).toEqual(dateRange);
    });
  });

  describe('pagination calculation', () => {
    it('should calculate total pages correctly', () => {
      mockUseGetChatHistoryQuery.mockReturnValue({
        data: { results: [], count: 50 },
        isLoading: false,
        isFetching: false,
      });

      const { result } = renderHook(() => useHistoryWithPagination(10));

      expect(result.current.totalPages).toBe(5);
    });

    it('should return 0 total pages when no data', () => {
      mockUseGetChatHistoryQuery.mockReturnValue({
        data: null,
        isLoading: false,
        isFetching: false,
      });

      const { result } = renderHook(() => useHistoryWithPagination());

      expect(result.current.totalPages).toBe(0);
    });

    it('should round up total pages', () => {
      mockUseGetChatHistoryQuery.mockReturnValue({
        data: { results: [], count: 23 },
        isLoading: false,
        isFetching: false,
      });

      const { result } = renderHook(() => useHistoryWithPagination(10));

      expect(result.current.totalPages).toBe(3);
    });
  });

  describe('trial user behavior', () => {
    it('should skip chat history filter query when user is on trial', () => {
      mockUseUserIsOnTrial.mockReturnValue(true);

      renderHook(() => useHistoryWithPagination());

      expect(mockUseGetChatHistoryFilterQuery).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ skip: true }),
      );
    });

    it('should not skip chat history filter query when user is not on trial', () => {
      mockUseUserIsOnTrial.mockReturnValue(false);

      renderHook(() => useHistoryWithPagination());

      expect(mockUseGetChatHistoryFilterQuery).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ skip: false }),
      );
    });

    it('should skip chat history query when filter is undefined and user is on trial', () => {
      mockUseUserIsOnTrial.mockReturnValue(true);
      mockUseGetChatHistoryFilterQuery.mockReturnValue({
        data: undefined,
      });

      renderHook(() => useHistoryWithPagination());

      expect(mockUseGetChatHistoryQuery).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ skip: true }),
      );
    });

    it('should not skip chat history query when filter is defined even if user is on trial', () => {
      mockUseUserIsOnTrial.mockReturnValue(true);
      mockUseGetChatHistoryFilterQuery.mockReturnValue({
        data: { sentiments: [], topics: [], users: [] },
      });

      renderHook(() => useHistoryWithPagination());

      expect(mockUseGetChatHistoryQuery).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ skip: false }),
      );
    });
  });

  describe('query parameters', () => {
    it('should pass correct params to chat history query', () => {
      mockUseGetMentorPublicSettingsQuery.mockReturnValue({
        data: { mentor_unique_id: 'unique-id' },
      });

      renderHook(() => useHistoryWithPagination());

      expect(mockUseGetChatHistoryQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          org: 'tenant-1',
          userId: 'testuser',
          mentor: 'mentor-1',
          page: 1,
          pageSize: 10,
        }),
        expect.anything(),
      );
    });

    it('should pass date range filters to chat history query', () => {
      const { result } = renderHook(() => useHistoryWithPagination());

      act(() => {
        result.current.setFilters({
          dateRange: {
            from: new Date('2024-01-15'),
            to: new Date('2024-01-20'),
          },
          sentiment: undefined,
          topics: undefined,
          users: undefined,
        });
      });

      expect(mockUseGetChatHistoryQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          startDate: '2024-01-15',
          endDate: '2024-01-20',
        }),
        expect.anything(),
      );
    });

    it('should pass undefined for date range when not set', () => {
      renderHook(() => useHistoryWithPagination());

      expect(mockUseGetChatHistoryQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          startDate: undefined,
          endDate: undefined,
        }),
        expect.anything(),
      );
    });

    it('should pass sentiment filter to query', () => {
      const { result } = renderHook(() => useHistoryWithPagination());

      act(() => {
        result.current.setFilters({
          dateRange: undefined,
          sentiment: 'positive',
          topics: undefined,
          users: undefined,
        });
      });

      expect(mockUseGetChatHistoryQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          sentiment: 'positive',
        }),
        expect.anything(),
      );
    });

    it('should pass topics filter to query', () => {
      const { result } = renderHook(() => useHistoryWithPagination());

      act(() => {
        result.current.setFilters({
          dateRange: undefined,
          sentiment: undefined,
          topics: 'topic1,topic2',
          users: undefined,
        });
      });

      expect(mockUseGetChatHistoryQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          topics: 'topic1,topic2',
        }),
        expect.anything(),
      );
    });

    it('should pass users filter to query', () => {
      const { result } = renderHook(() => useHistoryWithPagination());

      act(() => {
        result.current.setFilters({
          dateRange: undefined,
          sentiment: undefined,
          topics: undefined,
          users: 'user1',
        });
      });

      expect(mockUseGetChatHistoryQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          filterUserId: 'user1',
        }),
        expect.anything(),
      );
    });
  });

  describe('date range edge cases', () => {
    it('should handle date range with only from date', () => {
      const { result } = renderHook(() => useHistoryWithPagination());

      act(() => {
        result.current.setFilters({
          dateRange: {
            from: new Date('2024-01-15'),
            to: undefined,
          },
          sentiment: undefined,
          topics: undefined,
          users: undefined,
        });
      });

      expect(mockUseGetChatHistoryQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          startDate: '2024-01-15',
          endDate: undefined,
        }),
        expect.anything(),
      );
    });

    it('should handle date range with only to date', () => {
      const { result } = renderHook(() => useHistoryWithPagination());

      act(() => {
        result.current.setFilters({
          dateRange: {
            from: undefined,
            to: new Date('2024-01-20'),
          },
          sentiment: undefined,
          topics: undefined,
          users: undefined,
        });
      });

      expect(mockUseGetChatHistoryQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          startDate: undefined,
          endDate: '2024-01-20',
        }),
        expect.anything(),
      );
    });
  });

  describe('mentor public settings', () => {
    it('should handle undefined mentor public settings', () => {
      mockUseGetMentorPublicSettingsQuery.mockReturnValue({
        data: undefined,
      });

      const { result } = renderHook(() => useHistoryWithPagination());

      expect(result.current).toBeDefined();
    });
  });

  describe('anonymous username fallback', () => {
    it('should use ANONYMOUS_USERNAME when username is null', () => {
      mockUseUsername.mockReturnValue(null);

      renderHook(() => useHistoryWithPagination());

      expect(mockUseGetMentorPublicSettingsQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'anonymous',
        }),
      );
    });

    it('should use ANONYMOUS_USERNAME when username is undefined', () => {
      mockUseUsername.mockReturnValue(undefined);

      renderHook(() => useHistoryWithPagination());

      expect(mockUseGetMentorPublicSettingsQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'anonymous',
        }),
      );
    });

    it('should use actual username when available', () => {
      mockUseUsername.mockReturnValue('realuser');

      renderHook(() => useHistoryWithPagination());

      expect(mockUseGetMentorPublicSettingsQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'realuser',
        }),
      );
    });

    it('should use empty string for chat history query userId when username is null', () => {
      mockUseUsername.mockReturnValue(null);

      renderHook(() => useHistoryWithPagination());

      expect(mockUseGetChatHistoryQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: '',
        }),
        expect.anything(),
      );
    });

    it('should use empty string for chat history filter query userId when username is null', () => {
      mockUseUsername.mockReturnValue(null);

      renderHook(() => useHistoryWithPagination());

      expect(mockUseGetChatHistoryFilterQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: '',
        }),
        expect.anything(),
      );
    });
  });
});
