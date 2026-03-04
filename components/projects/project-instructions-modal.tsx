'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useEditMentorMutation, useGetMentorSettingsQuery } from '@iblai/iblai-js/data-layer';
import { toast } from 'sonner';
import { useUsername } from '@/hooks/use-user';
import { TenantKeyMentorIdParams } from '@/lib/types';

interface ProjectInstructionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (instructions: string) => void;
}

export function ProjectInstructionsModal({
  isOpen,
  onClose,
  onSave,
}: ProjectInstructionsModalProps) {
  const { tenantKey, mentorId } = useParams<TenantKeyMentorIdParams>();
  const username = useUsername();
  const activeMentorId = mentorId;

  const { data: mentorSettings } = useGetMentorSettingsQuery(
    // @ts-expect-error - userId parameter may not exist in API but passed from legacy code
    { mentor: activeMentorId, org: tenantKey, userId: username ?? '' },
    {
      skip: !activeMentorId || !tenantKey || !username,
    },
  );

  const [editMentor, { isLoading: isEditingMentor }] = useEditMentorMutation();

  // Use system_prompt from mentor settings, fallback to project instructions
  // @ts-ignore
  const currentSystemPrompt = mentorSettings?.system_prompt;
  const [instructions, setInstructions] = useState(currentSystemPrompt);

  const handleSave = async () => {
    try {
      if (mentorSettings && activeMentorId) {
        // Update mentor's system_prompt
        await editMentor({
          mentor: activeMentorId,
          org: tenantKey,
          // @ts-expect-error - userId parameter may not exist in API but passed from legacy code
          userId: username ?? '',
          formData: { system_prompt: instructions },
        }).unwrap();
        toast.success('Instructions updated successfully');
      }

      // Also call the original onSave callback for backward compatibility
      onSave?.(instructions);
      onClose();
    } catch (error) {
      console.error(JSON.stringify(error));
      toast.error('Failed to update instructions');
      console.error(JSON.stringify({ tenant: tenantKey, error }));
    }
  };

  const handleCancel = () => {
    setInstructions(currentSystemPrompt);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-full mx-4 max-h-[90vh] p-0 gap-0">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <DialogTitle className="text-xl font-semibold text-gray-900">Instructions</DialogTitle>
          </div>
          <DialogDescription className="text-gray-600">
            You can ask mentorAI to focus on certain topics, or ask it to use a certain tone or
            format for responses.
          </DialogDescription>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 overflow-y-auto">
          <Textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder='e.g. "Reference the latest JavaScript documentation. Keep answers short and focused."'
            className="min-h-[400px] resize-none border-2 border-gray-200 rounded-lg p-4 text-base placeholder:text-gray-400 focus:border-blue-500 focus:ring-0"
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          <Button variant="outline" onClick={handleCancel} aria-label="Cancel editing instructions">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isEditingMentor || !instructions?.trim()}
            className="ibl-button-primary"
            aria-label="Save project instructions"
          >
            {isEditingMentor ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
