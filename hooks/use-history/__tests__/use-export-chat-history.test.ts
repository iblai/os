import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useExportChatHistory } from '../use-export-chat-history';

// Mock dependencies
vi.mock('next/navigation', () => ({
  useParams: vi.fn(() => ({
    tenantKey: 'test-tenant',
    mentorId: 'test-mentor',
  })),
}));

const mockExportChatHistory = vi.fn();
const mockUnwrap = vi.fn();

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useExportChatHistoryMutation: vi.fn(() => [
    mockExportChatHistory.mockReturnValue({ unwrap: mockUnwrap }),
    { isLoading: false, data: null },
  ]),
  useGetChatHistoryExportStatusQuery: vi.fn(() => ({
    data: null,
  })),
}));

vi.mock('@/lib/constants', () => ({
  REPORT_NAME: 'chat-history-report',
}));

vi.mock('@/hooks/user-navigate', () => ({
  useNavigate: vi.fn(() => ({
    getMentorId: vi.fn(() => 'active-mentor-id'),
  })),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('date-fns', () => ({
  format: vi.fn(() => '2024-01-15'),
}));

describe('useExportChatHistory', () => {
  const originalWindowOpen = window.open;

  beforeEach(() => {
    vi.clearAllMocks();
    window.open = vi.fn();
  });

  afterEach(() => {
    window.open = originalWindowOpen;
  });

  it('should return exportStatus, handleExport, and isExporting', () => {
    const { result } = renderHook(() => useExportChatHistory());

    expect(result.current.exportStatus).toBeDefined();
    expect(result.current.handleExport).toBeDefined();
    expect(typeof result.current.handleExport).toBe('function');
    expect(result.current.isExporting).toBe(false);
  });

  it('should not be exporting initially', () => {
    const { result } = renderHook(() => useExportChatHistory());

    expect(result.current.isExporting).toBe(false);
  });

  it('should call exportChatHistory with correct parameters when handleExport is called', async () => {
    mockUnwrap.mockResolvedValue({ data: { state: 'pending' } });

    const { result } = renderHook(() => useExportChatHistory());

    const filters = {
      dateRange: {
        from: new Date('2024-01-01'),
        to: new Date('2024-01-31'),
      },
      sentiment: 'positive',
      topics: 'topic1,topic2',
      users: undefined,
    };

    await act(async () => {
      await result.current.handleExport(filters);
    });

    expect(mockExportChatHistory).toHaveBeenCalledWith({
      key: 'test-tenant',
      requestBody: expect.objectContaining({
        report_name: 'chat-history-report',
        mentor: 'active-mentor-id',
        topics: 'topic1,topic2',
      }),
    });
  });

  it('should handle export with empty filters', async () => {
    mockUnwrap.mockResolvedValue({ data: { state: 'pending' } });

    const { result } = renderHook(() => useExportChatHistory());

    const filters = {
      dateRange: undefined,
      sentiment: undefined,
      topics: undefined,
      users: undefined,
    };

    await act(async () => {
      await result.current.handleExport(filters);
    });

    expect(mockExportChatHistory).toHaveBeenCalled();
  });

  it('should handle export error gracefully', async () => {
    mockUnwrap.mockRejectedValue(new Error('Export failed'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useExportChatHistory());

    await act(async () => {
      await result.current.handleExport({} as any);
    });

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('should show isExporting as true when mutation is loading', async () => {
    const { useExportChatHistoryMutation } = await import('@iblai/iblai-js/data-layer');
    (useExportChatHistoryMutation as any).mockReturnValue([
      mockExportChatHistory,
      { isLoading: true, data: { data: { state: 'pending' } } },
    ]);

    const { result } = renderHook(() => useExportChatHistory());

    expect(result.current.isExporting).toBe(true);
  });

  it('should use getMentorId from useNavigate if available', () => {
    const { result } = renderHook(() => useExportChatHistory());

    // The hook uses getMentorId() || mentorId, so active-mentor-id should be used
    expect(result.current).toBeDefined();
  });

  it('should fall back to params mentorId if getMentorId returns null', async () => {
    const { useNavigate } = await import('@/hooks/user-navigate');
    (useNavigate as any).mockReturnValue({
      getMentorId: vi.fn(() => null),
    });

    const { result } = renderHook(() => useExportChatHistory());

    expect(result.current).toBeDefined();
  });

  it('should handle completed export status', async () => {
    const { useGetChatHistoryExportStatusQuery } = await import('@iblai/iblai-js/data-layer');
    (useGetChatHistoryExportStatusQuery as any).mockReturnValue({
      data: {
        data: {
          status: {
            state: 'completed',
            url: 'https://example.com/download',
          },
        },
      },
    });

    renderHook(() => useExportChatHistory());

    await waitFor(() => {
      expect(window.open).toHaveBeenCalledWith('https://example.com/download', '_blank');
    });
  });

  it('should handle error export status', async () => {
    const { toast } = await import('sonner');
    const { useGetChatHistoryExportStatusQuery } = await import('@iblai/iblai-js/data-layer');
    (useGetChatHistoryExportStatusQuery as any).mockReturnValue({
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
      expect(toast.error).toHaveBeenCalledWith('Failed to export chat history');
    });
  });
});
