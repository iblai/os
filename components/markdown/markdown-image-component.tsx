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
  // Seeded from a string `src` rather than left empty: the effect below cannot
  // run before the first paint, so starting at '' rendered the "unavailable"
  // fallback for one frame on every image. A Blob still needs the effect,
  // because its object URL can only be created (and revoked) there.
  const [imageSrc, setImageSrc] = useState<string>(
    typeof src === 'string' ? src : '',
  );

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
      // A <span> rather than a <div>: markdown puts an image inside a
      // paragraph, and flow content nested in <p> is invalid HTML that React
      // reports as a hydration error. `inline-flex` keeps the card's layout.
      <span
        className="inline-flex max-h-96 w-auto flex-col items-center justify-center gap-2 rounded border border-gray-300 bg-gray-50 p-8"
        title={title}
      >
        <ImageOff className="h-12 w-12 text-gray-400" />
        <span className="text-sm text-gray-500">
          {alt || 'Image unavailable'}
        </span>
      </span>
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
