import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useModelFileUploadCapabilities } from '../use-model-file-upload-capabilities';

// Mock useMentorSettings
const mockUseMentorSettings = vi.fn();
vi.mock('../use-mentors/use-mentor-settings', () => ({
  useMentorSettings: () => mockUseMentorSettings(),
}));

describe('useModelFileUploadCapabilities', () => {
  beforeEach(() => {
    mockUseMentorSettings.mockReset();
  });

  describe('default capabilities', () => {
    it('should return default capabilities when no mentor settings', () => {
      mockUseMentorSettings.mockReturnValue({ data: null });

      const { result } = renderHook(() => useModelFileUploadCapabilities());

      expect(result.current.supportsFileUpload).toBe(false);
      expect(result.current.supportsImages).toBe(false);
      expect(result.current.supportsDocuments).toBe(false);
      expect(result.current.supportedImageTypes).toEqual([]);
      expect(result.current.supportedDocumentTypes).toEqual([]);
      expect(result.current.allSupportedTypes).toEqual([]);
      expect(result.current.maxFileSizeMB).toBe(0);
      expect(result.current.maxFilesPerMessage).toBe(0);
      expect(result.current.supportsFileUrls).toBe(false);
    });

    it('should return default capabilities when llmConfig is undefined', () => {
      mockUseMentorSettings.mockReturnValue({
        data: { llmProvider: undefined, llmConfig: undefined },
      });

      const { result } = renderHook(() => useModelFileUploadCapabilities());

      expect(result.current.supportsFileUpload).toBe(false);
    });
  });

  describe('OpenAI provider', () => {
    it('should return provider defaults for openai', () => {
      mockUseMentorSettings.mockReturnValue({
        data: { llmProvider: 'openai', llmConfig: null },
      });

      const { result } = renderHook(() => useModelFileUploadCapabilities());

      expect(result.current.supportsFileUpload).toBe(true);
      expect(result.current.supportsImages).toBe(true);
      expect(result.current.supportsDocuments).toBe(true);
      expect(result.current.maxFileSizeMB).toBe(20);
      expect(result.current.maxFilesPerMessage).toBe(10);
      expect(result.current.supportsFileUrls).toBe(true);
    });

    it('should return provider defaults for OpenAI (case insensitive)', () => {
      mockUseMentorSettings.mockReturnValue({
        data: { llmProvider: 'OpenAI', llmConfig: null },
      });

      const { result } = renderHook(() => useModelFileUploadCapabilities());

      expect(result.current.supportsFileUpload).toBe(true);
    });

    it('should use multimodal_capabilities when available for openai', () => {
      mockUseMentorSettings.mockReturnValue({
        data: {
          llmProvider: 'openai',
          llmConfig: {
            is_multimodal: true,
            multimodal_capabilities: {
              supports_file_uploads: true,
              max_file_size_mb: 50,
              max_files_per_message: 20,
              supports_file_urls: true,
              supported_file_types: {
                images: ['image/png', 'image/jpeg'],
                documents: ['application/pdf'],
              },
            },
          },
        },
      });

      const { result } = renderHook(() => useModelFileUploadCapabilities());

      expect(result.current.supportsFileUpload).toBe(true);
      expect(result.current.maxFileSizeMB).toBe(50);
      expect(result.current.maxFilesPerMessage).toBe(20);
      expect(result.current.supportedImageTypes).toEqual([
        'image/png',
        'image/jpeg',
      ]);
      expect(result.current.supportedDocumentTypes).toEqual([
        'application/pdf',
      ]);
    });
  });

  describe('Google provider', () => {
    it('should return provider defaults for google', () => {
      mockUseMentorSettings.mockReturnValue({
        data: { llmProvider: 'google', llmConfig: null },
      });

      const { result } = renderHook(() => useModelFileUploadCapabilities());

      expect(result.current.supportsFileUpload).toBe(true);
      expect(result.current.supportsImages).toBe(true);
      expect(result.current.supportsDocuments).toBe(true);
    });

    it('should return provider defaults for Google (case insensitive)', () => {
      mockUseMentorSettings.mockReturnValue({
        data: { llmProvider: 'GOOGLE', llmConfig: null },
      });

      const { result } = renderHook(() => useModelFileUploadCapabilities());

      expect(result.current.supportsFileUpload).toBe(true);
    });
  });

  describe('non-OpenAI/Google providers', () => {
    it('should return defaults when llmConfig is missing', () => {
      mockUseMentorSettings.mockReturnValue({
        data: { llmProvider: 'anthropic', llmConfig: null },
      });

      const { result } = renderHook(() => useModelFileUploadCapabilities());

      expect(result.current.supportsFileUpload).toBe(false);
    });

    it('should return defaults when model is not multimodal', () => {
      mockUseMentorSettings.mockReturnValue({
        data: {
          llmProvider: 'anthropic',
          llmConfig: {
            is_multimodal: false,
          },
        },
      });

      const { result } = renderHook(() => useModelFileUploadCapabilities());

      expect(result.current.supportsFileUpload).toBe(false);
    });

    it('should return defaults when multimodal_capabilities is missing', () => {
      mockUseMentorSettings.mockReturnValue({
        data: {
          llmProvider: 'anthropic',
          llmConfig: {
            is_multimodal: true,
            multimodal_capabilities: null,
          },
        },
      });

      const { result } = renderHook(() => useModelFileUploadCapabilities());

      expect(result.current.supportsFileUpload).toBe(false);
    });

    it('should return defaults when supports_file_uploads is false', () => {
      mockUseMentorSettings.mockReturnValue({
        data: {
          llmProvider: 'anthropic',
          llmConfig: {
            is_multimodal: true,
            multimodal_capabilities: {
              supports_file_uploads: false,
            },
          },
        },
      });

      const { result } = renderHook(() => useModelFileUploadCapabilities());

      expect(result.current.supportsFileUpload).toBe(false);
    });

    it('should return capabilities from llmConfig for other providers', () => {
      mockUseMentorSettings.mockReturnValue({
        data: {
          llmProvider: 'anthropic',
          llmConfig: {
            is_multimodal: true,
            multimodal_capabilities: {
              supports_file_uploads: true,
              max_file_size_mb: 25,
              max_files_per_message: 5,
              supports_file_urls: false,
              supported_file_types: {
                images: ['image/png'],
                documents: ['text/plain'],
              },
            },
          },
        },
      });

      const { result } = renderHook(() => useModelFileUploadCapabilities());

      expect(result.current.supportsFileUpload).toBe(true);
      expect(result.current.supportsImages).toBe(true);
      expect(result.current.supportsDocuments).toBe(true);
      expect(result.current.maxFileSizeMB).toBe(25);
      expect(result.current.maxFilesPerMessage).toBe(5);
      expect(result.current.supportsFileUrls).toBe(false);
      expect(result.current.supportedImageTypes).toEqual(['image/png']);
      expect(result.current.supportedDocumentTypes).toEqual(['text/plain']);
    });
  });

  describe('edge cases', () => {
    it('should handle empty supported_file_types', () => {
      mockUseMentorSettings.mockReturnValue({
        data: {
          llmProvider: 'anthropic',
          llmConfig: {
            is_multimodal: true,
            multimodal_capabilities: {
              supports_file_uploads: true,
              max_file_size_mb: 10,
              max_files_per_message: 1,
              supports_file_urls: true,
              supported_file_types: {},
            },
          },
        },
      });

      const { result } = renderHook(() => useModelFileUploadCapabilities());

      expect(result.current.supportsFileUpload).toBe(true);
      expect(result.current.supportsImages).toBe(false);
      expect(result.current.supportsDocuments).toBe(false);
      expect(result.current.allSupportedTypes).toEqual([]);
    });

    it('should handle only images supported', () => {
      mockUseMentorSettings.mockReturnValue({
        data: {
          llmProvider: 'anthropic',
          llmConfig: {
            is_multimodal: true,
            multimodal_capabilities: {
              supports_file_uploads: true,
              max_file_size_mb: 10,
              max_files_per_message: 1,
              supports_file_urls: true,
              supported_file_types: {
                images: ['image/png'],
              },
            },
          },
        },
      });

      const { result } = renderHook(() => useModelFileUploadCapabilities());

      expect(result.current.supportsImages).toBe(true);
      expect(result.current.supportsDocuments).toBe(false);
      expect(result.current.allSupportedTypes).toEqual(['image/png']);
    });

    it('should handle only documents supported', () => {
      mockUseMentorSettings.mockReturnValue({
        data: {
          llmProvider: 'anthropic',
          llmConfig: {
            is_multimodal: true,
            multimodal_capabilities: {
              supports_file_uploads: true,
              max_file_size_mb: 10,
              max_files_per_message: 1,
              supports_file_urls: true,
              supported_file_types: {
                documents: ['application/pdf'],
              },
            },
          },
        },
      });

      const { result } = renderHook(() => useModelFileUploadCapabilities());

      expect(result.current.supportsImages).toBe(false);
      expect(result.current.supportsDocuments).toBe(true);
      expect(result.current.allSupportedTypes).toEqual(['application/pdf']);
    });
  });
});
