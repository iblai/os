'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAdvancedChat, ANONYMOUS_USERNAME } from '@iblai/iblai-js/web-utils';
import { toast } from 'sonner';
import { Bot } from 'lucide-react';

import { ChatMessages } from '@/components/chat/chat-messages';
import { ChatInputForm } from '@/components/chat-input-form';
import { LoadingMessage } from '@/components/chat/loading-message';
import { useAxdToken } from '@/hooks/use-tokens';
import { useUsername } from '@/hooks/use-user';
import { config } from '@/lib/config';
import { redirectToAuthSpa } from '@/lib/utils';
import eventBus, { RemoteEvents } from '@/lib/eventBus';

const noopAsync = async () => {};
const noop = () => {};

interface WorkflowPreviewChatProps {
  tenantKey: string;
  mentorId?: string;
}

export function WorkflowPreviewChat({ tenantKey, mentorId }: WorkflowPreviewChatProps) {
  const username = useUsername();
  const token = useAxdToken() ?? '';
  const [highlightedMessageId, setHighlightedMessageId] = useState<number | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    sendMessage,
    stopGenerating,
    setMessage,
    activeTab,
    mentorName,
    profileImage,
    sessionId,
    enableSafetyDisclaimer,
    isPending,
    isStreaming,
    currentStreamingMessage,
    isConnected,
    startNewChat,
  } = useAdvancedChat({
    mentorId: mentorId ?? '',
    tenantKey,
    username: username ?? ANONYMOUS_USERNAME,
    token,
    wsUrl: `${config.baseWsUrl()}/ws/langflow/`,
    stopGenerationWsUrl: `${config.baseWsUrl()}/ws/langflow-stop-generation/`,
    redirectToAuthSpa,
    cachedSessionId: {},
    errorHandler: (message) => {
      toast.error(message);
    },
  });

  const visibleMessages =
    messages.length > 0 && messages[0].role === 'assistant' ? messages.slice(1) : messages;

  useEffect(() => {
    const handler = () => startNewChat();
    eventBus.on(RemoteEvents.newChat, handler);
    return () => {
      eventBus.off(RemoteEvents.newChat, handler);
    };
  }, [startNewChat]);

  useEffect(() => {
    if (!chatContainerRef.current) return;
    chatContainerRef.current.scrollTo({
      top: chatContainerRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [visibleMessages.length, isStreaming, isPending]);

  const handleSubmit = useCallback(
    (content: string) => {
      sendMessage(activeTab, content, { visible: true });
    },
    [activeTab, sendMessage],
  );

  return (
    <div className="flex h-full flex-col">
      <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-6">
        {visibleMessages.length === 0 && !isPending && !isStreaming ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <Bot className="h-10 w-10 text-muted-foreground mb-3" />
            <h2 className="text-xl font-semibold text-foreground">Preview your agent</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Prompt the agent as if you&apos;re the user.
            </p>
          </div>
        ) : (
          <>
            <ChatMessages
              messages={visibleMessages}
              highlightedMessageId={highlightedMessageId}
              profileImage={profileImage}
              mentorName={mentorName}
              sessionId={sessionId}
              mentorId={mentorId ?? ''}
              tenantKey={tenantKey}
              handleHighlightMessage={setHighlightedMessageId}
              handleSubmit={handleSubmit}
            />
            {(isPending || isStreaming) && !currentStreamingMessage?.content && (
              <LoadingMessage mentorName={mentorName} profileImage={profileImage} />
            )}
          </>
        )}
      </div>

      <div className="border-t border-gray-200 p-4">
        <ChatInputForm
          sessionId={sessionId}
          onSubmit={handleSubmit}
          stopGenerating={stopGenerating}
          onScreenSharingClick={noop}
          isScreenSharingModalOpen={false}
          onPhoneCallClick={noop}
          tenantKey={tenantKey}
          mentorId={mentorId}
          username={username ?? ''}
          enableWebBrowsing={false}
          setMessage={setMessage}
          isStreaming={isStreaming}
          enableSafetyDisclaimer={enableSafetyDisclaimer}
          updateSessionTools={noopAsync}
          setSessionTools={noopAsync}
          activeTools={[]}
          screenSharing={false}
          deepResearch={false}
          studyMode={false}
          imageGeneration={false}
          codeInterpreter={false}
          promptsIsEnabled={false}
          googleSlidesIsEnabled={false}
          googleDocumentIsEnabled={false}
          artifactsEnabled={false}
          compactMode
          isConnecting={!isConnected}
        />
      </div>
    </div>
  );
}
