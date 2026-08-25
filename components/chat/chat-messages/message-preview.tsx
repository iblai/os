import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { FileText } from 'lucide-react';
import Markdown from '@/components/markdown';
import { CanvasMessagePreview } from './canvas-message-preview';
import type { CanvasOpenPayload } from './types';
import type { ArtifactVersion } from '@iblai/iblai-js/web-utils';
import {
  canOpenBinaryInCanvas,
  resolveBinaryMimeType,
  shouldUseBinaryCanvas,
} from '@/components/canvas/binary-artifact-utils';
import { useBinaryArtifactDownload } from '@/hooks/use-binary-artifact-download';
import { useUsername } from '@/hooks/use-user';
import type { TenantKeyMentorIdParams } from '@/lib/types';

const CODE_EXTENSIONS = new Set([
  'py',
  'js',
  'ts',
  'tsx',
  'jsx',
  'c',
  'cpp',
  'cs',
  'java',
  'rb',
  'go',
  'rs',
  'php',
  'swift',
  'kt',
  'scala',
  'sql',
  'json',
  'yml',
  'yaml',
  'xml',
  'html',
  'css',
  'sh',
]);

const determineToolType = (
  fileExtension?: string,
  isBinary?: boolean,
): string => {
  if (isBinary) {
    return 'binary';
  }
  if (!fileExtension) {
    return 'canvas';
  }
  return CODE_EXTENSIONS.has(fileExtension.toLowerCase()) ? 'code' : 'canvas';
};

// Get the current/latest artifact version from the versions array
const getCurrentArtifactVersion = (
  artifactVersions?: ArtifactVersion[],
): ArtifactVersion | null => {
  if (!artifactVersions || artifactVersions.length === 0) {
    return null;
  }

  // First try to find the current version
  const currentVersion = artifactVersions.find((v) => v.is_current);
  if (currentVersion) {
    return currentVersion;
  }

  // Fallback to the latest version (highest version number)
  return artifactVersions.reduce((latest, current) => {
    if (!latest || current.version_number > latest.version_number) {
      return current;
    }
    return latest;
  }, artifactVersions[0]);
};

