'use client';

import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { useLazyGetArtifactQuery } from '@iblai/iblai-js/data-layer';
import { downloadBlob } from '@/components/canvas/canvas-export-handlers';
import {
  artifactFileToBlob,
  buildBinaryFilename,
  type ArtifactWithBinaryFields,
} from '@/components/canvas/binary-artifact-utils';

export type DownloadBinaryArtifactArgs = {
  artifactId: number;
  org: string;
  userId: string;
  /** Fallbacks when the fetched artifact lacks them. */
  title?: string;
  fileExtension?: string;
  mimeType?: string;
};

/**
 * Downloads a binary artifact's original file. The bytes live only on the
 * artifact detail endpoint (`binary_content`, base64) — streamed and embedded
 * payloads null them out — so the file is fetched on demand and saved as-is,
 * with no markdown/PDF conversion.
 */
export function useBinaryArtifactDownload() {
  const [fetchArtifact] = useLazyGetArtifactQuery();
  const [isDownloading, setIsDownloading] = useState(false);

  const downloadBinaryArtifact = useCallback(
    async ({
      artifactId,
      org,
      userId,
      title,
      fileExtension,
      mimeType,
    }: DownloadBinaryArtifactArgs): Promise<boolean> => {
      setIsDownloading(true);
      try {
        const artifact = (await fetchArtifact({
          id: artifactId,
          org,
          userId,
        }).unwrap()) as ArtifactWithBinaryFields;

        const file = artifactFileToBlob(artifact, fileExtension, mimeType);
        if (!file) {
          throw new Error('Artifact has no downloadable content');
        }
        downloadBlob(
          file.blob,
          buildBinaryFilename(artifact.title || title, file.extension),
        );
        return true;
      } catch (error) {
        console.error('[BinaryArtifact] Download failed:', error);
        toast.error('Failed to download file');
        return false;
      } finally {
        setIsDownloading(false);
      }
    },
    [fetchArtifact],
  );

  return { downloadBinaryArtifact, isDownloading };
}
