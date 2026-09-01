'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { Edit, Info, Loader2, Play, Plus, Trash2 } from 'lucide-react';
import { AgentConfigPrompts } from '@iblai/iblai-js/web-containers';
import {
  useDeletePromptMutation,
  useEditMentorMutation,
  useGetMentorSettingsQuery,
  useGetPromptsSearchQuery,
  useUpdatePromptMutation,
  useGetClawMentorConfigQuery,
} from '@iblai/iblai-js/data-layer';
import { PromptVisibilityEnum } from '@iblai/iblai-api';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useUsername } from '@/hooks/use-user';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { TenantKeyMentorIdParams } from '@/lib/types';
import {
  EditFormValues,
  EditPromptModal,
  SelectedPrompt,
} from '@/components/modals/edit-prompt-modal';
import { AddPromptModal } from '../../add-prompt-modal';
import { useNavigate } from '@/hooks/user-navigate';
import { GreetingMethod } from '@/lib/constants';
import { toast } from 'sonner';
import { CopyButton } from './prompts-tab/copy-button';
import { useShowFreeTrialDialog } from '@/hooks/user-user-actions';
import WithFormPermissions from '@/hoc/withPermissions';
import { useAppDispatch } from '@/lib/hooks';
import { chatInputSliceActions } from '@/features/chat-input/api-slice';
import { parsePrompt } from '@/lib/utils';
import Markdown from '@/components/markdown';

const SUGGESTED_PROMPTS_PAGE_SIZE = 6;

