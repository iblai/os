import { ExternalLink, Loader2 } from 'lucide-react';

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
}: {
  title: string;
  content: string;
  previewText?: string;
  payload: CanvasOpenPayload;
  onOpenCanvas?: (payload: CanvasOpenPayload) => void;
  isStreaming?: boolean;
}) => {
  const handleOpenCanvas = () => {
    if (onOpenCanvas) {
      onOpenCanvas(payload);
    } else {
      console.log('Open Canvas - no handler provided');
    }
  };

  const snippet = buildSnippet(previewText ?? content.replace(/<[^>]+>/g, ' '));

  return (
    <div
      className="bg-white rounded-lg border border-gray-200 p-4 mb-2 max-w-md shadow-sm"
      data-testid="canvas-message-preview"
    >
      <div className="flex items-start gap-3">
        <div className="bg-[#D0E0FF] text-[#38A1E5] p-2 rounded-lg">
          <CanvasIcon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <Markdown className="font-medium text-gray-900 text-sm truncate mb-1">{title}</Markdown>
          <Markdown className="text-gray-500 text-xs mb-2 line-clamp-2">{snippet}</Markdown>
          {isStreaming && (
            <div className="flex items-center gap-2 text-blue-600 text-xs mb-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Generating...</span>
            </div>
          )}
          <Button
            size="sm"
            variant="outline"
            className="text-blue-600 border-blue-200 hover:bg-blue-50 bg-transparent"
            onClick={handleOpenCanvas}
            data-testid="canvas-open-button"
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            Open Canvas
          </Button>
        </div>
      </div>
    </div>
  );
};
