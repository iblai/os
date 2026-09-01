'use client';

import React from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';

import { Info, Edit, X, ChevronsUpDown, Check } from 'lucide-react';
import { useGetMentorCategoriesQuery } from '@iblai/iblai-js/data-layer';

import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
import { Button } from '@/components/ui/button';
import { useTenantKey } from '@/hooks/use-tenants';
import { MENTOR_VISIBILITY, MODEL_AGENTS } from '@/lib/constants';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useCreateMentor,
  type CreateMentorFormValues,
} from '@/hooks/use-mentors/use-create-mentor';
import { EditMentorModalDialog, Prompt } from './edit-mentor-modal-dialog';
import { useShowFreeTrialDialog } from '@/hooks/user-user-actions';
import { cn } from '@/lib/utils';
import { config } from '@/lib/config';

export interface CreateMentorFormProps {
  /**
   * Render mode. `dialog` (default) reproduces the exact markup used inside the
   * Create Agent modal. `inline` renders the same form without any Dialog-only
   * primitives so it can be embedded directly in a page.
   */
  variant?: 'dialog' | 'inline';
  /**
   * Optional values used to pre-populate any of the form fields (including the
   * prompts in the Prompts tab). Anything not provided falls back to the
   * existing defaults, so omitting this prop keeps the original behaviour.
   */
  initialValues?: Partial<CreateMentorFormValues>;
  /** Heading text. Defaults to the original "Create Agent" label. */
  title?: string;
  /** Whether to render the heading. Defaults to true (original behaviour). */
  showHeader?: boolean;
  /** Extra classes for the form container (inline mode only). */
  className?: string;
  /** Optional callback fired after an agent is successfully created. */
  onCreated?: () => void;
}

