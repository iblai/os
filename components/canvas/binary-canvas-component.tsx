'use client';

import React, { useEffect, useState } from 'react';
import { Download, FileArchive, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useLazyGetArtifactQuery } from '@iblai/iblai-js/data-layer';

import { Button } from '@/components/ui/button';
import { downloadBlob } from '@/components/canvas/canvas-export-handlers';
import {
  artifactFileToBlob,
  buildBinaryFilename,
  isImageMimeType,
  resolveBinaryMimeType,
  type ArtifactWithBinaryFields,
} from '@/components/canvas/binary-artifact-utils';

interface BinaryCanvasComponentProps {
  title?: string;
  onClose?: () => void;
  artifactId?: number;
  org?: string;
  userId?: string;
  fileExtension?: string;
  mimeType?: string;
}

/**
 * Read-only canvas for binary artifacts (pdf, images, …). Unlike the
 * rich-text canvas there is no editing of any kind: no formatting toolbar,
 * no highlight-to-edit, no AI rewrite controls, no version editing. The
 * only actions are viewing (when the browser can render the file) and a
 * plain export of the original bytes.
 *
 * The bytes are served base64-encoded by the artifact detail endpoint only
 * (`binary_content` is nulled on every embedded/streamed payload), so they
 * are fetched here on mount.
 */
export function BinaryCanvasComponent({
  title,
  onClose,
  artifactId,
  org,
  userId,
  fileExtension,
  mimeType,
}: BinaryCanvasComponentProps) {
  const t = useTranslations('canvasBinaryCanvas');
  const [fetchArtifact] = useLazyGetArtifactQuery();
  const [blob, setBlob] = useState<Blob | null>(null);
  const [resolvedTitle, setResolvedTitle] = useState<string | undefined>(title);
  const [resolvedExtension, setResolvedExtension] = useState<
    string | undefined
  >(fileExtension);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!artifactId || !org || !userId) {
        setLoadState('error');
        return;
      }
      setLoadState('loading');
      try {
        const artifact = (await fetchArtifact({
          id: artifactId,
          org,
          userId,
        }).unwrap()) as ArtifactWithBinaryFields;
        if (cancelled) return;

        // Binary artifacts carry base64 `binary_content`; text-based viewable
        // files (svg) carry their source in `content` — handle both.
        const file = artifactFileToBlob(artifact, fileExtension, mimeType);
        if (!file) {
          throw new Error('Artifact has no displayable content');
        }
        setBlob(file.blob);
        setResolvedTitle(artifact.title || title);
        setResolvedExtension(file.extension);
        setLoadState('ready');
      } catch (error) {
        if (cancelled) return;
        console.error('[BinaryCanvas] Failed to load artifact:', error);
        setLoadState('error');
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [artifactId, org, userId, reloadToken, fetchArtifact]);

  // Object URL for the embedded viewer. Created and revoked inside one
  // effect so each mount gets a fresh URL — a memoized URL would be revoked
  // by StrictMode's cleanup pass and hand the viewer a dead blob: URL.
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    setBlobUrl(url);
    return () => {
      setBlobUrl(null);
      URL.revokeObjectURL(url);
    };
  }, [blob]);

  const effectiveMime =
    blob?.type ?? resolveBinaryMimeType(fileExtension, mimeType);
  const isPdf = effectiveMime === 'application/pdf';
  const isImage = isImageMimeType(effectiveMime);
  const canPreview = isPdf || isImage;

  const handleExport = () => {
    if (!blob) return;
    downloadBlob(blob, buildBinaryFilename(resolvedTitle, resolvedExtension));
  };

  const displayTitle = resolvedTitle?.trim() || t('untitledFile');

  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden bg-white"
      data-testid="binary-canvas"
    >
      {/* Header — title + export + close only. Deliberately no formatting
          toolbar, version menu, rename, or save status. */}
      <div className="flex min-h-[50px] flex-shrink-0 items-center gap-1 border-b border-gray-200 bg-white px-2 py-2 sm:min-h-[60px] sm:px-3 sm:py-3 md:px-4">
        <div className="mr-2 flex min-w-0 flex-1 items-center gap-1 overflow-hidden sm:gap-2">
          <FileArchive className="h-4 w-4 flex-shrink-0 text-blue-600 sm:h-5 sm:w-5" />
          <span
            className="block truncate text-left text-xs font-medium text-gray-900 sm:text-sm md:text-base"
            data-testid="binary-canvas-title"
          >
            {displayTitle}
          </span>
        </div>
        <div className="ml-1 flex flex-shrink-0 items-center gap-1 sm:gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-1 border-blue-200 bg-transparent px-1 text-xs whitespace-nowrap text-blue-600 sm:px-2 md:px-3"
            onClick={handleExport}
            disabled={loadState !== 'ready' || !blob}
            data-testid="binary-canvas-export"
          >
            <Download className="h-3.5 w-3.5 sm:mr-1" />
            <span className="hidden sm:inline">{t('export')}</span>
          </Button>
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={onClose}
              data-testid="binary-canvas-close"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-gray-50">
        {loadState === 'loading' && (
          <div
            className="flex flex-1 items-center justify-center"
            data-testid="binary-canvas-loading"
          >
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          </div>
        )}

        {loadState === 'error' && (
          <div
            className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center"
            data-testid="binary-canvas-error"
          >
            <FileArchive className="h-10 w-10 text-gray-400" />
            <p className="text-sm text-gray-600">{t('loadError')}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReloadToken((v) => v + 1)}
              data-testid="binary-canvas-retry"
            >
              {t('retry')}
            </Button>
          </div>
        )}

        {loadState === 'ready' && blobUrl && canPreview && isPdf && (
          <iframe
            src={blobUrl}
            title={displayTitle}
            className="h-full w-full flex-1 border-0"
            data-testid="binary-canvas-pdf"
          />
        )}

        {loadState === 'ready' && blobUrl && canPreview && isImage && (
          <div className="flex flex-1 items-center justify-center overflow-auto p-4">
            <img
              src={blobUrl}
              alt={displayTitle}
              className="max-h-full max-w-full object-contain"
              data-testid="binary-canvas-image"
            />
          </div>
        )}

        {loadState === 'ready' && !canPreview && (
          /* Defensive: the chat chip offers Download instead of opening the
             canvas for these, but keep a usable fallback if we get here. */
          <div
            className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center"
            data-testid="binary-canvas-fallback"
          >
            <FileArchive className="h-10 w-10 text-gray-400" />
            <p className="text-sm text-gray-600">{t('previewUnavailable')}</p>
            <Button
              variant="outline"
              size="sm"
              className="border-blue-200 text-blue-600"
              onClick={handleExport}
              data-testid="binary-canvas-download"
            >
              <Download className="mr-1 h-3.5 w-3.5" />
              {t('download')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
