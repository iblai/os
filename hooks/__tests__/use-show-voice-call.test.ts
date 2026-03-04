import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useShowVoiceCall } from '../use-show-voice-call';

// Mock dependencies
const mockUseMentorSettings = vi.fn();
const mockUseEmbedMode = vi.fn();

vi.mock('../use-mentors/use-mentor-settings', () => ({
  useMentorSettings: () => mockUseMentorSettings(),
}));

vi.mock('../use-embed-mode', () => ({
  useEmbedMode: () => mockUseEmbedMode(),
}));

describe('useShowVoiceCall', () => {
  beforeEach(() => {
    mockUseMentorSettings.mockReset();
    mockUseEmbedMode.mockReset();
  });

  describe('regular mode', () => {
    beforeEach(() => {
      mockUseEmbedMode.mockReturnValue(false);
    });

    it('should return true when showVoiceCall is true', () => {
      mockUseMentorSettings.mockReturnValue({
        data: { showVoiceCall: true },
      });

      const { result } = renderHook(() => useShowVoiceCall());

      expect(result.current).toBe(true);
    });

    it('should return false when showVoiceCall is false', () => {
      mockUseMentorSettings.mockReturnValue({
        data: { showVoiceCall: false },
      });

      const { result } = renderHook(() => useShowVoiceCall());

      expect(result.current).toBe(false);
    });

    it('should return false when showVoiceCall is undefined', () => {
      mockUseMentorSettings.mockReturnValue({
        data: {},
      });

      const { result } = renderHook(() => useShowVoiceCall());

      expect(result.current).toBe(false);
    });

    it('should return false when mentorSettings data is undefined', () => {
      mockUseMentorSettings.mockReturnValue({
        data: undefined,
      });

      const { result } = renderHook(() => useShowVoiceCall());

      expect(result.current).toBe(false);
    });
  });

  describe('embed mode', () => {
    beforeEach(() => {
      mockUseEmbedMode.mockReturnValue(true);
    });

    it('should return true when embedShowVoiceCall is true', () => {
      mockUseMentorSettings.mockReturnValue({
        data: { embedShowVoiceCall: true },
      });

      const { result } = renderHook(() => useShowVoiceCall());

      expect(result.current).toBe(true);
    });

    it('should return false when embedShowVoiceCall is false', () => {
      mockUseMentorSettings.mockReturnValue({
        data: { embedShowVoiceCall: false },
      });

      const { result } = renderHook(() => useShowVoiceCall());

      expect(result.current).toBe(false);
    });

    it('should return false when embedShowVoiceCall is undefined', () => {
      mockUseMentorSettings.mockReturnValue({
        data: {},
      });

      const { result } = renderHook(() => useShowVoiceCall());

      expect(result.current).toBe(false);
    });

    it('should use embed setting even if regular setting exists', () => {
      mockUseMentorSettings.mockReturnValue({
        data: { showVoiceCall: true, embedShowVoiceCall: false },
      });

      const { result } = renderHook(() => useShowVoiceCall());

      expect(result.current).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should return false when showVoiceCall is a non-boolean truthy value', () => {
      mockUseEmbedMode.mockReturnValue(false);
      mockUseMentorSettings.mockReturnValue({
        data: { showVoiceCall: 'yes' },
      });

      const { result } = renderHook(() => useShowVoiceCall());

      expect(result.current).toBe(false);
    });

    it('should return false when showVoiceCall is null', () => {
      mockUseEmbedMode.mockReturnValue(false);
      mockUseMentorSettings.mockReturnValue({
        data: { showVoiceCall: null },
      });

      const { result } = renderHook(() => useShowVoiceCall());

      expect(result.current).toBe(false);
    });
  });
});
