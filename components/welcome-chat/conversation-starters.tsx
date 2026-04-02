'use client';

import { Card, CardContent } from '@/components/ui/card';
import { useUsername } from '@/hooks/use-user';
import { TenantKeyMentorIdParams } from '@/lib/types';
import { useGetGuidedPromptsQuery } from '@iblai/iblai-js/data-layer';
import { Globe } from 'lucide-react';
import { DynamicIcon, iconNames } from 'lucide-react/dynamic';
import { useParams } from 'next/navigation';
import { useAppSelector } from '@/lib/hooks';
import { selectRbacPermissions } from '@/features/rbac/rbac-slice';
import { checkRbacPermission } from '@/hoc/withPermissions';
import { useMentorSettings } from '@/hooks/use-mentors/use-mentor-settings';
import { cn } from '@/lib/utils';

interface Props {
  onTemplateSelect: (template: string) => void;
  enabledGuidedPrompts: boolean;
  sessionId: string;
}

function Icon({ icon }: { icon: string }) {
  const iconName = iconNames.find((name) => name === icon);

  if (!iconName) {
    return <Globe className="h-5 w-5 text-[#7D828C]" />;
  }

  return <DynamicIcon name={iconName} className="h-5 w-5 text-[#7D828C]" />;
}

export function ConversationStarters({
  onTemplateSelect,
  enabledGuidedPrompts,
  sessionId,
}: Props) {
  const username = useUsername();
  const realUsername = username ?? 'anonymous';
  const { tenantKey } = useParams<TenantKeyMentorIdParams>();
  const rbacPermissions = useAppSelector(selectRbacPermissions);
  const mentorSettings = useMentorSettings();

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

  const { data: guidedPrompts } = useGetGuidedPromptsQuery(
    {
      org: tenantKey,
      sessionId: sessionId,
      // @ts-ignore
      userId: realUsername,
    },
    {
      skip: !enabledGuidedPrompts || !tenantKey || !sessionId || !realUsername,
    },
  );

  if (!guidedPrompts?.results || guidedPrompts.results.length === 0) {
    return null;
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4">
      <h2 className="mb-6 text-xl font-semibold text-gray-900">
        Conversation Starters
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {guidedPrompts?.results?.map((guidedPrompt, index) => (
          <Card
            key={index}
            className={cn(
              'h-full border border-[#D0E0FF] bg-[#F5F8FF] shadow-xs transition-all duration-200',
              isChatDisabledByRbac
                ? 'cursor-not-allowed opacity-50'
                : 'cursor-pointer hover:shadow-sm focus:shadow-md focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 focus:outline-none',
            )}
            onClick={() =>
              !isChatDisabledByRbac && onTemplateSelect(guidedPrompt.prompt)
            }
            onKeyDown={(e) => {
              if (isChatDisabledByRbac) return;
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onTemplateSelect(guidedPrompt.prompt);
              }
            }}
            tabIndex={isChatDisabledByRbac ? -1 : 0}
            role="button"
            aria-label={`Select starter template: ${guidedPrompt.prompt}`}
            aria-disabled={isChatDisabledByRbac}
          >
            <CardContent className="flex h-full flex-col p-4">
              <p className="mb-3 flex-1 text-left text-sm leading-relaxed text-gray-700">
                {guidedPrompt.prompt}
              </p>
              <div className="flex justify-start">
                <Icon icon={guidedPrompt.icon ?? 'globe'} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