export function PromptsTab() {
  const t = useTranslations('tabsPromptsTab');
  const {
    showAddPromptModal,
    closeAddPromptModal,
    openAddPromptModal,
    closeEditMentorModal,
  } = useNavigate();
  const { tenantKey, mentorId } = useParams<TenantKeyMentorIdParams>();
  const username = useUsername();
  const { getMentorId } = useNavigate();
  const { executeWithTrialCheck, FreeTrialDialog, closeModal, isModalOpen } =
    useShowFreeTrialDialog();
  const dispatch = useAppDispatch();
  const activeMentorId = getMentorId() || mentorId;

  const [selectedPrompt, setSelectedPrompt] =
    React.useState<SelectedPrompt | null>(null);
  const [offset, setOffset] = React.useState(0);
  const [accumulatedPrompts, setAccumulatedPrompts] = React.useState<any[]>([]);

  const isOpen = !!selectedPrompt;

  const { data: mentorSettings, isLoading: isLoadingMentor } =
    useGetMentorSettingsQuery(
      // @ts-expect-error - userId parameter may not exist in API but passed from legacy code
      { mentor: activeMentorId, org: tenantKey, userId: username ?? '' },
      {
        skip: !activeMentorId || !tenantKey || !username,
      },
    );

  // @ts-expect-error enable_claw is not yet in the MentorSettingsPublic type
  const isClawEnabled: boolean = mentorSettings?.enable_claw ?? false;
  const mentorUuid: string | undefined = mentorSettings?.mentor_unique_id;

  // The Agent Configuration section is always rendered; <AgentConfigPrompts>
  // fetches its own claw-config and shows the appropriate grayed hint when the
  // sandbox is off or not yet wired to a Claw instance.
  //
  // We additionally detect a fully-wired "claw sandbox" mentor (enable_claw on
  // AND a Claw instance connected). For these, the System and Study prompts
  // don't apply — the agent's behavior is driven by the sandbox agent config —
  // so those two sections are hidden. The data-layer normalises 404 → null.
  const { data: clawMentorConfig } = useGetClawMentorConfigQuery(
    { org: tenantKey!, mentorUniqueId: mentorUuid! },
    { skip: !isClawEnabled || !tenantKey || !mentorUuid },
  );
  const isClawSandboxMentor = isClawEnabled && !!clawMentorConfig;

  const promptsQuery = useGetPromptsSearchQuery(
    {
      org: tenantKey,
      username: username ?? '',
      category: '',
      limit: SUGGESTED_PROMPTS_PAGE_SIZE,
      offset,
      mentor: mentorId,
      orderDirection: 'asc',
    },
    {
      skip: !tenantKey || !username || !mentorId,
    },
  );
  const {
    data: prompts,
    isLoading: isLoadingPrompts,
    isFetching: isFetchingPrompts,
  } = promptsQuery;

  const totalPromptCount = prompts?.count ?? 0;
  const hasMorePrompts = accumulatedPrompts.length < totalPromptCount;

  React.useEffect(() => {
    if (promptsQuery.status === 'fulfilled') {
      const newResults = prompts?.results ?? [];
      if (offset === 0) {
        setAccumulatedPrompts([...newResults]);
      } else {
        setAccumulatedPrompts((prev) => [...prev, ...newResults]);
      }
    }
  }, [offset, promptsQuery.status, prompts?.results]);

  const loadMorePrompts = () => {
    if (hasMorePrompts && !isFetchingPrompts) {
      setOffset((prev) => prev + SUGGESTED_PROMPTS_PAGE_SIZE);
    }
  };

  const [editMentor, { isLoading: isEditingMentor }] = useEditMentorMutation();
  const [updatePrompt, { isLoading: isUpdatingPrompt }] =
    useUpdatePromptMutation();
  const [deletePromptMutation] = useDeletePromptMutation();
  const [deletingPromptId, setDeletingPromptId] = React.useState<number | null>(
    null,
  );

  const isLoading = isLoadingMentor || isLoadingPrompts;

  async function toggleToolSettings(
    tool: string,
    value: boolean | GreetingMethod,
    callback?: () => void,
  ) {
    try {
      await executeWithTrialCheck(async () => {
        await editMentor({
          mentor: activeMentorId,
          org: tenantKey,
          // @ts-expect-error - userId parameter may not exist in API but passed from legacy code
          userId: username ?? '',
          formData: { [tool]: value },
        }).unwrap();
        toast.success(t('agentUpdatedSuccess'));
        callback?.();
      });
    } catch (error) {
      console.error(JSON.stringify(error));
      toast.error(t('agentUpdateFailed'));
      console.error(JSON.stringify({ tenant: tenantKey, error }));
    }
  }

  async function editPrompt(
    selectedPrompt: SelectedPrompt,
    value: EditFormValues,
  ) {
    if (selectedPrompt.isSystem) {
      try {
        await editMentor({
          mentor: activeMentorId,
          org: tenantKey,
          // @ts-expect-error - userId parameter may not exist in API but passed from legacy code
          userId: username ?? '',
          formData: { [selectedPrompt.name]: value.prompt },
        }).unwrap();
        toast.success(t('agentUpdatedSuccess'));
      } catch (error) {
        console.error(JSON.stringify(error));
        toast.error(t('agentUpdateFailed'));
        console.error(JSON.stringify({ tenant: tenantKey, error }));
      }
    } else {
      try {
        if (!selectedPrompt.id) {
          return;
        }
        await updatePrompt({
          id: selectedPrompt.id,
          org: tenantKey,
          userId: username ?? '',
          // @ts-expect-error - requestBody structure may not match API specification
          requestBody: {
            is_system: false,
            prompt: value.prompt,
            category: value.category,
            prompt_visibility: value.promptVisibility,
          },
        }).unwrap();
        toast.success(t('promptUpdatedSuccess'));
      } catch (error) {
        console.error(JSON.stringify(error));
        toast.error(t('promptUpdateFailed'));
        console.error(JSON.stringify({ tenant: tenantKey, error }));
      }
    }
  }

  function handleRunPrompt(promptText: string) {
    executeWithTrialCheck(() => {
      dispatch(chatInputSliceActions.setTextareaInput(promptText));
      closeEditMentorModal();
    });
  }

  async function handleDeletePrompt(promptId: number) {
    setDeletingPromptId(promptId);
    try {
      await executeWithTrialCheck(async () => {
        await deletePromptMutation({
          id: promptId,
          org: tenantKey,
        }).unwrap();
        toast.success(t('promptDeletedSuccess'));
      });
    } catch (error) {
      console.error(JSON.stringify(error));
      toast.error(t('promptDeleteFailed'));
      console.error(JSON.stringify({ tenant: tenantKey, error }));
    } finally {
      setDeletingPromptId(null);
    }
  }

  const isEditing = isUpdatingPrompt || isEditingMentor;

  return (
    <>
      <div className="flex hidden h-[73px] flex-shrink-0 items-center border-b border-gray-200 bg-white p-4 lg:block">
        <div>
          <h3 className="mb-1 text-base font-medium text-gray-900">
            {t('heading')}
          </h3>
          <p className="text-xs text-gray-700">{t('description')}</p>
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
          <div
            className="rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600"
            data-testid="prompts-info-box"
          >
            {isClawSandboxMentor ? t('infoBoxSandbox') : t('infoBoxDefault')}
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-2">
            {/* System Prompt — hidden for connected claw-sandbox mentors,
                where behavior is driven by the sandbox agent config instead. */}
            {!isClawSandboxMentor && (
              <WithFormPermissions
                name="system_prompt"
                // @ts-expect-error - permissions.field property may not exist on mentorSettings type
                permissions={mentorSettings?.permissions?.field}
              >
                {({ disabled }) => (
                  <div className="overflow-hidden rounded-lg bg-gray-50">
                    <div className="flex items-center justify-between border-b border-gray-200 p-[1.12rem]">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-medium text-gray-900">
                          {t('systemPromptTitle')}
                        </h3>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger
                              aria-label={t('systemPromptInfoAriaLabel')}
                            >
                              <Info className="h-4 w-4 text-gray-400" />
                            </TooltipTrigger>
                            <TooltipContent className="ibl-tooltip-content">
                              <p>{t('systemPromptTooltip')}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 p-4">
                      <div className="mt-1 flex-shrink-0">📝</div>
                      <div className="flex h-[180px] flex-1 flex-col">
                        <div
                          className="mb-4 flex-grow overflow-y-auto"
                          tabIndex={0}
                          role="region"
                          aria-label={t('systemPromptContentAriaLabel')}
                        >
                          <Markdown className="text-sm text-gray-700">
                            {/* @ts-expect-error - system_prompt property does not exist on MentorSettingsPublic type */}
                            {parsePrompt(mentorSettings?.system_prompt ?? '')}
                          </Markdown>
                        </div>
                      </div>
                    </div>
                    <div className="flex w-full gap-2 px-4 pb-4">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 flex-1 py-5"
                        disabled={disabled}
                        onClick={() =>
                          setSelectedPrompt({
                            label: t('systemPromptLabel'),
                            isSystem: true,
                            name: 'system_prompt',
                            // @ts-expect-error - system_prompt property may not exist on mentorSettings type
                            prompt: mentorSettings?.system_prompt,
                          })
                        }
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        {t('editButton')}
                      </Button>
                      <CopyButton
                        // @ts-expect-error - system_prompt property may not exist on mentorSettings type
                        text={mentorSettings?.system_prompt ?? ''}
                      />
                    </div>
                  </div>
                )}
              </WithFormPermissions>
            )}

            {/* Proactive Prompt */}
            <WithFormPermissions
              name="proactive_prompt"
              // @ts-expect-error - permissions.field property may not exist on mentorSettings type
              permissions={mentorSettings?.permissions?.field}
            >
              {({ disabled }) => (
                <div className="overflow-hidden rounded-lg bg-gray-50">
                  <div className="flex items-center justify-between border-b border-gray-200 p-4">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium text-gray-900">
                        {t('proactivePromptTitle')}
                      </h3>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger
                            aria-label={t('proactivePromptInfoAriaLabel')}
                          >
                            <Info className="h-4 w-4 text-gray-400" />
                          </TooltipTrigger>
                          <TooltipContent className="ibl-tooltip-content">
                            <p>{t('proactivePromptTooltip')}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <WithFormPermissions
                      name="greeting_method"
                      // @ts-expect-error - permissions.field property may not exist on mentorSettings type
                      permissions={mentorSettings?.permissions?.field}
                    >
                      {({ disabled }) => (
                        <div className="flex items-center gap-2">
                          <span className="text-primary text-xs">
                            {mentorSettings?.greeting_method ===
                            GreetingMethod.PROACTIVE_PROMPT
                              ? t('activeStatus')
                              : t('inactiveStatus')}
                          </span>
                          <Switch
                            checked={
                              mentorSettings?.greeting_method ===
                              GreetingMethod.PROACTIVE_PROMPT
                            }
                            onCheckedChange={async (checked) => {
                              await toggleToolSettings(
                                'greeting_method',
                                checked
                                  ? GreetingMethod.PROACTIVE_PROMPT
                                  : GreetingMethod.PROACTIVE_RESPONSE,
                              );
                            }}
                            disabled={isLoading || isEditingMentor || disabled}
                            aria-label={t('proactivePromptAriaLabel', {
                              status:
                                mentorSettings?.greeting_method ===
                                GreetingMethod.PROACTIVE_PROMPT
                                  ? 'enabled'
                                  : 'disabled',
                            })}
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
                        aria-label={t('proactivePromptContentAriaLabel')}
                      >
                        <Markdown className="text-sm text-gray-700">
                          {parsePrompt(mentorSettings?.proactive_prompt ?? '')}
                        </Markdown>
                      </div>
                    </div>
                  </div>
                  <div className="flex w-full gap-2 px-4 pb-4">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 flex-1 py-5"
                      disabled={disabled}
                      onClick={() =>
                        setSelectedPrompt({
                          label: t('proactivePromptLabel'),
                          isSystem: true,
                          name: 'proactive_prompt',
                          prompt: mentorSettings?.proactive_prompt ?? '',
                        })
                      }
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      {t('editButton')}
                    </Button>
                    <CopyButton text={mentorSettings?.proactive_prompt ?? ''} />
                  </div>
                </div>
              )}
            </WithFormPermissions>

            {/* Study Prompt — hidden for connected claw-sandbox mentors,
                where behavior is driven by the sandbox agent config instead. */}
            {!isClawSandboxMentor && (
              <WithFormPermissions
                name="study_mode_prompt"
                // @ts-expect-error - permissions.field property may not exist on mentorSettings type
                permissions={mentorSettings?.permissions?.field}
              >
                {({ disabled }) => (
                  <div className="overflow-hidden rounded-lg bg-gray-50">
                    <div className="flex items-center justify-between border-b border-gray-200 p-4">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-medium text-gray-900">
                          {t('studyPromptTitle')}
                        </h3>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger
                              aria-label={t('studyPromptInfoAriaLabel')}
                            >
                              <Info className="h-4 w-4 text-gray-400" />
                            </TooltipTrigger>
                            <TooltipContent className="ibl-tooltip-content">
                              <p>{t('studyPromptTooltip')}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 p-4">
                      <div className="mt-1 flex-shrink-0">📚</div>
                      <div className="flex h-[180px] flex-1 flex-col">
                        <div
                          className="mb-4 flex-grow overflow-y-auto"
                          tabIndex={0}
                          role="region"
                          aria-label={t('studyPromptContentAriaLabel')}
                        >
                          <Markdown className="text-sm text-gray-700">
                            {parsePrompt(
                              mentorSettings?.study_mode_prompt ?? '',
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
                        disabled={disabled}
                        onClick={() =>
                          setSelectedPrompt({
                            label: t('studyPromptLabel'),
                            isSystem: true,
                            name: 'study_mode_prompt',
                            prompt: mentorSettings?.study_mode_prompt ?? '',
                          })
                        }
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        {t('editButton')}
                      </Button>
                      <CopyButton
                        text={mentorSettings?.study_mode_prompt ?? ''}
                      />
                    </div>
                  </div>
                )}
              </WithFormPermissions>
            )}

            {/* Guided Prompt */}
            <WithFormPermissions
              name="enable_guided_prompts"
              // @ts-expect-error - permissions.field property may not exist on mentorSettings type
              permissions={mentorSettings?.permissions?.field}
            >
              {({ disabled }) => (
                <div className="overflow-hidden rounded-lg bg-gray-50">
                  <div className="flex items-center justify-between border-b border-gray-200 p-4">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium text-gray-900">
                        {t('guidedPromptTitle')}
                      </h3>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger
                            aria-label={t('guidedPromptInfoAriaLabel')}
                          >
                            <Info className="h-4 w-4 text-gray-400" />
                          </TooltipTrigger>
                          <TooltipContent className="ibl-tooltip-content">
                            <p>{t('guidedPromptTooltip')}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <WithFormPermissions
                      name="enable_guided_prompts"
                      // @ts-expect-error - permissions.field property may not exist on mentorSettings type
                      permissions={mentorSettings?.permissions?.field}
                    >
                      {({ disabled }) => (
                        <div className="flex items-center gap-2">
                          <span className="text-primary text-xs">
                            {mentorSettings?.enable_guided_prompts
                              ? t('activeStatus')
                              : t('inactiveStatus')}
                          </span>
                          <Switch
                            checked={mentorSettings?.enable_guided_prompts}
                            onCheckedChange={async (checked) => {
                              await toggleToolSettings(
                                'enable_guided_prompts',
                                checked,
                              );
                            }}
                            disabled={isLoading || isEditingMentor || disabled}
                            aria-label={t('guidedPromptAriaLabel', {
                              status: mentorSettings?.enable_guided_prompts
                                ? 'enabled'
                                : 'disabled',
                            })}
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
                        aria-label={t('guidedPromptContentAriaLabel')}
                      >
                        <Markdown className="text-sm text-gray-700">
                          {parsePrompt(
                            // @ts-ignore
                            mentorSettings?.guided_prompt_instructions ?? '',
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
                      disabled={disabled}
                      onClick={() =>
                        setSelectedPrompt({
                          label: t('guidedPromptLabel'),
                          isSystem: true,
                          name: 'guided_prompt_instructions',
                          prompt:
                            // @ts-ignore guided_prompt_instructions not in type of MentorSettingsPublic
                            mentorSettings?.guided_prompt_instructions ?? '',
                        })
                      }
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      {t('editButton')}
                    </Button>
                    <CopyButton
                      // @ts-ignore
                      text={mentorSettings?.guided_prompt_instructions ?? ''}
                    />
                  </div>
                </div>
              )}
            </WithFormPermissions>
          </div>

          {/* Suggested Prompts */}
          <WithFormPermissions
            name="suggested_prompts"
            // @ts-ignore
            permissions={mentorSettings?.permissions?.field}
          >
            {({ disabled }) => (
              <div className="mt-8">
                <div className="mb-4 flex items-center gap-2">
                  <h3 className="text-sm font-medium text-gray-900">
                    {t('suggestedPromptsTitle')}
                  </h3>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger
                        aria-label={t('suggestedPromptsInfoAriaLabel')}
                      >
                        <Info className="h-4 w-4 text-gray-400" />
                      </TooltipTrigger>
                      <TooltipContent className="ibl-tooltip-content">
                        <p>{t('suggestedPromptsTooltip')}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                {/* list of prompts */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {accumulatedPrompts.map((prompt, index) => (
                    <div
                      className="overflow-hidden rounded-lg bg-gray-50"
                      key={prompt.id}
                    >
                      <div className="flex items-start gap-2 p-4">
                        <div className="mt-1 flex-shrink-0">📝</div>
                        <div className="flex h-[180px] flex-1 flex-col">
                          <div
                            className="mb-4 flex-grow overflow-y-auto"
                            tabIndex={0}
                            role="region"
                            aria-label={t('suggestedPromptContentAriaLabel', {
                              index: index + 1,
                            })}
                          >
                            <Markdown className="text-sm text-gray-700">
                              {parsePrompt(prompt?.prompt ?? '')}
                            </Markdown>
                          </div>
                        </div>
                      </div>
                      <div className="flex w-full gap-2 px-4 pb-4">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex h-8 flex-1 items-center justify-center gap-2 py-5"
                          disabled={disabled || deletingPromptId === prompt.id}
                          onClick={() => {
                            setSelectedPrompt({
                              label: t('suggestedPromptLabel'),
                              id: prompt.id,
                              isSystem: false,
                              name: 'prompt',
                              prompt: prompt?.prompt ?? '',
                              category: prompt?.category?.name ?? '',
                              promptVisibility:
                                prompt?.prompt_visibility &&
                                prompt?.prompt_visibility !== 'null'
                                  ? (prompt?.prompt_visibility as PromptVisibilityEnum)
                                  : undefined,
                            });
                          }}
                        >
                          <Edit className="h-4 w-4" />
                          <span>{t('editButton')}</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex h-8 flex-1 items-center justify-center gap-2 py-5"
                          disabled={disabled || deletingPromptId === prompt.id}
                          onClick={() => handleRunPrompt(prompt?.prompt ?? '')}
                          aria-label={t('runSuggestedPromptAriaLabel', {
                            prompt: prompt?.prompt ?? '',
                          })}
                        >
                          <Play className="h-4 w-4" />
                          <span>{t('runButton')}</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex h-8 flex-1 items-center justify-center gap-2 py-5"
                          disabled={disabled || deletingPromptId === prompt.id}
                          onClick={() => {
                            if (prompt.id) {
                              handleDeletePrompt(prompt.id);
                            }
                          }}
                          aria-label={t('deleteSuggestedPromptAriaLabel', {
                            prompt: prompt?.prompt ?? '',
                          })}
                        >
                          {deletingPromptId === prompt.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                          <span>{t('deleteButton')}</span>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                {hasMorePrompts && (
                  <div className="mt-4 flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex h-7 items-center border-gray-200 px-3 text-xs font-normal text-gray-600"
                      onClick={loadMorePrompts}
                      disabled={isFetchingPrompts}
                    >
                      {isFetchingPrompts
                        ? t('loadingText')
                        : t('seeMoreButton')}
                    </Button>
                  </div>
                )}
                <Button
                  variant="outline"
                  className="mt-5 h-24 w-full border-dashed"
                  disabled={disabled}
                  onClick={() => openAddPromptModal()}
                >
                  <Plus className="mr-2 h-5 w-5" />
                  {t('addNewPromptButton')}
                </Button>
              </div>
            )}
          </WithFormPermissions>

          {/* Agent Configuration only applies to a fully-wired claw-sandbox
           * mentor (enable_claw on AND a Claw instance connected). For those,
           * behavior is driven by this section instead of the System/Study
           * prompts; otherwise it isn't shown at all. */}
          {isClawSandboxMentor && tenantKey && activeMentorId && (
            <div className="mt-8">
              <div className="mb-4 flex items-center gap-2">
                <h3 className="text-sm font-medium text-gray-900">
                  {t('agentConfigurationTitle')}
                </h3>
                <Info className="h-4 w-4 text-gray-400" />
              </div>
              <AgentConfigPrompts
                platformKey={tenantKey}
                mentorUniqueId={activeMentorId}
              />
            </div>
          )}

          {selectedPrompt && (
            <EditPromptModal
              isOpen={isOpen}
              onClose={() => setSelectedPrompt(null)}
              handleSave={editPrompt}
              selectedPrompt={selectedPrompt}
              isEditing={isEditing}
            />
          )}

          {showAddPromptModal && (
            <AddPromptModal
              isOpen={showAddPromptModal}
              onClose={closeAddPromptModal}
            />
          )}

          {isModalOpen && FreeTrialDialog && (
            <FreeTrialDialog onClose={closeModal} isOpen={isModalOpen} />
          )}
        </div>
      </div>
    </>
  );
}
