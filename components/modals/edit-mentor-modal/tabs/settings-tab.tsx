'use client';

import React from 'react';
import dynamic from 'next/dynamic';

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

import {
  useGetMentorSettingsQuery,
  useGetMentorCategoriesQuery,
  useEditMentorMutation,
  useGetClawMentorConfigQuery,
  useUpdateClawMentorConfigMutation,
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
  enable_claw: boolean;
  enable_memory_component: boolean;
  enable_multi_query_rag: boolean;
}

export function SettingsTab() {
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

  // Mentor UUID is required for the new mentor-scoped claw-config endpoint.
  // The route accepts it via `mentor_unique_id`; fall back to `activeMentorId`
  // (which may already be a UUID when navigating directly).
  // @ts-ignore mentor_unique_id is on the API response but not the public type
  const mentorUuid: string | undefined =
    // @ts-ignore mentor_unique_id is on the API response but not the public type
    mentor?.mentor_unique_id ?? activeMentorId;

  // Fetch the claw-config for this mentor. Returns null when no config exists
  // (the data-layer normalises 404 → null) — that's how we know the mentor is
  // not yet wired to a Claw instance.
  const { data: clawMentorConfig } = useGetClawMentorConfigQuery(
    { org: tenantKey!, mentorUniqueId: mentorUuid! },
    { skip: !tenantKey || !mentorUuid },
  );

  const [updateClawConfig] = useUpdateClawMentorConfigMutation();
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
      // @ts-ignore - enable_claw exists in API response but not in type
      enable_claw: mentor?.enable_claw ?? false,
      enable_memory_component: initialMemoryEnabled,
      enable_multi_query_rag: mentor?.enable_multi_query_rag ?? false,
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

      if (value.show_voice_call !== undefined) {
        values.show_voice_call = value.show_voice_call;
      }

      if (value.show_voice_record !== undefined) {
        values.show_voice_record = value.show_voice_record;
      }

      if (value.is_lti_accessible !== undefined) {
        values.is_lti_accessible = value.is_lti_accessible;
      }

      if (value.forkable !== undefined) {
        values.forkable = value.forkable;
      }

      if (value.enable_claw !== undefined) {
        values.enable_claw = value.enable_claw;
      }

      // Detect whether the Sandbox toggle changed. If it did AND the
      // mentor is wired to a Claw instance (clawMentorConfig exists), we also
      // PATCH the claw-config so its `enabled` flag stays in sync with the
      // mentor-settings intent. When no claw-config exists (404 → null) we
      // simply skip this — the mentor isn't connected to an instance yet.
      // @ts-ignore enable_claw exists in API response but not in type
      const previousEnableClaw: boolean = mentor?.enable_claw ?? false;
      const enableClawChanged =
        value.enable_claw !== undefined &&
        value.enable_claw !== previousEnableClaw;
      // Only send enable_memory_component if the user actually changed it.
      if (value.enable_memory_component !== initialMemoryEnabled) {
        values.enable_memory_component = value.enable_memory_component;
      }

      if (value.enable_multi_query_rag !== undefined) {
        values.enable_multi_query_rag = value.enable_multi_query_rag;
      }

      try {
        await editMentor({
          mentor: activeMentorId,
          org: tenantKey,
          // @ts-ignore
          userId: username ?? '',
          formData: {
            ...values,
          },
        }).unwrap();

        if (enableClawChanged && clawMentorConfig && tenantKey && mentorUuid) {
          try {
            await updateClawConfig({
              org: tenantKey,
              mentorUniqueId: mentorUuid,
              enabled: value.enable_claw,
            }).unwrap();
          } catch (clawError) {
            // Don't fail the whole save flow if syncing the claw-config
            // fails — the mentor-settings update already succeeded. Log
            // for diagnostics; the next reload will reflect the truth.
            console.error(JSON.stringify({ tenant: tenantKey, clawError }));
          }
        }
        toast.success('Agent updated successfully');
      } catch (error) {
        console.error(JSON.stringify(error));
        toast.error('Failed to update agent');
        console.error(JSON.stringify({ tenant: tenantKey, error }));
      }
    },
  });

  return (
    <>
      <div className="flex h-[73px] flex-shrink-0 items-center border-b border-gray-200 bg-white p-4 lg:block">
        <div>
          <h3 className="mb-1 text-base font-medium text-gray-900">Settings</h3>
          <p className="text-xs text-gray-600">
            Configure your agent's basic settings and preferences.
          </p>
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
        aria-label="Settings form content"
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
              aria-label="Settings sub-categories"
            >
              <TabsTrigger
                value="basic"
                className="px-3 py-1.5 text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-gray-900"
              >
                Basic
              </TabsTrigger>
              <TabsTrigger
                value="discovery"
                className="px-3 py-1.5 text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-gray-900"
              >
                Discovery
              </TabsTrigger>
              <TabsTrigger
                value="capabilities"
                className="px-3 py-1.5 text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-gray-900"
              >
                Capabilities
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
                                Name
                                <span className="ml-1 text-red-500">*</span>
                              </Label>
                              <Input
                                value={field.state.value}
                                onChange={(e) =>
                                  field.handleChange(e.target.value)
                                }
                                placeholder="Agent Name"
                                disabled={isDisabled || disabled}
                              />
                              {hasNoValueAndIsDirty && (
                                <p className="text-xs text-red-500">
                                  Agent name is required
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
                      Unique ID
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        value={activeMentorId || ''}
                        readOnly
                        disabled
                        className="flex-1 cursor-not-allowed bg-gray-50"
                        placeholder="Unique ID"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => activeMentorId && copy(activeMentorId)}
                        disabled={!activeMentorId}
                        aria-label={
                          copyStatus === 'success'
                            ? 'Unique ID copied to clipboard'
                            : 'Copy unique ID to clipboard'
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
                                Description
                                <span className="ml-1 text-red-500">*</span>
                              </Label>
                              <Textarea
                                value={field.state.value}
                                onChange={(e) =>
                                  field.handleChange(e.target.value)
                                }
                                placeholder="Agent Description"
                                className="min-h-[150px]"
                                disabled={isDisabled || disabled}
                              />
                              {hasNoValueAndIsDirty && (
                                <p className="text-xs text-red-500">
                                  Agent description is required
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
                              Category
                              <span className="ml-1 text-red-500">*</span>
                            </Label>
                            <Popover>
                              <PopoverTrigger
                                asChild
                                aria-label="Select a category"
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
                                    : 'Select category...'}
                                  <ChevronsUpDown className="opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-full max-w-[490px] p-0 sm:w-[400px] lg:w-[490px]">
                                <Command>
                                  <CommandInput
                                    placeholder="Search category..."
                                    className="h-9"
                                  />
                                  <CommandList>
                                    <CommandEmpty>
                                      No Category found.
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
                            Image
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
                                  alt="Agent"
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
                                  aria-label="Remove image"
                                  disabled={isDisabled || disabled}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ) : (
                              <span className="text-sm text-gray-500">
                                + Upload
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
                              Who Can View?
                              <span className="ml-1 text-red-500">*</span>
                            </Label>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger
                                  type="button"
                                  aria-label="More info about chat access"
                                >
                                  <Info className="h-4 w-4 text-gray-400" />
                                </TooltipTrigger>
                                <TooltipContent className="ibl-tooltip-content">
                                  <p>Control who can view this agent.</p>
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
                            <SelectTrigger aria-label="Select Who Can View">
                              <SelectValue placeholder="Select Who Can View" />
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
                              Who Can Chat?
                              <span className="ml-1 text-red-500">*</span>
                            </Label>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger
                                  type="button"
                                  aria-label="More info about chat access"
                                >
                                  <Info className="h-4 w-4 text-gray-400" />
                                </TooltipTrigger>
                                <TooltipContent className="ibl-tooltip-content">
                                  <p>Control who can chat with this agent.</p>
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
                            <SelectTrigger aria-label="Select who can chat">
                              <SelectValue placeholder="Select who can chat" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="true">Anyone</SelectItem>
                              <SelectItem value="false">
                                Authenticated Users
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
                              Highlight in featured listings
                            </span>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger aria-label="More info about highlight in featured listings">
                                  <Info className="h-4 w-4 text-gray-400" />
                                </TooltipTrigger>
                                <TooltipContent className="ibl-tooltip-content">
                                  <p>
                                    Feature this agent to highlight it in
                                    listings.
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
                            aria-label="Highlight in featured listings"
                            aria-checked={field.state.value}
                          />
                        </div>
                      )}
                    </form.Field>
                  )}
                </WithFormPermissions>

                <WithFormPermissions
                  name="is_lti_accessible"
                  // @ts-ignore
                  permissions={mentor?.permissions?.field}
                >
                  {({ disabled }) => (
                    <form.Field name="is_lti_accessible">
                      {(field) => (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-[#646464]">
                              Allow LTI launches
                            </span>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger
                                  type="button"
                                  aria-label="More info about allow lti launches"
                                >
                                  <Info className="h-4 w-4 text-gray-400" />
                                </TooltipTrigger>
                                <TooltipContent className="ibl-tooltip-content">
                                  <p>
                                    Allows this agent to be accessible via LTI
                                    launches. Unselecting this will immediately
                                    remove access for any users users that have
                                    launched this via LTI.
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
                            aria-label="Allow LTI launches"
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
                              Allow file attachments in chat
                            </span>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger
                                  type="button"
                                  aria-label="More info about allow file attachments in chat"
                                >
                                  <Info className="h-4 w-4 text-gray-400" />
                                </TooltipTrigger>
                                <TooltipContent className="ibl-tooltip-content">
                                  <p>
                                    Show File Attachment Options in Chat
                                    Interface
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
                            aria-label="Allow file attachments in chat"
                            aria-checked={field.state.value}
                          />
                        </div>
                      )}
                    </form.Field>
                  )}
                </WithFormPermissions>

                <WithFormPermissions
                  name="show_voice_call"
                  // @ts-ignore
                  permissions={mentor?.permissions?.field}
                >
                  {({ disabled }) => (
                    <form.Field name="show_voice_call">
                      {(field) => (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-[#646464]">
                              Enable voice calls
                            </span>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger
                                  type="button"
                                  aria-label="More info about enable voice calls"
                                >
                                  <Info className="h-4 w-4 text-gray-400" />
                                </TooltipTrigger>
                                <TooltipContent className="ibl-tooltip-content">
                                  <p>
                                    Show Voice Call Options in Chat Interface
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
                            aria-label="Enable voice calls"
                            aria-checked={field.state.value}
                          />
                        </div>
                      )}
                    </form.Field>
                  )}
                </WithFormPermissions>

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
                              Enable voice recordings
                            </span>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger
                                  type="button"
                                  aria-label="More info about enable voice recordings"
                                >
                                  <Info className="h-4 w-4 text-gray-400" />
                                </TooltipTrigger>
                                <TooltipContent className="ibl-tooltip-content">
                                  <p>
                                    Show Voice Recording Options in Chat
                                    Interface
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
                            aria-label="Enable voice recordings"
                            aria-checked={field.state.value}
                          />
                        </div>
                      )}
                    </form.Field>
                  )}
                </WithFormPermissions>

                <form.Field name="enable_claw">
                  {(field) => (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[#646464]">
                          Enable advanced sandbox
                        </span>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger
                              type="button"
                              aria-label="More info about enable advanced sandbox"
                            >
                              <Info className="h-4 w-4 text-gray-400" />
                            </TooltipTrigger>
                            <TooltipContent className="ibl-tooltip-content">
                              <p>
                                Sandbox mode for configuring agent settings,
                                prompts, and skills.
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
                        disabled={isDisabled}
                        aria-label="Enable advanced sandbox"
                        aria-checked={field.state.value}
                      />
                    </div>
                  )}
                </form.Field>

                <form.Field name="enable_memory_component">
                  {(field) => (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[#646464]">
                          Remember past conversations
                        </span>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger
                              type="button"
                              aria-label="More info about remember past conversations"
                            >
                              <Info className="h-4 w-4 text-gray-400" />
                            </TooltipTrigger>
                            <TooltipContent className="ibl-tooltip-content">
                              <p>
                                Allow this agent to remember and reference
                                information from past conversations.
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
                        disabled={isDisabled}
                        aria-label="Remember past conversations"
                        aria-checked={field.state.value}
                      />
                    </div>
                  )}
                </form.Field>

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
                              Improve document retrieval
                            </span>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger
                                  type="button"
                                  aria-label="More info about improve document retrieval"
                                >
                                  <Info className="h-4 w-4 text-gray-400" />
                                </TooltipTrigger>
                                <TooltipContent className="ibl-tooltip-content">
                                  <p>
                                    Generates multiple search queries from a
                                    single user question to retrieve more
                                    comprehensive and relevant documents.
                                    Improves answer quality by approaching the
                                    knowledge base from different angles,
                                    reducing the chance of missing relevant
                                    information.
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
                            aria-label="Improve document retrieval"
                            aria-checked={field.state.value}
                          />
                        </div>
                      )}
                    </form.Field>
                  )}
                </WithFormPermissions>

                <form.Field name="forkable">
                  {(field) => (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[#646464]">
                          Allow other admins to clone this agent
                        </span>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger
                              type="button"
                              aria-label="More info about allow other admins to clone this agent"
                            >
                              <Info className="h-4 w-4 text-gray-400" />
                            </TooltipTrigger>
                            <TooltipContent className="ibl-tooltip-content">
                              <p>
                                Allow other admins to create a copy of this
                                agent.
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
                        disabled={isDisabled}
                        aria-label="Allow other admins to clone this agent"
                        aria-checked={field.state.value}
                      />
                    </div>
                  )}
                </form.Field>
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
                          {isLoadingEditMentor ? 'Saving...' : 'Save'}
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
                  Copy
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
                      Delete
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