export function CreateMentorForm({
  variant = 'dialog',
  initialValues,
  title = 'Create Agent',
  showHeader = true,
  className,
  onCreated,
}: CreateMentorFormProps) {
  const t = useTranslations('modalsCreateMentorForm');
  const { tenant: tenantKey } = useTenantKey();
  const username = useUsername();

  const { data: mentorCategories, isLoading: isLoadingMentorCategories } =
    useGetMentorCategoriesQuery(
      {
        org: tenantKey ?? '',
        // @ts-expect-error - userId parameter may not exist in API but passed from legacy code
        userId: username ?? '',
      },
      {
        skip: !tenantKey || !username,
      },
    );

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = React.useState('settings');
  const [prompt, setPrompt] = React.useState<Prompt | null>(null);

  const {
    form,
    name,
    description,
    category,
    file,
    guidedPrompt,
    systemPrompt,
    proactivePrompt,
    isLoadingCreateMentor,
    editPrompt,
  } = useCreateMentor(initialValues, onCreated);
  const {
    FreeTrialDialog,
    closeModal: closeFreeTrialModal,
    isModalOpen: isFreeTrialModalOpen,
    executeWithTrialCheck,
  } = useShowFreeTrialDialog();

  const isDisabled = isLoadingMentorCategories || isLoadingCreateMentor;
  const disablePromptsTab =
    name === '' || description === '' || category === null;

  return (
    <>
      {variant === 'dialog' && (
        <DialogDescription className="sr-only">
          {t('dialogDescription')}
        </DialogDescription>
      )}
      <div
        className={cn(
          'space-y-6',
          variant === 'inline' ? className : undefined,
        )}
      >
        {showHeader && (
          <DialogHeader>
            {variant === 'dialog' ? (
              <DialogTitle className="ibl-dialog-title">{title}</DialogTitle>
            ) : (
              <h2 className="ibl-dialog-title">{title}</h2>
            )}
          </DialogHeader>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="justify-start">
            <TabsTrigger
              value="settings"
              className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#2563EB] data-[state=active]:to-[#93C5FD] data-[state=active]:text-white"
            >
              {t('settingsTab')}
            </TabsTrigger>
            <TabsTrigger
              value="prompts"
              disabled={disablePromptsTab}
              className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#2563EB] data-[state=active]:to-[#93C5FD] data-[state=active]:text-white"
            >
              {t('promptsTab')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="settings">
            <div className="space-y-6">
              <div className="flex flex-col gap-6 md:flex-row">
                <div className="order-2 space-y-6 md:order-1 md:flex-1">
                  <form.Field name="name">
                    {(field) => {
                      const hasNoValue = field.state.value === '';
                      const isDirty = field.state.meta.isDirty;
                      const hasNoValueAndIsDirty = hasNoValue && isDirty;

                      return (
                        <div className="space-y-2">
                          <label className="flex items-center text-sm font-medium text-gray-700">
                            {t('nameLabel')}
                            <span className="ml-1 text-red-500">*</span>
                          </label>
                          <Input
                            placeholder={t('namePlaceholder')}
                            value={field.state.value}
                            onChange={(e) => field.handleChange(e.target.value)}
                            autoComplete="name"
                            disabled={isDisabled}
                          />
                          {hasNoValueAndIsDirty && (
                            <p className="text-xs text-red-500">
                              {t('nameRequired')}
                            </p>
                          )}
                        </div>
                      );
                    }}
                  </form.Field>

                  <form.Field name="description">
                    {(field) => {
                      const hasNoValue = field.state.value === '';
                      const isDirty = field.state.meta.isDirty;
                      const hasNoValueAndIsDirty = hasNoValue && isDirty;

                      return (
                        <div className="space-y-2">
                          <label className="flex items-center text-sm font-medium text-gray-700">
                            {t('descriptionLabel')}
                            <span className="ml-1 text-red-500">*</span>
                          </label>
                          <Textarea
                            placeholder={t('descriptionPlaceholder')}
                            value={field.state.value}
                            onChange={(e) => field.handleChange(e.target.value)}
                            required
                            disabled={isDisabled}
                          />
                          {hasNoValueAndIsDirty && (
                            <p className="text-xs text-red-500">
                              {t('descriptionRequired')}
                            </p>
                          )}
                        </div>
                      );
                    }}
                  </form.Field>

                  <form.Field name="category">
                    {(field) => (
                      <div className="space-y-2">
                        <label className="flex items-center text-sm font-medium text-gray-700">
                          {t('categoryLabel')}
                          <span className="ml-1 text-red-500">*</span>
                        </label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-label={t('selectCategoryAriaLabel')}
                              className="w-full justify-between"
                            >
                              {field.state.value
                                ? mentorCategories?.find(
                                    (mentorCategory) =>
                                      mentorCategory.id === field.state.value,
                                  )?.name
                                : t('selectCategoryPlaceholder')}
                              <ChevronsUpDown className="opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent
                            aria-label={t('categoriesDropdownAriaLabel')}
                            role="listbox"
                            aria-labelledby="Categories dropdown container"
                            className="w-full max-w-[490px] p-0 sm:w-[400px] lg:w-[490px]"
                          >
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
                                  {mentorCategories?.map((mentorCategory) => (
                                    <CommandItem
                                      key={mentorCategory.id}
                                      value={mentorCategory.id.toString()}
                                      onSelect={(currentValue) => {
                                        field.handleChange(
                                          Number(currentValue),
                                        );
                                      }}
                                    >
                                      {mentorCategory.name}
                                      <Check
                                        className={cn(
                                          'ml-auto',
                                          field.state.value ===
                                            mentorCategory.id
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

                  <form.Field name="mentorVisibility">
                    {(field) => (
                      <div className="space-y-2">
                        <label className="flex items-center text-sm font-medium text-gray-700">
                          {t('agentVisibilityLabel')}
                          <span className="ml-1 text-red-500">*</span>
                        </label>
                        <Select
                          value={field.state.value}
                          onValueChange={(value) => field.handleChange(value)}
                          required
                          disabled={isDisabled}
                        >
                          <SelectTrigger
                            aria-label={t('selectAgentVisibilityAriaLabel')}
                          >
                            <SelectValue
                              placeholder={t('selectVisibilityPlaceholder')}
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

                  {config.showBaseMentor() && (
                    <form.Field name="base">
                      {(field) => (
                        <div className="space-y-2">
                          <label className="flex items-center text-sm font-medium text-gray-700">
                            {t('baseLabel')}
                            <span className="ml-1 text-red-500">*</span>
                          </label>
                          <Select
                            value={field.state.value}
                            onValueChange={(value) => field.handleChange(value)}
                            required
                            disabled={isDisabled}
                          >
                            <SelectTrigger
                              aria-label={t('selectBaseModelAriaLabel')}
                            >
                              <SelectValue
                                placeholder={t('selectBasePlaceholder')}
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {MODEL_AGENTS.map((agent) => (
                                <SelectItem
                                  key={agent.value}
                                  value={agent.value}
                                >
                                  {agent.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </form.Field>
                  )}
                </div>
                <form.Field name="file">
                  {(field) => (
                    <>
                      <div className="order-1 mb-4 space-y-2 md:order-2 md:mb-0 md:w-[200px]">
                        <label className="text-sm font-medium text-gray-700">
                          {t('imageLabel')}
                        </label>
                        <div
                          className="flex h-[200px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200"
                          onClick={() => {
                            if (isDisabled) return;
                            fileInputRef.current?.click();
                          }}
                          role="button"
                          tabIndex={0}
                          aria-label={t('uploadImageAriaLabel')}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              if (!isDisabled) {
                                fileInputRef.current?.click();
                              }
                            }
                          }}
                        >
                          {file ? (
                            <div className="relative h-full w-full">
                              <Image
                                src={URL.createObjectURL(file)}
                                alt={t('agentImageAlt')}
                                className="h-full w-full object-cover"
                                width={200}
                                height={200}
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="absolute top-2 right-2 cursor-pointer rounded-full"
                                onClick={(event) => {
                                  if (isDisabled) return;
                                  event.stopPropagation();
                                  field.handleChange(null);
                                  if (fileInputRef.current) {
                                    fileInputRef.current.value = '';
                                  }
                                }}
                                aria-label={t('removeImageAriaLabel')}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-700">
                              {t('uploadButton')}
                            </span>
                          )}
                        </div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) {
                              field.handleChange(file);
                            }
                          }}
                          aria-label={t('selectImageFileAriaLabel')}
                        />
                      </div>
                    </>
                  )}
                </form.Field>
              </div>

              <div className="flex justify-end">
                <Button
                  type="button"
                  disabled={disablePromptsTab}
                  className="w-full gap-2 bg-gradient-to-r from-[#2563EB] to-[#93C5FD] text-white hover:opacity-90 sm:w-auto"
                  onClick={() => setActiveTab('prompts')}
                >
                  {t('nextButton')}
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="prompts">
            <form
              className="mt-6 space-y-6"
              onSubmit={(formEvent) => {
                formEvent.preventDefault();
                formEvent.stopPropagation();
                executeWithTrialCheck(form.handleSubmit);
              }}
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <form.Field name="systemPrompt">
                  {(field) => (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-medium text-gray-700">
                          {t('systemPromptsHeading')}
                        </h3>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                aria-label={t('systemPromptsInfoAriaLabel')}
                                className="flex items-center justify-center"
                              >
                                <Info className="h-4 w-4 text-gray-400" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{t('systemPromptsTooltip')}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <div className="flex h-[200px] flex-col rounded-lg bg-gray-50 p-4">
                        <div
                          className="flex-1 overflow-auto"
                          tabIndex={0}
                          role="textbox"
                          aria-readonly="true"
                          aria-label={t('systemPromptContentAriaLabel')}
                        >
                          <p className="text-sm text-gray-600">
                            {field.state.value}
                          </p>
                        </div>
                        <div className="mt-4 flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 border-gray-200 px-4 text-xs font-normal text-gray-600"
                            onClick={() => {
                              field.handleChange(field.state.value);
                              setPrompt({
                                label: t('systemPromptLabel'),
                                type: 'systemPrompt',
                              });
                            }}
                          >
                            <Edit className="mr-1.5 h-3 w-3" />
                            {t('editButton')}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </form.Field>

                <form.Field name="proactivePrompt">
                  {(field) => (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-medium text-gray-700">
                          {t('proactivePromptsHeading')}
                        </h3>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                aria-label={t('proactivePromptsInfoAriaLabel')}
                                className="flex items-center justify-center"
                              >
                                <Info className="h-4 w-4 text-gray-400" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{t('proactivePromptsTooltip')}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <div className="flex h-[200px] flex-col rounded-lg bg-gray-50 p-4">
                        <div
                          className="flex-1 overflow-auto"
                          tabIndex={0}
                          role="textbox"
                          aria-readonly="true"
                          aria-label={t('proactivePromptContentAriaLabel')}
                        >
                          <p className="text-sm text-gray-600">
                            {field.state.value}
                          </p>
                        </div>
                        <div className="mt-4 flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 border-gray-200 px-4 text-xs font-normal text-gray-600"
                            onClick={() => {
                              field.handleChange(field.state.value);
                              setPrompt({
                                label: t('proactivePromptLabel'),
                                type: 'proactivePrompt',
                              });
                            }}
                          >
                            <Edit className="mr-1.5 h-3 w-3" />
                            {t('editButton')}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </form.Field>

                <form.Field name="guidedPrompt">
                  {(field) => (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-medium text-gray-700">
                          {t('guidedPromptsHeading')}
                        </h3>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                aria-label={t('guidedPromptsInfoAriaLabel')}
                                className="flex items-center justify-center"
                              >
                                <Info className="h-4 w-4 text-gray-400" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{t('guidedPromptsTooltip')}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <div className="flex h-[200px] flex-col rounded-lg bg-gray-50 p-4">
                        <div
                          className="flex-1 overflow-auto"
                          tabIndex={0}
                          role="textbox"
                          aria-readonly="true"
                          aria-label={t('guidedPromptContentAriaLabel')}
                        >
                          <p className="text-sm text-gray-600">
                            {field.state.value}
                          </p>
                        </div>
                        <div className="mt-4 flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 border-gray-200 px-4 text-xs font-normal text-gray-600"
                            onClick={() => {
                              field.handleChange(field.state.value);
                              setPrompt({
                                label: t('guidedPromptLabel'),
                                type: 'guidedPrompt',
                              });
                            }}
                          >
                            <Edit className="mr-1.5 h-3 w-3" />
                            {t('editButton')}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </form.Field>
              </div>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  className="bg-gradient-to-r from-[#2563EB] to-[#93C5FD] text-white hover:opacity-90"
                  disabled={isDisabled}
                >
                  {isLoadingCreateMentor ? t('saving') : t('saveButton')}
                </Button>
              </div>
            </form>
          </TabsContent>
        </Tabs>
      </div>
      {prompt && (
        <EditMentorModalDialog
          isOpen={!!prompt}
          onClose={() => setPrompt(null)}
          editPrompt={editPrompt}
          prompt={prompt}
          value={
            prompt.type === 'systemPrompt'
              ? systemPrompt
              : prompt.type === 'proactivePrompt'
                ? proactivePrompt
                : guidedPrompt
          }
        />
      )}
      {isFreeTrialModalOpen && FreeTrialDialog && (
        <FreeTrialDialog
          isOpen={isFreeTrialModalOpen}
          onClose={closeFreeTrialModal}
        />
      )}
    </>
  );
}

/**
 * Convenience wrapper for embedding the Create Agent form directly in a page
 * (i.e. without the surrounding Dialog chrome).
 */
export function CreateMentorInline(
  props: Omit<CreateMentorFormProps, 'variant'>,
) {
  return <CreateMentorForm {...props} variant="inline" />;
}
