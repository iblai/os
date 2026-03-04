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
      className={`flex flex-col items-end mb-4 pl-4 message-container transition-all duration-300 ${
        isHighlighted ? 'bg-blue-100 rounded-lg' : ''
      }`}
    >
      {/* Render file attachments if present (new structure) */}
      {message.fileAttachments && message.fileAttachments.length > 0 && (
        <div className="flex flex-col items-end gap-2 mb-2">
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
            <FileCard key={message.id} fileName={message.content} fileType={message.fileType} />
          )}
        </div>
      )}

      {/* If this is a reply to another message, show the reply context */}
      {message.replyTo && (
        <div
          className="rounded-lg overflow-hidden mb-2 max-w-[80%] w-full cursor-pointer shadow-sm border border-gray-100"
          onClick={() => {
            // Find the index of the original message
            const originalMessageIndex = messages.findIndex(
              (m) => m.role === message.replyTo?.role && m.content === message.replyTo?.content,
            );
            if (originalMessageIndex !== -1) {
              onHighlightMessage(originalMessageIndex);
              // Scroll to the original message if needed
              const messageElements = document.querySelectorAll('.message-container');
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
          <div className="bg-white rounded-t-lg p-1.5">
            <div className="flex items-center gap-1 mb-0.5">
              <span className="text-gray-500 text-sm">"</span>
              <div className="w-4 h-4 rounded-full bg-gray-500 flex items-center justify-center overflow-hidden">
                <img src={profileImage} alt={mentorName} className="w-full h-full object-cover" />
              </div>
              <span className="font-medium text-xs">{mentorName}</span>
            </div>
            <div className="text-gray-800 text-xs ml-5 line-clamp-2">{message.replyTo.content}</div>
          </div>

          {/* Reply message with light blue background */}
          <div className="bg-blue-50 rounded-b-lg px-4 py-2 text-gray-800 text-sm whitespace-pre-wrap">
            {message.content}
          </div>
        </div>
      )}

      {/* Render message content if not a reply and there is content */}
      {!message.replyTo && message.content && (
        <div
          className={cn(
            'bg-blue-50 text-gray-800 text-sm rounded-lg px-4 py-2 max-w-[80%] wrap-anywhere whitespace-pre-wrap',
            CSS_CLASS_NAMES.CHAT.USER_MESSAGE_QUERY,
          )}
        >
          {message.content}
        </div>
      )}
    </div>
  );
}
