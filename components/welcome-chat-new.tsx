import { AppSyncBanner } from '@/components/welcome-chat/app-sync-banner';
import { ExploreMentors } from '@/components/welcome-chat/explore-mentors';
import { ConversationStarters } from '@/components/welcome-chat/conversation-starters';
import { ChatInputForm } from '@/components/chat-input-form';
import { useGetUserProjectDetailsQuery } from '@iblai/iblai-js/data-layer';
import { Message } from '@iblai/iblai-js/web-utils';
import { CHAT_AREA_SIZE } from '@iblai/iblai-js/web-utils';
import { config } from '@/lib/config';
import { useEmbedMode } from '@/hooks/use-embed-mode';
import { WelcomeChat } from './welcome-chat';
import { WelcomeMessage } from '@/components/welcome-chat/welcome-message';
import { useAxdToken } from '@/hooks/use-tokens';
import { ProjectPageParams } from '@/lib/types';
import { useParams } from 'next/navigation';
import { ProjectLandingPage } from '@iblai/iblai-js/web-containers';
import { useUserIsStudent } from '@/hooks/use-user';
import { useNavigate } from '@/hooks/user-navigate';
import { useAccessingPublicRoute } from '@/hooks/use-anonymous-mentor';

type Props = {
  mentorName: string;
  sessionId: string;
  enabledGuidedPrompts: boolean;
  onSubmit: (content: string) => void;
  onScreenSharingClick: () => void;
  isScreenSharingModalOpen: boolean;
  onPhoneCallClick: () => void;
  stopGenerating: () => void;
  tenantKey: string;
  username: string;
  enableWebBrowsing: boolean;
  setMessage: (messages: Message) => void;
  isStreaming: boolean;
  enableSafetyDisclaimer: boolean;
  isPreviewMode?: boolean;
  updateSessionTools: (tool: string) => Promise<void>;
  setSessionTools: (tools: string[]) => Promise<void>;
  activeTools: string[];
  screenSharing: boolean;
  deepResearch: boolean;
  studyMode: boolean;
  imageGeneration: boolean;
  codeInterpreter: boolean;
  mentorUniqueId: string;
  profileImage: string;
  promptsIsEnabled: boolean;
  googleSlidesIsEnabled: boolean;
  googleDocumentIsEnabled: boolean;
  artifactsEnabled: boolean;
  chatAreaMaxWidth?: number;
  isNewSession?: boolean;
  aiWelcomeMessage?: string;
  isConnecting?: boolean;
  compactMode?: boolean;
};

