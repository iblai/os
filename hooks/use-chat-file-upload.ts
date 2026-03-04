import { useGetFileUploadUrlMutation } from '@iblai/iblai-js/data-layer';
import { selectSessionId } from '@iblai/iblai-js/web-utils';
import { useAppDispatch, useAppSelector } from '@/lib/hooks';
import {
  addFiles,
  updateFileProgress,
  updateFileStatus,
  updateFileUrl,
  updateFileMetadata,
  updateFileRetryCount,
} from '@iblai/iblai-js/web-utils';
import { uploadToS3 } from '@iblai/iblai-js/web-utils';
import { useCallback, useRef } from 'react';
import { RootState } from '@/store';

interface FileUploadCapabilities {
  supportsFileUpload: boolean;
  allSupportedTypes: string[];
  maxFileSizeMB: number;
  maxFilesPerMessage: number;
}

interface UseChatFileUploadProps {
  org: string;
  userId: string;
  errorHandler?: (error: string) => void;
  capabilities?: FileUploadCapabilities;
}

export function useChatFileUpload({
  org,
  userId,
  errorHandler,
  capabilities,
}: UseChatFileUploadProps) {
  const dispatch = useAppDispatch();
  const sessionId = useAppSelector(selectSessionId);
  const attachedFiles = useAppSelector((state: RootState) => state.files.attachedFiles);
  const filesMapRef = useRef<Map<string, File>>(new Map());

  const [getFileUploadUrl] = useGetFileUploadUrlMutation();

  // Validate files based on capabilities
  const validateFiles = useCallback(
    (files: File[]): { valid: File[]; errors: string[] } => {
      const valid: File[] = [];
      const errors: string[] = [];

      if (!capabilities) {
        // No capabilities provided, skip validation
        return { valid: files, errors };
      }

      if (!capabilities.supportsFileUpload) {
        errors.push('This model does not support file uploads');
        return { valid, errors };
      }

      // Check max files per message
      const currentFileCount = attachedFiles.length;
      const totalFiles = currentFileCount + files.length;
      if (totalFiles > capabilities.maxFilesPerMessage) {
        errors.push(
          `Cannot upload more than ${capabilities.maxFilesPerMessage} files per message.`,
        );
        return { valid, errors };
      }

      files.forEach((file) => {
        // Check file size
        const fileSizeMB = file.size / (1024 * 1024);
        if (fileSizeMB > capabilities.maxFileSizeMB) {
          errors.push(
            `${file.name}: File size (${fileSizeMB.toFixed(2)}MB) exceeds maximum of ${capabilities.maxFileSizeMB}MB`,
          );
          return;
        }

        // Check file type
        // const fileType = file.type;
        // if (
        //   capabilities.allSupportedTypes.length > 0 &&
        //   !capabilities.allSupportedTypes.includes(fileType)
        // ) {
        //   errors.push(`${file.name}: File type ${fileType || 'unknown'} is not supported`);
        //   return;
        // }

        valid.push(file);
      });

      return { valid, errors };
    },
    [capabilities, attachedFiles.length],
  );

  const uploadFiles = async (files: File[]) => {
    // Validate files before processing
    const { valid, errors } = validateFiles(files);

    // Report validation errors
    if (errors.length > 0) {
      errors.forEach((error) => errorHandler?.(error));
    }

    // If no valid files, return early
    if (valid.length === 0) {
      return;
    }

    // Step 1: Save only valid files to the redux state with 'pending' status
    const fileIds: string[] = [];
    const filesWithIds = valid.map((file) => {
      const id = Math.random().toString(36).substring(2, 9);
      fileIds.push(id);
      // Store file reference for potential retry
      filesMapRef.current.set(id, file);
      return {
        id,
        file,
        uploadProgress: 0,
        uploadStatus: 'pending' as const,
        uploadUrl: '',
      };
    });

    dispatch(
      addFiles(
        filesWithIds.map(({ id, file, uploadProgress, uploadStatus, uploadUrl }) => ({
          id,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          uploadProgress,
          uploadStatus,
          uploadUrl,
        })),
      ),
    );

    // Step 2: Get the upload URL for each valid file (in parallel)
    const uploadUrlPromises = valid.map(async (file, index) => {
      const fileId = fileIds[index];
      try {
        const response = await getFileUploadUrl({
          org,
          userId,
          requestBody: {
            session_id: sessionId,
            file_name: file.name,
            content_type: file.type,
            file_size: file.size,
          },
        }).unwrap();

        // Update the file with the upload URL and metadata
        dispatch(updateFileUrl({ id: fileId, uploadUrl: response.upload_url }));
        dispatch(
          updateFileMetadata({
            id: fileId,
            fileKey: response.file_key,
            fileId: response.file_id,
          }),
        );

        return { fileId, file, response, success: true };
      } catch (error) {
        console.error(`Failed to get upload URL for ${file.name}:`, error);
        dispatch(updateFileStatus({ id: fileId, status: 'error' }));
        errorHandler?.(`Failed to get upload URL for ${file.name}`);
        return { fileId, file, response: null, success: false };
      }
    });

    const uploadUrlResults = await Promise.all(uploadUrlPromises);

    // Step 3: Upload files that successfully got upload URLs
    const uploadPromises = uploadUrlResults
      .filter((result) => result.success && result.response)
      .map(async ({ fileId, file, response }) => {
        try {
          // Update status to 'uploading'
          dispatch(updateFileStatus({ id: fileId, status: 'uploading' }));

          // Step 4: Upload to S3 with progress tracking
          await uploadToS3(response!.upload_url, file, file.type, (progress) => {
            // Step 5: Update progress in Redux state
            dispatch(updateFileProgress({ id: fileId, progress }));
          });

          // Update status to 'success' when upload completes
          dispatch(updateFileStatus({ id: fileId, status: 'success' }));
          dispatch(updateFileProgress({ id: fileId, progress: 100 }));
        } catch (error) {
          console.error(`Failed to upload ${file.name}:`, error);
          dispatch(updateFileStatus({ id: fileId, status: 'error' }));
          errorHandler?.(`Failed to upload ${file.name}`);
        }
      });

    await Promise.all(uploadPromises);
  };

  const retryUpload = useCallback(
    async (fileId: string) => {
      const file = filesMapRef.current.get(fileId);
      if (!file) {
        console.error(`File not found for retry: ${fileId}`);
        return;
      }

      try {
        // Get current retry count and increment
        const currentFile = attachedFiles.find((f) => f.id === fileId);
        const retryCount = (currentFile?.retryCount || 0) + 1;

        // Update retry count and reset status
        dispatch(updateFileRetryCount({ id: fileId, retryCount }));
        dispatch(updateFileStatus({ id: fileId, status: 'pending' }));
        dispatch(updateFileProgress({ id: fileId, progress: 0 }));

        // Step 1: Get upload URL
        const response = await getFileUploadUrl({
          org,
          userId,
          requestBody: {
            session_id: sessionId,
            file_name: file.name,
            content_type: file.type,
            file_size: file.size,
          },
        }).unwrap();

        // Update the file with the upload URL and metadata
        dispatch(updateFileUrl({ id: fileId, uploadUrl: response.upload_url }));
        dispatch(
          updateFileMetadata({
            id: fileId,
            fileKey: response.file_key,
            fileId: response.file_id,
          }),
        );

        // Step 2: Upload to S3
        dispatch(updateFileStatus({ id: fileId, status: 'uploading' }));
        await uploadToS3(response.upload_url, file, file.type, (progress) => {
          dispatch(updateFileProgress({ id: fileId, progress }));
        });

        // Success
        dispatch(updateFileStatus({ id: fileId, status: 'success' }));
        dispatch(updateFileProgress({ id: fileId, progress: 100 }));
      } catch (error) {
        console.error(`Failed to retry upload for ${file.name}:`, error);
        dispatch(updateFileStatus({ id: fileId, status: 'error' }));
        errorHandler?.(`Failed to retry upload for ${file.name}`);
      }
    },
    [attachedFiles, dispatch, errorHandler, getFileUploadUrl, org, sessionId, userId],
  );

  return { uploadFiles, retryUpload };
}
