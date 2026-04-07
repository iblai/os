import { useRef, useState } from 'react';

import { useAddTrainingDocumentMutation } from '@iblai/iblai-js/data-layer';
import { toast } from 'sonner';
import { Loader2, Upload, X } from 'lucide-react';

import { convertFromBytes, maxDatasetFileSizeInMegaBytes } from '@/lib/utils';
import { useParams } from 'next/navigation';
import { useUsername } from '@/hooks/use-user';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ResourceType } from '../resource-types';
import { useNavigate } from '@/hooks/user-navigate';
import { TenantKeyMentorIdParams } from '@/lib/types';
import { extractErrorMessage } from './utils';

type Props = {
  resource: ResourceType;
};

export function LocalFileUploadModal({ resource }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [description, setDescription] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const username = useUsername();
  const { tenantKey, mentorId } = useParams<TenantKeyMentorIdParams>();
  const { getMentorId } = useNavigate();
  const activeMentorId = getMentorId() ?? mentorId;

  const [addTrainingDocument, { isLoading: isAddTrainingDocumentLoading }] =
    useAddTrainingDocumentMutation();

  const isDisabled = isAddTrainingDocumentLoading;
  const maxDatasetFileSize = maxDatasetFileSizeInMegaBytes() * 1024 * 1024;

  const maxFileSize = convertFromBytes(maxDatasetFileSize);

  const isImageFile = (file: File | null): boolean => {
    return file ? file.type.startsWith('image/') : false;
  };

  const handleUploadFile = async () => {
    try {
      if (!file) {
        toast.error('File not found');
        return;
      }
      const formData = new FormData();
      formData.append('file', file);
      await addTrainingDocument({
        org: tenantKey,
        formData: {
          file: file,
          pathway: activeMentorId,
          type: resource.fileType
            ? resource.fileType.toLocaleLowerCase()
            : 'file',
          ...(isImageFile(file) && { user_image_description: description }),
        },
        // @ts-ignore
        userId: username ?? '',
      }).unwrap();
      setFile(null);
      setDescription('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      toast.success('Document has been queued for training');
    } catch (error: unknown) {
      console.error(JSON.stringify(error));
      const errorMessage = extractErrorMessage(
        error,
        'Error adding training document',
      );

      toast.error(errorMessage);
      console.error(JSON.stringify({ tenant: tenantKey, error }));
    }
  };

  const validateFileSize = (file: File): boolean => {
    if (file.size > maxDatasetFileSize) {
      toast.error(`File size exceeds ${maxFileSize.value} ${maxFileSize.unit}`);
      return false;
    }
    return true;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      if (!validateFileSize(e.target.files[0])) {
        e.target.value = '';
        return;
      }
      setFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      if (!validateFileSize(e.dataTransfer.files[0])) {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        return;
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(true);
  };

  const handleSubmit = () => {
    if (file) {
      handleUploadFile();
    }
  };

  return (
    <div className="flex flex-col items-center">
      <div
        className={`w-full max-w-sm border-2 border-dashed ${
          isDraggingFile
            ? 'border-blue-400 bg-blue-50/50 backdrop-blur-sm'
            : 'border-gray-300 bg-gray-50'
        } flex flex-col items-center justify-center rounded-lg p-8 transition-all duration-200 ${
          !isDraggingFile && 'hover:bg-gray-100'
        }`}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="mb-4 rounded-full bg-blue-100 p-3">
          <Upload className="h-8 w-8 text-blue-600" />
        </div>

        <h3 className="mb-1 text-lg font-medium text-gray-700">
          Drag and drop your file here
        </h3>
        <p className="mb-4 text-sm text-gray-500">or</p>

        <label htmlFor="file-upload" className="cursor-pointer">
          <div className="rounded-md bg-gradient-to-r from-blue-600 to-blue-400 px-4 py-2 font-medium text-white transition-colors hover:opacity-90">
            Browse files
          </div>
          <input
            id="file-upload"
            type="file"
            accept={resource.accept}
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileChange}
          />
        </label>

        <p className="mt-4 text-xs text-gray-500">
          Maximum file size: {maxFileSize.value} {maxFileSize.unit}
        </p>

        {file && (
          <>
            <div className="mt-4 flex w-full items-center rounded-md border border-gray-200 bg-white p-3">
              <div className="flex w-full items-center">
                <div className="mr-3 flex-shrink-0 rounded-md bg-blue-100 p-2">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2Z"
                      fill="#4285F4"
                    />
                    <path d="M14 2V8H20L14 2Z" fill="#A1C2FA" />
                  </svg>
                </div>
                <div className="isolate z-50 min-w-0 flex-1 overflow-hidden">
                  <p className="truncate text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-gray-500">
                    {convertFromBytes(file.size).value}{' '}
                    {convertFromBytes(file.size).unit}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setFile(null);
                    setDescription('');
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                  }}
                  className="ml-2 flex-shrink-0 rounded-full p-1 transition-colors hover:bg-gray-100"
                >
                  <X className="h-4 w-4 text-gray-500" />
                </button>
              </div>
            </div>
            {isImageFile(file) && (
              <div className="mt-3 w-full">
                <label
                  htmlFor="image-description"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Description (optional)
                </label>
                <Textarea
                  id="image-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add a description for this image..."
                  className="resize-none"
                  rows={3}
                />
              </div>
            )}
          </>
        )}
      </div>

      <div className="mt-4 flex w-full justify-end">
        <Button
          onClick={handleSubmit}
          disabled={!file || isDisabled}
          className={`${file ? 'bg-gradient-to-r from-blue-600 to-blue-400 text-white' : 'bg-gray-100 text-gray-500'} hover:opacity-90`}
        >
          {isAddTrainingDocumentLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Submitting
            </>
          ) : (
            <>Submit</>
          )}
        </Button>
      </div>
    </div>
  );
}
