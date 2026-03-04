import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useShowAttachment } from '../use-show-attachment';

// Mock dependencies
const mockUseMentorSettings = vi.fn();
const mockUseModelFileUploadCapabilities = vi.fn();
const mockUseEmbedMode = vi.fn();

vi.mock('../use-mentors/use-mentor-settings', () => ({
  useMentorSettings: () => mockUseMentorSettings(),
}));

vi.mock('../use-model-file-upload-capabilities', () => ({
  useModelFileUploadCapabilities: () => mockUseModelFileUploadCapabilities(),
}));

vi.mock('../use-embed-mode', () => ({
  useEmbedMode: () => mockUseEmbedMode(),
}));

describe('useShowAttachment', () => {
  beforeEach(() => {
    mockUseMentorSettings.mockReset();
    mockUseModelFileUploadCapabilities.mockReset();
    mockUseEmbedMode.mockReset();
  });

  describe('file upload capability check', () => {
    it('should return false when model does not support file upload', () => {
      mockUseModelFileUploadCapabilities.mockReturnValue({
        supportsFileUpload: false,
      });
      mockUseMentorSettings.mockReturnValue({
        data: { showAttachment: true },
      });
      mockUseEmbedMode.mockReturnValue(false);

      const { result } = renderHook(() => useShowAttachment());

      expect(result.current).toBe(false);
    });
  });

  describe('regular mode', () => {
    beforeEach(() => {
      mockUseModelFileUploadCapabilities.mockReturnValue({
        supportsFileUpload: true,
      });
      mockUseEmbedMode.mockReturnValue(false);
    });

    it('should return true when showAttachment is true', () => {
      mockUseMentorSettings.mockReturnValue({
        data: { showAttachment: true },
      });

      const { result } = renderHook(() => useShowAttachment());

      expect(result.current).toBe(true);
    });

    it('should return false when showAttachment is false', () => {
      mockUseMentorSettings.mockReturnValue({
        data: { showAttachment: false },
      });

      const { result } = renderHook(() => useShowAttachment());

      expect(result.current).toBe(false);
    });

    it('should return false when showAttachment is undefined', () => {
      mockUseMentorSettings.mockReturnValue({
        data: {},
      });

      const { result } = renderHook(() => useShowAttachment());

      expect(result.current).toBe(false);
    });

    it('should return false when mentorSettings data is undefined', () => {
      mockUseMentorSettings.mockReturnValue({
        data: undefined,
      });

      const { result } = renderHook(() => useShowAttachment());

      expect(result.current).toBe(false);
    });
  });

  describe('embed mode', () => {
    beforeEach(() => {
      mockUseModelFileUploadCapabilities.mockReturnValue({
        supportsFileUpload: true,
      });
      mockUseEmbedMode.mockReturnValue(true);
    });

    it('should return true when embedShowAttachment is true', () => {
      mockUseMentorSettings.mockReturnValue({
        data: { embedShowAttachment: true },
      });

      const { result } = renderHook(() => useShowAttachment());

      expect(result.current).toBe(true);
    });

    it('should return false when embedShowAttachment is false', () => {
      mockUseMentorSettings.mockReturnValue({
        data: { embedShowAttachment: false },
      });

      const { result } = renderHook(() => useShowAttachment());

      expect(result.current).toBe(false);
    });

    it('should return false when embedShowAttachment is undefined', () => {
      mockUseMentorSettings.mockReturnValue({
        data: {},
      });

      const { result } = renderHook(() => useShowAttachment());

      expect(result.current).toBe(false);
    });

    it('should use embed setting even if regular setting exists', () => {
      mockUseMentorSettings.mockReturnValue({
        data: { showAttachment: true, embedShowAttachment: false },
      });

      const { result } = renderHook(() => useShowAttachment());

      expect(result.current).toBe(false);
    });
  });

  describe('edge cases', () => {
    beforeEach(() => {
      mockUseModelFileUploadCapabilities.mockReturnValue({
        supportsFileUpload: true,
      });
      mockUseEmbedMode.mockReturnValue(false);
    });

    it('should return false when showAttachment is a non-boolean truthy value', () => {
      mockUseMentorSettings.mockReturnValue({
        data: { showAttachment: 'yes' },
      });

      const { result } = renderHook(() => useShowAttachment());

      expect(result.current).toBe(false);
    });

    it('should return false when showAttachment is null', () => {
      mockUseMentorSettings.mockReturnValue({
        data: { showAttachment: null },
      });

      const { result } = renderHook(() => useShowAttachment());

      expect(result.current).toBe(false);
    });

    it('should return false when showAttachment is 0', () => {
      mockUseMentorSettings.mockReturnValue({
        data: { showAttachment: 0 },
      });

      const { result } = renderHook(() => useShowAttachment());

      expect(result.current).toBe(false);
    });
  });
});
