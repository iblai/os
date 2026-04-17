'use client';

import React from 'react';

import { FileCard } from './file-card';
import { ImageMessage } from './image-message';
import { cn } from '@/lib/utils';
import { Message as BaseMessage } from '@iblai/iblai-js/web-utils';
import { CSS_CLASS_NAMES } from '@/lib/constants';

interface Message extends BaseMessage {
  replyTo?: Message | null;
}

type Props = {
  message: Message;
  isHighlighted: boolean;
  profileImage: string;
  mentorName: string;
  messages: Message[];
  onHighlightMessage: (messageId: number) => void;
  onPreviewImage: (url: string) => void;
};

export function UserMessageBubble({
  message,
  isHighlighted,
  profileImage,
  mentorName,
  messages,
  onHighlightMessage,
  onPreviewImage,
}: Props) {
  return (
    <div
      className={`message-container mb-4 flex flex-col items-end transition-all duration-300 ${
        isHighlighted ? 'rounded-2xl bg-blue-100' : ''
      }`}
    >
      {/* Render file attachments if present (new structure) */}
      {message.fileAttachments && message.fileAttachments.length > 0 && (
        <div className="mb-2 flex flex-col items-end gap-2">
          {message.fileAttachments.map((attachment, idx) => {
            if (attachment.fileType.startsWith('image/')) {
              return (
                <ImageMessage
                  key={`${message.id}-attachment-${idx}`}
                  url={attachment.uploadUrl || ''}
                  fileName={attachment.fileName}
                  setPreviewImage={onPreviewImage}
                />
              );
            } else {
              return (
                <FileCard
                  key={`${message.id}-attachment-${idx}`}
                  fileName={attachment.fileName}
                  fileType={attachment.fileType}
                />
              );
            }
          })}
        </div>
      )}

      {/* Render file attachments if present (legacy structure for backwards compatibility) */}
      {!message.fileAttachments && message.url && message.fileType && (
        <div className="flex flex-col items-end">
          {message.fileType.startsWith('image/') ? (
            <ImageMessage
              key={message.id}
              url={message.url}
              fileName={message.content}
              setPreviewImage={onPreviewImage}
            />
          ) : (
            <FileCard
              key={message.id}
              fileName={message.content}
              fileType={message.fileType}
            />
          )}
        </div>
      )}

      {/* If this is a reply to another message, show the reply context */}
      {message.replyTo && (
        <div
          className="mb-2 max-w-full cursor-pointer overflow-hidden rounded-2xl border border-gray-100 shadow-sm"
          onClick={() => {
            // Find the index of the original message
            const originalMessageIndex = messages.findIndex(
              (m) =>
                m.role === message.replyTo?.role &&
                m.content === message.replyTo?.content,
            );
            if (originalMessageIndex !== -1) {
              onHighlightMessage(originalMessageIndex);
              // Scroll to the original message if needed
              const messageElements =
                document.querySelectorAll('.message-container');
              if (messageElements[originalMessageIndex]) {
                messageElements[originalMessageIndex].scrollIntoView({
                  behavior: 'smooth',
                  block: 'center',
                });
              }
            }
          }}
        >
          {/* Quoted message with white background */}
          <div className="rounded-t-2xl bg-white p-1.5">
            <div className="mb-0.5 flex items-center gap-1">
              <span className="text-sm text-gray-500">"</span>
              <div className="flex h-4 w-4 items-center justify-center overflow-hidden rounded-full bg-gray-500">
                <img
                  src={profileImage}
                  alt={mentorName}
                  className="h-full w-full object-cover"
                />
              </div>
              <span className="text-xs font-medium">{mentorName}</span>
            </div>
            <div className="ml-5 line-clamp-2 text-xs text-gray-800">
              {message.replyTo.content}
            </div>
          </div>

          {/* Reply message with light blue background */}
          <div className="rounded-b-2xl bg-blue-50 px-4 py-2 text-sm whitespace-pre-wrap text-gray-800">
            {message.content}
          </div>
        </div>
      )}

      {/* Render message content if not a reply and there is content */}
      {!message.replyTo && message.content && (
        <div
          className={cn(
            'max-w-full rounded-2xl bg-blue-50 px-4 py-2 text-sm wrap-anywhere whitespace-pre-wrap text-gray-800',
            CSS_CLASS_NAMES.CHAT.USER_MESSAGE_QUERY,
          )}
        >
          {message.content}
        </div>
      )}
    </div>
  );
}
