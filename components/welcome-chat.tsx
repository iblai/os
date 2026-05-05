'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAxdToken } from '@/hooks/use-tokens';
import { CSS_CLASS_NAMES } from '@/lib/constants';
import {
  useGetGuidedPromptsQuery,
  useGetPromptsSearchQuery,
} from '@iblai/iblai-js/data-layer';
import { cn } from '@/lib/utils';
import { useParams } from 'next/navigation';
import { useUsername } from '@/hooks/use-user';
import { TenantKeyMentorIdParams } from '@/lib/types';
import { WelcomeMessage } from '@/components/welcome-chat/welcome-message';
import { useMentorSettings } from '@/hooks/use-mentors/use-mentor-settings';
import Markdown from '@/components/markdown';

interface Props {
  onPromptSelect: (prompt: string) => void;
  mentorName: string;
  profileImage: string;
  enabledGuidedPrompts: boolean;
  sessionId: string;
  mentorUniqueId: string;
  isNewSession?: boolean;
  aiWelcomeMessage?: string;
}

export function WelcomeChat({
  onPromptSelect,
  mentorName,
  profileImage,
  enabledGuidedPrompts,
  sessionId,
  mentorUniqueId,
  isNewSession = true,
  aiWelcomeMessage = '',
}: Props) {
  const username = useUsername();
  const { tenantKey, mentorId } = useParams<TenantKeyMentorIdParams>();
  const realUsername = username ?? 'anonymous';
  const axdToken = useAxdToken();
  const mentorSettings = useMentorSettings();
  const isSuggestedPrompts =
    mentorSettings?.data?.starterPrompts === 'suggested_prompt';

  const { data: guidedPrompts } = useGetGuidedPromptsQuery(
    {
      org: tenantKey,
      sessionId: sessionId,
      // @ts-ignore
      userId: realUsername,
    },
    {
      skip:
        isSuggestedPrompts ||
        !enabledGuidedPrompts ||
        !tenantKey ||
        !sessionId ||
        !realUsername,
    },
  );

  const { data: suggestedPrompts } = useGetPromptsSearchQuery(
    {
      org: tenantKey,
      username: realUsername,
      category: '',
      limit: 4,
      offset: 0,
      mentor: mentorId,
      orderDirection: 'asc',
    },
    {
      skip: !isSuggestedPrompts || !tenantKey || !realUsername || !mentorId,
    },
  );

  const hasGuidedPrompts =
    !isSuggestedPrompts && (guidedPrompts?.ai_prompts?.length ?? 0) > 0;
  const hasSuggestedPrompts =
    isSuggestedPrompts && (suggestedPrompts?.results?.length ?? 0) > 0;
  const hasPrompts = hasGuidedPrompts || hasSuggestedPrompts;

  return (
    <div
      className={cn('mx-auto flex h-full max-w-2xl flex-col rounded-lg p-4', {
        'justify-center': !hasPrompts,
      })}
    >
      {hasPrompts ? null : (
        <div className="mb-6 flex items-center gap-4">
          <Avatar
            className={cn(
              'h-14 w-14 border-2 border-blue-500',
              CSS_CLASS_NAMES.APP_LAYOUT.MENTOR_IMAGE_CONTAINER_RING,
            )}
          >
            <AvatarImage src={profileImage} alt={mentorName} />
            <AvatarFallback className="bg-blue-400 text-white">
              {mentorName.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-xl font-bold text-gray-800">{mentorName}</h1>
            <WelcomeMessage
              aiWelcomeMessage={aiWelcomeMessage}
              sessionId={sessionId}
              username={username ?? ''}
              tenantKey={tenantKey}
              mentorUniqueId={mentorUniqueId}
              token={axdToken}
              isNewSession={isNewSession ?? true}
              className="mt-1 text-[14px] text-gray-600"
            />
          </div>
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-2">
        {enabledGuidedPrompts &&
          !isSuggestedPrompts &&
          guidedPrompts?.ai_prompts?.slice(0, 4).map((prompt) => (
            <button
              key={prompt}
              type="button"
              className={cn(
                'flex h-full flex-col justify-start rounded-lg bg-[#EDF3FF] p-4 text-left shadow-sm transition-colors hover:bg-gray-50',
                CSS_CLASS_NAMES.APP_LAYOUT.WELCOME_CHAT_BUTTON,
              )}
              onClick={() => onPromptSelect(prompt)}
            >
              <Markdown className="text-sm text-gray-700">{prompt}</Markdown>
            </button>
          ))}
        {isSuggestedPrompts &&
          suggestedPrompts?.results?.slice(0, 4).map((item: any) => (
            <button
              key={item.id}
              type="button"
              className={cn(
                'flex h-full flex-col justify-start rounded-lg bg-[#EDF3FF] p-4 text-left shadow-sm transition-colors hover:bg-gray-50',
                CSS_CLASS_NAMES.APP_LAYOUT.WELCOME_CHAT_BUTTON,
              )}
              onClick={() => onPromptSelect(item.prompt)}
            >
              <Markdown className="text-sm text-gray-700">
                {item.prompt}
              </Markdown>
            </button>
          ))}
      </div>
    </div>
  );
}
