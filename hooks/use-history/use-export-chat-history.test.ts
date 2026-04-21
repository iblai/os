import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
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

// Mock useReports from web-containers
const mockInitializeReportDownload = vi.fn();
const mockUseReports = vi.fn();
vi.mock('@iblai/iblai-js/web-containers', () => ({
  useReports: (params: unknown) => mockUseReports(params),
}));

describe('useExportChatHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    mockUseParams.mockReturnValue({
      tenantKey: 'test-tenant',
      mentorId: 'mentor-123',
    });
    mockGetMentorId.mockReturnValue(null);

    mockUseReports.mockReturnValue({
      initializeReportDownload: mockInitializeReportDownload,
      isGenerating: false,
    });
  });

  describe('initial state', () => {
    it('should return handleExport function and isExporting state', () => {
      const { result } = renderHook(() => useExportChatHistory());

      expect(typeof result.current.handleExport).toBe('function');
      expect(result.current.isExporting).toBe(false);
    });

    it('should initialize useReports with correct params using mentorId from params', () => {
      mockGetMentorId.mockReturnValue(null);

      renderHook(() => useExportChatHistory());

      expect(mockUseReports).toHaveBeenCalledWith({
        tenantKey: 'test-tenant',
        selectedMentorId: 'mentor-123',
      });
    });

    it('should use getMentorId result when available', () => {
      mockGetMentorId.mockReturnValue('override-mentor-id');

      renderHook(() => useExportChatHistory());

      expect(mockUseReports).toHaveBeenCalledWith({
        tenantKey: 'test-tenant',
        selectedMentorId: 'override-mentor-id',
      });
    });
  });

  describe('isExporting state', () => {
    it('should be true when isGenerating is true', () => {
      mockUseReports.mockReturnValue({
        initializeReportDownload: mockInitializeReportDownload,
        isGenerating: true,
      });

      const { result } = renderHook(() => useExportChatHistory());

      expect(result.current.isExporting).toBe(true);
    });

    it('should be false when isGenerating is false', () => {
      mockUseReports.mockReturnValue({
        initializeReportDownload: mockInitializeReportDownload,
        isGenerating: false,
      });

      const { result } = renderHook(() => useExportChatHistory());

      expect(result.current.isExporting).toBe(false);
    });
  });

  describe('handleExport', () => {
    it('should call initializeReportDownload with correct params for basic filters', () => {
      const { result } = renderHook(() => useExportChatHistory());

      act(() => {
        result.current.handleExport({
          dateRange: undefined,
          sentiment: undefined,
          topics: undefined,
          users: undefined,
        });
      });

      expect(mockInitializeReportDownload).toHaveBeenCalledWith({
        report: {
          report_name: 'ai-mentor-chat-history',
        },
        autoDownload: true,
        extraRequestBody: {
          end_date: undefined,
          start_date: undefined,
          sentiment: undefined,
          topics: undefined,
          source: 'http://localhost:3000',
        },
      });
    });

    it('should format date range correctly', () => {
      const { result } = renderHook(() => useExportChatHistory());

      act(() => {
        result.current.handleExport({
          dateRange: {
            from: new Date('2024-01-15'),
            to: new Date('2024-01-31'),
          },
          sentiment: undefined,
          topics: undefined,
          users: undefined,
        });
      });

      expect(mockInitializeReportDownload).toHaveBeenCalledWith({
        report: {
          report_name: 'ai-mentor-chat-history',
        },
        autoDownload: true,
        extraRequestBody: expect.objectContaining({
          start_date: '2024-01-15',
          end_date: '2024-01-31',
        }),
      });
    });

    it('should handle date range with only from date', () => {
      const { result } = renderHook(() => useExportChatHistory());

      act(() => {
        result.current.handleExport({
          dateRange: {
            from: new Date('2024-01-15'),
            to: undefined,
          },
          sentiment: undefined,
          topics: undefined,
          users: undefined,
        });
      });

      expect(mockInitializeReportDownload).toHaveBeenCalledWith({
        report: {
          report_name: 'ai-mentor-chat-history',
        },
        autoDownload: true,
        extraRequestBody: expect.objectContaining({
          start_date: '2024-01-15',
          end_date: undefined,
        }),
      });
    });

    it('should handle date range with only to date', () => {
      const { result } = renderHook(() => useExportChatHistory());

      act(() => {
        result.current.handleExport({
          dateRange: {
            from: undefined,
            to: new Date('2024-01-31'),
          },
          sentiment: undefined,
          topics: undefined,
          users: undefined,
        });
      });

      expect(mockInitializeReportDownload).toHaveBeenCalledWith({
        report: {
          report_name: 'ai-mentor-chat-history',
        },
        autoDownload: true,
        extraRequestBody: expect.objectContaining({
          start_date: undefined,
          end_date: '2024-01-31',
        }),
      });
    });

    it('should pass sentiment filter', () => {
      const { result } = renderHook(() => useExportChatHistory());

      act(() => {
        result.current.handleExport({
          dateRange: undefined,
          sentiment: 'positive',
          topics: undefined,
          users: undefined,
        });
      });

      expect(mockInitializeReportDownload).toHaveBeenCalledWith({
        report: {
          report_name: 'ai-mentor-chat-history',
        },
        autoDownload: true,
        extraRequestBody: expect.objectContaining({
          sentiment: 'positive',
        }),
      });
    });

    it('should pass topics filter', () => {
      const { result } = renderHook(() => useExportChatHistory());

      act(() => {
        result.current.handleExport({
          dateRange: undefined,
          sentiment: undefined,
          topics: 'topic1,topic2',
          users: undefined,
        });
      });

      expect(mockInitializeReportDownload).toHaveBeenCalledWith({
        report: {
          report_name: 'ai-mentor-chat-history',
        },
        autoDownload: true,
        extraRequestBody: expect.objectContaining({
          topics: 'topic1,topic2',
        }),
      });
    });

    it('should handle all filters provided at once', () => {
      const { result } = renderHook(() => useExportChatHistory());

      act(() => {
        result.current.handleExport({
          dateRange: {
            from: new Date('2024-01-01'),
            to: new Date('2024-12-31'),
          },
          sentiment: 'negative',
          topics: 'topic1,topic2,topic3',
          users: 'user1',
        });
      });

      expect(mockInitializeReportDownload).toHaveBeenCalledWith({
        report: {
          report_name: 'ai-mentor-chat-history',
        },
        autoDownload: true,
        extraRequestBody: {
          start_date: '2024-01-01',
          end_date: '2024-12-31',
          sentiment: 'negative',
          topics: 'topic1,topic2,topic3',
          source: 'http://localhost:3000',
        },
      });
    });
  });

  describe('date formatting', () => {
    it('should format dates in yyyy-MM-dd format', () => {
      const { result } = renderHook(() => useExportChatHistory());

      // Using a date that could be formatted differently in other formats
      act(() => {
        result.current.handleExport({
          dateRange: {
            from: new Date('2024-03-05'), // Month < 10, Day < 10
            to: new Date('2024-11-22'),
          },
          sentiment: undefined,
          topics: undefined,
          users: undefined,
        });
      });

      expect(mockInitializeReportDownload).toHaveBeenCalledWith({
        report: {
          report_name: 'ai-mentor-chat-history',
        },
        autoDownload: true,
        extraRequestBody: expect.objectContaining({
          start_date: '2024-03-05',
          end_date: '2024-11-22',
        }),
      });
    });
  });

  describe('edge cases', () => {
    it('should handle empty tenant key', () => {
      mockUseParams.mockReturnValue({ tenantKey: '', mentorId: 'mentor-123' });

      const { result } = renderHook(() => useExportChatHistory());

      expect(result.current).toBeDefined();
      expect(mockUseReports).toHaveBeenCalledWith({
        tenantKey: '',
        selectedMentorId: 'mentor-123',
      });
    });

    it('should handle undefined mentor id in params', () => {
      mockUseParams.mockReturnValue({
        tenantKey: 'test-tenant',
        mentorId: undefined,
      });
      mockGetMentorId.mockReturnValue(null);

      const { result } = renderHook(() => useExportChatHistory());

      expect(result.current).toBeDefined();
      expect(mockUseReports).toHaveBeenCalledWith({
        tenantKey: 'test-tenant',
        selectedMentorId: undefined,
      });
    });

    it('should handle multiple rapid exports', () => {
      const { result } = renderHook(() => useExportChatHistory());

      const filters = {
        dateRange: undefined,
        sentiment: undefined,
        topics: undefined,
        users: undefined,
      };

      act(() => {
        result.current.handleExport(filters);
        result.current.handleExport(filters);
        result.current.handleExport(filters);
      });

      expect(mockInitializeReportDownload).toHaveBeenCalledTimes(3);
    });
  });

  describe('handleExport callback stability', () => {
    it('should maintain stable reference when dependencies do not change', () => {
      const { result, rerender } = renderHook(() => useExportChatHistory());

      const firstHandleExport = result.current.handleExport;

      rerender();

      expect(result.current.handleExport).toBe(firstHandleExport);
    });
  });
});
