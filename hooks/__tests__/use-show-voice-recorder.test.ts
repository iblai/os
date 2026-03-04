import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useShowVoiceRecorder } from '../use-show-voice-recorder';

// Mock dependencies
const mockUseMentorSettings = vi.fn();
const mockUseEmbedMode = vi.fn();

vi.mock('../use-mentors/use-mentor-settings', () => ({
  useMentorSettings: () => mockUseMentorSettings(),
}));

vi.mock('../use-embed-mode', () => ({
  useEmbedMode: () => mockUseEmbedMode(),
}));

describe('useShowVoiceRecorder', () => {
  beforeEach(() => {
    mockUseMentorSettings.mockReset();
    mockUseEmbedMode.mockReset();
  });

  describe('regular mode', () => {
    beforeEach(() => {
      mockUseEmbedMode.mockReturnValue(false);
    });

    it('should return true when showVoiceRecord is true', () => {
      mockUseMentorSettings.mockReturnValue({
        data: { showVoiceRecord: true },
      });

      const { result } = renderHook(() => useShowVoiceRecorder());

      expect(result.current).toBe(true);
    });

    it('should return false when showVoiceRecord is false', () => {
      mockUseMentorSettings.mockReturnValue({
        data: { showVoiceRecord: false },
      });

      const { result } = renderHook(() => useShowVoiceRecorder());

      expect(result.current).toBe(false);
    });

    it('should return false when showVoiceRecord is undefined', () => {
      mockUseMentorSettings.mockReturnValue({
        data: {},
      });

      const { result } = renderHook(() => useShowVoiceRecorder());

      expect(result.current).toBe(false);
    });

    it('should return false when mentorSettings data is undefined', () => {
      mockUseMentorSettings.mockReturnValue({
        data: undefined,
      });

      const { result } = renderHook(() => useShowVoiceRecorder());

      expect(result.current).toBe(false);
    });
  });

  describe('embed mode', () => {
    beforeEach(() => {
      mockUseEmbedMode.mockReturnValue(true);
    });

    it('should return true when embedShowVoiceRecord is true', () => {
      mockUseMentorSettings.mockReturnValue({
        data: { embedShowVoiceRecord: true },
      });

      const { result } = renderHook(() => useShowVoiceRecorder());

      expect(result.current).toBe(true);
    });

    it('should return false when embedShowVoiceRecord is false', () => {
      mockUseMentorSettings.mockReturnValue({
        data: { embedShowVoiceRecord: false },
      });

      const { result } = renderHook(() => useShowVoiceRecorder());

      expect(result.current).toBe(false);
    });

    it('should return false when embedShowVoiceRecord is undefined', () => {
      mockUseMentorSettings.mockReturnValue({
        data: {},
      });

      const { result } = renderHook(() => useShowVoiceRecorder());

      expect(result.current).toBe(false);
    });

    it('should use embed setting even if regular setting exists', () => {
      mockUseMentorSettings.mockReturnValue({
        data: { showVoiceRecord: true, embedShowVoiceRecord: false },
      });

      const { result } = renderHook(() => useShowVoiceRecorder());

      expect(result.current).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should return false when showVoiceRecord is a non-boolean truthy value', () => {
      mockUseEmbedMode.mockReturnValue(false);
      mockUseMentorSettings.mockReturnValue({
        data: { showVoiceRecord: 'yes' },
      });

      const { result } = renderHook(() => useShowVoiceRecorder());

      expect(result.current).toBe(false);
    });

    it('should return false when showVoiceRecord is null', () => {
      mockUseEmbedMode.mockReturnValue(false);
      mockUseMentorSettings.mockReturnValue({
        data: { showVoiceRecord: null },
      });

      const { result } = renderHook(() => useShowVoiceRecorder());

      expect(result.current).toBe(false);
    });
  });
});
