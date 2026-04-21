import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { X, RotateCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FileTypeIcon } from './file-type-icon';

interface AttachedFile {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadStatus: 'pending' | 'uploading' | 'processing' | 'success' | 'error';
  uploadProgress: number;
  retryCount?: number;
}

interface FileAttachmentsListProps {
  attachedFiles: AttachedFile[];
  onRemoveFile: (id: string) => void;
  onRetryFile: (id: string) => void;
}

export function FileAttachmentsList({
  attachedFiles,
  onRemoveFile,
  onRetryFile,
}: FileAttachmentsListProps) {
  if (!attachedFiles || attachedFiles.length === 0) return null;

  const statusColors = {
    pending: 'bg-gray-100',
    uploading: 'bg-blue-50 border-blue-200',
    processing: 'bg-yellow-50 border-yellow-200',
    success: 'bg-blue-50 border-blue-200',
    error: 'bg-red-50 border-red-200',
  };

  return (
    <div className="flex flex-wrap gap-2 px-3 pt-3">
      {attachedFiles.map((file) => (
        <div key={file.id} className="relative">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className={cn(
                    'inline-flex max-w-fit cursor-pointer items-center gap-2 rounded-lg border p-2 transition-colors',
                    statusColors[file.uploadStatus],
                  )}
                >
                  <div className="relative flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                    <FileTypeIcon
                      fileName={file.fileName}
                      fileType={file.fileType}
                    />
                    {file.uploadStatus === 'uploading' && (
                      <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-blue-100/90">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                      </div>
                    )}
                    {file.uploadStatus === 'success' && (
                      <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full border-2 border-white bg-blue-500" />
                    )}
                    {file.uploadStatus === 'error' && (
                      <div className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full border-2 border-white bg-red-500">
                        <X className="h-2 w-2 text-white" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="max-w-[150px] truncate text-sm font-medium text-gray-900">
                      {file.fileName}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-xs text-gray-500 uppercase">
                        {file.fileType.split('/')[1] || 'FILE'}
                      </div>
                      {file.uploadStatus === 'uploading' && (
                        <span className="text-xs font-medium text-blue-600">
                          {file.uploadProgress}%
                          {file.retryCount &&
                            file.retryCount > 0 &&
                            ` (retry ${file.retryCount})`}
                        </span>
                      )}
                      {file.uploadStatus === 'error' && (
                        <button
                          onClick={() => onRetryFile(file.id)}
                          className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
                        >
                          <RotateCw className="h-3 w-3" />
                          Retry
                        </button>
                      )}
                    </div>
                    {file.uploadStatus === 'uploading' && (
                      <div className="mt-1 h-1 w-[150px] overflow-hidden rounded-full bg-gray-200">
                        <div
                          className="h-full bg-blue-500 transition-all duration-300 ease-out"
                          style={{ width: `${file.uploadProgress}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent className="ibl-tooltip-content">
                <p>{file.fileName}</p>
                <p className="mt-1 text-xs text-gray-500 capitalize">
                  Status: {file.uploadStatus}
                  {file.uploadStatus === 'uploading' &&
                    ` (${file.uploadProgress}%)`}
                  {file.retryCount && file.retryCount > 0 && (
                    <span className="block text-yellow-600">
                      Retry attempt {file.retryCount}
                    </span>
                  )}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button
            variant="ghost"
            size="icon"
            className="absolute -top-2 -right-2 z-10 h-5 w-5 rounded-[5px] border border-gray-200 bg-white p-0 shadow-sm hover:bg-gray-200"
            onClick={() => onRemoveFile(file.id)}
            disabled={file.uploadStatus === 'uploading'}
          >
            <X className="h-3 w-3" />
            <span className="sr-only">Remove file</span>
          </Button>
        </div>
      ))}
    </div>
  );
}
