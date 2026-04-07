'use client';

import React from 'react';
import { useParams } from 'next/navigation';

import {
  useGetPromptCategoriesQuery,
  useUpdatePromptMutation,
} from '@iblai/iblai-js/data-layer';
import { PromptVisibilityEnum } from '@iblai/iblai-api';
import { Plus } from 'lucide-react';
import { useMediaQuery } from 'react-responsive';

import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AddPromptModal } from '@/components/modals/add-prompt-modal';
import {
  EditPromptModal,
  SelectedPrompt,
} from '@/components/modals/edit-prompt-modal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TenantKeyMentorIdParams } from '@/lib/types';
import { useUserIsStudent, useUsername } from '@/hooks/use-user';
import { CategorySection } from './prompt-gallery-modal/category-section';
import { Spinner } from '@/components/spinner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useShowFreeTrialDialog } from '@/hooks/user-user-actions';

export interface EditFormValues {
  category: string;
  prompt: string;
  promptVisibility?: PromptVisibilityEnum;
}

interface PromptGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPrompt?: (promptText: string) => void;
}

export function PromptGalleryModal({
  isOpen,
  onClose,
  onSelectPrompt,
}: PromptGalleryModalProps) {
  const userIsStudent = useUserIsStudent();
  const [activeCategory, setActiveCategory] = React.useState('');
  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false);
  const [editingPrompt, setEditingPrompt] =
    React.useState<SelectedPrompt | null>(null);
  const isMobile = useMediaQuery({ maxWidth: 767 });
  const { tenantKey, mentorId } = useParams<TenantKeyMentorIdParams>();
  const username = useUsername();
  const { executeWithTrialCheck, FreeTrialDialog, closeModal, isModalOpen } =
    useShowFreeTrialDialog();

  const { data: promptCategories, isLoading } = useGetPromptCategoriesQuery({
    org: tenantKey,
    // @ts-ignore
    userId: username ?? '',
  });

  const [updatePrompt, { isLoading: isEditingPrompt }] =
    useUpdatePromptMutation();

  // Set "All" as default when data loads
  React.useEffect(() => {
    if (promptCategories && promptCategories.length > 0 && !activeCategory) {
      setActiveCategory('All');
    }
  }, [promptCategories, activeCategory]);

  const selectPrompt = (prompt: SelectedPrompt) => {
    setEditingPrompt(prompt);
  };

  const handleEditPrompt = async (
    selectedPrompt: SelectedPrompt,
    value: EditFormValues,
  ) => {
    if (editingPrompt) {
      try {
        await updatePrompt({
          id: selectedPrompt.id as number,
          org: tenantKey,
          userId: username ?? '',
          // @ts-ignore
          requestBody: {
            is_system: false,
            prompt: value.prompt,
            category: value.category,
            prompt_visibility: value.promptVisibility,
          },
        }).unwrap();
        toast.success('Mentor updated successfully');
      } catch (error) {
        console.error(JSON.stringify(error));
        toast.error('Failed to update mentor');
        console.error(JSON.stringify({ tenant: tenantKey, error }));
      }
    }
  };

  const handleSelectPrompt = (promptText: string) => {
    if (onSelectPrompt) {
      onSelectPrompt(promptText);
      onClose();
    }
  };

  const addPromptButton = (
    <Button
      variant="outline"
      size="sm"
      className={cn(
        'flex h-9 items-center gap-2 rounded-md border-none bg-gradient-to-r from-[#2563EB] to-[#93C5FD] px-3 text-sm font-normal whitespace-nowrap text-white shadow-sm hover:text-white hover:opacity-90',
        {
          'h-8': isMobile,
        },
      )}
      onClick={() => executeWithTrialCheck(() => setIsAddModalOpen(true))}
    >
      <Plus className="h-4 w-4" />
      Add
    </Button>
  );

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="h-[90vh] w-full max-w-7xl overflow-hidden sm:w-[calc(100vw-2rem)]">
          <DialogDescription className="sr-only">
            View and edit custom prompts for your mentor.
          </DialogDescription>
          <div className="flex h-full w-full max-w-full flex-col overflow-hidden p-6">
            <DialogHeader>
              <DialogTitle className="ibl-dialog-title">
                Prompt Gallery
              </DialogTitle>
            </DialogHeader>

            {isLoading ? (
              <div className="flex h-full w-full items-center justify-center">
                <Spinner />
              </div>
            ) : (
              <>
                <div className="w-full overflow-hidden py-4">
                  {isMobile ? (
                    <div className="flex items-center justify-between gap-4">
                      <div className="w-full flex-1">
                        <Select
                          value={activeCategory}
                          onValueChange={setActiveCategory}
                        >
                          <SelectTrigger className="h-8 w-full">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="All">All</SelectItem>
                            {promptCategories?.map((category) => (
                              <SelectItem
                                key={category.name}
                                value={category.name}
                              >
                                {category.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {!userIsStudent && (
                        <div className="flex-shrink-0">{addPromptButton}</div>
                      )}
                    </div>
                  ) : (
                    <div className="flex w-full gap-4">
                      <div className="scrollbar-none w-full overflow-x-auto">
                        <Tabs
                          value={activeCategory}
                          onValueChange={setActiveCategory}
                          className="w-full"
                        >
                          <TabsList className="scrollbar-none w-full flex-nowrap items-center justify-start gap-2 overflow-x-auto bg-transparent p-0">
                            <TabsTrigger
                              key="all"
                              value="All"
                              className="h-8 flex-shrink-0 rounded-md bg-gray-100 px-4 py-1.5 text-sm font-medium whitespace-nowrap text-gray-600 hover:bg-gray-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#2563EB] data-[state=active]:to-[#93C5FD] data-[state=active]:text-white"
                            >
                              All
                            </TabsTrigger>
                            {promptCategories?.map((category) => (
                              <TabsTrigger
                                key={category.id}
                                value={category.name}
                                className="h-8 flex-shrink-0 rounded-md bg-gray-100 px-4 py-1.5 text-sm font-medium whitespace-nowrap text-gray-600 hover:bg-gray-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#2563EB] data-[state=active]:to-[#93C5FD] data-[state=active]:text-white"
                              >
                                {category.name}
                              </TabsTrigger>
                            ))}
                          </TabsList>
                        </Tabs>
                      </div>
                      {!userIsStudent && <div>{addPromptButton}</div>}
                    </div>
                  )}
                </div>

                <div
                  className="mt-4 overflow-x-hidden overflow-y-auto pb-6"
                  style={{ height: 'calc(90vh - 140px)' }}
                >
                  {activeCategory === 'All' ? (
                    <CategorySection
                      key="all"
                      title="All"
                      onEdit={selectPrompt}
                      onSelect={onSelectPrompt ? handleSelectPrompt : undefined}
                      uniqueMentorId={mentorId}
                      category="All"
                      activeCategory={activeCategory}
                    />
                  ) : (
                    promptCategories
                      ?.filter(
                        (category: any) => category.name === activeCategory,
                      )
                      ?.map((category: any) => (
                        <CategorySection
                          key={category.id}
                          title={category.name}
                          onEdit={selectPrompt}
                          onSelect={
                            onSelectPrompt ? handleSelectPrompt : undefined
                          }
                          uniqueMentorId={mentorId}
                          category={category.name}
                          activeCategory={activeCategory}
                        />
                      ))
                  )}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {isAddModalOpen && (
        <AddPromptModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
        />
      )}

      {editingPrompt && (
        <EditPromptModal
          isOpen={!!editingPrompt}
          onClose={() => setEditingPrompt(null)}
          selectedPrompt={editingPrompt}
          handleSave={handleEditPrompt}
          isEditing={isEditingPrompt}
        />
      )}

      {isModalOpen && FreeTrialDialog && (
        <FreeTrialDialog onClose={closeModal} isOpen={isModalOpen} />
      )}
    </>
  );
}
