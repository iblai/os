import React from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';

import {
  useEditMentorMutation,
  useGetMentorSettingsQuery,
} from '@iblai/iblai-js/data-layer';
import { Edit, Info, AlertTriangle } from 'lucide-react';

const FlaggedPromptsModal = dynamic(
  () =>
    import('./safety-tab/flagged-prompts').then((mod) => ({
      default: mod.FlaggedPromptsModal,
    })),
  { ssr: false },
);

import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useUsername } from '@/hooks/use-user';
import { TenantKeyMentorIdParams } from '@/lib/types';
import {
  EditFormValues,
  EditPromptModal,
  SelectedPrompt,
} from '@/components/modals/edit-prompt-modal';
import { toast } from 'sonner';
import { useNavigate } from '@/hooks/user-navigate';
import { CopyButton } from '@/components/modals/edit-mentor-modal/tabs/prompts-tab/copy-button';
import { useShowFreeTrialDialog } from '@/hooks/user-user-actions';
import WithFormPermissions, { WithPermissions } from '@/hoc/withPermissions';
import { parsePrompt } from '@/lib/utils';
import Markdown from '@/components/markdown';

export function SafetyTab() {
  const username = useUsername();
  const { executeWithTrialCheck, isModalOpen, FreeTrialDialog, closeModal } =
    useShowFreeTrialDialog();
  const { tenantKey, mentorId } = useParams<TenantKeyMentorIdParams>();
  const { getMentorId } = useNavigate();
  const activeMentorId = getMentorId() || mentorId;

  const [selectedPrompt, setSelectedPrompt] =
    React.useState<SelectedPrompt | null>(null);
  const [isFlaggedPromptsModalOpen, setIsFlaggedPromptsModalOpen] =
    React.useState(false);

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
  const [editMentor, { isLoading: isEditMentorLoading }] =
    useEditMentorMutation();

  const isDisabled = isMentorSettingsLoading || isEditMentorLoading;

  async function toggleToolSettings(
    tool: string,
    value: boolean,
    callback?: () => void,
  ) {
    try {
      await executeWithTrialCheck(async () => {
        await editMentor({
          mentor: activeMentorId,
          org: tenantKey,
          // @ts-ignore
          userId: username ?? '',
          formData: { [tool]: value },
        }).unwrap();
        toast.success('Mentor updated successfully');
        callback?.();
      });
    } catch (error) {
      console.error(JSON.stringify(error));
      toast.error('Failed to update mentor');
      console.error(JSON.stringify({ tenant: tenantKey, error }));
    }
  }

  async function editPrompt(
    selectedPrompt: SelectedPrompt,
    value: EditFormValues,
  ) {
    try {
      await editMentor({
        mentor: activeMentorId,
        org: tenantKey,
        formData: { [selectedPrompt.name]: value.prompt },
        // @ts-ignore
        userId: username ?? '',
      }).unwrap();
      toast.success('Mentor updated successfully');
    } catch (error) {
      console.error(JSON.stringify(error));
      toast.error('Failed to update mentor');
      console.error(JSON.stringify({ tenant: tenantKey, error }));
    }
  }

  return (
    <>
      <div className="flex hidden h-[73px] flex-shrink-0 items-center border-b border-gray-200 bg-white p-4 lg:block">
        <div>
          <h3 className="mb-1 text-base font-medium text-gray-900">Safety</h3>
          <p className="text-xs text-gray-700">
            Configure safety and moderation settings.
          </p>
        </div>
      </div>
      <div
        className="flex-1 space-y-4 p-3 lg:p-4"
        style={{
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        <div className="space-y-6">
          {/* View Flagged Prompts Button */}
          <WithPermissions
            rbacResource={`/mentors/${mentorSettings?.mentor_id}/#view_moderation_logs`}
          >
            {({ hasPermission }) =>
              hasPermission && (
                <div className="flex justify-end">
                  <Button
                    onClick={() => setIsFlaggedPromptsModalOpen(true)}
                    className="bg-gradient-to-r from-[#2563EB] to-[#93C5FD] text-white hover:opacity-90"
                  >
                    <AlertTriangle className="mr-2 h-4 w-4" />
                    View Flagged Prompts
                  </Button>
                </div>
              )
            }
          </WithPermissions>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Moderation Prompt */}
            <WithFormPermissions
              name="moderation_system_prompt"
              // @ts-ignore
              permissions={mentorSettings?.permissions?.field}
            >
              {({ disabled }) => (
                <div className="overflow-hidden rounded-lg bg-gray-50">
                  <div className="flex items-center justify-between border-b border-gray-200 p-4">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium text-gray-900">
                        Moderation Prompt
                      </h3>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger aria-label="More info about moderation prompt">
                            <Info className="h-4 w-4 text-gray-400" />
                          </TooltipTrigger>
                          <TooltipContent className="ibl-tooltip-content">
                            <p>Controls Content Moderation</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <WithFormPermissions
                      name="enable_moderation"
                      // @ts-ignore
                      permissions={mentorSettings?.permissions?.field}
                    >
                      {({ disabled }) => (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-600">
                            {mentorSettings?.enable_moderation
                              ? 'Active'
                              : 'Inactive'}
                          </span>
                          <Switch
                            checked={mentorSettings?.enable_moderation}
                            onCheckedChange={async (checked) => {
                              await toggleToolSettings(
                                'enable_moderation',
                                checked,
                              );
                            }}
                            disabled={isDisabled || disabled}
                            aria-label={`Moderation prompt ${mentorSettings?.enable_moderation ? 'enabled' : 'disabled'}`}
                          />
                        </div>
                      )}
                    </WithFormPermissions>
                  </div>
                  <div className="flex items-start gap-2 p-4">
                    <div className="mt-1 flex-shrink-0">📝</div>
                    <div className="flex h-[180px] flex-1 flex-col">
                      <div
                        className="mb-4 flex-grow overflow-y-auto"
                        tabIndex={0}
                        role="region"
                        aria-label="Moderation prompt content"
                      >
                        {/* @ts-ignore */}
                        <Markdown className="text-sm text-gray-700">
                          {parsePrompt(
                            // @ts-expect-error moderation_system_prompt not in type of mentorSettings
                            mentorSettings?.moderation_system_prompt ?? '',
                          )}
                        </Markdown>
                      </div>
                    </div>
                  </div>
                  <div className="flex w-full gap-2 px-4 pb-4">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 flex-1 py-5"
                      onClick={() =>
                        setSelectedPrompt({
                          label: 'Moderation Prompt',
                          isSystem: true,
                          name: 'moderation_system_prompt',
                          prompt:
                            // @ts-expect-error moderation_system_prompt not in type of mentorSettings
                            mentorSettings?.moderation_system_prompt ?? '',
                        })
                      }
                      disabled={isDisabled || disabled}
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                    <CopyButton
                      disabled={isDisabled || disabled}
                      // @ts-expect-error moderation_system_prompt not in type of mentorSettings
                      text={mentorSettings?.moderation_system_prompt ?? ''}
                    />
                  </div>
                </div>
              )}
            </WithFormPermissions>

            {/* Safety Prompt */}
            <WithFormPermissions
              name="safety_system_prompt"
              // @ts-ignore
              permissions={mentorSettings?.permissions?.field}
            >
              {({ disabled }) => (
                <div className="overflow-hidden rounded-lg bg-gray-50">
                  <div className="flex items-center justify-between border-b border-gray-200 p-4">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium text-gray-900">
                        Safety Prompt
                      </h3>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger aria-label="More info about safety prompt">
                            <Info className="h-4 w-4 text-gray-400" />
                          </TooltipTrigger>
                          <TooltipContent className="ibl-tooltip-content">
                            <p>Controls Safety Filtering</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <WithFormPermissions
                      name="enable_safety_system"
                      // @ts-ignore
                      permissions={mentorSettings?.permissions?.field}
                    >
                      {({ disabled }) => (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-600">
                            {mentorSettings?.enable_safety_system
                              ? 'Active'
                              : 'Inactive'}
                          </span>
                          <Switch
                            checked={mentorSettings?.enable_safety_system}
                            onCheckedChange={async (checked) => {
                              await toggleToolSettings(
                                'enable_safety_system',
                                checked,
                              );
                            }}
                            disabled={isDisabled || disabled}
                            aria-label={`Safety prompt ${mentorSettings?.enable_safety_system ? 'enabled' : 'disabled'}`}
                          />
                        </div>
                      )}
                    </WithFormPermissions>
                  </div>
                  <div className="flex items-start gap-2 p-4">
                    <div className="mt-1 flex-shrink-0">📝</div>
                    <div className="flex h-[180px] flex-1 flex-col">
                      <div
                        className="mb-4 flex-grow overflow-y-auto"
                        tabIndex={0}
                        role="region"
                        aria-label="Safety prompt content"
                      >
                        {/* @ts-ignore */}
                        <Markdown className="text-sm text-gray-700">
                          {parsePrompt(
                            // @ts-expect-error safety_system_prompt not in type of mentorSettings
                            mentorSettings?.safety_system_prompt ?? '',
                          )}
                        </Markdown>
                      </div>
                    </div>
                  </div>
                  <div className="flex w-full gap-2 px-4 pb-4">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 flex-1 py-5"
                      disabled={disabled || isDisabled}
                      onClick={() =>
                        setSelectedPrompt({
                          label: 'Safety Prompt',
                          isSystem: true,
                          name: 'safety_system_prompt',
                          // @ts-ignore
                          prompt: mentorSettings?.safety_system_prompt ?? '',
                        })
                      }
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                    <CopyButton
                      disabled={disabled || isDisabled}
                      // @ts-ignore
                      text={mentorSettings?.safety_system_prompt ?? ''}
                    />
                  </div>
                </div>
              )}
            </WithFormPermissions>

            {/* Moderation Response */}
            <WithFormPermissions
              name="moderation_response"
              // @ts-ignore
              permissions={mentorSettings?.permissions?.field}
            >
              {({ disabled }) => (
                <div className="overflow-hidden rounded-lg bg-gray-50">
                  <div className="flex items-center justify-between border-b border-gray-200 p-4">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium text-gray-900">
                        Moderation Response
                      </h3>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 p-4">
                    <div className="mt-1 flex-shrink-0">📝</div>
                    <div className="flex h-[180px] flex-1 flex-col">
                      <div
                        className="mb-4 flex-grow overflow-y-auto"
                        tabIndex={0}
                        role="region"
                        aria-label="Moderation response content"
                      >
                        {/* @ts-ignore */}
                        <Markdown className="text-sm text-gray-700">
                          {parsePrompt(
                            //  @ts-expect-error moderation_response not in type of mentorSettings
                            mentorSettings?.moderation_response ?? '',
                          )}
                        </Markdown>
                      </div>
                    </div>
                  </div>
                  <div className="flex w-full gap-2 px-4 pb-4">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 flex-1 py-5"
                      disabled={isDisabled || disabled}
                      onClick={() =>
                        setSelectedPrompt({
                          label: 'Moderation Response',
                          isSystem: true,
                          name: 'moderation_response',
                          // @ts-ignore
                          prompt: mentorSettings?.moderation_response ?? '',
                        })
                      }
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                    <CopyButton
                      disabled={isDisabled || disabled}
                      // @ts-ignore
                      text={mentorSettings?.moderation_response ?? ''}
                    />
                  </div>
                </div>
              )}
            </WithFormPermissions>

            {/* Safety Response */}
            <WithFormPermissions
              name="safety_response"
              // @ts-ignore
              permissions={mentorSettings?.permissions?.field}
            >
              {({ disabled }) => (
                <div className="overflow-hidden rounded-lg bg-gray-50">
                  <div className="flex items-center justify-between border-b border-gray-200 p-4">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium text-gray-900">
                        Safety Response
                      </h3>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 p-4">
                    <div className="mt-1 flex-shrink-0">📝</div>
                    <div className="flex h-[180px] flex-1 flex-col">
                      <div
                        className="mb-4 flex-grow overflow-y-auto"
                        tabIndex={0}
                        role="region"
                        aria-label="Safety response content"
                      >
                        {/* @ts-ignore */}
                        <Markdown className="text-sm text-gray-700">
                          {/* @ts-expect-error safety_response not in type of mentorSettings */}
                          {parsePrompt(mentorSettings?.safety_response ?? '')}
                        </Markdown>
                      </div>
                    </div>
                  </div>
                  <div className="flex w-full gap-2 px-4 pb-4">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 flex-1 py-5"
                      disabled={isDisabled || disabled}
                      onClick={() =>
                        setSelectedPrompt({
                          label: 'Safety Response',
                          isSystem: true,
                          name: 'safety_response',
                          // @ts-ignore
                          prompt: mentorSettings?.safety_response ?? '',
                        })
                      }
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                    <CopyButton
                      disabled={isDisabled || disabled}
                      // @ts-ignore
                      text={mentorSettings?.safety_response ?? ''}
                    />
                  </div>
                </div>
              )}
            </WithFormPermissions>
          </div>

          {/* Edit Prompt Modal */}
          {selectedPrompt && (
            <EditPromptModal
              isOpen={!!selectedPrompt}
              onClose={() => setSelectedPrompt(null)}
              handleSave={editPrompt}
              selectedPrompt={selectedPrompt}
              isEditing={isEditMentorLoading}
            />
          )}

          {/* Flagged Prompts Modal */}
          {isFlaggedPromptsModalOpen && (
            <FlaggedPromptsModal
              isOpen={isFlaggedPromptsModalOpen}
              onClose={() => setIsFlaggedPromptsModalOpen(false)}
              mentorId={activeMentorId}
              tenantKey={tenantKey}
              username={username ?? ''}
            />
          )}

          {isModalOpen && FreeTrialDialog && (
            <FreeTrialDialog isOpen={isModalOpen} onClose={closeModal} />
          )}
        </div>
      </div>
    </>
  );
}
