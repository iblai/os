import { advancedTabsProperties } from '@iblai/iblai-js/web-utils';
import type { AdvancedTab, Prompt } from '@iblai/iblai-js/web-utils';
import { DefaultTag } from './ui-tags/default-tag';
import { OptionsTag } from './ui-tags/options-tag';
import { useLazyGetGuidedPromptsQuery, useLazyGetPromptsSearchQuery } from '@iblai/iblai-js/data-layer';
import { useEffect, useState } from 'react';
import { config } from '@/lib/config';
import useWelcome from '@/hooks/use-welcome-message';
import { useAxdToken } from '@/hooks/use-tokens';
import { Avatar } from '@/components/ui/avatar';
import { AvatarImage } from '@/components/ui/avatar';
import { AvatarFallback } from '@/components/ui/avatar';
import Markdown from '@/components/markdown';

type Props = {
  activeTab: AdvancedTab;
  sendMessage: (tab: AdvancedTab, prompt: string) => void;
  profileImage: string;
  mentorName: string;
  tenantKey: string;
  sessionId: string;
  username: string;
  mentorUniqueId: string;
};

export function AdvancedStaticChatBuilder({
  activeTab,
  profileImage,
  mentorName,
  sendMessage,
  tenantKey,
  sessionId,
  username,
  mentorUniqueId,
}: Props) {
  const realUsername = username || 'anonymous';

  const isChatTabActive = activeTab === 'chat';

  const [triggerGetPromptsSearch, { isLoading: isLoadingSuggestedPrompts }] =
    useLazyGetPromptsSearchQuery();

  const [triggerGetGuidedPrompts, { isLoading: isLoadingGuidedPrompts }] =
    useLazyGetGuidedPromptsQuery();

  const [promptsData, setPromptsData] = useState<Prompt[]>([]);

  const handleFetchPromptData = async () => {
    if (!tenantKey || !realUsername || !isChatTabActive || !mentorUniqueId || !sessionId) return;
    try {
      const suggestedPrompts = await triggerGetPromptsSearch(
        {
          org: tenantKey,
          username: realUsername,
          category: '',
          limit: 10,
          offset: 0,
          orderDirection: 'asc',
          mentor: mentorUniqueId,
        },
        true,
      );
      if (suggestedPrompts.data?.results?.length === 0) {
        const guidedPromptsData = await triggerGetGuidedPrompts(
          {
            org: tenantKey,
            sessionId: sessionId,
            // @ts-ignore
            userId: realUsername,
          },
          true,
        ).unwrap();
        setPromptsData(
          guidedPromptsData.ai_prompts.map((prompt) => ({
            type: 'ai',
            content: prompt || '',
          })) as Prompt[],
        );
        return;
      }
      setPromptsData(
        suggestedPrompts.data?.results.map((prompt) => ({
          type: 'ai',
          content: prompt.prompt || prompt.title || '',
        })) as Prompt[],
      );
    } catch (error) {
      console.error(JSON.stringify(error));
    }
  };

  // Effect to trigger suggested prompts query when conditions are met
  useEffect(() => {
    handleFetchPromptData();
  }, [tenantKey, realUsername, isChatTabActive, mentorUniqueId, sessionId]);

  const axdToken = useAxdToken();

  const { welcomeMessage } = useWelcome({
    sessionId,
    username: realUsername,
    tenantKey,
    mentorUniqueId,
    token: axdToken,
    wsUrl: `${config.baseWsUrl()}/ws/langflow/`,
  });

  const activeTabProperties = advancedTabsProperties[activeTab];

  if (!activeTabProperties || !activeTabProperties.tag) return null;

  if (activeTabProperties.tag === 'options') {
    return (
      <OptionsTag
        title={activeTabProperties.display ?? ''}
        // @ts-expect-error - description property may not exist on all tab property union types
        description={activeTabProperties?.description ?? ''}
        // @ts-expect-error - metaDescription property may not exist on all tab property union types
        metaDescription={activeTabProperties?.metaDescription ?? ''}
        options={activeTabProperties.prompts as Prompt[]}
        onOptionSelect={sendMessage}
        profileImage={profileImage}
        mentorName={mentorName}
      />
    );
  }

  return (
    <>
      {welcomeMessage &&
        promptsData?.length === 0 &&
        !isLoadingGuidedPrompts &&
        !isLoadingSuggestedPrompts && (
          /* WELCOME CHAT SECTION */
          <div className="flex h-full justify-center">
            <div className="flex items-center gap-4 p-4">
              <Avatar className="h-14 w-14 border-2 border-blue-500">
                <AvatarImage src={profileImage} alt={mentorName} />
                <AvatarFallback className="bg-blue-400 text-white">
                  {mentorName.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-xl font-bold text-gray-800">{mentorName}</h1>
                <Markdown className="mt-1 text-[14px] text-gray-600">{welcomeMessage}</Markdown>
              </div>
            </div>
          </div>
        )}
      <DefaultTag
        onPromptSelect={sendMessage}
        prompts={
          (isChatTabActive
            ? (promptsData?.slice(0, 4)?.map((prompt) => ({
                type: 'ai',
                content: prompt.content || '',
              })) ?? [])
            : activeTabProperties.prompts) as Prompt[]
        }
      />
    </>
  );
}
