import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useShowVoiceRecorder } from '../use-show-voice-recorder';
import * as useMentorSettingsModule from '../use-mentors/use-mentor-settings';
import * as useEmbedModeModule from '../use-embed-mode';

vi.mock('../use-mentors/use-mentor-settings');
vi.mock('../use-embed-mode');

describe('useShowVoiceRecorder', () => {
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

  describe('when showVoiceRecorder is not specified in settings', () => {
    it('should return false when mentorSettings is undefined', () => {
      mockUseMentorSettings.mockReturnValue({
        isLoading: false,
        data: undefined as any,
      });

      const { result } = renderHook(() => useShowVoiceRecorder());
      expect(result.current).toBe(false);
    });

    it('should return false when mentorSettings is null', () => {
      mockUseMentorSettings.mockReturnValue({
        isLoading: false,
        data: null as any,
      });

      const { result } = renderHook(() => useShowVoiceRecorder());
      expect(result.current).toBe(false);
    });

    it('should return false when mentorSettings exists but showVoiceRecorder is undefined', () => {
      mockUseMentorSettings.mockReturnValue({
        isLoading: false,
        data: {
          mentorName: 'Test Mentor',
        } as any,
      });

      const { result } = renderHook(() => useShowVoiceRecorder());
      expect(result.current).toBe(false);
    });

    it('should return false when showVoiceRecorder is null', () => {
      mockUseMentorSettings.mockReturnValue({
        isLoading: false,
        data: {
          showVoiceRecorder: null as any,
        } as any,
      });

      const { result } = renderHook(() => useShowVoiceRecorder());
      expect(result.current).toBe(false);
    });

    it('should return false when showVoiceRecorder is a non-boolean value (string)', () => {
      mockUseMentorSettings.mockReturnValue({
        isLoading: false,
        data: {
          showVoiceRecorder: 'true' as any,
        } as any,
      });

      const { result } = renderHook(() => useShowVoiceRecorder());
      expect(result.current).toBe(false);
    });

    it('should return false when showVoiceRecorder is a non-boolean value (number)', () => {
      mockUseMentorSettings.mockReturnValue({
        isLoading: false,
        data: {
          showVoiceRecorder: 1 as any,
        } as any,
      });

      const { result } = renderHook(() => useShowVoiceRecorder());
      expect(result.current).toBe(false);
    });

    it('should return false when showVoiceRecorder is a non-boolean value (object)', () => {
      mockUseMentorSettings.mockReturnValue({
        isLoading: false,
        data: {
          showVoiceRecorder: {} as any,
        } as any,
      });

      const { result } = renderHook(() => useShowVoiceRecorder());
      expect(result.current).toBe(false);
    });
  });

  describe('when showVoiceRecorder is explicitly set to true', () => {
    it('should return true', () => {
      mockUseMentorSettings.mockReturnValue({
        isLoading: false,
        data: {
          showVoiceRecord: true,
        } as any,
      });

      const { result } = renderHook(() => useShowVoiceRecorder());
      expect(result.current).toBe(true);
    });
  });

  describe('when showVoiceRecorder is explicitly set to false', () => {
    it('should return false', () => {
      mockUseMentorSettings.mockReturnValue({
        isLoading: false,
        data: {
          showVoiceRecord: false,
        } as any,
      });

      const { result } = renderHook(() => useShowVoiceRecorder());
      expect(result.current).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle empty object for data', () => {
      mockUseMentorSettings.mockReturnValue({
        isLoading: false,
        data: {} as any,
      });

      const { result } = renderHook(() => useShowVoiceRecorder());
      expect(result.current).toBe(false);
    });

    it('should handle data with other properties but no showVoiceRecorder', () => {
      mockUseMentorSettings.mockReturnValue({
        isLoading: false,
        data: {
          mentorName: 'Test',
          profileImage: 'image.png',
          greetingMethod: 'text',
        } as any,
      });

      const { result } = renderHook(() => useShowVoiceRecorder());
      expect(result.current).toBe(false);
    });

    it('should reactively update when settings change', () => {
      mockUseMentorSettings.mockReturnValue({
        isLoading: false,
        data: {
          showVoiceRecord: true,
        } as any,
      });

      const { result, rerender } = renderHook(() => useShowVoiceRecorder());
      expect(result.current).toBe(true);

      // Update mock to return false
      mockUseMentorSettings.mockReturnValue({
        isLoading: false,
        data: {
          showVoiceRecord: false,
        } as any,
      });

      rerender();
      expect(result.current).toBe(false);
    });
  });

  describe('embed mode behavior', () => {
    it('should use embedShowVoiceRecord when in embed mode', () => {
      mockUseEmbedMode.mockReturnValue(true);
      mockUseMentorSettings.mockReturnValue({
        isLoading: false,
        data: {
          showVoiceRecord: false,
          embedShowVoiceRecord: true,
        } as any,
      });

      const { result } = renderHook(() => useShowVoiceRecorder());
      expect(result.current).toBe(true);
    });

    it('should use showVoiceRecord when not in embed mode', () => {
      mockUseEmbedMode.mockReturnValue(false);
      mockUseMentorSettings.mockReturnValue({
        isLoading: false,
        data: {
          showVoiceRecord: true,
          embedShowVoiceRecord: false,
        } as any,
      });

      const { result } = renderHook(() => useShowVoiceRecorder());
      expect(result.current).toBe(true);
    });

    it('should return false when embedShowVoiceRecord is false in embed mode', () => {
      mockUseEmbedMode.mockReturnValue(true);
      mockUseMentorSettings.mockReturnValue({
        isLoading: false,
        data: {
          showVoiceRecord: true,
          embedShowVoiceRecord: false,
        } as any,
      });

      const { result } = renderHook(() => useShowVoiceRecorder());
      expect(result.current).toBe(false);
    });
  });
});
