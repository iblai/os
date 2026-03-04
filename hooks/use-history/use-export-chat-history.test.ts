import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useExportChatHistory } from './use-export-chat-history';

// Mock next/navigation
const mockUseParams = vi.fn();
vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
}));

// Mock user-navigate
const mockGetMentorId = vi.fn();
vi.mock('@/hooks/user-navigate', () => ({
  useNavigate: () => ({
    getMentorId: () => mockGetMentorId(),
  }),
}));

// Mock constants
vi.mock('@/lib/constants', () => ({
  REPORT_NAME: 'ai-mentor-chat-history',
}));

// Mock sonner
const mockToastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    error: (msg: string) => mockToastError(msg),
  },
}));

// Mock data-layer hooks
const mockExportChatHistoryMutation = vi.fn();
const mockUnwrap = vi.fn();
const mockUseExportChatHistoryMutation = vi.fn();
const mockUseGetChatHistoryExportStatusQuery = vi.fn();

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useExportChatHistoryMutation: () => mockUseExportChatHistoryMutation(),
  useGetChatHistoryExportStatusQuery: (...args: unknown[]) =>
    mockUseGetChatHistoryExportStatusQuery(...args),
}));

describe('useExportChatHistory', () => {
  const mockWindowOpen = vi.fn();
  const originalWindowOpen = window.open;
  const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  beforeEach(() => {
    vi.clearAllMocks();
    window.open = mockWindowOpen;

    // Default mock implementations
    mockUseParams.mockReturnValue({ tenantKey: 'test-tenant', mentorId: 'mentor-123' });
    mockGetMentorId.mockReturnValue(null);

    mockExportChatHistoryMutation.mockReturnValue({
      unwrap: mockUnwrap,
    });
    mockUnwrap.mockResolvedValue({ data: { state: 'pending' } });

    mockUseExportChatHistoryMutation.mockReturnValue([
      mockExportChatHistoryMutation,
      { isLoading: false, data: null },
    ]);

    mockUseGetChatHistoryExportStatusQuery.mockReturnValue({
      data: null,
    });
  });

  afterEach(() => {
    window.open = originalWindowOpen;
  });

  describe('initial state', () => {
    it('should return initial state values', () => {
      const { result } = renderHook(() => useExportChatHistory());

      expect(result.current.isExporting).toBe(false);
      expect(result.current.exportStatus).toBeNull();
      expect(typeof result.current.handleExport).toBe('function');
    });

    it('should use mentorId from params when getMentorId returns null', () => {
      mockGetMentorId.mockReturnValue(null);

      renderHook(() => useExportChatHistory());

      expect(mockUseGetChatHistoryExportStatusQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'test-tenant',
          reportName: 'ai-mentor-chat-history',
          mentorUniqueId: 'mentor-123',
        }),
        expect.anything(),
      );
    });

    it('should use getMentorId result when available', () => {
      mockGetMentorId.mockReturnValue('override-mentor-id');

      renderHook(() => useExportChatHistory());

      expect(mockUseGetChatHistoryExportStatusQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          mentorUniqueId: 'override-mentor-id',
        }),
        expect.anything(),
      );
    });
  });

  describe('query configuration', () => {
    it('should skip query when no export data state', () => {
      mockUseExportChatHistoryMutation.mockReturnValue([
        mockExportChatHistoryMutation,
        { isLoading: false, data: null },
      ]);

      renderHook(() => useExportChatHistory());

      expect(mockUseGetChatHistoryExportStatusQuery).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          skip: true,
          pollingInterval: 0,
        }),
      );
    });

    it('should not skip query when export data has state', () => {
      mockUseExportChatHistoryMutation.mockReturnValue([
        mockExportChatHistoryMutation,
        { isLoading: false, data: { data: { state: 'pending' } } },
      ]);

      renderHook(() => useExportChatHistory());

      expect(mockUseGetChatHistoryExportStatusQuery).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          skip: false,
        }),
      );
    });
  });

  describe('handleExport', () => {
    it('should call exportChatHistory with correct params for basic filters', async () => {
      const { result } = renderHook(() => useExportChatHistory());

      await act(async () => {
        await result.current.handleExport({
          dateRange: undefined,
          sentiment: undefined,
          topics: undefined,
          users: undefined,
        });
      });

      expect(mockExportChatHistoryMutation).toHaveBeenCalledWith({
        key: 'test-tenant',
        requestBody: {
          report_name: 'ai-mentor-chat-history',
          end_date: undefined,
          start_date: undefined,
          sentiment: undefined,
          topics: undefined,
          mentor: 'mentor-123',
        },
      });
    });

    it('should format date range correctly', async () => {
      const { result } = renderHook(() => useExportChatHistory());

      await act(async () => {
        await result.current.handleExport({
          dateRange: {
            from: new Date('2024-01-15'),
            to: new Date('2024-01-31'),
          },
          sentiment: undefined,
          topics: undefined,
          users: undefined,
        });
      });

      expect(mockExportChatHistoryMutation).toHaveBeenCalledWith({
        key: 'test-tenant',
        requestBody: expect.objectContaining({
          start_date: '2024-01-15',
          end_date: '2024-01-31',
        }),
      });
    });

    it('should handle date range with only from date', async () => {
      const { result } = renderHook(() => useExportChatHistory());

      await act(async () => {
        await result.current.handleExport({
          dateRange: {
            from: new Date('2024-01-15'),
            to: undefined,
          },
          sentiment: undefined,
          topics: undefined,
          users: undefined,
        });
      });

      expect(mockExportChatHistoryMutation).toHaveBeenCalledWith({
        key: 'test-tenant',
        requestBody: expect.objectContaining({
          start_date: '2024-01-15',
          end_date: undefined,
        }),
      });
    });

    it('should handle date range with only to date', async () => {
      const { result } = renderHook(() => useExportChatHistory());

      await act(async () => {
        await result.current.handleExport({
          dateRange: {
            from: undefined,
            to: new Date('2024-01-31'),
          },
          sentiment: undefined,
          topics: undefined,
          users: undefined,
        });
      });

      expect(mockExportChatHistoryMutation).toHaveBeenCalledWith({
        key: 'test-tenant',
        requestBody: expect.objectContaining({
          start_date: undefined,
          end_date: '2024-01-31',
        }),
      });
    });

    it('should pass sentiment filter', async () => {
      const { result } = renderHook(() => useExportChatHistory());

      await act(async () => {
        await result.current.handleExport({
          dateRange: undefined,
          sentiment: 'positive',
          topics: undefined,
          users: undefined,
        });
      });

      expect(mockExportChatHistoryMutation).toHaveBeenCalledWith({
        key: 'test-tenant',
        requestBody: expect.objectContaining({
          sentiment: 'positive',
        }),
      });
    });

    it('should pass topics filter', async () => {
      const { result } = renderHook(() => useExportChatHistory());

      await act(async () => {
        await result.current.handleExport({
          dateRange: undefined,
          sentiment: undefined,
          topics: 'topic1,topic2',
          users: undefined,
        });
      });

      expect(mockExportChatHistoryMutation).toHaveBeenCalledWith({
        key: 'test-tenant',
        requestBody: expect.objectContaining({
          topics: 'topic1,topic2',
        }),
      });
    });

    it('should use override mentor id from getMentorId', async () => {
      mockGetMentorId.mockReturnValue('custom-mentor');

      const { result } = renderHook(() => useExportChatHistory());

      await act(async () => {
        await result.current.handleExport({
          dateRange: undefined,
          sentiment: undefined,
          topics: undefined,
          users: undefined,
        });
      });

      expect(mockExportChatHistoryMutation).toHaveBeenCalledWith({
        key: 'test-tenant',
        requestBody: expect.objectContaining({
          mentor: 'custom-mentor',
        }),
      });
    });
  });

  describe('export error handling', () => {
    it('should log error when export fails', async () => {
      const error = new Error('Export failed');
      mockUnwrap.mockRejectedValue(error);

      const { result } = renderHook(() => useExportChatHistory());

      await act(async () => {
        await result.current.handleExport({
          dateRange: undefined,
          sentiment: undefined,
          topics: undefined,
          users: undefined,
        });
      });

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('test-tenant'));
    });

    it('should not start polling when export fails', async () => {
      mockUnwrap.mockRejectedValue(new Error('Export failed'));

      const { result } = renderHook(() => useExportChatHistory());

      await act(async () => {
        await result.current.handleExport({
          dateRange: undefined,
          sentiment: undefined,
          topics: undefined,
          users: undefined,
        });
      });

      // isExporting should remain false since polling didn't start
      expect(result.current.isExporting).toBe(false);
    });
  });

  describe('isExporting state', () => {
    it('should be true when mutation is loading', () => {
      mockUseExportChatHistoryMutation.mockReturnValue([
        mockExportChatHistoryMutation,
        { isLoading: true, data: null },
      ]);

      const { result } = renderHook(() => useExportChatHistory());

      expect(result.current.isExporting).toBe(true);
    });

    it('should be false when not loading and not polling', () => {
      mockUseExportChatHistoryMutation.mockReturnValue([
        mockExportChatHistoryMutation,
        { isLoading: false, data: null },
      ]);

      const { result } = renderHook(() => useExportChatHistory());

      expect(result.current.isExporting).toBe(false);
    });
  });

  describe('export status polling effect', () => {
    it('should open URL when export status is completed with URL', async () => {
      mockUseGetChatHistoryExportStatusQuery.mockReturnValue({
        data: {
          data: {
            status: {
              state: 'completed',
              url: 'https://example.com/download.csv',
            },
          },
        },
      });

      renderHook(() => useExportChatHistory());

      await waitFor(() => {
        expect(mockWindowOpen).toHaveBeenCalledWith('https://example.com/download.csv', '_blank');
      });
    });

    it('should not open URL when completed but URL is missing', async () => {
      mockUseGetChatHistoryExportStatusQuery.mockReturnValue({
        data: {
          data: {
            status: {
              state: 'completed',
              url: null,
            },
          },
        },
      });

      renderHook(() => useExportChatHistory());

      await waitFor(() => {
        expect(mockWindowOpen).not.toHaveBeenCalled();
      });
    });

    it('should show toast error when export status is error', async () => {
      mockUseGetChatHistoryExportStatusQuery.mockReturnValue({
        data: {
          data: {
            status: {
              state: 'error',
            },
          },
        },
      });

      renderHook(() => useExportChatHistory());

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith('Failed to export chat history');
      });
    });

    it('should not trigger any action for pending status', async () => {
      mockUseGetChatHistoryExportStatusQuery.mockReturnValue({
        data: {
          data: {
            status: {
              state: 'pending',
            },
          },
        },
      });

      renderHook(() => useExportChatHistory());

      // Give some time for potential side effects
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockWindowOpen).not.toHaveBeenCalled();
      expect(mockToastError).not.toHaveBeenCalled();
    });
  });

  describe('polling behavior', () => {
    it('should set polling interval to 2000ms when shouldPoll is true', async () => {
      mockUnwrap.mockResolvedValue({ data: { state: 'pending' } });
      mockUseExportChatHistoryMutation.mockReturnValue([
        mockExportChatHistoryMutation,
        { isLoading: false, data: { data: { state: 'pending' } } },
      ]);

      const { result, rerender } = renderHook(() => useExportChatHistory());

      // Trigger export to start polling
      await act(async () => {
        await result.current.handleExport({
          dateRange: undefined,
          sentiment: undefined,
          topics: undefined,
          users: undefined,
        });
      });

      // Re-render to check the updated polling interval
      rerender();

      // Check that the query was called with polling interval of 2000
      const lastCall = mockUseGetChatHistoryExportStatusQuery.mock.calls.at(-1);
      expect(lastCall?.[1]?.pollingInterval).toBe(2000);
    });

    it('should stop polling when export completes', async () => {
      // Start with pending state to enable polling
      mockUseExportChatHistoryMutation.mockReturnValue([
        mockExportChatHistoryMutation,
        { isLoading: false, data: { data: { state: 'pending' } } },
      ]);

      const { result, rerender } = renderHook(() => useExportChatHistory());

      // Trigger export
      await act(async () => {
        await result.current.handleExport({
          dateRange: undefined,
          sentiment: undefined,
          topics: undefined,
          users: undefined,
        });
      });

      // Simulate completed status
      mockUseGetChatHistoryExportStatusQuery.mockReturnValue({
        data: {
          data: {
            status: {
              state: 'completed',
              url: 'https://example.com/download.csv',
            },
          },
        },
      });

      rerender();

      await waitFor(() => {
        expect(mockWindowOpen).toHaveBeenCalled();
      });
    });

    it('should stop polling when export errors', async () => {
      // Start with pending state to enable polling
      mockUseExportChatHistoryMutation.mockReturnValue([
        mockExportChatHistoryMutation,
        { isLoading: false, data: { data: { state: 'pending' } } },
      ]);

      const { result, rerender } = renderHook(() => useExportChatHistory());

      // Trigger export
      await act(async () => {
        await result.current.handleExport({
          dateRange: undefined,
          sentiment: undefined,
          topics: undefined,
          users: undefined,
        });
      });

      // Simulate error status
      mockUseGetChatHistoryExportStatusQuery.mockReturnValue({
        data: {
          data: {
            status: {
              state: 'error',
            },
          },
        },
      });

      rerender();

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith('Failed to export chat history');
      });
    });
  });

  describe('exportStatus return value', () => {
    it('should return exportStatus data', () => {
      const mockStatusData = {
        data: {
          status: {
            state: 'completed',
            url: 'https://example.com/report.csv',
          },
        },
      };

      mockUseGetChatHistoryExportStatusQuery.mockReturnValue({
        data: mockStatusData,
      });

      const { result } = renderHook(() => useExportChatHistory());

      expect(result.current.exportStatus).toEqual(mockStatusData);
    });

    it('should return null when no export status', () => {
      mockUseGetChatHistoryExportStatusQuery.mockReturnValue({
        data: null,
      });

      const { result } = renderHook(() => useExportChatHistory());

      expect(result.current.exportStatus).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should handle empty tenant key', () => {
      mockUseParams.mockReturnValue({ tenantKey: '', mentorId: 'mentor-123' });

      const { result } = renderHook(() => useExportChatHistory());

      expect(result.current).toBeDefined();
    });

    it('should handle undefined mentor id in params', () => {
      mockUseParams.mockReturnValue({ tenantKey: 'test-tenant', mentorId: undefined });

      const { result } = renderHook(() => useExportChatHistory());

      expect(result.current).toBeDefined();
    });

    it('should handle all filters provided at once', async () => {
      const { result } = renderHook(() => useExportChatHistory());

      await act(async () => {
        await result.current.handleExport({
          dateRange: {
            from: new Date('2024-01-01'),
            to: new Date('2024-12-31'),
          },
          sentiment: 'negative',
          topics: 'topic1,topic2,topic3',
          users: 'user1',
        });
      });

      expect(mockExportChatHistoryMutation).toHaveBeenCalledWith({
        key: 'test-tenant',
        requestBody: {
          report_name: 'ai-mentor-chat-history',
          start_date: '2024-01-01',
          end_date: '2024-12-31',
          sentiment: 'negative',
          topics: 'topic1,topic2,topic3',
          mentor: 'mentor-123',
        },
      });
    });

    it('should handle multiple rapid exports', async () => {
      const { result } = renderHook(() => useExportChatHistory());

      const filters = {
        dateRange: undefined,
        sentiment: undefined,
        topics: undefined,
        users: undefined,
      };

      // Rapidly trigger multiple exports
      await act(async () => {
        const exports = [
          result.current.handleExport(filters),
          result.current.handleExport(filters),
          result.current.handleExport(filters),
        ];
        await Promise.all(exports);
      });

      // All exports should have been called
      expect(mockExportChatHistoryMutation).toHaveBeenCalledTimes(3);
    });

    it('should handle exportStatus with undefined nested properties', () => {
      mockUseGetChatHistoryExportStatusQuery.mockReturnValue({
        data: {
          data: undefined,
        },
      });

      const { result } = renderHook(() => useExportChatHistory());

      // Should not crash and should return the status
      expect(result.current.exportStatus).toEqual({ data: undefined });
    });

    it('should handle exportStatus with null status', () => {
      mockUseGetChatHistoryExportStatusQuery.mockReturnValue({
        data: {
          data: {
            status: null,
          },
        },
      });

      const { result } = renderHook(() => useExportChatHistory());

      expect(result.current.exportStatus).toBeDefined();
    });
  });

  describe('date formatting', () => {
    it('should format dates in yyyy-MM-dd format', async () => {
      const { result } = renderHook(() => useExportChatHistory());

      // Using a date that could be formatted differently in other formats
      await act(async () => {
        await result.current.handleExport({
          dateRange: {
            from: new Date('2024-03-05'), // Month < 10, Day < 10
            to: new Date('2024-11-22'),
          },
          sentiment: undefined,
          topics: undefined,
          users: undefined,
        });
      });

      expect(mockExportChatHistoryMutation).toHaveBeenCalledWith({
        key: 'test-tenant',
        requestBody: expect.objectContaining({
          start_date: '2024-03-05',
          end_date: '2024-11-22',
        }),
      });
    });
  });
});
