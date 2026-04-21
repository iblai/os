import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useIsPreviewMode } from '../use-is-preview-mode';

// Mock next/navigation
const mockGet = vi.fn();
vi.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: mockGet,
  }),
}));

// Mock use-mentors/use-mentor-settings
const mockUseMentorSettings = vi.fn();
vi.mock('../use-mentors/use-mentor-settings', () => ({
  useMentorSettings: () => mockUseMentorSettings(),
}));

// Mock use-user
const mockUseUsername = vi.fn();
vi.mock('../use-user', () => ({
  useUsername: () => mockUseUsername(),
}));

// Mock useAppSelector
const mockUseAppSelector = vi.fn();
vi.mock('@/lib/hooks', () => ({
  useAppSelector: () => mockUseAppSelector(),
}));

// Mock selectTokenEnabled
vi.mock('@iblai/iblai-js/web-utils', () => ({
  selectTokenEnabled: vi.fn(),
}));

describe('useIsPreviewMode', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockUseMentorSettings.mockReset();
    mockUseUsername.mockReset();
    mockUseAppSelector.mockReset();

    // Default mocks
    mockUseMentorSettings.mockReturnValue({ data: {} });
    mockUseUsername.mockReturnValue('testuser');
    mockUseAppSelector.mockReturnValue(false);
  });

  describe('internalPreview parameter', () => {
    it('should return true when internalPreview=true', () => {
      mockGet.mockImplementation((key: string) => {
        if (key === 'internalPreview') return 'true';
        return null;
      });

      const { result } = renderHook(() => useIsPreviewMode());

      expect(result.current).toBe(true);
    });

    it('should return false when internalPreview=false', () => {
      mockGet.mockImplementation((key: string) => {
        if (key === 'internalPreview') return 'false';
        return null;
      });

      const { result } = renderHook(() => useIsPreviewMode());

      expect(result.current).toBe(false);
    });

    it('should return false when internalPreview is not present', () => {
      mockGet.mockReturnValue(null);

      const { result } = renderHook(() => useIsPreviewMode());

      expect(result.current).toBe(false);
    });
  });

  describe('userIsNotAllowedToChat logic', () => {
    it('should return true when user has no username, mentor is not anonymous, has token, and token is not enabled', () => {
      mockUseUsername.mockReturnValue(null);
      mockUseMentorSettings.mockReturnValue({
        data: { allowAnonymous: false },
      });
      mockUseAppSelector.mockReturnValue(false); // tokenEnabled = false
      mockGet.mockImplementation((key: string) => {
        if (key === 'token') return 'some-token';
        if (key === 'internalPreview') return null;
        return null;
      });

      const { result } = renderHook(() => useIsPreviewMode());

      expect(result.current).toBe(true);
    });

    it('should return false when user has username', () => {
      mockUseUsername.mockReturnValue('testuser');
      mockUseMentorSettings.mockReturnValue({
        data: { allowAnonymous: false },
      });
      mockUseAppSelector.mockReturnValue(false);
      mockGet.mockImplementation((key: string) => {
        if (key === 'token') return 'some-token';
        return null;
      });

      const { result } = renderHook(() => useIsPreviewMode());

      expect(result.current).toBe(false);
    });

    it('should return false when mentor allows anonymous', () => {
      mockUseUsername.mockReturnValue(null);
      mockUseMentorSettings.mockReturnValue({ data: { allowAnonymous: true } });
      mockUseAppSelector.mockReturnValue(false);
      mockGet.mockImplementation((key: string) => {
        if (key === 'token') return 'some-token';
        return null;
      });

      const { result } = renderHook(() => useIsPreviewMode());

      expect(result.current).toBe(false);
    });

    it('should return false when no token in URL', () => {
      mockUseUsername.mockReturnValue(null);
      mockUseMentorSettings.mockReturnValue({
        data: { allowAnonymous: false },
      });
      mockUseAppSelector.mockReturnValue(false);
      mockGet.mockReturnValue(null);

      const { result } = renderHook(() => useIsPreviewMode());

      expect(result.current).toBe(false);
    });

    it('should return false when token is enabled', () => {
      mockUseUsername.mockReturnValue(null);
      mockUseMentorSettings.mockReturnValue({
        data: { allowAnonymous: false },
      });
      mockUseAppSelector.mockReturnValue(true); // tokenEnabled = true
      mockGet.mockImplementation((key: string) => {
        if (key === 'token') return 'some-token';
        return null;
      });

      const { result } = renderHook(() => useIsPreviewMode());

      expect(result.current).toBe(false);
    });
  });

  describe('combined conditions', () => {
    it('should return true when internalPreview is true even if user is allowed to chat', () => {
      mockUseUsername.mockReturnValue('testuser');
      mockUseMentorSettings.mockReturnValue({ data: { allowAnonymous: true } });
      mockUseAppSelector.mockReturnValue(true);
      mockGet.mockImplementation((key: string) => {
        if (key === 'internalPreview') return 'true';
        return null;
      });

      const { result } = renderHook(() => useIsPreviewMode());

      expect(result.current).toBe(true);
    });

    it('should return false when all conditions are false', () => {
      mockUseUsername.mockReturnValue('testuser');
      mockUseMentorSettings.mockReturnValue({ data: { allowAnonymous: true } });
      mockUseAppSelector.mockReturnValue(true);
      mockGet.mockReturnValue(null);

      const { result } = renderHook(() => useIsPreviewMode());

      expect(result.current).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle undefined mentorSettings data', () => {
      mockUseUsername.mockReturnValue(null);
      mockUseMentorSettings.mockReturnValue({ data: undefined });
      mockUseAppSelector.mockReturnValue(false);
      mockGet.mockImplementation((key: string) => {
        if (key === 'token') return 'some-token';
        return null;
      });

      const { result } = renderHook(() => useIsPreviewMode());

      // allowAnonymous is undefined, which is falsy
      expect(result.current).toBe(true);
    });

    it('should handle empty string username as falsy', () => {
      mockUseUsername.mockReturnValue('');
      mockUseMentorSettings.mockReturnValue({
        data: { allowAnonymous: false },
      });
      mockUseAppSelector.mockReturnValue(false);
      mockGet.mockImplementation((key: string) => {
        if (key === 'token') return 'some-token';
        return null;
      });

      const { result } = renderHook(() => useIsPreviewMode());

      expect(result.current).toBe(true);
    });
  });
});
