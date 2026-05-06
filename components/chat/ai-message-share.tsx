import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { Loader2, Share2 } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useUpdateChatSessionSharedMutation } from '@iblai/iblai-js/data-layer';
import { useUsername } from '@/hooks/use-user';
import { toast } from 'sonner';
import { ANONYMOUS_USERNAME } from '@iblai/iblai-js/web-utils';

type Props = {
  sessionId: string;
  tenantKey: string;
};

export function AIMessageShare({ sessionId, tenantKey }: Props) {
  const { copy, status } = useCopyToClipboard();
  const isCopied = status === 'success';
  const username = useUsername();
  const [updateChatSessionShared, { isLoading }] =
    useUpdateChatSessionSharedMutation();

  const handleShare = async () => {
    // Copy the URL to clipboard first, before the async API call.
    // Safari only allows clipboard writes synchronously within a user gesture,
    // so awaiting the API call first would break clipboard access.
    const shareUrl = `${window.location.origin}/share/chat/${sessionId}`;
    copy(shareUrl);

    try {
      await updateChatSessionShared({
        org: tenantKey,
        sessionId,
        // @ts-ignore - userId is required at runtime but not in generated types
        userId: username ?? ANONYMOUS_USERNAME,
        requestBody: {
          is_shared: true,
        },
      }).unwrap();

      toast.success('Share link copied to clipboard');
    } catch (error) {
      toast.error('Failed to share chat');
      console.error('Error sharing chat:', error);
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={handleShare}
          disabled={isLoading}
          aria-label="Share this chat"
          className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-[#646464] transition-colors hover:text-[#484848] disabled:opacity-50"
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : isCopied ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5 text-blue-500"
            >
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          ) : (
            <Share2 className="h-5 w-5" />
          )}
          <span className="hidden whitespace-nowrap lg:inline">Share</span>
        </button>
      </TooltipTrigger>
      <TooltipContent className="ibl-tooltip-content">
        {isLoading ? 'Sharing...' : isCopied ? 'Copied' : 'Share'}
      </TooltipContent>
    </Tooltip>
  );
}
