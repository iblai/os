import { useMemo } from 'react';
import { useMentorSettings } from './use-mentors/use-mentor-settings';

interface MultimodalCapabilities {
  max_file_size_mb: number;
  supports_file_urls: boolean;
  supported_file_types: {
    images?: string[];
    documents?: string[];
  };
  max_files_per_message: number;
  supports_file_uploads: boolean;
}

interface LLMConfig {
  llm_name: string;
  description: string;
  display_name: string;
  is_multimodal: boolean;
  training_data: string;
  context_window: string;
  multimodal_capabilities?: MultimodalCapabilities;
}

interface FileUploadCapabilities {
  supportsFileUpload: boolean;
  supportsImages: boolean;
  supportsDocuments: boolean;
  supportedImageTypes: string[];
  supportedDocumentTypes: string[];
  allSupportedTypes: string[];
  maxFileSizeMB: number;
  maxFilesPerMessage: number;
  supportsFileUrls: boolean;
}

/**
 * Hook to determine file upload capabilities based on the LLM config
 * @returns File upload capabilities for the current model
 *
 * @example
 * ```tsx
 * const capabilities = useModelFileUploadCapabilities();
 *
 * if (capabilities.supportsFileUpload) {
 *   console.log('Max file size:', capabilities.maxFileSizeMB, 'MB');
 *   console.log('Supported types:', capabilities.allSupportedTypes);
 *   console.log('Max files per message:', capabilities.maxFilesPerMessage);
 * }
 * ```
 */
export function useModelFileUploadCapabilities(): FileUploadCapabilities {
  const mentorSettings = useMentorSettings();

  return useMemo(() => {
    const defaultCapabilities: FileUploadCapabilities = {
      supportsFileUpload: false,
      supportsImages: false,
      supportsDocuments: false,
      supportedImageTypes: [],
      supportedDocumentTypes: [],
      allSupportedTypes: [],
      maxFileSizeMB: 0,
      maxFilesPerMessage: 0,
      supportsFileUrls: false,
    };

    // Default capabilities for OpenAI and Google providers
    const providerDefaultCapabilities: FileUploadCapabilities = {
      supportsFileUpload: true,
      supportsImages: true,
      supportsDocuments: true,
      supportedImageTypes: ['image/jpg', 'image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      supportedDocumentTypes: ['text/plain', 'application/pdf'],
      allSupportedTypes: [
        'image/jpg',
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'text/plain',
        'application/pdf',
      ],
      maxFileSizeMB: 20,
      maxFilesPerMessage: 10,
      supportsFileUrls: true,
    };

    // Get llmProvider from mentor settings
    const llmProvider = mentorSettings?.data?.llmProvider as string | undefined;
    const llmConfig = mentorSettings?.data?.llmConfig as LLMConfig | undefined;

    // Check if provider is OpenAI or Google - enable file uploads by default
    if (llmProvider) {
      const provider = llmProvider.toLowerCase();
      if (provider === 'openai' || provider === 'google') {
        // If llm_config exists and has multimodal_capabilities, use those
        if (llmConfig?.is_multimodal && llmConfig.multimodal_capabilities?.supports_file_uploads) {
          const capabilities = llmConfig.multimodal_capabilities;
          const supportedImageTypes = capabilities.supported_file_types?.images || [];
          const supportedDocumentTypes = capabilities.supported_file_types?.documents || [];
          const allSupportedTypes = [...supportedImageTypes, ...supportedDocumentTypes];

          return {
            supportsFileUpload: true,
            supportsImages: supportedImageTypes.length > 0,
            supportsDocuments: supportedDocumentTypes.length > 0,
            supportedImageTypes,
            supportedDocumentTypes,
            allSupportedTypes,
            maxFileSizeMB: capabilities.max_file_size_mb,
            maxFilesPerMessage: capabilities.max_files_per_message,
            supportsFileUrls: capabilities.supports_file_urls,
          };
        }

        // Otherwise, use provider defaults
        return providerDefaultCapabilities;
      }
    }

    // For non-OpenAI/Google providers, use llm_config
    if (!llmConfig) {
      return defaultCapabilities;
    }

    // Check if model is multimodal
    if (!llmConfig.is_multimodal) {
      return defaultCapabilities;
    }

    // Get multimodal capabilities
    const capabilities = llmConfig.multimodal_capabilities;

    if (!capabilities || !capabilities.supports_file_uploads) {
      return defaultCapabilities;
    }

    // Extract supported file types
    const supportedImageTypes = capabilities.supported_file_types?.images || [];
    const supportedDocumentTypes = capabilities.supported_file_types?.documents || [];
    const allSupportedTypes = [...supportedImageTypes, ...supportedDocumentTypes];

    return {
      supportsFileUpload: true,
      supportsImages: supportedImageTypes.length > 0,
      supportsDocuments: supportedDocumentTypes.length > 0,
      supportedImageTypes,
      supportedDocumentTypes,
      allSupportedTypes,
      maxFileSizeMB: capabilities.max_file_size_mb,
      maxFilesPerMessage: capabilities.max_files_per_message,
      supportsFileUrls: capabilities.supports_file_urls,
    };
  }, [mentorSettings?.data?.llmConfig, mentorSettings?.data?.llmProvider]);
}