// Build snippet preview from content
const buildSnippet = (content: string, maxLength: number = 150): string => {
  if (!content) return '';

  // Remove markdown syntax for preview
  const plainText = content
    .replace(/#{1,6}\s/g, '') // Remove headers
    .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
    .replace(/\*([^*]+)\*/g, '$1') // Remove italic
    .replace(/`([^`]+)`/g, '$1') // Remove inline code
    .replace(/```[\s\S]*?```/g, '') // Remove code blocks
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links
    .replace(/\n+/g, ' ') // Replace newlines with spaces
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();

  if (plainText.length <= maxLength) {
    return plainText;
  }

  return `${plainText.slice(0, maxLength)}…`;
};

interface MessagePreviewProps {
  content: string;
  artifactVersions?: ArtifactVersion[];
  streamingArtifactId?: number;
  onOpenCanvas?: (payload: CanvasOpenPayload) => void;
}

export function MessagePreview({
  content,
  artifactVersions,
  onOpenCanvas,
  streamingArtifactId,
}: MessagePreviewProps) {
  const { tenantKey } = useParams<TenantKeyMentorIdParams>();
  const username = useUsername();
  const { downloadBinaryArtifact, isDownloading } = useBinaryArtifactDownload();
  const currentArtifact = useMemo(
    () => getCurrentArtifactVersion(artifactVersions),
    [artifactVersions],
  );
  const fallbackVersion =
    artifactVersions && artifactVersions.length > 0
      ? artifactVersions[0]
      : null;

  const selectedVersion = currentArtifact ?? fallbackVersion;

  const [displayTitle, setDisplayTitle] = useState<string | null>(null);
  const artifactId = selectedVersion?.artifact?.id;

  useEffect(() => {
    const nextTitle =
      selectedVersion?.title ||
      selectedVersion?.artifact?.title ||
      'Untitled Artifact';
    setDisplayTitle(nextTitle);
  }, [selectedVersion?.title, selectedVersion?.artifact?.title]);

  useEffect(() => {
    const handler = (
      event: CustomEvent<{ artifactId: number; title: string }>,
    ) => {
      if (!artifactId) return;
      if (Number(event.detail?.artifactId) === artifactId) {
        setDisplayTitle(event.detail.title);
      }
    };
    window.addEventListener('artifact-title-updated' as any, handler as any);
    return () => {
      window.removeEventListener(
        'artifact-title-updated' as any,
        handler as any,
      );
    };
  }, [artifactId]);

  if (!selectedVersion) {
    return <Markdown>{content}</Markdown>;
  }

  const artifact = selectedVersion.artifact;
  const artifactContent = selectedVersion.content || artifact.content || '';
  const fileExtension = artifact.file_extension || 'md';
  // `is_binary` / `mime_type` are returned by the API but predate the SDK's
  // ArtifactData type; live-streamed artifacts lack them entirely, so the
  // extension map inside isBinaryArtifact is the fallback.
  const { is_binary: rawIsBinary, mime_type: rawMimeType } =
    artifact as typeof artifact & {
      is_binary?: boolean;
      mime_type?: string | null;
    };
  const isBinary = shouldUseBinaryCanvas({
    isBinary: rawIsBinary,
    mimeType: rawMimeType,
    fileExtension,
  });
  const mimeType = isBinary
    ? resolveBinaryMimeType(fileExtension, rawMimeType)
    : undefined;
  const binaryOpensInCanvas =
    isBinary && canOpenBinaryInCanvas({ mimeType, fileExtension });
  const toolType = determineToolType(fileExtension, isBinary);

  const payload: CanvasOpenPayload = {
    title: displayTitle || 'Untitled Artifact',
    content: isBinary ? '' : artifactContent,
    toolType,
    artifactId: artifact.id,
    org: undefined, // Will be resolved from context
    userId: artifact.username,
    fileExtension,
    isBinary,
    mimeType,
    metadata: {
      sessionId: artifact.session_id || selectedVersion.session_id,
      versionNumber: selectedVersion.version_number,
      versionCount: artifact.version_count,
      currentVersionNumber: artifact.current_version_number,
      ...artifact.metadata,
    },
  };

  const previewText = isBinary ? '' : buildSnippet(artifactContent);

  const handleDownload = () => {
    if (!artifact.id || !tenantKey) return;
    void downloadBinaryArtifact({
      artifactId: artifact.id,
      org: tenantKey,
      userId: artifact.username || username || '',
      title: displayTitle || artifact.title,
      fileExtension,
      mimeType,
    });
  };

  const renderArtifactPreview = () => {
    if (selectedVersion.is_current) {
      const isStreaming =
        streamingArtifactId !== undefined && artifactId === streamingArtifactId;
      return (
        <CanvasMessagePreview
          title={displayTitle || 'Untitled Artifact'}
          content={isBinary ? '' : artifactContent}
          previewText={previewText}
          payload={payload}
          onOpenCanvas={onOpenCanvas}
          isStreaming={isStreaming}
          isBinary={isBinary}
          canOpenInCanvas={!isBinary || binaryOpensInCanvas}
          onDownload={handleDownload}
          isDownloading={isDownloading}
        />
      );
    }

    return (
      <button
        className="flex w-full cursor-pointer items-start gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2 text-left hover:border-gray-300"
        onClick={() => onOpenCanvas?.(payload)}
      >
        <div className="mt-1">
          <FileText className="h-5 w-5 text-gray-500" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-gray-900">
            {displayTitle || 'Untitled Artifact'}
          </div>
          <div className="text-xs text-gray-600">
            Version {selectedVersion.version_number}
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-3">
      {content && content.trim() && (
        <div className="text-gray-800">
          <Markdown>{content}</Markdown>
        </div>
      )}
      {renderArtifactPreview()}
    </div>
  );
}
