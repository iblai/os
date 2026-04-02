'use client';

import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, File, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface FileUploadProps {
  onFilesUploaded?: (files: File[]) => void;
  maxFiles?: number;
  acceptedFileTypes?: Record<string, string[]>;
}

export function FileUpload({
  onFilesUploaded,
  maxFiles = 5,
  acceptedFileTypes = {
    'application/pdf': ['.pdf'],
    'text/plain': ['.txt'],
    'text/csv': ['.csv'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
      '.docx',
    ],
    'application/msword': ['.doc'],
  },
}: FileUploadProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [isDraggingOverDocument, setIsDraggingOverDocument] = useState(false);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const newFiles = [...files];

      acceptedFiles.forEach((file) => {
        if (
          newFiles.length < maxFiles &&
          !newFiles.some((f) => f.name === file.name)
        ) {
          newFiles.push(file);
        }
      });

      setFiles(newFiles);
      if (onFilesUploaded) {
        onFilesUploaded(newFiles);
      }
    },
    [files, maxFiles, onFilesUploaded],
  );

  const removeFile = (fileName: string) => {
    const newFiles = files.filter((file) => file.name !== fileName);
    setFiles(newFiles);
    if (onFilesUploaded) {
      onFilesUploaded(newFiles);
    }
  };

  const { getRootProps, getInputProps, open } = useDropzone({
    onDrop,
    maxFiles,
    accept: acceptedFileTypes,
    noClick: true,
    noKeyboard: true,
  });

  // Handle document-level drag events
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      setIsDraggingOverDocument(true);
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      // Only set to false if we're leaving the document
      if (
        e.relatedTarget === null ||
        (e.relatedTarget as Node).nodeName === 'HTML'
      ) {
        setIsDraggingOverDocument(false);
      }
    };

    const handleDrop = () => {
      setIsDraggingOverDocument(false);
    };

    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('dragleave', handleDragLeave);
    document.addEventListener('drop', handleDrop);

    return () => {
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('dragleave', handleDragLeave);
      document.removeEventListener('drop', handleDrop);
    };
  }, []);

  return (
    <>
      {/* Full-screen glassy overlay that only appears during drag */}
      {isDraggingOverDocument && (
        <div
          {...getRootProps()}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
        >
          <input {...getInputProps()} />
          <div className="mx-auto max-w-2xl transform rounded-xl border border-white/20 bg-white/80 p-12 text-center shadow-2xl backdrop-blur-md transition-all dark:bg-gray-800/80">
            <div className="flex flex-col items-center justify-center gap-6">
              <div className="bg-primary/10 rounded-full p-6">
                <Upload className="text-primary h-16 w-16" />
              </div>
              <div>
                <h3 className="text-2xl font-bold">Drop your files here</h3>
                <p className="mt-2 text-gray-500">
                  Release to upload your documents
                </p>
              </div>
              <div className="mt-2 text-sm text-gray-500">
                Supported file types: PDF, TXT, CSV, DOC, DOCX
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Regular upload button when not dragging */}
      <div className="mx-auto w-full max-w-3xl">
        <Card
          className="hover:border-primary/50 cursor-pointer border border-dashed transition-colors"
          onClick={open}
        >
          <CardContent className="p-6 text-center">
            <div className="flex flex-col items-center justify-center gap-4 py-4">
              <div className="bg-primary/10 rounded-full p-4">
                <Upload className="text-primary h-8 w-8" />
              </div>
              <div>
                <p className="text-lg font-medium">Upload your documents</p>
                <p className="mt-1 text-sm text-gray-500">
                  Drag & drop files anywhere on the page or click to browse
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Display uploaded files */}
        {files.length > 0 && (
          <Card className="mt-6">
            <CardContent className="p-4">
              <h3 className="mb-3 font-medium">
                Uploaded Files ({files.length}/{maxFiles})
              </h3>
              <ul className="space-y-2">
                {files.map((file) => (
                  <li
                    key={file.name}
                    className="flex items-center justify-between rounded bg-gray-50 p-2 dark:bg-gray-800"
                  >
                    <div className="flex items-center">
                      <File className="text-primary mr-2 h-4 w-4" />
                      <span className="max-w-[250px] truncate text-sm">
                        {file.name}
                      </span>
                      <span className="ml-2 text-xs text-gray-500">
                        ({(file.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(file.name)}
                      className="h-8 w-8 p-0"
                    >
                      <X className="h-4 w-4" />
                      <span className="sr-only">Remove file</span>
                    </Button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
