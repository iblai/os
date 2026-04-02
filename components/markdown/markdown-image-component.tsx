'use client';

import { ImageOff } from 'lucide-react';
import { useEffect, useState } from 'react';

interface MarkdownImageComponentProps {
  src?: string | Blob;
  alt?: string;
  title?: string;
}

export function MarkdownImageComponent({
  src,
  alt,
  title,
}: MarkdownImageComponentProps) {
  const [hasError, setHasError] = useState(false);
  const [imageSrc, setImageSrc] = useState<string>('');

  useEffect(() => {
    if (!src) {
      setImageSrc('');
      return;
    }

    if (typeof src === 'string') {
      setImageSrc(src);
    } else {
      const objectUrl = URL.createObjectURL(src);
      setImageSrc(objectUrl);

      return () => {
        URL.revokeObjectURL(objectUrl);
      };
    }
  }, [src]);

  if (hasError || !imageSrc) {
    return (
      <div
        className="flex max-h-96 w-auto flex-col items-center justify-center gap-2 rounded border border-gray-300 bg-gray-50 p-8"
        title={title}
      >
        <ImageOff className="h-12 w-12 text-gray-400" />
        <span className="text-sm text-gray-500">
          {alt || 'Image unavailable'}
        </span>
      </div>
    );
  }

  return (
    <img
      src={imageSrc}
      alt={alt || ''}
      title={title}
      className="max-h-96 w-auto rounded object-contain"
      onError={() => setHasError(true)}
      loading="lazy"
    />
  );
}