export function WelcomeChatNew({
  mentorName,
  sessionId,
  enabledGuidedPrompts,
  onSubmit,
  onScreenSharingClick,
  isScreenSharingModalOpen,
  onPhoneCallClick,
  stopGenerating,
  tenantKey,
  username,
  enableWebBrowsing,
  setMessage,
  isStreaming,
  enableSafetyDisclaimer,
  isPreviewMode,
  updateSessionTools,
  setSessionTools,
  activeTools,
  screenSharing,
  deepResearch,
  studyMode,
  imageGeneration,
  codeInterpreter,
  mentorUniqueId,
  profileImage,
  promptsIsEnabled,
  googleSlidesIsEnabled,
  googleDocumentIsEnabled,
  artifactsEnabled,
  chatAreaMaxWidth = CHAT_AREA_SIZE.DEFAULT,
  isNewSession = true,
  aiWelcomeMessage = '',
  isConnecting = false,
  compactMode = false,
}: Props) {
  const { projectId, mentorId } = useParams<ProjectPageParams>();
  const embedMode = useEmbedMode();
  const axdToken = useAxdToken();
  const userIsStudent = useUserIsStudent();
  const isPublicRoute = useAccessingPublicRoute();
  const { navigateToProject } = useNavigate();

  const { data: project } = useGetUserProjectDetailsQuery(
    {
      tenantKey,
      username: username!,
      id: parseInt(projectId),
    },
    {
      skip: !username || !tenantKey || !projectId,
    },
  );

  if (embedMode) {
    return (
      <div className="h-full flex-1">
        <WelcomeChat
          onPromptSelect={onSubmit}
          mentorName={mentorName}
          profileImage={profileImage}
          enabledGuidedPrompts={enabledGuidedPrompts}
          sessionId={sessionId}
          mentorUniqueId={mentorUniqueId}
          isNewSession={isNewSession}
          aiWelcomeMessage={aiWelcomeMessage}
        />
      </div>
    );
  }

  if (projectId) {
    if (!project) {
      return null;
    }

    return (
      <ProjectLandingPage
        project={project}
        mentorName={mentorName}
        sessionId={sessionId}
        enabledGuidedPrompts={enabledGuidedPrompts}
        onSubmit={onSubmit}
        onScreenSharingClick={onScreenSharingClick}
        isScreenSharingModalOpen={isScreenSharingModalOpen}
        onPhoneCallClick={onPhoneCallClick}
        stopGenerating={stopGenerating}
        tenantKey={tenantKey}
        username={username}
        enableSafetyDisclaimer={enableSafetyDisclaimer}
        enableWebBrowsing={enableWebBrowsing}
        isStreaming={isStreaming}
        updateSessionTools={updateSessionTools}
        setSessionTools={setSessionTools}
        activeTools={activeTools}
        screenSharing={screenSharing}
        deepResearch={deepResearch}
        studyMode={studyMode}
        imageGeneration={imageGeneration}
        codeInterpreter={codeInterpreter}
        promptsIsEnabled={promptsIsEnabled}
        isPreviewMode={isPreviewMode}
        setMessage={setMessage}
        mentorId={mentorId}
        mentorUniqueId={mentorUniqueId}
        projectId={projectId}
        profileImage={profileImage}
        googleSlidesIsEnabled={googleSlidesIsEnabled}
        googleDocumentIsEnabled={googleDocumentIsEnabled}
        artifactsEnabled={artifactsEnabled}
        userIsStudent={userIsStudent}
        isPublicRoute={isPublicRoute}
        navigateToProject={navigateToProject}
        showExploreMentors
      />
    );
  }

  return (
    <div className="overflow-y-auto">
      <div className="w-full py-6">
        {/* GitHub Sync Banner */}
        {tenantKey === config.mainTenantKey() &&
          config.showAppBanner() === 'true' && <AppSyncBanner />}

        {/* mentorAI Logo and Branding */}
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-6 flex items-center gap-3">
            <h1 className="bg-gradient-to-r from-[#38A1E5] to-[#7284FF] bg-clip-text text-center text-3xl font-bold text-transparent">
              {mentorName}
            </h1>
          </div>

          <div className="mb-6 text-center">
            <WelcomeMessage
              aiWelcomeMessage={aiWelcomeMessage}
              sessionId={sessionId}
              username={username}
              tenantKey={tenantKey}
              mentorUniqueId={mentorUniqueId}
              token={axdToken}
              isNewSession={isNewSession}
            />
          </div>

          {/* Chat Input Form */}
          <div className="w-full" style={{ maxWidth: `${chatAreaMaxWidth}px` }}>
            <ChatInputForm
              sessionId={sessionId}
              onSubmit={onSubmit}
              stopGenerating={stopGenerating}
              onScreenSharingClick={onScreenSharingClick}
              isScreenSharingModalOpen={isScreenSharingModalOpen}
              onPhoneCallClick={onPhoneCallClick}
              tenantKey={tenantKey}
              username={username ?? ''}
              setMessage={setMessage}
              enableSafetyDisclaimer={enableSafetyDisclaimer}
              isPreviewMode={isPreviewMode}
              enableWebBrowsing={enableWebBrowsing}
              isStreaming={isStreaming}
              updateSessionTools={updateSessionTools}
              setSessionTools={setSessionTools}
              activeTools={activeTools}
              screenSharing={screenSharing}
              deepResearch={deepResearch}
              studyMode={studyMode}
              imageGeneration={imageGeneration}
              codeInterpreter={codeInterpreter}
              promptsIsEnabled={promptsIsEnabled}
              googleSlidesIsEnabled={googleSlidesIsEnabled}
              googleDocumentIsEnabled={googleDocumentIsEnabled}
              artifactsEnabled={artifactsEnabled}
              isConnecting={isConnecting}
              compactMode={compactMode}
            />
          </div>
        </div>

        {/* Starter Templates */}
        <div className="mb-12">
          <ConversationStarters
            onTemplateSelect={onSubmit}
            enabledGuidedPrompts={enabledGuidedPrompts}
            sessionId={sessionId}
          />
        </div>

        {/* Explore Mentors */}
        <div className="mb-12">
          <ExploreMentors />
        </div>

        {/* Tools Section */}
        {/*
          <div className="mb-12">
            <ToolsSection onToolSelect={() => {}} />
          </div>
        */}
      </div>
    </div>
  );
}
