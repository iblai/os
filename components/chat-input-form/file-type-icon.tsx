import {
  FileText,
  FileIcon as FilePdf,
  FileImage,
  FileAudio,
  FileVideo,
  FileSpreadsheet,
  FileArchive,
  FileCode,
  File,
} from 'lucide-react';

interface FileTypeIconProps {
  fileName: string;
  fileType: string;
}

export function FileTypeIcon({ fileName, fileType }: FileTypeIconProps) {
  const type = fileType.toLowerCase();
  const name = fileName.toLowerCase();
  const extension = name.split('.').pop() || '';

  // Check by MIME type first
  if (type.includes('pdf')) {
    return <FilePdf className="h-5 w-5 text-blue-500" />;
  } else if (type.includes('image')) {
    return <FileImage className="h-5 w-5 text-blue-500" />;
  } else if (type.includes('audio')) {
    return <FileAudio className="h-5 w-5 text-blue-500" />;
  } else if (type.includes('video')) {
    return <FileVideo className="h-5 w-5 text-blue-500" />;
  } else if (type.includes('spreadsheet') || type.includes('excel') || type.includes('csv')) {
    return <FileSpreadsheet className="h-5 w-5 text-blue-500" />;
  } else if (type.includes('zip') || type.includes('compressed') || type.includes('archive')) {
    return <FileArchive className="h-5 w-5 text-blue-500" />;
  } else if (
    type.includes('javascript') ||
    type.includes('typescript') ||
    type.includes('html') ||
    type.includes('css') ||
    type.includes('json')
  ) {
    return <FileCode className="h-5 w-5 text-blue-500" />;
  }

  // If MIME type doesn't match, check by extension
  if (['doc', 'docx', 'txt', 'rtf'].includes(extension)) {
    return <FileText className="h-5 w-5 text-blue-500" />;
  } else if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(extension)) {
    return <FileImage className="h-5 w-5 text-blue-500" />;
  } else if (['pdf'].includes(extension)) {
    return <FilePdf className="h-5 w-5 text-blue-500" />;
  } else if (['mp3', 'wav', 'ogg', 'flac'].includes(extension)) {
    return <FileAudio className="h-5 w-5 text-blue-500" />;
  } else if (['mp4', 'webm', 'avi', 'mov'].includes(extension)) {
    return <FileVideo className="h-5 w-5 text-blue-500" />;
  } else if (['xls', 'xlsx', 'csv'].includes(extension)) {
    return <FileSpreadsheet className="h-5 w-5 text-blue-500" />;
  } else if (['zip', 'rar', '7z', 'tar', 'gz'].includes(extension)) {
    return <FileArchive className="h-5 w-5 text-blue-500" />;
  } else if (
    ['js', 'ts', 'jsx', 'tsx', 'html', 'css', 'json', 'py', 'java', 'c', 'cpp'].includes(extension)
  ) {
    return <FileCode className="h-5 w-5 text-blue-500" />;
  }

  // Default icon
  return <File className="h-5 w-5 text-blue-500" />;
}
