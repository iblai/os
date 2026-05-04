'use client';

import type React from 'react';

import { useState, useRef, ChangeEvent } from 'react';
import { format } from 'date-fns';
import { useMediaQuery } from 'react-responsive';
import { FileText } from 'lucide-react';
import { useAppSelector, useAppDispatch } from '@/lib/hooks';
import { removeFile } from '@iblai/iblai-js/web-utils';
import { RootState } from '@/store';
import { Message } from '@iblai/iblai-js/web-utils';
import { MENTOR_CHAT_DOCUMENTS_EXTENSIONS } from '@iblai/iblai-js/web-utils';
import { useAccessingPublicRoute } from '@/hooks/use-anonymous-mentor';
import { useChatFileUpload } from '@/hooks/use-chat-file-upload';
import { cn, isLoggedIn } from '@/lib/utils';
import useVoiceChat from '@/hooks/use-voice-chat';
import { VoiceChatButton } from './chat-input-form/voice-chat-button';
import { RetrievedDocumentsButton } from './retrieved-documents-button';
import dynamic from 'next/dynamic';
import { useEmbedMode } from '@/hooks/use-embed-mode';
import { StopStreamingButton } from './chat/stop-streaming-button';
import { SubmitMessageButton } from './chat/submit-message-button';
import { useShowFreeTrialDialog } from '@/hooks/user-user-actions';
import { CSS_CLASS_NAMES } from '@/lib/constants';
import { ScreenSharingButton } from './chat-input-form/screen-sharing-button';
import AutoResizeTextarea from './auto-resize-text-area';
import { OutsideButtons } from './chat-input-form/outside-buttons';
import { UploadMenu } from './chat-input-form/upload-menu';
import {
  chatInputSliceActions,
  chatInputSliceSelectors,
} from '@/features/chat-input/api-slice';
import { useResponsive } from '@/hooks/use-responsive';
import { InsideButtons } from './chat-input-form/inside-buttons';
import { VoiceCallButton } from './chat-input-form/voice-call-button';
import { useMentorSettings } from '@/hooks/use-mentors/use-mentor-settings';
import { MentorVisibilityEnum } from '@iblai/iblai-api';
import { selectShowingSharedChat } from '@iblai/iblai-js/web-utils';
import { useVisitingTenant } from '@/hooks/use-user';
import { FileAttachmentsList } from './chat-input-form/file-attachments-list';
import { toast } from 'sonner';
import { useModelFileUploadCapabilities } from '@/hooks/use-model-file-upload-capabilities';
import { selectRbacPermissions } from '@/features/rbac/rbac-slice';
import { checkRbacPermission } from '@/hoc/withPermissions';

const PromptGalleryModal = dynamic(
  () =>
    import('@/components/modals/prompt-gallery-modal').then(
      (mod) => mod.PromptGalleryModal,
    ),
  {
    ssr: false,
  },
);

interface ChatInputFormProps {
  onSubmit: (content: string) => void;
  onScreenSharingClick: () => void;
  isScreenSharingModalOpen: boolean;
  onPhoneCallClick: () => void;
  sessionId: string;
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
  promptsIsEnabled: boolean;
  googleSlidesIsEnabled: boolean;
  googleDocumentIsEnabled: boolean;
  artifactsEnabled: boolean;
  /** When true, shows only textarea and submit button (hides voice call, screen share, prompts, etc.) */
  compactMode?: boolean;
  chatAreaMaxWidth?: number;
  /** When true, shows a loading state in the submit button indicating the connection is being established */
  isConnecting?: boolean;
  /** Ref forwarded to the stop streaming button for focus management */
  stopStreamingButtonRef?: React.RefObject<HTMLButtonElement | null>;
}

