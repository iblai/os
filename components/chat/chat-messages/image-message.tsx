'use client';

import { useState } from 'react';

import { FileCard } from './file-card';

type Props = {
  url: string;
  fileName: string;
  setPreviewImage: (url: string) => void;
};

export function ImageMessage({ url, fileName, setPreviewImage }: Props) {
  const [hasError, setHasError] = useState(false);

  if (hasError || !url) {
    return <FileCard fileName={fileName} fileType="image/*" />;
  }

  return (
    <div className="overflow-hidden rounded-lg w-full h-full max-w-96 max-h-64">
      <div className="relative">
        <img
          src={url}
          alt={fileName}
          className="w-full h-auto object-contain p-2 cursor-pointer"
          onClick={() => setPreviewImage(url)}
          onError={() => setHasError(true)}
        />
      </div>
    </div>
  );
}
