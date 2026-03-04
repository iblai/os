import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { MENTOR_CHAT_DOCUMENTS_EXTENSIONS } from '@iblai/iblai-js/web-utils';
import { useModelFileUploadCapabilities } from '@/hooks/use-model-file-upload-capabilities';
import { useChatFileUpload } from '@/hooks/use-chat-file-upload';
import { isFileAccepted } from '@/components/utils';

interface UseFileDragDropOptions {
  org: string;
  userId: string;
}

export function useFileDragDrop({ org, userId }: UseFileDragDropOptions) {
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const fileUploadCapabilities = useModelFileUploadCapabilities();

  const { uploadFiles } = useChatFileUpload({
    org,
    userId,
    errorHandler: (error) => toast.error(error),
    capabilities: {
      supportsFileUpload: fileUploadCapabilities.supportsFileUpload,
      allSupportedTypes: fileUploadCapabilities.allSupportedTypes,
      maxFileSizeMB: fileUploadCapabilities.maxFileSizeMB,
      maxFilesPerMessage: fileUploadCapabilities.maxFilesPerMessage,
    },
  });

  // Prevent the browser from opening files in a new window when dropped anywhere
  useEffect(() => {
    const preventDefaultDrop = (e: DragEvent) => {
      e.preventDefault();
    };
    window.addEventListener('dragover', preventDefaultDrop);
    window.addEventListener('drop', preventDefaultDrop);
    return () => {
      window.removeEventListener('dragover', preventDefaultDrop);
      window.removeEventListener('drop', preventDefaultDrop);
    };
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer?.types.includes('Files')) {
      setIsDraggingFile(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    // Only hide overlay when leaving the container entirely
    if (e.relatedTarget === null || !e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDraggingFile(false);
    }
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDraggingFile(false);

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const allFiles = Array.from(e.dataTransfer.files);

        const acceptedTypes =
          fileUploadCapabilities.allSupportedTypes.length > 0
            ? fileUploadCapabilities.allSupportedTypes
            : MENTOR_CHAT_DOCUMENTS_EXTENSIONS;

        const files = allFiles.filter((file) => isFileAccepted(file, acceptedTypes));

        if (files.length === 0) {
          toast.error('The dropped file type is not supported.');
          return;
        }

        if (files.length < allFiles.length) {
          const rejectedCount = allFiles.length - files.length;
          toast.error(
            `${rejectedCount} file${rejectedCount > 1 ? 's were' : ' was'} rejected due to unsupported type.`,
          );
        }

        await uploadFiles(files);
      }
    },
    [uploadFiles, fileUploadCapabilities.allSupportedTypes],
  );

  return {
    isDraggingFile,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  };
}
