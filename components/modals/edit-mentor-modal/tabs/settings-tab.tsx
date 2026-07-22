'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';

/* istanbul ignore next -- @preserve dynamic import is not testable in unit tests */
const DeleteMentorModal = dynamic(
  () =>
    import('./settings-tab/delete-mentor-modal').then((module) => ({
      default: module.DeleteMentorModal,
    })),
  { ssr: false },
);

/* istanbul ignore next -- @preserve dynamic import is not testable in unit tests */
const CopyMentorModal = dynamic(
  () =>
    import('./settings-tab/copy-mentor-modal').then((module) => ({
      default: module.CopyMentorModal,
    })),
  { ssr: false },
);
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { useDispatch } from 'react-redux';

import {
  useGetMentorSettingsQuery,
  useGetMentorCategoriesQuery,
  useEditMentorMutation,
  useGetCallConfigurationsQuery,
  useCreateCallConfigurationMutation,
  useUpdateCallConfigurationMutation,
  useGetTenantChatPrivacyConfigQuery,
  chatPrivacyApiSlice,
} from '@iblai/iblai-js/data-layer';
import { useForm } from '@tanstack/react-form';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { useUsername } from '@/hooks/use-user';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { Textarea } from '@/components/ui/textarea';
import { TenantKeyMentorIdParams } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Check, ChevronsUpDown, Copy, Info, X } from 'lucide-react';
import { MENTOR_VISIBILITY } from '@/lib/constants';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { useNavigate } from '@/hooks/user-navigate';
import { useShowFreeTrialDialog } from '@/hooks/user-user-actions';
import { cn } from '@/lib/utils';
import WithFormPermissions from '@/hoc/withPermissions';
import { pickWritableFields, type FieldPermissions } from '@/hoc/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Settings is now split into three sub-tabs so the form scales as more
// fields land. Form state is shared (single `useForm`) so Save submits
// the whole thing regardless of which sub-tab is active. Tests need to
// click into the relevant sub-tab before exercising a toggle.
type SettingsSubTab = 'basic' | 'discovery' | 'capabilities';

interface SettingsForm {
  mentor_name: string;
  mentor_description: string;
  categories: number | null;
  profile_image: string | File | null;
  mentor_visibility: string;
  allow_anonymous: string;
  is_featured: boolean;
  show_attachment: boolean;
  show_voice_call: boolean;
  show_voice_record: boolean;
  is_lti_accessible: boolean;
  forkable: boolean;
  show_reasoning: boolean;
  enable_claw: boolean;
  enable_memory_component: boolean;
  enable_multi_query_rag: boolean;
  enable_prompt_caching: boolean;
  /** Gates the standalone Privacy tab (PII-rules UI) — hidden when off. */
  enable_privacy_router: boolean;
  /** Mentor-level private-mode kill switch → `mentor.disable_chathistory`. */
  disable_chathistory: boolean;
  /** Voice-call: function calling for RAG. Persisted on CallConfiguration, not MentorSettings. */
  use_function_calling_for_rag: boolean;
  /** Voice-call: enable screen sharing. Persisted on CallConfiguration, not MentorSettings. */
  enable_video: boolean;
}

