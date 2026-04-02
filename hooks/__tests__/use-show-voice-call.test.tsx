import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useShowVoiceCall } from '../use-show-voice-call';
import * as useMentorSettingsModule from '../use-mentors/use-mentor-settings';
import * as useEmbedModeModule from '../use-embed-mode';

vi.mock('../use-mentors/use-mentor-settings');
vi.mock('../use-embed-mode');

describe('useShowVoiceCall', () => {
  const mockUseMentorSettings = vi.spyOn(
    useMentorSettingsModule,
    'useMentorSettings',
  );
  const mockUseEmbedMode = vi.spyOn(useEmbedModeModule, 'useEmbedMode');

  beforeEach(() => {
    // Mock embed mode to be false by default
    mockUseEmbedMode.mockReturnValue(false);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('when showVoiceCall is not specified in settings', () => {
    it('should return false when mentorSettings is undefined', () => {
      mockUseMentorSettings.mockReturnValue({
        isLoading: false,
        data: undefined as any,
      });

      const { result } = renderHook(() => useShowVoiceCall());
      expect(result.current).toBe(false);
    });

    it('should return false when mentorSettings is null', () => {
      mockUseMentorSettings.mockReturnValue({
        isLoading: false,
        data: null as any,
      });

      const { result } = renderHook(() => useShowVoiceCall());
      expect(result.current).toBe(false);
    });

    it('should return false when mentorSettings exists but showVoiceCall is undefined', () => {
      mockUseMentorSettings.mockReturnValue({
        isLoading: false,
        data: {
          mentorName: 'Test Mentor',
        } as any,
      });

      const { result } = renderHook(() => useShowVoiceCall());
      expect(result.current).toBe(false);
    });

    it('should return false when showVoiceCall is null', () => {
      mockUseMentorSettings.mockReturnValue({
        isLoading: false,
        data: {
          showVoiceCall: null as any,
        } as any,
      });

      const { result } = renderHook(() => useShowVoiceCall());
      expect(result.current).toBe(false);
    });

    it('should return false when showVoiceCall is a non-boolean value (string)', () => {
      mockUseMentorSettings.mockReturnValue({
        isLoading: false,
        data: {
          showVoiceCall: 'true' as any,
        } as any,
      });

      const { result } = renderHook(() => useShowVoiceCall());
      expect(result.current).toBe(false);
    });

    it('should return false when showVoiceCall is a non-boolean value (number)', () => {
      mockUseMentorSettings.mockReturnValue({
        isLoading: false,
        data: {
          showVoiceCall: 1 as any,
        } as any,
      });

      const { result } = renderHook(() => useShowVoiceCall());
      expect(result.current).toBe(false);
    });

    it('should return false when showVoiceCall is a non-boolean value (object)', () => {
      mockUseMentorSettings.mockReturnValue({
        isLoading: false,
        data: {
          showVoiceCall: {} as any,
        } as any,
      });

      const { result } = renderHook(() => useShowVoiceCall());
      expect(result.current).toBe(false);
    });
  });

  describe('when showVoiceCall is explicitly set to true', () => {
    it('should return true', () => {
      mockUseMentorSettings.mockReturnValue({
        isLoading: false,
        data: {
          showVoiceCall: true,
        } as any,
      });

      const { result } = renderHook(() => useShowVoiceCall());
      expect(result.current).toBe(true);
    });
  });

  describe('when showVoiceCall is explicitly set to false', () => {
    it('should return false', () => {
      mockUseMentorSettings.mockReturnValue({
        isLoading: false,
        data: {
          showVoiceCall: false,
        } as any,
      });

      const { result } = renderHook(() => useShowVoiceCall());
      expect(result.current).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle empty object for data', () => {
      mockUseMentorSettings.mockReturnValue({
        isLoading: false,
        data: {} as any,
      });

      const { result } = renderHook(() => useShowVoiceCall());
      expect(result.current).toBe(false);
    });

    it('should handle data with other properties but no showVoiceCall', () => {
      mockUseMentorSettings.mockReturnValue({
        isLoading: false,
        data: {
          mentorName: 'Test',
          profileImage: 'image.png',
          greetingMethod: 'text',
        } as any,
      });

      const { result } = renderHook(() => useShowVoiceCall());
      expect(result.current).toBe(false);
    });

    it('should reactively update when settings change', () => {
      mockUseMentorSettings.mockReturnValue({
        isLoading: false,
        data: {
          showVoiceCall: true,
        } as any,
      });

      const { result, rerender } = renderHook(() => useShowVoiceCall());
      expect(result.current).toBe(true);

      // Update mock to return false
      mockUseMentorSettings.mockReturnValue({
        isLoading: false,
        data: {
          showVoiceCall: false,
        } as any,
      });

      rerender();
      expect(result.current).toBe(false);
    });
  });

  describe('embed mode behavior', () => {
    it('should use embedShowVoiceCall when in embed mode', () => {
      mockUseEmbedMode.mockReturnValue(true);
      mockUseMentorSettings.mockReturnValue({
        isLoading: false,
        data: {
          showVoiceCall: false,
          embedShowVoiceCall: true,
        } as any,
      });

      const { result } = renderHook(() => useShowVoiceCall());
      expect(result.current).toBe(true);
    });

    it('should use showVoiceCall when not in embed mode', () => {
      mockUseEmbedMode.mockReturnValue(false);
      mockUseMentorSettings.mockReturnValue({
        isLoading: false,
        data: {
          showVoiceCall: true,
          embedShowVoiceCall: false,
        } as any,
      });

      const { result } = renderHook(() => useShowVoiceCall());
      expect(result.current).toBe(true);
    });

    it('should return false when embedShowVoiceCall is false in embed mode', () => {
      mockUseEmbedMode.mockReturnValue(true);
      mockUseMentorSettings.mockReturnValue({
        isLoading: false,
        data: {
          showVoiceCall: true,
          embedShowVoiceCall: false,
        } as any,
      });

      const { result } = renderHook(() => useShowVoiceCall());
      expect(result.current).toBe(false);
    });
  });
});
