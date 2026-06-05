'use client';

import { useState } from 'react';

import dynamic from 'next/dynamic';

import { OpenFolderIcon } from '@/components/icons/svg-icons';
import { Project } from '@iblai/iblai-js/data-layer';
import { ProjectMentorsList } from './project-mentors-list';
import { ProjectActionButtons } from './project-action-buttons';
import { ChatInputForm } from '../chat-input-form';
import { Message } from '@iblai/iblai-js/web-utils';
import { useUserIsStudent } from '@/hooks/use-user';
import { isLoggedIn } from '@/lib/utils';

const ProjectInstructionsModal = dynamic(
  () =>
    import('@/components/projects/project-instructions-modal').then(
      (mod) => mod.ProjectInstructionsModal,
    ),
  { ssr: false },
);

const ProjectFilesModal = dynamic(
  () =>
    import('@/components/projects/project-files-modal').then(
      (mod) => mod.ProjectFilesModal,
    ),
  { ssr: false },
);

const AddMentorToProjectModal = dynamic(
  () =>
    import('@/components/projects/add-mentor-to-project-modal').then(
      (mod) => mod.AddMentorToProjectModal,
    ),
  { ssr: false },
);

type Props = {
  project: Project;
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
};

export function ProjectLandingPage({
  project,
  sessionId,
  onSubmit,
  onScreenSharingClick,
  isScreenSharingModalOpen,
  onPhoneCallClick,
  stopGenerating,
  tenantKey,
  username,
  enableSafetyDisclaimer,
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
  isPreviewMode,
  setMessage,
  googleSlidesIsEnabled,
  googleDocumentIsEnabled,
  artifactsEnabled,
}: Props) {
  const [isInstructionsModalOpen, setIsInstructionsModalOpen] = useState(false);
  const [isFilesModalOpen, setIsFilesModalOpen] = useState(false);
  const [isAddMentorModalOpen, setIsAddMentorModalOpen] = useState(false);
  const userIsStudent = useUserIsStudent();

  // Hide "Add files" and "Add project instructions" if user is logged in and NOT a student
  const shouldHideFileAndInstructionSection = isLoggedIn() && !userIsStudent;

  return (
    <>
      <div className="mx-auto flex h-full w-full max-w-4xl flex-col">
        {/* Project Header */}
        <div className="flex items-center justify-center gap-3 border-b border-gray-200 px-6 py-6">
          <OpenFolderIcon className="h-7 w-7" />
          <h1 className="line-clamp-1 text-2xl font-semibold text-gray-900">
            {project.name}
          </h1>
        </div>

        {/* Main Content */}
        <div className="flex-1 space-y-8 overflow-y-auto py-6">
          {/* Chat Input Form */}
          <div className="w-full max-w-4xl">
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
            />
          </div>

          {/* Background Section for Action Buttons and Recent Files */}
          <div className="space-y-8 rounded-lg bg-[#FBFBFB] p-6">
            {/* Action Buttons - Combined Card with transparent background */}
            {shouldHideFileAndInstructionSection && (
              <ProjectActionButtons
                onFilesClick={() => setIsFilesModalOpen(true)}
                onInstructionsClick={() => setIsInstructionsModalOpen(true)}
                instructions={project.instructions}
              />
            )}

            {/* Project Mentors Section */}
            {project.mentors && project.mentors.length > 0 && (
              <ProjectMentorsList
                projectMentors={project.mentors?.map((mentor) => ({
                  id: mentor.id.toString(),
                  unique_id: mentor.unique_id,
                  name: mentor.name,
                  avatar: (mentor as any).profile_image,
                  description: (mentor as any).description,
                }))}
                onAddMentorClick={() => setIsAddMentorModalOpen(true)}
                showTitle={true}
              />
            )}
          </div>
        </div>
      </div>

      {isInstructionsModalOpen && (
        <ProjectInstructionsModal
          isOpen={isInstructionsModalOpen}
          onClose={() => setIsInstructionsModalOpen(false)}
        />
      )}

      {isFilesModalOpen && (
        <ProjectFilesModal
          isOpen={isFilesModalOpen}
          onClose={() => setIsFilesModalOpen(false)}
        />
      )}

      {isAddMentorModalOpen && (
        <AddMentorToProjectModal
          isOpen={isAddMentorModalOpen}
          onClose={() => setIsAddMentorModalOpen(false)}
          projectName={project.name}
        />
      )}
    </>
  );
}
