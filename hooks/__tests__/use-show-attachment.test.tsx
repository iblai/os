import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useShowAttachment } from '../use-show-attachment';
import * as useMentorSettingsModule from '../use-mentors/use-mentor-settings';
import * as useModelFileUploadCapabilitiesModule from '../use-model-file-upload-capabilities';
import * as useEmbedModeModule from '../use-embed-mode';

vi.mock('../use-mentors/use-mentor-settings');
vi.mock('../use-model-file-upload-capabilities');
vi.mock('../use-embed-mode');

describe('useShowAttachment', () => {
  const mockUseMentorSettings = vi.spyOn(
    useMentorSettingsModule,
    'useMentorSettings',
  );
  const mockUseModelFileUploadCapabilities = vi.spyOn(
    useModelFileUploadCapabilitiesModule,
    'useModelFileUploadCapabilities',
  );
  const mockUseEmbedMode = vi.spyOn(useEmbedModeModule, 'useEmbedMode');

  beforeEach(() => {
    // Mock file upload capabilities to support file uploads by default
    mockUseModelFileUploadCapabilities.mockReturnValue({
      supportsFileUpload: true,
      supportsImages: true,
      supportsDocuments: true,
      supportedImageTypes: ['image/jpg', 'image/jpeg', 'image/png'],
      supportedDocumentTypes: ['text/plain', 'application/pdf'],
      allSupportedTypes: [
        'image/jpg',
        'image/jpeg',
        'image/png',
        'text/plain',
        'application/pdf',
      ],
      maxFileSizeMB: 20,
      maxFilesPerMessage: 10,
      supportsFileUrls: true,
    });

    // Mock embed mode to be false by default
    mockUseEmbedMode.mockReturnValue(false);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('when showAttachment is not specified in settings', () => {
    it('should return false when mentorSettings is undefined', () => {
      mockUseMentorSettings.mockReturnValue({
        isLoading: false,
        data: undefined as any,
      });

      const { result } = renderHook(() => useShowAttachment());
      expect(result.current).toBe(false);
    });

    it('should return false when mentorSettings is null', () => {
      mockUseMentorSettings.mockReturnValue({
        isLoading: false,
        data: null as any,
      });

      const { result } = renderHook(() => useShowAttachment());
      expect(result.current).toBe(false);
    });

    it('should return false when mentorSettings exists but showAttachment is undefined', () => {
      mockUseMentorSettings.mockReturnValue({
        isLoading: false,
        data: {
          mentorName: 'Test Mentor',
        } as any,
      });

      const { result } = renderHook(() => useShowAttachment());
      expect(result.current).toBe(false);
    });

    it('should return false when showAttachment is null', () => {
      mockUseMentorSettings.mockReturnValue({
        isLoading: false,
        data: {
          showAttachment: null as any,
        } as any,
      });

      const { result } = renderHook(() => useShowAttachment());
      expect(result.current).toBe(false);
    });

    it('should return false when showAttachment is a non-boolean value (string)', () => {
      mockUseMentorSettings.mockReturnValue({
        isLoading: false,
        data: {
          showAttachment: 'true' as any,
        } as any,
      });

      const { result } = renderHook(() => useShowAttachment());
      expect(result.current).toBe(false);
    });

    it('should return false when showAttachment is a non-boolean value (number)', () => {
      mockUseMentorSettings.mockReturnValue({
        isLoading: false,
        data: {
          showAttachment: 1 as any,
        } as any,
      });

      const { result } = renderHook(() => useShowAttachment());
      expect(result.current).toBe(false);
    });

    it('should return false when showAttachment is a non-boolean value (object)', () => {
      mockUseMentorSettings.mockReturnValue({
        isLoading: false,
        data: {
          showAttachment: {} as any,
        } as any,
      });

      const { result } = renderHook(() => useShowAttachment());
      expect(result.current).toBe(false);
    });
  });

  describe('when showAttachment is explicitly set to true', () => {
    it('should return true', () => {
      mockUseMentorSettings.mockReturnValue({
        isLoading: false,
        data: {
          showAttachment: true,
        } as any,
      });

      const { result } = renderHook(() => useShowAttachment());
      expect(result.current).toBe(true);
    });
  });

  describe('when showAttachment is explicitly set to false', () => {
    it('should return false', () => {
      mockUseMentorSettings.mockReturnValue({
        isLoading: false,
        data: {
          showAttachment: false,
        } as any,
      });

      const { result } = renderHook(() => useShowAttachment());
      expect(result.current).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle empty object for data', () => {
      mockUseMentorSettings.mockReturnValue({
        isLoading: false,
        data: {} as any,
      });

      const { result } = renderHook(() => useShowAttachment());
      expect(result.current).toBe(false);
    });

    it('should handle data with other properties but no showAttachment', () => {
      mockUseMentorSettings.mockReturnValue({
        isLoading: false,
        data: {
          mentorName: 'Test',
          profileImage: 'image.png',
          greetingMethod: 'text',
        } as any,
      });

      const { result } = renderHook(() => useShowAttachment());
      expect(result.current).toBe(false);
    });

    it('should reactively update when settings change', () => {
      mockUseMentorSettings.mockReturnValue({
        isLoading: false,
        data: {
          showAttachment: true,
        } as any,
      });

      const { result, rerender } = renderHook(() => useShowAttachment());
      expect(result.current).toBe(true);

      // Update mock to return false
      mockUseMentorSettings.mockReturnValue({
        isLoading: false,
        data: {
          showAttachment: false,
        } as any,
      });

      rerender();
      expect(result.current).toBe(false);
    });

    it('should return false when model does not support file uploads', () => {
      mockUseModelFileUploadCapabilities.mockReturnValue({
        supportsFileUpload: false,
        supportsImages: false,
        supportsDocuments: false,
        supportedImageTypes: [],
        supportedDocumentTypes: [],
        allSupportedTypes: [],
        maxFileSizeMB: 0,
        maxFilesPerMessage: 0,
        supportsFileUrls: false,
      });

      mockUseMentorSettings.mockReturnValue({
        isLoading: false,
        data: {
          showAttachment: true,
        } as any,
      });

      const { result } = renderHook(() => useShowAttachment());
      expect(result.current).toBe(false);
    });
  });

  describe('embed mode behavior', () => {
    it('should use embedShowAttachment when in embed mode', () => {
      mockUseEmbedMode.mockReturnValue(true);
      mockUseMentorSettings.mockReturnValue({
        isLoading: false,
        data: {
          showAttachment: false,
          embedShowAttachment: true,
        } as any,
      });

      const { result } = renderHook(() => useShowAttachment());
      expect(result.current).toBe(true);
    });

    it('should use showAttachment when not in embed mode', () => {
      mockUseEmbedMode.mockReturnValue(false);
      mockUseMentorSettings.mockReturnValue({
        isLoading: false,
        data: {
          showAttachment: true,
          embedShowAttachment: false,
        } as any,
      });

      const { result } = renderHook(() => useShowAttachment());
      expect(result.current).toBe(true);
    });

    it('should return false when embedShowAttachment is false in embed mode', () => {
      mockUseEmbedMode.mockReturnValue(true);
      mockUseMentorSettings.mockReturnValue({
        isLoading: false,
        data: {
          showAttachment: true,
          embedShowAttachment: false,
        } as any,
      });

      const { result } = renderHook(() => useShowAttachment());
      expect(result.current).toBe(false);
    });
  });
});
