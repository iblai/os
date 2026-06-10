'use client';

import { useEffect, useState } from 'react';

import { FileCard } from './file-card';

type Props = {
  url: string;
  fileName: string;
  setPreviewImage: (url: string) => void;
};

export function ImageMessage({ url, fileName, setPreviewImage }: Props) {
  const [hasError, setHasError] = useState(false);

  // Reset the error state whenever the url changes. The first url an attachment
  // renders with can be a non-viewable presigned PUT upload URL (which makes the
  // <img> fire onError); a viewable url (the local object-URL preview, or the
  // server's processed file_url) often arrives a moment later via a re-render.
  // Without this reset, hasError stays sticky and the message is stuck showing
  // the FileCard fallback forever even though a good url is now available. This
  // is what made camera-captured images render as a card.
  useEffect(() => {
    setHasError(false);
  }, [url]);

  if (hasError || !url) {
    return <FileCard fileName={fileName} fileType="image/*" />;
  }

  return (
    <div className="h-full max-h-64 w-full max-w-96 overflow-hidden rounded-xl">
      <div className="relative">
        <img
          src={url}
          alt={fileName}
          className="h-auto w-full cursor-pointer rounded-xl object-contain"
          onClick={() => setPreviewImage(url)}
          onError={() => setHasError(true)}
        />
      </div>
    </div>
  );
}
