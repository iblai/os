'use client';

import { Flag } from 'lucide-react';
import { useTranslations } from 'next-intl';

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

function formatConversationForEmail(
  messages: Message[],
  roleUser: string,
  roleAi: string,
): string {
  return messages
    .map(
      (msg) => `[${msg.role === 'user' ? roleUser : roleAi}]: ${msg.content}`,
    )
    .join('\n\n');
}

export function AIMessageReportInappropriateContent({
  mentorName,
  messages,
  supportEmail,
}: Props) {
  const t = useTranslations('chatAiMessageReportInappropriateContent');

  const toEmail = supportEmail || DEFAULT_SUPPORT_EMAIL;
  const subject = t('emailSubject', { mentorName });
  const conversation = formatConversationForEmail(
    messages,
    t('emailRoleUser'),
    t('emailRoleAi'),
  );
  const body = t('emailBody', { conversation });

  const mailtoUrl = `mailto:${toEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <a href={mailtoUrl} className="-ml-1 text-gray-500 hover:text-gray-700">
          <span className="sr-only">{t('reportInappropriateContent')}</span>
          <Flag className="h-4 w-4" />
        </a>
      </TooltipTrigger>
      <TooltipContent className="ibl-tooltip-content">
        {t('reportInappropriateContent')}
      </TooltipContent>
    </Tooltip>
  );
}
