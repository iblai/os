'use client';

import * as React from 'react';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RichTextEditor } from '@iblai/iblai-js/web-containers';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useGetPromptCategoriesQuery } from '@iblai/iblai-js/data-layer';
import { PromptVisibilityEnum } from '@iblai/iblai-api';
import { MENTOR_VISIBILITY } from '@/lib/constants';
import { useParams } from 'next/navigation';
import { TenantKeyMentorIdParams } from '@/lib/types';
import { useUsername } from '@/hooks/use-user';
import { useForm } from '@tanstack/react-form';
import { useShowFreeTrialDialog } from '@/hooks/user-user-actions';
import { Label } from '../ui/label';

export type SystemPrompt =
  | 'system_prompt'
  | 'proactive_prompt'
  | 'guided_prompt_instructions'
  | 'study_mode_prompt'
  | 'prompt';

export type SafetyPrompt =
  | 'moderation_response'
  | 'safety_response'
  | 'moderation_system_prompt'
  | 'safety_system_prompt';

export interface SelectedPrompt {
  label: string;
  isSystem: boolean;
  name: SystemPrompt | SafetyPrompt;
  prompt: string;
  category?: string;
  id?: number;
  promptVisibility?: PromptVisibilityEnum;
}

const systemPromptSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required'),
});

const nonSystemPromptSchema = z.object({
  category: z.string().min(1, 'Category is required'),
  prompt: z.string().min(1, 'Prompt is required'),
  promptVisibility: z.nativeEnum(PromptVisibilityEnum),
});

export type EditFormValues = {
  category: string;
  prompt: string;
  promptVisibility?: PromptVisibilityEnum;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  selectedPrompt: SelectedPrompt;
  handleSave: (selectedPrompt: SelectedPrompt, values: EditFormValues) => void;
  isEditing: boolean;
};

export function EditPromptModal({ isOpen, onClose, selectedPrompt, handleSave, isEditing }: Props) {
  const { tenantKey } = useParams<TenantKeyMentorIdParams>();
  const username = useUsername();

  const { executeWithTrialCheck, isModalOpen, FreeTrialDialog, closeModal } =
    useShowFreeTrialDialog();

  const { data: promptCategories, isLoading: isLoadingPromptCategories } =
    useGetPromptCategoriesQuery(
      {
        org: tenantKey ?? '',
        // @ts-expect-error - userId parameter may not exist in API but passed from legacy code
        userId: username ?? '',
      },
      {
        skip: selectedPrompt.isSystem,
      },
    );

  const isDisabled = isLoadingPromptCategories || isEditing;

  const form = useForm({
    defaultValues: selectedPrompt.isSystem
      ? {
          prompt: selectedPrompt.prompt,
        }
      : {
          category: selectedPrompt.category ?? '',
          prompt: selectedPrompt.prompt,
          promptVisibility: selectedPrompt.promptVisibility,
        },
    validators: {
      onChange: selectedPrompt.isSystem ? systemPromptSchema : nonSystemPromptSchema,
    },
    onSubmit: ({ value }) => {
      handleSave(selectedPrompt, value as EditFormValues);
    },
  });

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="w-full">
          <form
            onSubmit={(formEvent) => {
              formEvent.preventDefault();
              formEvent.stopPropagation();
              executeWithTrialCheck(form.handleSubmit);
            }}
          >
            <DialogHeader>
              <DialogTitle className="text-start text-base font-semibold text-[#646464]">
                Edit {selectedPrompt.label}
              </DialogTitle>
            </DialogHeader>

            <div className="mt-7 grid gap-4">
              {!selectedPrompt.isSystem && (
                <form.Field name="category">
                  {(field) => (
                    <div className="space-y-2">
                      <Label className="flex items-center text-sm font-medium text-[#646464]">
                        Category
                      </Label>
                      <Select
                        disabled={isDisabled}
                        value={field.state.value}
                        onValueChange={field.handleChange}
                      >
                        <SelectTrigger className="py-6" aria-label="Select a category">
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                        <SelectContent>
                          {promptCategories?.map((category) => (
                            <SelectItem key={category.id} value={category.name}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </form.Field>
              )}

              {!selectedPrompt.isSystem && (
                <form.Field name="promptVisibility">
                  {(field) => (
                    <div className="space-y-2">
                      <Label className="flex items-center text-sm font-medium text-[#646464]">
                        Visibility
                      </Label>
                      <Select
                        disabled={isDisabled}
                        value={field.state.value}
                        onValueChange={(value) => field.handleChange(value as PromptVisibilityEnum)}
                      >
                        <SelectTrigger className="py-6" aria-label="Select visibility">
                          <SelectValue placeholder="Select visibility" />
                        </SelectTrigger>
                        <SelectContent>
                          {MENTOR_VISIBILITY.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </form.Field>
              )}

              <form.Field name="prompt">
                {(field) => {
                  const hasNoValue = field.state.value === '';
                  const isDirty = field.state.meta.isDirty;
                  const hasNoValueAndIsDirty = hasNoValue && isDirty;

                  return (
                    <div className="space-y-2 overflow-hidden">
                      <Label
                        htmlFor="prompt-textarea"
                        className="flex items-center text-sm font-medium text-[#646464]"
                      >
                        {selectedPrompt.label}
                      </Label>
                      <RichTextEditor
                        value={field.state.value}
                        onChange={field.handleChange}
                        disabled={isDisabled}
                      />
                      {hasNoValueAndIsDirty && (
                        <p className="text-red-500 text-xs">Prompt is required</p>
                      )}
                    </div>
                  );
                }}
              </form.Field>
            </div>
            <DialogFooter>
              <div className="flex justify-end gap-2 pt-4">
                <form.Subscribe selector={(state) => ({ isFormValue: state.canSubmit })}>
                  {({ isFormValue }) => (
                    <Button
                      type="submit"
                      className="bg-gradient-to-r from-[#2563EB] to-[#93C5FD] text-white hover:opacity-90"
                      disabled={isDisabled || !isFormValue}
                    >
                      {isEditing ? 'Saving...' : 'Save'}
                    </Button>
                  )}
                </form.Subscribe>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {isModalOpen && FreeTrialDialog && (
        <FreeTrialDialog isOpen={isModalOpen} onClose={closeModal} />
      )}
    </>
  );
}