export function ChatInputForm({
  onSubmit,
  onScreenSharingClick,
  isScreenSharingModalOpen,
  onPhoneCallClick,
  sessionId,
  stopGenerating,
  tenantKey,
  username,
  isPreviewMode,
  enableWebBrowsing,
  isStreaming,
  updateSessionTools,
  setSessionTools,
  activeTools,
  screenSharing,
  deepResearch,
  studyMode,
  imageGeneration,
  codeInterpreter,
  promptsIsEnabled,
  googleSlidesIsEnabled,
  googleDocumentIsEnabled,
  artifactsEnabled,
  compactMode = false,
  chatAreaMaxWidth,
  isConnecting = false,
  stopStreamingButtonRef,
}: ChatInputFormProps) {
  const dispatch = useAppDispatch();
  const mentorSettings = useMentorSettings();
  const showingSharedChat = useAppSelector(selectShowingSharedChat);
  const rbacPermissions = useAppSelector(selectRbacPermissions);

  // Check if user has chat permission via RBAC
  const mentorDbId = mentorSettings?.data?.mentorDbId;
  const mentorRbacKey = mentorDbId ? `/mentors/${mentorDbId}/` : null;
  const hasMentorRbacData = mentorRbacKey
    ? mentorRbacKey in rbacPermissions
    : false;
  const hasChatPermission =
    mentorDbId && hasMentorRbacData
      ? checkRbacPermission(rbacPermissions, `/mentors/${mentorDbId}/#chat`)
      : true; // Default to true if mentor ID not available or RBAC data not loaded
  const isChatDisabledByRbac = !hasChatPermission;

  const {
    FreeTrialDialog,
    closeModal: closeFreeTrialModal,
    isModalOpen: isFreeTrialModalOpen,
    executeWithTrialCheck,
  } = useShowFreeTrialDialog();
  const embedMode = useEmbedMode();
  const inputValue = useAppSelector(
    chatInputSliceSelectors.selectTextareaInput,
  );
  const containerRef = useRef<HTMLFormElement>(null);
  const { containerWidth } = useResponsive(
    containerRef as React.RefObject<HTMLElement>,
  );

  const [textAreaRows] = useState(1);
  const [isPromptGalleryOpen, setIsPromptGalleryOpen] = useState(false);
  const [fileAddedNotification, setFileAddedNotification] = useState<
    string | null
  >(null);
  const fileUploadInputRef = useRef<HTMLInputElement>(null);
  const isTabletOrMobile = useMediaQuery({ maxWidth: 1023 });
  const isAccessingPublicRoute = useAccessingPublicRoute();
  const userIsVisiting = useVisitingTenant();
  const fileUploadCapabilities = useModelFileUploadCapabilities();

  const { uploadFiles, retryUpload } = useChatFileUpload({
    org: tenantKey,
    userId: username,
    errorHandler: (error) => toast.error(error),
    capabilities: {
      supportsFileUpload: fileUploadCapabilities.supportsFileUpload,
      allSupportedTypes: fileUploadCapabilities.allSupportedTypes,
      maxFileSizeMB: fileUploadCapabilities.maxFileSizeMB,
      maxFilesPerMessage: fileUploadCapabilities.maxFilesPerMessage,
    },
  });

  const visibleToLoggedInUsersOnly = !isAccessingPublicRoute || isLoggedIn();
  const isMentorViewableByAnyone =
    mentorSettings?.data?.mentorVisibility ===
    MentorVisibilityEnum.VIEWABLE_BY_ANYONE;

  const setInputValue = (input: string) => {
    dispatch(chatInputSliceActions.setTextareaInput(input));
  };

  const handleSelectPrompt = (promptText: string) => {
    setInputValue(promptText);
    setIsPromptGalleryOpen(false);
  };

  const { handleMicrophoneBtnClick, processing, recording, time } =
    useVoiceChat({
      sendMessage: handleSelectPrompt,
    });

  // Get attached files from Redux store with a fallback for when the state is not yet available
  const attachedFiles = useAppSelector(
    (state: RootState) => state.files.attachedFiles || [],
  );

  // Check if any files are currently uploading
  const hasUploadingFiles = attachedFiles.some(
    (file) =>
      file.uploadStatus === 'pending' || file.uploadStatus === 'uploading',
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Prevent submission when chat is disabled, files are uploading, or session not ready
    if (isChatDisabledByRbac || hasUploadingFiles || !sessionId) return;
    onSubmit(inputValue);
    setInputValue('');
    setFileAddedNotification(null);
  };

  const openPromptGallery = () => {
    setIsPromptGalleryOpen(true);
  };

  const handleRemoveFile = (id: string) => {
    dispatch(removeFile(id));
  };

  const handleFileInputChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);

      // Show notification
      setFileAddedNotification(
        `Uploading ${files.length} file${files.length > 1 ? 's' : ''}...`,
      );

      // Upload files (validation happens inside the hook)
      await uploadFiles(files);

      // Hide notification after upload completes
      setTimeout(() => {
        setFileAddedNotification(null);
      }, 3000);

      // Reset the file input so the same file can be uploaded again if needed
      if (fileUploadInputRef.current) {
        fileUploadInputRef.current.value = '';
      }
    }
  };

  const triggerFileInput = () => {
    if (fileUploadInputRef.current) {
      fileUploadInputRef.current.click();
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setInputValue(text);
  };

  const textAreaPlaceholder = () => {
    if (recording) {
      const formattedTime = format(new Date(time), 'mm:ss');
      return `Listening... ${formattedTime}`;
    }
    if (processing) {
      return 'Processing...';
    }
    return 'Ask anything';
  };

  return (
    <>
      {isTabletOrMobile && !isPreviewMode && !embedMode && !compactMode && (
        <div
          className="mx-auto flex w-full justify-end pt-4 pl-4"
          style={
            chatAreaMaxWidth ? { maxWidth: `${chatAreaMaxWidth}px` } : undefined
          }
        >
          <RetrievedDocumentsButton sessionId={sessionId} />
        </div>
      )}
      {mentorSettings?.data?.disclaimer && !compactMode && (
        <div
          className="mx-auto mt-1 w-full pb-1"
          style={
            chatAreaMaxWidth ? { maxWidth: `${chatAreaMaxWidth}px` } : undefined
          }
        >
          <p
            id="chat-input-disclaimer"
            className="text-center text-[0.625rem] text-gray-500 italic"
          >
            {mentorSettings?.data?.disclaimer}
          </p>
        </div>
      )}
      <form
        ref={containerRef}
        onSubmit={handleSubmit}
        className={cn(
          'mx-auto mt-4 w-full pb-2',
          CSS_CLASS_NAMES.CHAT.TEXTAREA,
        )}
        style={
          chatAreaMaxWidth ? { maxWidth: `${chatAreaMaxWidth}px` } : undefined
        }
      >
        <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-[#fbfbfb] pb-3 shadow-xs">
          <FileAttachmentsList
            attachedFiles={attachedFiles}
            onRemoveFile={handleRemoveFile}
            onRetryFile={retryUpload}
          />

          {fileAddedNotification && (
            <div className="animate-in slide-in-from-bottom-5 absolute top-0 right-0 left-0 -mt-10 flex items-center gap-2 rounded-md bg-blue-50 p-2 text-xs text-blue-600 duration-300">
              <FileText className="h-3 w-3" />
              <span className="truncate">{fileAddedNotification}</span>
            </div>
          )}

          <div className="grid">
            <label
              id="chat-input-label"
              htmlFor="chat-input-textarea"
              className="sr-only"
            >
              Ask anything
            </label>
            <AutoResizeTextarea
              id="chat-input-textarea"
              aria-labelledby="chat-input-label"
              aria-describedby={
                mentorSettings?.data?.disclaimer
                  ? 'chat-input-disclaimer'
                  : undefined
              }
              value={inputValue}
              onChange={handleInputChange}
              onSubmit={handleSubmit}
              sessionId={sessionId}
              isPreviewMode={isPreviewMode}
              textAreaRows={textAreaRows}
              placeholder={
                isChatDisabledByRbac
                  ? "Sorry about that! You don't have permission to chat."
                  : textAreaPlaceholder()
              }
              disabled={isChatDisabledByRbac || hasUploadingFiles}
              allowEmptySubmit={attachedFiles.length > 0}
              allowAnonymousAccess={
                isMentorViewableByAnyone ||
                showingSharedChat ||
                !!userIsVisiting
              }
              embedMode={embedMode}
            />
            <div className="flex items-center gap-2 px-2">
              {visibleToLoggedInUsersOnly && !compactMode && (
                <UploadMenu
                  onFileInputTrigger={() =>
                    executeWithTrialCheck(triggerFileInput)
                  }
                  disabled={isChatDisabledByRbac || !sessionId}
                />
              )}

              {visibleToLoggedInUsersOnly && !compactMode && (
                <InsideButtons
                  containerWidth={containerWidth}
                  activeOptions={activeTools}
                  onOptionClick={updateSessionTools}
                  deepResearch={deepResearch}
                  artifactsEnabled={artifactsEnabled}
                  disabled={isChatDisabledByRbac}
                  onOpenPromptGallery={openPromptGallery}
                  embedMode={embedMode}
                  promptsIsEnabled={promptsIsEnabled}
                  studyMode={studyMode}
                  memoryEnabled={mentorSettings.data.memoryEnabled}
                  tenantKey={tenantKey}
                  username={username}
                />
              )}

              <div className="ml-auto flex">
                {visibleToLoggedInUsersOnly && !compactMode && (
                  <ScreenSharingButton
                    onClick={onScreenSharingClick}
                    isScreenSharingModalOpen={isScreenSharingModalOpen}
                    screenSharing={screenSharing}
                    isPreviewMode={isPreviewMode}
                    disabled={isChatDisabledByRbac}
                  />
                )}

                {visibleToLoggedInUsersOnly && !compactMode && (
                  <VoiceChatButton
                    isPreviewMode={isPreviewMode}
                    handleMicrophoneBtnClick={() =>
                      executeWithTrialCheck(handleMicrophoneBtnClick)
                    }
                    processing={processing}
                    recording={recording}
                    disabled={isChatDisabledByRbac}
                  />
                )}

                {visibleToLoggedInUsersOnly && !compactMode && (
                  <VoiceCallButton
                    isPreviewMode={isPreviewMode}
                    onClick={() => executeWithTrialCheck(onPhoneCallClick)}
                    disabled={isChatDisabledByRbac}
                  />
                )}

                {isStreaming ? (
                  <StopStreamingButton
                    ref={stopStreamingButtonRef}
                    stopGenerating={stopGenerating}
                  />
                ) : (
                  <SubmitMessageButton
                    isPreviewMode={isPreviewMode}
                    allowAnonymousAccess={isMentorViewableByAnyone}
                    isUploading={hasUploadingFiles}
                    disabled={isChatDisabledByRbac || !sessionId}
                    isConnecting={isConnecting}
                  />
                )}
              </div>
            </div>
          </div>

          <input
            type="file"
            ref={fileUploadInputRef}
            className="hidden"
            onChange={handleFileInputChange}
            accept={
              fileUploadCapabilities.allSupportedTypes.length > 0
                ? fileUploadCapabilities.allSupportedTypes.join(',')
                : MENTOR_CHAT_DOCUMENTS_EXTENSIONS.join(',')
            }
            multiple
            disabled={isChatDisabledByRbac || !sessionId}
          />
        </div>

        {visibleToLoggedInUsersOnly && !compactMode && (
          <div className="flex w-full justify-center">
            <OutsideButtons
              activeOptions={activeTools}
              onOptionClick={updateSessionTools}
              setSessionTools={setSessionTools}
              onCrossClick={updateSessionTools}
              containerWidth={containerWidth}
              enableWebBrowsing={enableWebBrowsing}
              imageGeneration={imageGeneration}
              codeInterpreter={codeInterpreter}
              googleSlidesIsEnabled={googleSlidesIsEnabled}
              googleDocumentIsEnabled={googleDocumentIsEnabled}
              tenantKey={tenantKey}
              userId={username}
              disabled={isChatDisabledByRbac}
            />
          </div>
        )}
      </form>

      {isPromptGalleryOpen && (
        <PromptGalleryModal
          isOpen={isPromptGalleryOpen}
          onClose={() => setIsPromptGalleryOpen(false)}
          onSelectPrompt={handleSelectPrompt}
        />
      )}
      {isFreeTrialModalOpen && FreeTrialDialog && (
        <FreeTrialDialog
          isOpen={isFreeTrialModalOpen}
          onClose={closeFreeTrialModal}
        />
      )}
    </>
  );
}
