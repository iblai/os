import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { toast } from 'sonner';
import { useToggleTools } from '../use-toggle-tools';

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock the data-layer mutation
const mockEditMentor = vi.fn();
const mockUnwrap = vi.fn();

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useEditMentorMutation: () => [
    (...args: unknown[]) => {
      mockEditMentor(...args);
      return { unwrap: mockUnwrap };
    },
    { isLoading: false },
  ],
}));

describe('useToggleTools', () => {
  const defaultProps = {
    activeMentorId: 'mentor-123',
    tenantKey: 'test-tenant',
    username: 'test-user',
    tools: ['tool-1', 'tool-2'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUnwrap.mockResolvedValue({});
  });

  describe('initialization', () => {
    it('returns toggleTools function and isLoading state', () => {
      const { result } = renderHook(() => useToggleTools(defaultProps));

      expect(result.current.toggleTools).toBeDefined();
      expect(typeof result.current.toggleTools).toBe('function');
      expect(result.current.isLoading).toBe(false);
    });

    it('handles empty tools array', () => {
      const { result } = renderHook(() =>
        useToggleTools({
          ...defaultProps,
          tools: [],
        }),
      );

      expect(result.current.toggleTools).toBeDefined();
    });
  });

  describe('toggleTools - adding tools', () => {
    it('adds a new tool when it does not exist in the list', async () => {
      const { result } = renderHook(() => useToggleTools(defaultProps));

      await act(async () => {
        await result.current.toggleTools('new-tool');
      });

      expect(mockEditMentor).toHaveBeenCalledWith({
        mentor: 'mentor-123',
        org: 'test-tenant',
        formData: {
          tool_slugs: ['tool-1', 'tool-2', 'new-tool'],
          can_use_tools: true,
        },
        userId: 'test-user',
      });
    });

    it('shows success toast after adding tool', async () => {
      const { result } = renderHook(() => useToggleTools(defaultProps));

      await act(async () => {
        await result.current.toggleTools('new-tool');
      });

      expect(toast.success).toHaveBeenCalledWith('Mentor updated successfully');
    });

    it('calls callback after successful tool addition', async () => {
      const callback = vi.fn();
      const { result } = renderHook(() => useToggleTools(defaultProps));

      await act(async () => {
        await result.current.toggleTools('new-tool', callback);
      });

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('toggleTools - removing tools', () => {
    it('removes a tool when it exists in the list', async () => {
      const { result } = renderHook(() => useToggleTools(defaultProps));

      await act(async () => {
        await result.current.toggleTools('tool-1');
      });

      expect(mockEditMentor).toHaveBeenCalledWith({
        mentor: 'mentor-123',
        org: 'test-tenant',
        formData: {
          tool_slugs: ['tool-2'],
          can_use_tools: true,
        },
        userId: 'test-user',
      });
    });

    it('sets can_use_tools to false when all tools are removed', async () => {
      const { result } = renderHook(() =>
        useToggleTools({
          ...defaultProps,
          tools: ['only-tool'],
        }),
      );

      await act(async () => {
        await result.current.toggleTools('only-tool');
      });

      expect(mockEditMentor).toHaveBeenCalledWith({
        mentor: 'mentor-123',
        org: 'test-tenant',
        formData: {
          tool_slugs: [],
          can_use_tools: false,
        },
        userId: 'test-user',
      });
    });
  });

  describe('error handling', () => {
    it('shows error toast with data.error message on failure', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      mockUnwrap.mockRejectedValue({ data: { error: 'Custom API error' } });

      const { result } = renderHook(() => useToggleTools(defaultProps));

      await act(async () => {
        await result.current.toggleTools('new-tool');
      });

      expect(toast.error).toHaveBeenCalledWith('Custom API error');
      consoleSpy.mockRestore();
    });

    it('shows error toast with error.error message on failure', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      mockUnwrap.mockRejectedValue({
        error: { error: 'Nested error message' },
      });

      const { result } = renderHook(() => useToggleTools(defaultProps));

      await act(async () => {
        await result.current.toggleTools('new-tool');
      });

      expect(toast.error).toHaveBeenCalledWith('Nested error message');
      consoleSpy.mockRestore();
    });

    it('shows default error message when no specific error message available', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      mockUnwrap.mockRejectedValue({});

      const { result } = renderHook(() => useToggleTools(defaultProps));

      await act(async () => {
        await result.current.toggleTools('new-tool');
      });

      expect(toast.error).toHaveBeenCalledWith('Failed to update tool');
      consoleSpy.mockRestore();
    });

    it('logs error to console on failure', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const error = { data: { error: 'Test error' } };
      mockUnwrap.mockRejectedValue(error);

      const { result } = renderHook(() => useToggleTools(defaultProps));

      await act(async () => {
        await result.current.toggleTools('new-tool');
      });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('does not call callback on error', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      mockUnwrap.mockRejectedValue({ data: { error: 'Error' } });
      const callback = vi.fn();

      const { result } = renderHook(() => useToggleTools(defaultProps));

      await act(async () => {
        await result.current.toggleTools('new-tool', callback);
      });

      expect(callback).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('edge cases', () => {
    it('handles undefined username by using empty string', async () => {
      const { result } = renderHook(() =>
        useToggleTools({
          ...defaultProps,
          // @ts-expect-error - Testing undefined username
          username: undefined,
        }),
      );

      await act(async () => {
        await result.current.toggleTools('new-tool');
      });

      expect(mockEditMentor).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: '',
        }),
      );
    });

    it('handles tool toggle without callback', async () => {
      const { result } = renderHook(() => useToggleTools(defaultProps));

      await act(async () => {
        await result.current.toggleTools('new-tool');
      });

      expect(toast.success).toHaveBeenCalledWith('Mentor updated successfully');
    });
  });
});
