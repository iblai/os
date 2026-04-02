import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FlaggedPrompt } from './types';

interface FlaggedPromptsListProps {
  prompts: FlaggedPrompt[];
  selectedPrompt: FlaggedPrompt | null;
  onPromptClick: (prompt: FlaggedPrompt) => void;
}

export function FlaggedPromptsList({
  prompts,
  selectedPrompt,
  onPromptClick,
}: FlaggedPromptsListProps) {
  return (
    <div className="col-span-full space-y-4 md:col-span-1">
      <div className="scrollbar-hide max-h-[500px] overflow-hidden overflow-y-auto rounded-md border">
        {prompts.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No flagged prompts found
          </div>
        ) : (
          prompts.map((prompt) => (
            <div
              key={prompt.id}
              className={cn(
                'flex cursor-pointer items-center justify-between border-b p-4 last:border-b-0',
                selectedPrompt?.id === prompt.id
                  ? 'bg-gray-100'
                  : 'hover:bg-gray-50',
              )}
              onClick={() => onPromptClick(prompt)}
            >
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm text-gray-500">
                    {prompt.timeAgo}
                  </span>
                  <span className="text-sm text-gray-900">
                    {prompt.userEmail}
                  </span>
                </div>
                <div className="flex items-center gap-2 font-medium text-gray-900">
                  {prompt.userFullName}
                  <span
                    className={cn(
                      'rounded-md px-2 py-0.5 text-xs font-medium',
                      prompt.type === 'Moderation'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-blue-200 text-blue-800',
                    )}
                  >
                    {prompt.type}
                  </span>
                </div>
                <p className="line-clamp-1 text-sm text-gray-500">
                  {prompt.prompt}
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <ChevronRight className="h-4 w-4" />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
