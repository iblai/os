'use client';

import useWelcome from '@/hooks/use-welcome-message';
import { config } from '@/lib/config';
import Markdown from '@/components/markdown';

interface WelcomeMessageProps {
  aiWelcomeMessage: string;
  sessionId: string;
  username: string;
  tenantKey: string;
  mentorUniqueId: string;
  token: string;
  isNewSession: boolean;
  className?: string;
}

export function WelcomeMessage({
  aiWelcomeMessage,
  sessionId,
  username,
  tenantKey,
  mentorUniqueId,
  token,
  isNewSession,
  className = 'text-gray-600 text-lg max-w-3xl',
}: WelcomeMessageProps) {
  const { welcomeMessage } = useWelcome({
    sessionId,
    username,
    tenantKey,
    mentorUniqueId,
    token,
    wsUrl: `${config.baseWsUrl()}/ws/langflow/`,
    isNewSession,
  });
  return (
    <Markdown className={className}>
      {welcomeMessage || aiWelcomeMessage || ''}
    </Markdown>
  );
}
