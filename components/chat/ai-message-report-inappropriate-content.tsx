'use client';

import { Flag } from 'lucide-react';

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { Message } from '@iblai/iblai-js/web-utils';

const DEFAULT_SUPPORT_EMAIL = 'support@iblai.zendesk.com';

type Props = {
  mentorName: string;
  messages: Message[];
  supportEmail?: string;
};

function formatConversationForEmail(messages: Message[]): string {
  return messages
    .map((msg) => `[${msg.role === 'user' ? 'User' : 'AI'}]: ${msg.content}`)
    .join('\n\n');
}

export function AIMessageReportInappropriateContent({
  mentorName,
  messages,
  supportEmail,
}: Props) {
  const toEmail = supportEmail || DEFAULT_SUPPORT_EMAIL;
  const subject = `Report Inappropriate Content — ${mentorName}`;
  const body = `I would like to report inappropriate content from the following conversation:\n\n---\n${formatConversationForEmail(messages)}\n---\n\nAdditional comments:\n\n-`;

  const mailtoUrl = `mailto:${toEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <a href={mailtoUrl} className="-ml-1 text-gray-500 hover:text-gray-700">
          <span className="sr-only">Report Inappropriate Content</span>
          <Flag className="h-4 w-4" />
        </a>
      </TooltipTrigger>
      <TooltipContent className="ibl-tooltip-content">
        Report Inappropriate Content
      </TooltipContent>
    </Tooltip>
  );
}
