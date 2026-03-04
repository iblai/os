import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useChatMode } from '../use-chat-mode';

// Mock next/navigation
const mockGet = vi.fn();
vi.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: mockGet,
  }),
}));

describe('useChatMode', () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  describe('chat mode detection', () => {
    it('should return "default" when chat parameter is not present', () => {
      mockGet.mockReturnValue(null);

      const { result } = renderHook(() => useChatMode());

      expect(result.current).toBe('default');
      expect(mockGet).toHaveBeenCalledWith('chat');
    });

    it('should return "default" when chat=default', () => {
      mockGet.mockImplementation((key: string) => (key === 'chat' ? 'default' : null));

      const { result } = renderHook(() => useChatMode());

      expect(result.current).toBe('default');
    });

    it('should return "advanced" when chat=advanced', () => {
      mockGet.mockImplementation((key: string) => (key === 'chat' ? 'advanced' : null));

      const { result } = renderHook(() => useChatMode());

      expect(result.current).toBe('advanced');
    });

    it('should return the parameter value even if it is unexpected', () => {
      mockGet.mockImplementation((key: string) => (key === 'chat' ? 'unknown' : null));

      const { result } = renderHook(() => useChatMode());

      // The hook casts to the union type but doesn't validate
      expect(result.current).toBe('unknown');
    });

    it('should return empty string when chat is empty', () => {
      mockGet.mockImplementation((key: string) => (key === 'chat' ? '' : null));

      const { result } = renderHook(() => useChatMode());

      // Empty string is not nullish (only null/undefined), so it returns empty string
      expect(result.current).toBe('');
    });
  });

  describe('re-render behavior', () => {
    it('should update when search params change', () => {
      mockGet.mockReturnValue(null);

      const { result, rerender } = renderHook(() => useChatMode());

      expect(result.current).toBe('default');

      mockGet.mockImplementation((key: string) => (key === 'chat' ? 'advanced' : null));
      rerender();

      expect(result.current).toBe('advanced');
    });
  });
});
