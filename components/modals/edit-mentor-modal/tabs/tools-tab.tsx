import type React from 'react';

import { Info } from 'lucide-react';

import { useGetMentorSettingsQuery } from '@iblai/iblai-js/data-layer';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useParams } from 'next/navigation';
import { useUsername } from '@/hooks/use-user';
import { Switch } from '@/components/ui/switch';
import { useNavigate } from '@/hooks/user-navigate';
import { TenantKeyMentorIdParams } from '@/lib/types';
import { useGetToolsQuery } from '@iblai/iblai-js/data-layer';
import { useToggleTools } from '@/hooks/use-tools/use-toggle-tools';
import WithFormPermissions from '@/hoc/withPermissions';

export function ToolsTab() {
  const { tenantKey, mentorId } = useParams<TenantKeyMentorIdParams>();
  const username = useUsername();
  const { getMentorId } = useNavigate();
  const activeMentorId = getMentorId() || mentorId;

  const { data: tools, isLoading: isToolsLoading } = useGetToolsQuery(
    {
      mentor: activeMentorId,
      org: tenantKey,
      // @ts-ignore
      userId: username ?? '',
    },
    {
      skip: !username,
    },
  );

  const { data: mentorSettings, isLoading: isMentorSettingsLoading } =
    useGetMentorSettingsQuery(
      {
        mentor: activeMentorId,
        org: tenantKey,
        // @ts-ignore
        userId: username ?? '',
      },
      { skip: !username || !activeMentorId || !tenantKey },
    );

  const { toggleTools, isLoading: isToggleToolsLoading } = useToggleTools({
    tools: mentorSettings?.mentor_tools?.map((tool) => tool.slug) ?? [],
    activeMentorId,
    tenantKey,
    username: username ?? '',
  });

  const isDisabled =
    isMentorSettingsLoading || isToggleToolsLoading || isToolsLoading;

  return (
    <>
      <div className="flex hidden h-[73px] flex-shrink-0 items-center border-b border-gray-200 bg-white p-4 lg:block">
        <div>
          <h3 className="mb-1 text-base font-medium text-gray-900">Tools</h3>
          <p className="text-xs text-gray-700">
            Configure tools and integrations for your mentor.
          </p>
        </div>
      </div>
      <div
        className="flex-1 space-y-4 p-3"
        style={{
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        <WithFormPermissions
          name="mentor_tools"
          // @ts-ignore
          permissions={mentorSettings?.permissions?.field}
        >
          {({ disabled }) => (
            <div className="space-y-6">
              {tools?.map((tool) => {
                const isEnabled = mentorSettings?.mentor_tools
                  ?.map((tool) => tool.slug)
                  .includes(tool?.slug ?? '');

                return (
                  <div
                    className="flex items-center justify-between rounded-lg border p-6"
                    key={tool?.slug ?? tool?.name}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-700">
                        {tool?.display_name}
                      </span>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger
                            aria-label={`More info about ${tool?.display_name}`}
                          >
                            <Info className="h-4 w-4 text-gray-400" />
                          </TooltipTrigger>
                          <TooltipContent className="ibl-tooltip-content">
                            <p>{tool?.description}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <Switch
                      checked={isEnabled}
                      onCheckedChange={async () => {
                        await toggleTools(tool?.slug ?? '');
                      }}
                      disabled={isDisabled || disabled}
                      aria-label={`${tool?.display_name} ${isEnabled ? 'enabled' : 'disabled'}`}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </WithFormPermissions>
      </div>
    </>
  );
}
