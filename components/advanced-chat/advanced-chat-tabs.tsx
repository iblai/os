import type { Message, SendMessageOptions } from '@iblai/iblai-js/web-utils';
import { ChatTab } from './chat-tab';
import { ExpandTab } from './expand-tab';
import { SummarizeTab } from './summarize-tab';
import { TranslateTab } from './translate-tab';
import { type AdvancedTab, translatePrompt } from '@iblai/iblai-js/web-utils';

type Props = {
  mentorName: string;
  profileImage: string;
  onPromptSelect: (prompt: string) => void;
  activeTab: AdvancedTab;
  messages: Message[];
  sendMessage: (text: string, options?: SendMessageOptions) => Promise<void>;
  isPreviewMode: boolean;
};

export const AdvancedChatTabs = ({
  mentorName,
  profileImage,
  onPromptSelect,
  activeTab,
  messages,
  sendMessage,
  isPreviewMode,
}: Props) => {
  function translateRequest(language: string) {
    onPromptSelect(translatePrompt(language));
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'chat':
        return <ChatTab onPromptSelect={onPromptSelect} />;
      case 'summarize':
        return (
          <SummarizeTab
            messages={messages}
            sendMessage={sendMessage}
            isPreviewMode={isPreviewMode}
          />
        );
      case 'translate':
        return (
          <TranslateTab
            mentorName={mentorName}
            profileImage={profileImage}
            onLanguageSelect={translateRequest}
          />
        );
      case 'expand':
        return (
          <ExpandTab
            messages={messages}
            sendMessage={sendMessage}
            isPreviewMode={isPreviewMode}
          />
        );
      default:
        return <ChatTab onPromptSelect={onPromptSelect} />;
    }
  };

  return (
    <>
      {/* Tab Content */}
      {renderTabContent()}
    </>
  );
};
