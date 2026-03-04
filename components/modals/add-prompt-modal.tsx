'use client';

import React from 'react';
import { useParams } from 'next/navigation';

import { useForm } from '@tanstack/react-form';
import { useGetPromptCategoriesQuery, useCreatePromptMutation } from '@iblai/iblai-js/data-layer';
import { PromptVisibilityEnum } from '@iblai/iblai-api';
import { MENTOR_VISIBILITY } from '@/lib/constants';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useUsername } from '@/hooks/use-user';
import { Button } from '@/components/ui/button';
import { RichTextEditor } from '@iblai/iblai-js/web-containers';

import { TenantKeyMentorIdParams } from '@/lib/types';
import { toast } from 'sonner';
import { Label } from '@radix-ui/react-label';
import { useShowFreeTrialDialog } from '@/hooks/user-user-actions';
import { useNavigate } from '@/hooks/user-navigate';

interface AddPromptForm {
  category: string;
  prompt: string;
  promptVisibility: PromptVisibilityEnum;
}

const defaultValues: AddPromptForm = {
  category: '',
  prompt: '',
  promptVisibility: PromptVisibilityEnum.VIEWABLE_BY_TENANT_STUDENTS,
};

interface AddPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddPromptModal({ isOpen, onClose }: AddPromptModalProps) {
  const username = useUsername();
  const { getMentorId } = useNavigate();
  const { tenantKey, mentorId: mentorIdParam } = useParams<TenantKeyMentorIdParams>();

  const mentorId = getMentorId() ?? mentorIdParam;

  const { executeWithTrialCheck, isModalOpen, FreeTrialDialog, closeModal } =
    useShowFreeTrialDialog();

  const { data: promptCategories, isLoading: isLoadingPromptCategories } =
    useGetPromptCategoriesQuery({
      org: tenantKey,
      // @ts-ignore
      userId: username ?? '',
    });

  const [createPrompt, { isLoading: isCreatingPrompt }] = useCreatePromptMutation();

  const form = useForm({
    defaultValues,
    onSubmit: async ({ value }) => {
      try {
        await createPrompt({
          org: tenantKey,
          // @ts-ignore
          userId: username ?? '',
          requestBody: {
            prompt: value.prompt,
            category: value.category,
            is_system: false,
            mentor: mentorId,
            // @ts-ignore
            platform: tenantKey,
            prompt_visibility: value.promptVisibility,
          },
        }).unwrap();
        toast.success('Prompt created successfully');
        onClose();
      } catch (error) {
        console.error(JSON.stringify(error));
        toast.error('Failed to create prompt');
        console.error(JSON.stringify({ tenant: tenantKey, error }));
      }
    },
  });

  const isDisabled = isLoadingPromptCategories || isCreatingPrompt;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="w-full">
          <DialogHeader>
            <DialogTitle className="ibl-dialog-title">Add New Prompt</DialogTitle>
          </DialogHeader>

          <form
            onSubmit={(formEvent) => {
              formEvent.preventDefault();
              formEvent.stopPropagation();
              executeWithTrialCheck(form.handleSubmit);
            }}
            className="mt-6 space-y-6 overflow-hidden"
          >
            <form.Field name="category">
              {(field) => {
                const hasNoValue = field.state.value === '';
                const isDirty = field.state.meta.isDirty;
                const hasNoValueAndIsDirty = hasNoValue && isDirty;

                return (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">Category</Label>
                    <Select
                      value={field.state.value}
                      onValueChange={field.handleChange}
                      disabled={isDisabled}
                    >
                      <SelectTrigger className="py-6" aria-label="Select a category">
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        {promptCategories?.map((category: any) => (
                          <SelectItem key={category.id} value={category.name}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {hasNoValueAndIsDirty && (
                      <p className="text-red-500 text-xs">Category is required</p>
                    )}
                  </div>
                );
              }}
            </form.Field>

            <form.Field name="promptVisibility">
              {(field) => {
                return (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">Visibility</Label>
                    <Select
                      value={field.state.value}
                      onValueChange={(value) => field.handleChange(value as PromptVisibilityEnum)}
                      disabled={isDisabled}
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
                    {!field.state.value && field.state.meta.isDirty && (
                      <p className="text-red-500 text-xs">Visibility is required</p>
                    )}
                  </div>
                );
              }}
            </form.Field>

            <form.Field name="prompt">
              {(field) => {
                const hasNoValue = field.state.value === '';
                const isDirty = field.state.meta.isDirty;
                const hasNoValueAndIsDirty = hasNoValue && isDirty;

                return (
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-gray-700" htmlFor="prompt-textarea">
                      Prompt
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

            <div className="flex justify-end">
              <form.Subscribe selector={(state) => ({ isFormValue: state.canSubmit })}>
                {({ isFormValue }) => (
                  <Button
                    type="submit"
                    className="bg-gradient-to-r from-[#2563EB] to-[#93C5FD] text-white hover:opacity-90"
                    disabled={isDisabled || !isFormValue}
                  >
                    {isCreatingPrompt ? 'Submitting...' : 'Submit'}
                  </Button>
                )}
              </form.Subscribe>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      {isModalOpen && FreeTrialDialog && (
        <FreeTrialDialog isOpen={isModalOpen} onClose={closeModal} />
      )}
    </>
  );
}
