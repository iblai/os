import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { Copy } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type Props = {
  content: string;
};

export function AIMessageCopy({ content }: Props) {
  const { copy, status } = useCopyToClipboard();
  const isCopied = status === 'success';

  const handleCopy = () => {
    copy(content);
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={handleCopy}
          className="text-gray-500 hover:text-gray-700"
          aria-label="Copy to Clipboard"
        >
          <span className="sr-only">Copy to Clipboard</span>
          {isCopied ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4 text-blue-500"
            >
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent className="ibl-tooltip-content">
        {isCopied ? 'Copied' : 'Copy to Clipboard'}
      </TooltipContent>
    </Tooltip>
  );
}
