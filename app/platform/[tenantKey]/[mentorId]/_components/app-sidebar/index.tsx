'use client';

import React, { useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { ToggleSidebarButton } from './toggle-sidebar-button';
import { PinnedMessages } from './pinned-messages';
import { RecentMessages } from './recent-messages';
import { useSidebarNavigation } from '@/hooks/user-navigate';
import { useShowFreeTrialDialog } from '@/hooks/user-user-actions';
import Logo from '@/components/logo';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/lib/hooks';

import { useEmbedMode } from '@/hooks/use-embed-mode';
import { useUserType } from '@/hooks/use-user-type';
import { chatActions, selectSessionId } from '@iblai/iblai-js/web-utils';
import eventBus, { RemoteEvents } from '@/lib/eventBus';
import { ProjectsSidebarDropdown } from './projects-sidebar-dropdown';
import { ProjectPageParams } from '@/lib/types';
import { AppSidebarFooter } from './app-sidebar-footer';
import { AppSidebarContent } from './app-sidebar-content';
import {
  useCurrentTenant,
  useIsVisiting,
  useUserIsStudent,
  useVisitingTenant,
} from '@/hooks/use-user';
import { UserType, LOCAL_STORAGE_KEYS } from '@/lib/constants';
import { clearFiles } from '@iblai/iblai-js/web-utils';
import { useLocalStorage } from '@/hooks/use-local-storage';

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { mentorId, projectId, tenantKey } = useParams<ProjectPageParams>();
  const dispatch = useAppDispatch();
  const { open, openMobile, isMobile, setOpenMobile } = useSidebar();
  const { executeWithTrialCheck, FreeTrialDialog, closeModal, isModalOpen } =
    useShowFreeTrialDialog();
  const { contentItems, footerItems } = useSidebarNavigation();
  const embedMode = useEmbedMode();
  const { currentTenant } = useCurrentTenant();
  const { isUserTypeAllowed } = useUserType();
  const isMainTenant = tenantKey === 'main';
  const userIsStudent = useUserIsStudent();
  const userIsVisiting = useIsVisiting();
  const { visitingTenant } = useVisitingTenant();
  const sessionId = useAppSelector(selectSessionId);
  const [cachedSessionId, saveCachedSessionId] = useLocalStorage<Record<string, string>>(
    LOCAL_STORAGE_KEYS.SESSION_ID,
    {},
    { deserializer: (value) => JSON.parse(value) },
  );

  const isSidebarOpen = (isMobile && openMobile) || (!isMobile && open);
  const isChatPage = (pathname && /\/platform\/[^/]+\/[^/]+$/.test(pathname)) || projectId;

  // this will map the content items to include the STUDENT user type for students in the main tenant
  const updateNavItemsForStudentsInMainOrAdvertisingTenant = useCallback(
    (item: any) => {
      if (isMainTenant || currentTenant?.is_advertising || visitingTenant) {
        if (userIsStudent) {
          item = { ...item, userTypes: [...item.userTypes, UserType.STUDENT] };
        } else if (userIsVisiting) {
          item = { ...item, userTypes: [...item.userTypes, UserType.VISITING] };
        }
      }
      return item;
    },
    [isMainTenant, userIsStudent, currentTenant],
  );

  const handleSelectMessage = async (message: any) => {
    // clear files if the session id is different
    if (message.session_id !== sessionId) {
      dispatch(clearFiles(undefined));
    }

    const messages = message.messages
      .map((messageObj) => {
        // Map files from backend format to fileAttachments
        const fileAttachments =
          messageObj.files?.map((file: any) => ({
            fileId: String(file.id),
            fileName: file.name,
            fileType: file.content_type,
            fileSize: file.file_size,
            uploadUrl: file.url,
          })) || [];

        // Transform artifact_versions from snake_case to camelCase for canvas preview
        const artifactVersions = messageObj.artifact_versions?.map((av: any) => ({
          id: av.id,
          artifact: {
            id: av.artifact?.id,
            title: av.artifact?.title,
            content: av.artifact?.content,
            file_extension: av.artifact?.file_extension,
            llm_name: av.artifact?.llm_name,
            llm_provider: av.artifact?.llm_provider,
            date_created: av.artifact?.date_created,
            date_updated: av.artifact?.date_updated,
            metadata: av.artifact?.metadata,
            username: av.artifact?.username,
            session_id: av.artifact?.session_id,
            current_version_number: av.artifact?.current_version_number,
            version_count: av.artifact?.version_count,
          },
          title: av.title,
          content: av.content,
          session_id: av.session_id,
          content_length: av.content_length,
          is_current: av.is_current,
          chat_message: av.chat_message,
          version_number: av.version_number,
          date_created: av.date_created,
          created_by: av.created_by,
          change_summary: av.change_summary,
        }));

        return {
          id: messageObj.id,
          role: messageObj.message.type === 'human' ? 'user' : 'ai',
          content: messageObj.message.data.content,
          timestamp: messageObj.inserted_at,
          visible: true,
          fileAttachments: fileAttachments.length > 0 ? fileAttachments : undefined,
          artifactVersions: artifactVersions?.length > 0 ? artifactVersions : undefined,
        };
      })
      .reverse();

    eventBus.emit(RemoteEvents.stopChatGenerating);
    dispatch(chatActions.resetIsTyping(undefined));
    dispatch(chatActions.setStreaming(false));
    dispatch(chatActions.resetCurrentStreamingMessage(undefined));
    dispatch(chatActions.setActiveTab('chat'));
    dispatch(chatActions.updateSessionIds(message.session_id));
    dispatch(chatActions.setNewMessages(messages));
    dispatch(chatActions.setShouldStartNewChat(false));

    // Persist session ID to localStorage
    if (mentorId) {
      saveCachedSessionId({ ...cachedSessionId, [mentorId]: message.session_id });
    }

    if (!isChatPage) {
      if (projectId) {
        router.push(`/platform/${tenantKey}/projects/${projectId}/${mentorId}`);
      } else {
        router.push(`/platform/${tenantKey}/${mentorId}`);
      }
    }
  };

  return (
    <>
      <Sidebar
        collapsible="icon"
        variant="sidebar"
        className={cn('flex flex-col border-r border-[#D0E0FF] transition-all duration-300')}
        sidebarInnerClassName={cn('bg-white')}
      >
        <SidebarHeader
          className={cn('h-16 flex justify-center flex-none border-b border-[#D0E0FF]')}
        >
          <div
            className={cn('flex w-full items-center', {
              'justify-center': !(open || openMobile),
            })}
          >
            <ToggleSidebarButton />
            <div
              className={cn('-ml-9 flex-1 flex items-center justify-center', {
                hidden: !isSidebarOpen,
                flex: isSidebarOpen,
              })}
            >
              <Logo className={cn('max-w-[calc(16rem-2.25rem)]')} />
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent className="!overflow-visible p-4 flex-grow px-0">
          <SidebarMenu
            className={cn('flex-none px-4 gap-0', {
              'place-content-center': !open && !openMobile,
            })}
          >
            {embedMode ? (
              <AppSidebarContent
                contentItems={contentItems.filter((item) => item.label === 'New Chat')}
                isUserTypeAllowed={isUserTypeAllowed}
                isMobile={isMobile}
                open={open}
                openMobile={openMobile}
                setOpenMobile={setOpenMobile}
                updateNavItemsForStudentsInMainOrAdvertisingTenant={
                  updateNavItemsForStudentsInMainOrAdvertisingTenant
                }
                executeWithTrialCheck={executeWithTrialCheck}
                tenantKey={tenantKey}
              />
            ) : (
              <AppSidebarContent
                contentItems={contentItems}
                isUserTypeAllowed={isUserTypeAllowed}
                isMobile={isMobile}
                open={open}
                openMobile={openMobile}
                setOpenMobile={setOpenMobile}
                updateNavItemsForStudentsInMainOrAdvertisingTenant={
                  updateNavItemsForStudentsInMainOrAdvertisingTenant
                }
                executeWithTrialCheck={executeWithTrialCheck}
                tenantKey={tenantKey}
              />
            )}
          </SidebarMenu>
          <div className="border-t border-[#D0E0FF] mb-2" />
          <SidebarMenu className="flex-1 overflow-auto h-full scrollbar-thin px-4">
            <SidebarMenuItem className="overflow-y-auto h-full scrollbar-thin">
              {isSidebarOpen && (
                <div className="flex max-h-fit flex-col overflow-y-auto">
                  {!embedMode && <ProjectsSidebarDropdown />}
                  <PinnedMessages onSelectMessage={handleSelectMessage} mentorId={mentorId} />
                  <RecentMessages onSelectMessage={handleSelectMessage} mentorId={mentorId} />
                </div>
              )}
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
        <div className="border-t border-[#D0E0FF] mb-2" />
        <AppSidebarFooter
          embedMode={embedMode}
          footerItems={footerItems}
          isUserTypeAllowed={isUserTypeAllowed}
          isMobile={isMobile}
          open={open}
          openMobile={openMobile}
          setOpenMobile={setOpenMobile}
          executeWithTrialCheck={executeWithTrialCheck}
          tenantKey={tenantKey}
          updateNavItemsForStudentsInMainOrAdvertisingTenant={
            updateNavItemsForStudentsInMainOrAdvertisingTenant
          }
        />
      </Sidebar>

      {isModalOpen && FreeTrialDialog && (
        <FreeTrialDialog onClose={closeModal} isOpen={isModalOpen} />
      )}
    </>
  );
}
