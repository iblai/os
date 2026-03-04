import React from 'react';

import { useGetGuidedPromptsQuery } from '@iblai/iblai-js/data-layer';
import { ArrowRight, Loader2, RotateCcw } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';
import { CSS_CLASS_NAMES } from '@/lib/constants';

type Props = {
  enabledGuidedPrompts: boolean;
  tenantKey: string;
  sessionId: string;
  username: string;
  isStreaming: boolean;
  isPending: boolean;
  onPromptSelect: (prompt: string) => void;
};

export function GuidedSuggestedPrompts({
  enabledGuidedPrompts,
  tenantKey,
  sessionId,
  username,
  isStreaming,
  isPending,
  onPromptSelect,
}: Props) {
  const realUsername = username || 'anonymous';
  const { data, refetch, isFetching, status } = useGetGuidedPromptsQuery(
    {
      org: tenantKey,
      sessionId: sessionId,
      // @ts-ignore
      userId: realUsername,
    },
    {
      skip: !enabledGuidedPrompts || !tenantKey || !sessionId || !realUsername,
    },
  );

  React.useEffect(() => {
    if (!isStreaming && status !== 'uninitialized') {
      refetch();
    }
  }, [isStreaming]);

  if (
    !enabledGuidedPrompts ||
    !tenantKey ||
    !sessionId ||
    !realUsername ||
    isStreaming ||
    isPending ||
    data?.ai_prompts?.length === 0
  ) {
    return null;
  }

  const Icon = isFetching ? Loader2 : RotateCcw;

  const ariaLabel = `Your guided prompts are below. Click on a prompt to add it to your chat.`;

  return (
    <div
      className="mt-8 flex justify-end w-full"
      aria-live="polite"
      aria-relevant="additions text"
      aria-atomic="true"
    >
      <span className="sr-only" aria-label={ariaLabel}>
        {ariaLabel}
      </span>
      <div className="text-sm/7 flex gap-2 items-end">
        {/* Question Cards */}
        <div className="flex flex-col gap-2">
          {data?.ai_prompts?.slice(0, 3).map((question, index) => (
            <button
              key={index}
              type="button"
              onClick={() => {
                onPromptSelect(question);
              }}
              className={cn(
                'flex items-center gap-2 border rounded-md px-1.5 py-0.5 text-blue-700 border-blue-700 cursor-pointer justify-between text-left',
                CSS_CLASS_NAMES.APP_LAYOUT.GUIDED_SUGGESTED_PROMPTS,
              )}
            >
              <span>{question}</span>
              <ArrowRight className="h-4 w-4 text-blue-700" />
            </button>
          ))}
        </div>

        {/* Refresh Button */}
        <div>
          <Button
            type="button"
            onClick={() => refetch()}
            variant="outline"
            size="icon"
            className={cn(
              'cursor-pointer border-blue-700',
              CSS_CLASS_NAMES.APP_LAYOUT.GUIDED_SUGGESTED_PROMPTS_REFRESH,
            )}
          >
            <span className="sr-only">Refresh Guided Prompts</span>
            <Icon
              className={cn('w-4 h-4 text-blue-700', {
                'animate-spin': isFetching,
              })}
            />
          </Button>
        </div>
      </div>
    </div>
  );
}
