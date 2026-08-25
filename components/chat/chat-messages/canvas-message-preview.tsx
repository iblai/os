import { Download, ExternalLink, FileArchive, Loader2 } from 'lucide-react';

import { CanvasIcon } from '@/components/icons/svg-icons';
import { Button } from '@/components/ui/button';
import type { CanvasOpenPayload } from './types';
import { markdownToHtml, isHtml } from '@/lib/utils';
import Markdown from '@/components/markdown';

const SNIPPET_LENGTH = 140;

const buildSnippet = (text: string) => {
  // Convert markdown to HTML if needed, then strip HTML tags to get plain text
  let plainText = text;

  // If it's not HTML, assume it's markdown and convert to HTML first
  if (!isHtml(text)) {
    const html = markdownToHtml(text);
    // Strip HTML tags to get plain text
    plainText = html.replace(/<[^>]+>/g, ' ');
  } else {
    // Already HTML, just strip tags
    plainText = text.replace(/<[^>]+>/g, ' ');
  }

  // Clean up whitespace and build snippet
  const condensed = plainText.replace(/\s+/g, ' ').trim();
  if (condensed.length <= SNIPPET_LENGTH) {
    return condensed;
  }
  return `${condensed.slice(0, SNIPPET_LENGTH)}…`;
};

// Canvas preview component - updated to use blue color palette
export const CanvasMessagePreview = ({
  title,
  content,
  previewText,
  payload,
  onOpenCanvas,
  isStreaming = false,
  isBinary = false,
  canOpenInCanvas = true,
  onDownload,
  isDownloading = false,
}: {
  title: string;
  content: string;
  previewText?: string;
  payload: CanvasOpenPayload;
  onOpenCanvas?: (payload: CanvasOpenPayload) => void;
  isStreaming?: boolean;
  /** Binary file artifact (pdf, zip, …). */
  isBinary?: boolean;
  /** Whether the side canvas can display this artifact. */
  canOpenInCanvas?: boolean;
  /** Download-in-place handler for binaries the canvas cannot display. */
  onDownload?: () => void;
  isDownloading?: boolean;
}) => {
  const handleOpenCanvas = () => {
    if (onOpenCanvas) {
      onOpenCanvas(payload);
    } else {
      console.log('Open Canvas - no handler provided');
    }
  };

  // Binary artifacts have no textual content — describe the file instead.
  const fileExtension = (payload.fileExtension || '').trim();
  const binaryLabel = fileExtension
    ? `${fileExtension.toUpperCase()} file`
    : 'Binary file';
  const snippet = isBinary
    ? binaryLabel
    : buildSnippet(previewText ?? content.replace(/<[^>]+>/g, ' '));

  const showDownloadInstead = isBinary && !canOpenInCanvas;

  return (
    <div
      className="mb-2 max-w-md rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
      data-testid="canvas-message-preview"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-[#D0E0FF] p-2 text-[#38A1E5]">
          {isBinary ? (
            <FileArchive className="h-5 w-5" />
          ) : (
            <CanvasIcon className="h-5 w-5" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <Markdown className="mb-1 truncate text-sm font-medium text-gray-900">
            {title}
          </Markdown>
          <Markdown className="mb-2 line-clamp-2 text-xs text-gray-500">
            {snippet}
          </Markdown>
          {isStreaming && (
            <div className="mb-2 flex items-center gap-2 text-xs text-blue-600">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Generating...</span>
            </div>
          )}
          {showDownloadInstead ? (
            <Button
              size="sm"
              variant="outline"
              className="border-blue-200 bg-transparent text-blue-600 hover:bg-blue-50"
              onClick={onDownload}
              disabled={isDownloading || isStreaming}
              data-testid="canvas-download-button"
            >
              {isDownloading ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <Download className="mr-1 h-3 w-3" />
              )}
              Download
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="border-blue-200 bg-transparent text-blue-600 hover:bg-blue-50"
              onClick={handleOpenCanvas}
              data-testid="canvas-open-button"
            >
              <ExternalLink className="mr-1 h-3 w-3" />
              Open Canvas
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
