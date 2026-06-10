'use client';

import { Dialog, DialogContent } from '@/components/ui/dialog';
import { CreateMentorForm } from './create-mentor-form';
import type { CreateMentorFormValues } from '@/hooks/use-mentors/use-create-mentor';

interface CreateMentorModalProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Optional values used to pre-populate any of the form fields (including the
   * prompts in the Prompts tab). Omitting this keeps the original behaviour.
   */
  initialValues?: Partial<CreateMentorFormValues>;
}

export function CreateMentorModal({
  isOpen,
  onClose,
  initialValues,
}: CreateMentorModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="mx-auto max-h-[85vh] w-full max-w-5xl overflow-y-auto">
        <CreateMentorForm variant="dialog" initialValues={initialValues} />
      </DialogContent>
    </Dialog>
  );
}
