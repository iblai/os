'use client';

import React from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Download,
  MessageCircleIcon,
  MoreHorizontal,
  Pin,
  Trash2,
} from 'lucide-react';
import {
  chatApiSlice,
  useAddPinnedMessageMutation,
  useDeleteMessageMutation,
  useGetPinnedMessagesQuery,
} from '@iblai/iblai-js/data-layer';
import { getUserName } from '@/features/utils';
import { useParams } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/lib/hooks';
import writeXlsxFile from 'write-excel-file/browser';
import { saveAs } from 'file-saver';
import {
  chatActions,
  clearFiles,
  selectSessionId,
} from '@iblai/iblai-js/web-utils';
import { useSidebar } from '@/components/ui/sidebar';
import { TenantKeyMentorIdParams } from '@/lib/types';
import {
  getCurrentArtifactTitle,
  getFirstMessageWithContent,
} from '@/lib/utils';
import eventBus, { RemoteEvents } from '@/lib/eventBus';
import Markdown from '@/components/markdown';

interface PinnedMessagesProps {
  onSelectMessage: (message: any) => void;
  mentorId: string;
}

export function PinnedMessages({
  onSelectMessage,
  mentorId,
}: PinnedMessagesProps) {
  const { isMobile, setOpenMobile } = useSidebar();
  const dispatch = useAppDispatch();
  const params = useParams<{ tenantKey: string }>();
  const { tenantKey } = useParams<TenantKeyMentorIdParams>();
  const appSessionId = useAppSelector(selectSessionId);

  const { data: pinnedMessages } = useGetPinnedMessagesQuery(
    {
      org: params.tenantKey,
      sessionId: appSessionId,
      // @ts-expect-error - userId parameter may not exist in API but passed from legacy code
      userId: getUserName(),
    },
    {
      skip: !getUserName(),
      selectFromResult(state) {
        return {
          ...state,
          data: {
            ...state.data,
            // @ts-expect-error - pinnedMessages type structure not fully defined, results exists at runtime
            results: state.data?.results?.filter(
              (result: any) => result.mentor.unique_id === mentorId,
            ),
          },
        };
      },
    },
  );

  const [pinMessage] = useAddPinnedMessageMutation();
  const [deleteMessage] = useDeleteMessageMutation();

  const handleDelete = async (pinnedMessage: any) => {
    try {
      await deleteMessage({
        org: params.tenantKey,
        // @ts-expect-error - userId parameter may not exist in API but is passed from legacy code
        userId: getUserName(),
        sessionId: pinnedMessage.session_id,
      }).unwrap();

      // Remove from pinned messages cache
      (dispatch as any)(
        chatApiSlice.util.updateQueryData(
          'getPinnedMessages',
          {
            org: params.tenantKey,
            // @ts-expect-error - userId parameter may not exist in API but is passed from legacy code
            userId: getUserName(),
            sessionId: appSessionId,
          },
          (draft: any) => {
            draft.results = draft.results.filter(
              (msg: any) => msg.session_id !== pinnedMessage.session_id,
            );
          },
        ),
      );

      // Also remove from recent messages cache in case it exists there
      (dispatch as any)(
        chatApiSlice.util.updateQueryData(
          'getRecentMessage',
          {
            org: params.tenantKey,
            // @ts-expect-error - userId parameter may not exist in API but is passed from legacy code
            userId: getUserName(),
          },
          (draft: any) => {
            draft.results = draft.results.filter(
              (msg: any) => msg.session_id !== pinnedMessage.session_id,
            );
          },
        ),
      );

      // If the deleted session was the active chat, start a new chat
      if (pinnedMessage.session_id === appSessionId) {
        dispatch(clearFiles(undefined));
        eventBus.emit(RemoteEvents.newChat);
        dispatch(chatActions.setShouldStartNewChat(true));
      }
    } catch (err) {
      console.error('Failed to delete message: ', err);
    }
  };

  const handlePin = async (recentMessage: any) => {
    try {
      const result = await pinMessage({
        org: params.tenantKey,
        // @ts-expect-error - userId parameter may not exist in API but is passed from legacy code
        userId: getUserName(),
        requestBody: { session_id: recentMessage.session_id },
      }).unwrap();
      (dispatch as any)(
        chatApiSlice.util.updateQueryData(
          'getPinnedMessages',
          {
            org: params.tenantKey,
            // @ts-expect-error - userId parameter may not exist in API but is passed from legacy code
            userId: getUserName(),
            sessionId: appSessionId,
          },
          (draft: any) => {
            draft.results.push(result ?? recentMessage);
          },
        ),
      );

      (dispatch as any)(
        chatApiSlice.util.updateQueryData(
          'getRecentMessage',
          {
            org: params.tenantKey,
            // @ts-expect-error - userId parameter may not exist in API but is passed from legacy code
            userId: getUserName(),
          },
          (draft: any) => {
            draft.results = draft.results.filter(
              (msg: any) => msg.session_id !== recentMessage.session_id,
            );
          },
        ),
      );
    } catch (err) {
      console.error('Failed to pin message: ', err);
      console.error(JSON.stringify({ tenant: tenantKey, error: err }));
    }
  };

  const handleExport = async (messages: any) => {
    try {
      const data = messages.filter((item: any) => item?.message?.data?.content);
      const blob = await writeXlsxFile(data, {
        sheet: 'Messages',
        columns: [
          {
            header: 'Message Type',
            cell: (message: any) => message?.message?.data?.type,
          },
          {
            header: 'Content',
            cell: (message: any) => message?.message?.data?.content,
          },
        ],
      }).toBlob();
      saveAs(blob, 'messages.xlsx');
    } catch (err) {
      console.error('Failed to export messages: ', err);
    }
  };

  const handleSelectMessage = (message: any) => {
    onSelectMessage(message);
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  // @ts-expect-error - pinnedMessages type structure not fully defined
  if (!pinnedMessages?.results?.length) {
    return null;
  }

  return (
    <div>
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="pinned" className="border-none">
          <AccordionTrigger className="cursor-pointer space-x-1 rounded-md px-2 py-1.5 text-sm font-medium text-gray-700 hover:bg-[#c9d8f8] hover:no-underline">
            <span className="flex items-center gap-3">
              <Pin className="h-4 w-4 text-gray-500" />
              Pinned
            </span>
          </AccordionTrigger>
          <AccordionContent className="mt-1 ml-4 pb-0">
            <div className="space-y-1 border-l border-[#D0E0FF]">
              {/* @ts-expect-error - pinnedMessage type not fully defined */}
              {pinnedMessages?.results?.map((pinnedMessage: any) => (
                <div className="group relative" key={pinnedMessage.session_id}>
                  <Button
                    variant="ghost"
                    className="flex h-auto w-full items-center gap-1 px-2 hover:bg-[#c9d8f8]"
                    onClick={() => handleSelectMessage(pinnedMessage)}
                  >
                    <div className="mr-2 flex h-4 w-4 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-300 text-xs">
                      {pinnedMessage.mentor.profile_image ? (
                        <Image
                          src={pinnedMessage.mentor.profile_image}
                          alt="User avatar"
                          className="h-full w-full object-cover"
                          width={20}
                          height={20}
                        />
                      ) : (
                        <MessageCircleIcon />
                      )}
                    </div>
                    <div className="-ml-1 line-clamp-1 flex-1 overflow-hidden pr-6 text-left text-xs text-gray-800 [&_*]:!my-0 [&_*]:!text-xs [&_*]:!leading-snug [&_*]:!font-normal [&_*]:!text-gray-800 [&_h2]:!border-0">
                      {(() => {
                        const content = getFirstMessageWithContent(
                          pinnedMessage?.messages,
                        );

                        if (!content) {
                          const artifactTitle = getCurrentArtifactTitle(
                            pinnedMessage?.messages,
                          );
                          if (artifactTitle) {
                            return artifactTitle;
                          }
                          return 'No content';
                        }

                        return (
                          <Markdown className="!space-y-0">{content}</Markdown>
                        );
                      })()}
                    </div>
                  </Button>
                  <div className="absolute top-1/2 right-2 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 p-0"
                        >
                          <span className="sr-only">More chat options</span>
                          <MoreHorizontal className="h-4 w-4 text-gray-400" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => handlePin(pinnedMessage.session_id)}
                        >
                          <Pin className="mr-2 h-4 w-4" />
                          <span>Unpin</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            void handleExport(pinnedMessage.messages)
                          }
                        >
                          <Download className="mr-2 h-4 w-4" />
                          <span>Export</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDelete(pinnedMessage)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          <span>Delete</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
