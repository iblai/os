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
    <div className="space-y-4 col-span-full md:col-span-1">
      <div className="border rounded-md overflow-hidden max-h-[500px] overflow-y-auto scrollbar-hide">
        {prompts.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No flagged prompts found</div>
        ) : (
          prompts.map((prompt) => (
            <div
              key={prompt.id}
              className={cn(
                'flex items-center justify-between p-4 border-b last:border-b-0 cursor-pointer',
                selectedPrompt?.id === prompt.id ? 'bg-gray-100' : 'hover:bg-gray-50',
              )}
              onClick={() => onPromptClick(prompt)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-500">{prompt.timeAgo}</span>
                  <span className="text-sm text-gray-900">{prompt.userEmail}</span>
                </div>
                <div className="font-medium text-gray-900 flex items-center gap-2">
                  {prompt.userFullName}
                  <span
                    className={cn(
                      'text-xs font-medium px-2 py-0.5 rounded-md',
                      prompt.type === 'Moderation'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-blue-200 text-blue-800',
                    )}
                  >
                    {prompt.type}
                  </span>
                </div>
                <p className="text-sm text-gray-500 line-clamp-1">{prompt.prompt}</p>
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