export function SettingsTab() {
  const t = useTranslations('tabsSettingsTab');
  const { getMentorId } = useNavigate();
  const { tenantKey, mentorId } = useParams<TenantKeyMentorIdParams>();
  const username = useUsername();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const activeMentorId = getMentorId() ?? mentorId;

  const { data: categories, isLoading: isLoadingCategories } =
    useGetMentorCategoriesQuery(
      // @ts-ignore
      { org: tenantKey, userId: username ?? '' },
      {
        skip: !tenantKey || !username,
      },
    );

  const { data: mentor, isLoading: isLoadingMentor } =
    useGetMentorSettingsQuery(
      // @ts-ignore
      { mentor: activeMentorId, org: tenantKey, userId: username ?? '' },
      {
        skip: !activeMentorId || !tenantKey || !username || isLoadingCategories,
      },
    );

  const [editMentor, { isLoading: isLoadingEditMentor }] =
    useEditMentorMutation();
  const dispatch = useDispatch();

  // Tenant gate for the agent-level "Enable private mode" row — hidden when off.
  const { data: tenantChatPrivacyConfig } = useGetTenantChatPrivacyConfigQuery(
    // @ts-ignore - userId is not part of the public query args type
    { org: tenantKey ?? '', userId: username ?? '' },
    { skip: !tenantKey || !username },
  );
  const tenantAllowsChatPrivacyControl =
    !!tenantChatPrivacyConfig?.allow_user_chat_privacy_control;

  // Voice-call toggles live on CallConfiguration; use the inlined config, else fetch the list.
  // @ts-ignore call_configuration is on the API response but not typed
  const inlineCallConfig = mentor?.call_configuration ?? undefined;
  const { data: callConfigList } = useGetCallConfigurationsQuery(
    { org: tenantKey!, userId: username ?? '', mentor: activeMentorId! },
    {
      skip:
        inlineCallConfig !== undefined ||
        !tenantKey ||
        !username ||
        !activeMentorId,
    },
  );
  const existingCallConfig = inlineCallConfig ?? callConfigList?.[0];

  const [createCallConfig] = useCreateCallConfigurationMutation();
  const [updateCallConfig] = useUpdateCallConfigurationMutation();
  // @ts-ignore - enable_memory_component exists on API but not typed
  const initialMemoryEnabled: boolean =
    // @ts-ignore - enable_memory_component exists on API but not typed
    mentor?.enable_memory_component ?? false;

  const { executeWithTrialCheck, isModalOpen, FreeTrialDialog, closeModal } =
    useShowFreeTrialDialog();

  const { copy, status: copyStatus } = useCopyToClipboard(1000);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = React.useState(false);
  const [isCopyModalOpen, setIsCopyModalOpen] = React.useState(false);
  const [subTab, setSubTab] = React.useState<SettingsSubTab>('basic');
  const isDeletingMentor = false;

  const openDeleteMentorModal = () => {
    setIsDeleteModalOpen(true);
  };

  const closeDeleteMentorModal = () => {
    setIsDeleteModalOpen(false);
  };

  const openCopyMentorModal = () => {
    setIsCopyModalOpen(true);
  };

  const closeCopyMentorModal = () => {
    setIsCopyModalOpen(false);
  };

  const isDisabled =
    isLoadingCategories ||
    isLoadingMentor ||
    isLoadingEditMentor ||
    isDeletingMentor;

  const firstCategory =
    mentor?.categories && mentor?.categories?.length > 0
      ? mentor?.categories[0]
      : null;

  const form = useForm({
    defaultValues: {
      mentor_name: mentor?.mentor_name || '',
      mentor_description: mentor?.mentor_description || '',
      categories: firstCategory ? firstCategory.id : null,
      profile_image: mentor?.profile_image || '',
      mentor_visibility: mentor?.mentor_visibility?.toString() || '',
      allow_anonymous: mentor?.allow_anonymous ? 'true' : 'false',
      // @ts-ignore - is_featured exists in API response but not in type
      is_featured: mentor?.is_featured ?? false,
      // @ts-ignore - show_attachment exists in API response but not in type
      show_attachment: mentor?.show_attachment ?? true,
      // @ts-ignore - show_voice_call exists in API response but not in type
      show_voice_call: mentor?.show_voice_call ?? true,
      // @ts-ignore - show_voice_record exists in API response but not in type
      show_voice_record: mentor?.show_voice_record ?? true,
      // @ts-expect-error - is_lti_accessible exists in API response but not in type
      is_lti_accessible: mentor?.is_lti_accessible ?? false,
      // @ts-ignore - forkable exists in API response but not in type
      forkable: mentor?.forkable ?? false,
      // @ts-ignore - show_reasoning exists in API response but not in type
      show_reasoning: mentor?.show_reasoning ?? false,
      // @ts-ignore - enable_claw exists in API response but not in type
      enable_claw: mentor?.enable_claw ?? false,
      enable_memory_component: initialMemoryEnabled,
      enable_multi_query_rag: mentor?.enable_multi_query_rag ?? false,
      // @ts-ignore - enable_prompt_caching exists in the API response but not yet in the installed SDK type
      enable_prompt_caching: mentor?.enable_prompt_caching ?? false,
      // @ts-ignore - enable_privacy_router exists on API but not in the public type yet
      enable_privacy_router: mentor?.enable_privacy_router ?? false,
      // @ts-ignore - disable_chathistory exists on the mentor object but not in the public type yet
      disable_chathistory: mentor?.disable_chathistory ?? false,
      use_function_calling_for_rag:
        existingCallConfig?.use_function_calling_for_rag ?? false,
      enable_video: existingCallConfig?.enable_video ?? false,
    } as SettingsForm,
    // validators: {
    //   onChange: settingsFormSchema,
    // },
    onSubmit: async ({ value }) => {
      const values: any = {};

      if (value.profile_image instanceof File) {
        values.uploaded_profile_image = value.profile_image;
      }

      if (value.mentor_name) {
        values.mentor_name = value.mentor_name;
      }

      if (value.mentor_description) {
        values.mentor_description = value.mentor_description;
      }

      if (value.categories) {
        values.categories = value.categories;
      }

      if (value.mentor_visibility) {
        values.mentor_visibility = value.mentor_visibility;
      }

      if (value.allow_anonymous) {
        values.allow_anonymous = value.allow_anonymous === 'true';
      }

      if (value.is_featured !== undefined) {
        values.is_featured = value.is_featured;
      }

      if (value.show_attachment !== undefined) {
        values.show_attachment = value.show_attachment;
      }

      // `show_voice_call` is now owned by the Voice tab's inline capability
      // toggle — Settings no longer writes it (avoids clobbering the tab).

      if (value.show_voice_record !== undefined) {
        values.show_voice_record = value.show_voice_record;
      }

      // `is_lti_accessible` is now owned by the LTI tab's inline capability
      // toggle — Settings no longer writes it (avoids clobbering the tab).

      if (value.forkable !== undefined) {
        values.forkable = value.forkable;
        values.forkable_with_training_data = value.forkable;
      }

      if (value.show_reasoning !== undefined) {
        values.show_reasoning = value.show_reasoning;
      }

      // `enable_claw` (Sandbox) and `enable_memory_component` (Memory) are now
      // owned by their respective tabs' inline capability toggles — Settings no
      // longer writes them (avoids clobbering the tab-owned values).

      if (value.enable_multi_query_rag !== undefined) {
        values.enable_multi_query_rag = value.enable_multi_query_rag;
      }

      if (value.enable_prompt_caching !== undefined) {
        values.enable_prompt_caching = value.enable_prompt_caching;
      }

      // `enable_privacy_router` (Privacy) is now owned by the Privacy tab's
      // inline capability toggle — Settings no longer writes it.

      if (value.disable_chathistory !== undefined) {
        values.disable_chathistory = value.disable_chathistory;
      }

      // Drop any field the user only has read access to. Field-level RBAC
      // permissions come from the settings endpoint; including a read-only
      // field makes the PUT fail (e.g. "No permission to write field:
      // mentor_visibility"). A few payload keys are gated under a differently
      // named permission key, so map those explicitly.
      // @ts-ignore - permissions exists on the API response but not the type
      const fieldPermissions: FieldPermissions = mentor?.permissions?.field;
      const writableValues = pickWritableFields(values, fieldPermissions, {
        fieldNameMap: {
          uploaded_profile_image: 'profile_image',
          categories: 'metadata',
        },
      });

      try {
        await editMentor({
          mentor: activeMentorId,
          org: tenantKey,
          // @ts-ignore
          userId: username ?? '',
          formData: {
            ...writableValues,
          },
        }).unwrap();

        // Refresh the nav-bar chat-privacy toggle — the mentor-settings mutation
        // doesn't invalidate chat-privacy-effective. Unconditional on purpose.
        dispatch(
          chatPrivacyApiSlice.util.invalidateTags(['ChatPrivacyEffective']),
        );

        // `enable_claw` sync to the claw-config is now handled by the Sandbox
        // tab; Settings no longer touches it.

        // Sync `use_function_calling_for_rag` to CallConfiguration only when
        // changed (POST a new config if none exists, else PATCH). `enable_video`
        // (screen sharing) is now owned by the Screen Share tab, so Settings no
        // longer writes it here.
        const prevFnCalling = existingCallConfig?.use_function_calling_for_rag
          ? true
          : false;
        const callConfigChanged =
          value.use_function_calling_for_rag !== prevFnCalling;

        if (
          callConfigChanged &&
          tenantKey &&
          username &&
          activeMentorId !== undefined
        ) {
          try {
            if (existingCallConfig?.id) {
              await updateCallConfig({
                org: tenantKey,
                userId: username,
                id: existingCallConfig.id,
                requestBody: {
                  use_function_calling_for_rag:
                    value.use_function_calling_for_rag,
                },
              }).unwrap();
            } else {
              await createCallConfig({
                org: tenantKey,
                userId: username,
                requestBody: {
                  mentor: activeMentorId,
                  mode: 'realtime',
                  language: 'en',
                  use_function_calling_for_rag:
                    value.use_function_calling_for_rag,
                },
              }).unwrap();
            }
          } catch (callConfigError) {
            // Settings already saved — surface a separate toast if the voice-call sync fails.
            console.error(
              JSON.stringify({ tenant: tenantKey, callConfigError }),
            );
            toast.error(t('voiceCallSettingsError'));
          }
        }

        toast.success(t('agentUpdatedSuccess'));
      } catch (error) {
        console.error(JSON.stringify(error));
        toast.error(t('agentUpdateError'));
        console.error(JSON.stringify({ tenant: tenantKey, error }));
      }
    },
  });

  // The Sandbox tab now owns `enable_claw` and its claw-config sync, so the
  // Settings tab no longer needs to fetch the claw-config on open.

  return (
    <>
      <div className="flex h-[73px] flex-shrink-0 items-center border-b border-gray-200 bg-white p-4 lg:block">
        <div>
          <h3 className="mb-1 text-base font-medium text-gray-900">
            {t('settingsHeading')}
          </h3>
          <p className="text-xs text-gray-600">{t('settingsDescription')}</p>
        </div>
      </div>
      <div
        className="flex-1 space-y-4 p-3 lg:p-4"
        style={{
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
        tabIndex={0}
        role="region"
        aria-label={t('settingsFormAriaLabel')}
      >
        <form
          onSubmit={(formEvent) => {
            formEvent.preventDefault();
            formEvent.stopPropagation();
            executeWithTrialCheck(form.handleSubmit);
          }}
        >
          <Tabs
            value={subTab}
            onValueChange={(v) => setSubTab(v as SettingsSubTab)}
            className="space-y-4"
          >
            <TabsList
              className="inline-flex h-auto rounded-md bg-gray-100 p-1"
              aria-label={t('settingsSubCategoriesAriaLabel')}
            >
              {/*
                `text-gray-700` overrides Radix TabsList's default
                `text-muted-foreground` (#737373) which has only 4.3:1
                contrast against the bg-gray-100 strip — under the WCAG
                2.1 AA threshold of 4.5:1 and flagged by axe-core in
                journey 29:146. gray-700 (#374151) gives ~9.3:1 contrast
                while the active state still darkens to gray-900.
              */}
              <TabsTrigger
                value="basic"
                className="px-3 py-1.5 text-sm font-medium text-gray-700 data-[state=active]:bg-white data-[state=active]:text-gray-900"
              >
                {t('tabBasic')}
              </TabsTrigger>
              <TabsTrigger
                value="discovery"
                className="px-3 py-1.5 text-sm font-medium text-gray-700 data-[state=active]:bg-white data-[state=active]:text-gray-900"
              >
                {t('tabDiscovery')}
              </TabsTrigger>
              <TabsTrigger
                value="capabilities"
                className="px-3 py-1.5 text-sm font-medium text-gray-700 data-[state=active]:bg-white data-[state=active]:text-gray-900"
              >
                {t('tabCapabilities')}
              </TabsTrigger>
            </TabsList>

            {/* === BASIC ===================================================== */}
            <TabsContent
              value="basic"
              forceMount
              className="m-0 data-[state=inactive]:hidden"
            >
              <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_200px]">
                <div className="order-2 space-y-6 sm:order-1">
                  <WithFormPermissions
                    name="mentor_name"
                    // @ts-ignore
                    permissions={mentor?.permissions?.field}
                  >
                    {({ disabled }) => (
                      <form.Field name="mentor_name">
                        {(field) => {
                          const hasNoValue = field.state.value === '';
                          const isDirty = field.state.meta.isDirty;
                          const hasNoValueAndIsDirty = hasNoValue && isDirty;
                          return (
                            <div className="space-y-2">
                              <Label className="flex items-center text-sm font-medium text-[#646464]">
                                {t('nameLabel')}
                                <span className="ml-1 text-red-500">*</span>
                              </Label>
                              <Input
                                value={field.state.value}
                                onChange={(e) =>
                                  field.handleChange(e.target.value)
                                }
                                placeholder={t('agentNamePlaceholder')}
                                disabled={isDisabled || disabled}
                              />
                              {hasNoValueAndIsDirty && (
                                <p className="text-xs text-red-500">
                                  {t('agentNameRequired')}
                                </p>
                              )}
                            </div>
                          );
                        }}
                      </form.Field>
                    )}
                  </WithFormPermissions>

                  <div className="space-y-2">
                    <Label className="flex items-center text-sm font-medium text-[#646464]">
                      {t('uniqueIdLabel')}
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        value={activeMentorId || ''}
                        readOnly
                        disabled
                        className="flex-1 cursor-not-allowed bg-gray-50"
                        placeholder={t('uniqueIdPlaceholder')}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => activeMentorId && copy(activeMentorId)}
                        disabled={!activeMentorId}
                        aria-label={
                          copyStatus === 'success'
                            ? t('uniqueIdCopied')
                            : t('copyUniqueId')
                        }
                      >
                        {copyStatus === 'success' ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <WithFormPermissions
                    name="mentor_description"
                    // @ts-ignore
                    permissions={mentor?.permissions?.field}
                  >
                    {({ disabled }) => (
                      <form.Field name="mentor_description">
                        {(field) => {
                          const hasNoValue = field.state.value === '';
                          const isDirty = field.state.meta.isDirty;
                          const hasNoValueAndIsDirty = hasNoValue && isDirty;

                          return (
                            <div className="space-y-2">
                              <Label className="flex items-center text-sm font-medium text-[#646464]">
                                {t('descriptionLabel')}
                                <span className="ml-1 text-red-500">*</span>
                              </Label>
                              <Textarea
                                value={field.state.value}
                                onChange={(e) =>
                                  field.handleChange(e.target.value)
                                }
                                placeholder={t('agentDescriptionPlaceholder')}
                                className="min-h-[150px]"
                                disabled={isDisabled || disabled}
                              />
                              {hasNoValueAndIsDirty && (
                                <p className="text-xs text-red-500">
                                  {t('agentDescriptionRequired')}
                                </p>
                              )}
                            </div>
                          );
                        }}
                      </form.Field>
                    )}
                  </WithFormPermissions>

                  <WithFormPermissions
                    name="metadata"
                    // @ts-ignore
                    permissions={mentor?.permissions?.field}
                  >
                    {({ disabled }) => (
                      <form.Field name="categories">
                        {(field) => (
                          <div className="space-y-2">
                            <Label className="flex items-center text-sm font-medium text-[#646464]">
                              {t('categoryLabel')}
                              <span className="ml-1 text-red-500">*</span>
                            </Label>
                            <Popover>
                              <PopoverTrigger
                                asChild
                                aria-label={t('selectCategoryAriaLabel')}
                              >
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  className="w-full justify-between"
                                  disabled={isDisabled || disabled}
                                >
                                  {field.state.value
                                    ? categories?.find(
                                        (category) =>
                                          category.id === field.state.value,
                                      )?.name
                                    : t('selectCategoryPlaceholder')}
                                  <ChevronsUpDown className="opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-full max-w-[490px] p-0 sm:w-[400px] lg:w-[490px]">
                                <Command>
                                  <CommandInput
                                    placeholder={t('searchCategoryPlaceholder')}
                                    className="h-9"
                                  />
                                  <CommandList>
                                    <CommandEmpty>
                                      {t('noCategoryFound')}
                                    </CommandEmpty>
                                    <CommandGroup>
                                      {categories?.map((category) => (
                                        <CommandItem
                                          key={category.id}
                                          value={category.id.toString()}
                                          onSelect={(currentValue) => {
                                            field.handleChange(
                                              Number(currentValue),
                                            );
                                          }}
                                        >
                                          {category.name}
                                          <Check
                                            className={cn(
                                              'ml-auto',
                                              field.state.value === category.id
                                                ? 'opacity-100'
                                                : 'opacity-0',
                                            )}
                                          />
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                          </div>
                        )}
                      </form.Field>
                    )}
                  </WithFormPermissions>
                </div>

                <WithFormPermissions
                  name="profile_image"
                  // @ts-ignore
                  permissions={mentor?.permissions?.field}
                >
                  {({ disabled }) => (
                    <form.Field name="profile_image">
                      {(field) => (
                        <div className="order-1 mb-6 space-y-2 sm:order-2 sm:mb-0">
                          <Label className="text-sm font-medium text-[#646464]">
                            {t('imageLabel')}
                          </Label>
                          <div
                            className="flex h-[200px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200"
                            onClick={(event) => {
                              event.stopPropagation();
                              if (!isDisabled && fileInputRef.current) {
                                fileInputRef.current.click();
                              }
                            }}
                          >
                            {field.state.value ? (
                              <div className="relative h-full w-full">
                                <Image
                                  src={
                                    typeof field.state.value === 'string'
                                      ? field.state.value
                                      : URL.createObjectURL(field.state.value)
                                  }
                                  alt={t('agentImageAlt')}
                                  className="h-full w-full rounded-lg object-cover"
                                  height={200}
                                  width={200}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                  }}
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="absolute top-2 right-2 h-7 w-7 cursor-pointer rounded-full"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    if (!isDisabled && fileInputRef.current) {
                                      field.handleChange(null);
                                      fileInputRef.current.value = '';
                                    }
                                  }}
                                  aria-label={t('removeImageAriaLabel')}
                                  disabled={isDisabled || disabled}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ) : (
                              <span className="text-sm text-gray-500">
                                {t('uploadLabel')}
                              </span>
                            )}
                            <input
                              type="file"
                              accept="image/*"
                              ref={fileInputRef}
                              disabled={isDisabled || disabled}
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                if (file) {
                                  field.handleChange(file);
                                }
                              }}
                              className="hidden"
                            />
                          </div>
                        </div>
                      )}
                    </form.Field>
                  )}
                </WithFormPermissions>
              </div>
            </TabsContent>

            {/* === DISCOVERY ================================================= */}
            <TabsContent
              value="discovery"
              forceMount
              className="m-0 data-[state=inactive]:hidden"
            >
              <div className="space-y-6">
                <WithFormPermissions
                  name="mentor_visibility"
                  // @ts-ignore
                  permissions={mentor?.permissions?.field}
                >
                  {({ disabled }) => (
                    <form.Field name="mentor_visibility">
                      {(field) => (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Label className="flex items-center text-sm font-medium text-[#646464]">
                              {t('whoCanViewLabel')}
                              <span className="ml-1 text-red-500">*</span>
                            </Label>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger
                                  type="button"
                                  aria-label={t('whoCanViewInfoAriaLabel')}
                                >
                                  <Info className="h-4 w-4 text-gray-400" />
                                </TooltipTrigger>
                                <TooltipContent className="ibl-tooltip-content">
                                  <p>{t('whoCanViewTooltip')}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                          <Select
                            value={field.state.value}
                            onValueChange={(value) =>
                              value && field.handleChange(value)
                            }
                            required
                            disabled={isDisabled || disabled}
                          >
                            <SelectTrigger aria-label={t('selectWhoCanView')}>
                              <SelectValue
                                placeholder={t('selectWhoCanView')}
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {MENTOR_VISIBILITY.map((visibility) => (
                                <SelectItem
                                  key={visibility.value}
                                  value={visibility.value}
                                >
                                  {visibility.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </form.Field>
                  )}
                </WithFormPermissions>

                <WithFormPermissions
                  name="allow_anonymous"
                  // @ts-ignore
                  permissions={mentor?.permissions?.field}
                >
                  {({ disabled }) => (
                    <form.Field name="allow_anonymous">
                      {(field) => (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Label className="text-sm font-medium text-[#646464]">
                              {t('whoCanChatLabel')}
                              <span className="ml-1 text-red-500">*</span>
                            </Label>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger
                                  type="button"
                                  aria-label={t('whoCanChatInfoAriaLabel')}
                                >
                                  <Info className="h-4 w-4 text-gray-400" />
                                </TooltipTrigger>
                                <TooltipContent className="ibl-tooltip-content">
                                  <p>{t('whoCanChatTooltip')}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                          <Select
                            value={field.state.value}
                            onValueChange={(value) =>
                              value && field.handleChange(value)
                            }
                            disabled={isDisabled || disabled}
                          >
                            <SelectTrigger aria-label={t('selectWhoCanChat')}>
                              <SelectValue
                                placeholder={t('selectWhoCanChat')}
                              />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="true">
                                {t('anyoneOption')}
                              </SelectItem>
                              <SelectItem value="false">
                                {t('authenticatedUsersOption')}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </form.Field>
                  )}
                </WithFormPermissions>

                <WithFormPermissions
                  name="is_featured"
                  // @ts-ignore
                  permissions={mentor?.permissions?.field}
                >
                  {({ disabled }) => (
                    <form.Field name="is_featured">
                      {(field) => (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-[#646464]">
                              {t('highlightFeaturedLabel')}
                            </span>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger
                                  aria-label={t(
                                    'highlightFeaturedInfoAriaLabel',
                                  )}
                                >
                                  <Info className="h-4 w-4 text-gray-400" />
                                </TooltipTrigger>
                                <TooltipContent className="ibl-tooltip-content">
                                  <p>{t('highlightFeaturedTooltip')}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                          <Switch
                            checked={field.state.value}
                            onCheckedChange={(checked) =>
                              field.handleChange(checked)
                            }
                            disabled={isDisabled || disabled}
                            aria-label={t('highlightFeaturedLabel')}
                            aria-checked={field.state.value}
                          />
                        </div>
                      )}
                    </form.Field>
                  )}
                </WithFormPermissions>
              </div>
            </TabsContent>

            {/* === CAPABILITIES ============================================== */}
            <TabsContent
              value="capabilities"
              forceMount
              className="m-0 data-[state=inactive]:hidden"
            >
              <div className="space-y-6">
                {/* Chat experience */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
                    {t('chatExperienceHeading')}
                  </h4>
                  <WithFormPermissions
                    name="show_attachment"
                    // @ts-ignore
                    permissions={mentor?.permissions?.field}
                  >
                    {({ disabled }) => (
                      <form.Field name="show_attachment">
                        {(field) => (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-[#646464]">
                                {t('enableFileAttachmentsLabel')}
                              </span>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger
                                    type="button"
                                    aria-label={t(
                                      'enableFileAttachmentsInfoAriaLabel',
                                    )}
                                  >
                                    <Info className="h-4 w-4 text-gray-400" />
                                  </TooltipTrigger>
                                  <TooltipContent className="ibl-tooltip-content">
                                    <p>{t('enableFileAttachmentsTooltip')}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                            <Switch
                              checked={field.state.value}
                              onCheckedChange={(checked) =>
                                field.handleChange(checked)
                              }
                              disabled={isDisabled || disabled}
                              aria-label={t('enableFileAttachmentsLabel')}
                              aria-checked={field.state.value}
                            />
                          </div>
                        )}
                      </form.Field>
                    )}
                  </WithFormPermissions>

                  {/* "Remember past conversations" (enable_memory_component)
                      moved to the Memory tab's inline capability toggle. */}

                  <WithFormPermissions
                    name="show_reasoning"
                    // @ts-ignore
                    permissions={mentor?.permissions?.field}
                  >
                    {({ disabled }) => (
                      <form.Field name="show_reasoning">
                        {(field) => (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-[#646464]">
                                Enable verbose reasoning
                              </span>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger
                                    type="button"
                                    aria-label="More info about enable verbose reasoning"
                                  >
                                    <Info className="h-4 w-4 text-gray-400" />
                                  </TooltipTrigger>
                                  <TooltipContent className="ibl-tooltip-content">
                                    <p>
                                      Show the agent’s reasoning steps while it
                                      responds.
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                            <Switch
                              checked={field.state.value}
                              onCheckedChange={(checked) =>
                                field.handleChange(checked)
                              }
                              disabled={isDisabled || disabled}
                              aria-label={`Enable verbose reasoning ${field.state.value ? 'enabled' : 'disabled'}`}
                            />
                          </div>
                        )}
                      </form.Field>
                    )}
                  </WithFormPermissions>

                  <WithFormPermissions
                    name="enable_multi_query_rag"
                    // @ts-ignore
                    permissions={mentor?.permissions?.field}
                  >
                    {({ disabled }) => (
                      <form.Field name="enable_multi_query_rag">
                        {(field) => (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-[#646464]">
                                {t('enhancedDocRetrievalLabel')}
                              </span>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger
                                    type="button"
                                    aria-label={t(
                                      'enhancedDocRetrievalInfoAriaLabel',
                                    )}
                                  >
                                    <Info className="h-4 w-4 text-gray-400" />
                                  </TooltipTrigger>
                                  <TooltipContent className="ibl-tooltip-content">
                                    <p>{t('enhancedDocRetrievalTooltip')}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                            <Switch
                              checked={field.state.value}
                              onCheckedChange={(checked) =>
                                field.handleChange(checked)
                              }
                              disabled={isDisabled || disabled}
                              aria-label={t('enhancedDocRetrievalLabel')}
                              aria-checked={field.state.value}
                            />
                          </div>
                        )}
                      </form.Field>
                    )}
                  </WithFormPermissions>

                  <WithFormPermissions
                    name="enable_prompt_caching"
                    // @ts-ignore
                    permissions={mentor?.permissions?.field}
                  >
                    {({ disabled }) => (
                      <form.Field name="enable_prompt_caching">
                        {(field) => (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-[#646464]">
                                {t('enablePromptCachingLabel')}
                              </span>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger
                                    type="button"
                                    aria-label={t(
                                      'enablePromptCachingInfoAriaLabel',
                                    )}
                                  >
                                    <Info className="h-4 w-4 text-gray-400" />
                                  </TooltipTrigger>
                                  <TooltipContent className="ibl-tooltip-content">
                                    <p>{t('enablePromptCachingTooltip')}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                            <Switch
                              checked={field.state.value}
                              onCheckedChange={(checked) =>
                                field.handleChange(checked)
                              }
                              disabled={isDisabled || disabled}
                              aria-label={t('enablePromptCachingLabel')}
                              aria-checked={field.state.value}
                            />
                          </div>
                        )}
                      </form.Field>
                    )}
                  </WithFormPermissions>
                </div>

                {/* Voice & calls */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
                    {t('voiceCallsHeading')}
                  </h4>
                  {/* "Enable voice calls" (show_voice_call) moved to the Voice
                      tab's inline capability toggle. */}

                  <WithFormPermissions
                    name="show_voice_record"
                    // @ts-ignore
                    permissions={mentor?.permissions?.field}
                  >
                    {({ disabled }) => (
                      <form.Field name="show_voice_record">
                        {(field) => (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-[#646464]">
                                {t('enableVoiceRecordingsLabel')}
                              </span>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger
                                    type="button"
                                    aria-label={t(
                                      'enableVoiceRecordingsInfoAriaLabel',
                                    )}
                                  >
                                    <Info className="h-4 w-4 text-gray-400" />
                                  </TooltipTrigger>
                                  <TooltipContent className="ibl-tooltip-content">
                                    <p>{t('enableVoiceRecordingsTooltip')}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                            <Switch
                              checked={field.state.value}
                              onCheckedChange={(checked) =>
                                field.handleChange(checked)
                              }
                              disabled={isDisabled || disabled}
                              aria-label={t('enableVoiceRecordingsLabel')}
                              aria-checked={field.state.value}
                            />
                          </div>
                        )}
                      </form.Field>
                    )}
                  </WithFormPermissions>

                  {/* "Enable screen sharing" (enable_video) moved to the Screen
                      Share tab's inline capability toggle. */}

                  <form.Field name="use_function_calling_for_rag">
                    {(field) => (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-[#646464]">
                            {t('smartDocRetrievalLabel')}
                          </span>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger
                                type="button"
                                aria-label={t('smartDocRetrievalInfoAriaLabel')}
                              >
                                <Info className="h-4 w-4 text-gray-400" />
                              </TooltipTrigger>
                              <TooltipContent className="ibl-tooltip-content">
                                <p>{t('smartDocRetrievalTooltip')}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <Switch
                          checked={field.state.value}
                          onCheckedChange={(checked) =>
                            field.handleChange(checked)
                          }
                          disabled={isDisabled}
                          aria-label={
                            field.state.value
                              ? t('smartDocRetrievalAriaEnabled')
                              : t('smartDocRetrievalAriaDisabled')
                          }
                          data-testid="settings-use-function-calling-for-rag-switch"
                        />
                      </div>
                    )}
                  </form.Field>
                </div>

                {/* Advanced */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
                    {t('advancedHeading')}
                  </h4>
                  {/* "Dedicated sandbox" (enable_claw) moved to the Sandbox
                      tab's inline capability toggle, and "Filter PII from
                      messages" (enable_privacy_router) moved to the Privacy
                      tab's inline capability toggle. */}

                  {/* Hidden when the tenant disables chat-privacy control — the kill switch is a no-op then. */}
                  {tenantAllowsChatPrivacyControl && (
                    <WithFormPermissions
                      name="disable_chathistory"
                      // @ts-ignore - disable_chathistory not in permissions type yet
                      permissions={mentor?.permissions?.field}
                    >
                      {({ disabled }) => (
                        <form.Field name="disable_chathistory">
                          {(field) => (
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-[#646464]">
                                  Enable private mode
                                </span>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger
                                      type="button"
                                      aria-label="More info about enable private mode"
                                    >
                                      <Info className="h-4 w-4 text-gray-400" />
                                    </TooltipTrigger>
                                    <TooltipContent className="ibl-tooltip-content">
                                      <p>
                                        When on, every conversation with this
                                        agent runs in private mode — no chat
                                        history or memory is stored for any
                                        user. Use this for sensitive or
                                        compliance-bound deployments.
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                              <Switch
                                checked={field.state.value}
                                onCheckedChange={(checked) =>
                                  field.handleChange(checked)
                                }
                                disabled={isDisabled || disabled}
                                aria-label="Enable private mode"
                                aria-checked={field.state.value}
                              />
                            </div>
                          )}
                        </form.Field>
                      )}
                    </WithFormPermissions>
                  )}

                  <WithFormPermissions
                    name="forkable"
                    // @ts-ignore
                    permissions={mentor?.permissions?.field}
                  >
                    {({ disabled }) => (
                      <form.Field name="forkable">
                        {(field) => (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-[#646464]">
                                {t('enableCopiesLabel')}
                              </span>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger
                                    type="button"
                                    aria-label={t('enableCopiesInfoAriaLabel')}
                                  >
                                    <Info className="h-4 w-4 text-gray-400" />
                                  </TooltipTrigger>
                                  <TooltipContent className="ibl-tooltip-content">
                                    <p>{t('enableCopiesTooltip')}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                            <Switch
                              checked={field.state.value}
                              onCheckedChange={(checked) =>
                                field.handleChange(checked)
                              }
                              disabled={isDisabled || disabled}
                              aria-label={t('enableCopiesLabel')}
                              aria-checked={field.state.value}
                            />
                          </div>
                        )}
                      </form.Field>
                    )}
                  </WithFormPermissions>

                  {/* "Enable LTI launches" (is_lti_accessible) moved to the LTI
                      tab's inline capability toggle. */}
                </div>
              </div>
            </TabsContent>
          </Tabs>
          <div className="mt-6 flex items-center">
            <div className="flex gap-2">
              <form.Subscribe
                selector={(state) => ({ isFormValid: state.canSubmit })}
              >
                {({ isFormValid }) => (
                  <WithFormPermissions
                    name="object"
                    // @ts-ignore
                    permissions={mentor?.permissions}
                  >
                    {({ disabled }) =>
                      !disabled && (
                        <Button
                          type="submit"
                          disabled={isDisabled || !isFormValid}
                          className="bg-gradient-to-r from-[#2563EB] to-[#93C5FD] text-white hover:opacity-90"
                        >
                          {isLoadingEditMentor
                            ? t('savingButton')
                            : t('saveButton')}
                        </Button>
                      )
                    }
                  </WithFormPermissions>
                )}
              </form.Subscribe>

              {/* @ts-ignore forkable exists in API response but not in type */}
              {mentor?.forkable && (
                <Button
                  onClick={openCopyMentorModal}
                  type="button"
                  disabled={isDisabled}
                  variant="outline"
                >
                  {t('copyButton')}
                </Button>
              )}

              <WithFormPermissions
                name="object"
                // @ts-ignore
                permissions={mentor?.permissions}
              >
                {({ canDelete }) =>
                  canDelete && (
                    <Button
                      onClick={openDeleteMentorModal}
                      type="button"
                      disabled={isDisabled}
                      variant="outline"
                    >
                      {t('deleteButton')}
                    </Button>
                  )
                }
              </WithFormPermissions>
            </div>
          </div>
        </form>
      </div>

      {isModalOpen && FreeTrialDialog && (
        <FreeTrialDialog isOpen={isModalOpen} onClose={closeModal} />
      )}

      {isDeleteModalOpen && (
        <DeleteMentorModal
          isOpen={isDeleteModalOpen}
          onClose={closeDeleteMentorModal}
        />
      )}

      {isCopyModalOpen && <CopyMentorModal onClose={closeCopyMentorModal} />}
    </>
  );
}
