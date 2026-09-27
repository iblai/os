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
  const contentClassName =
    'mx-auto max-h-[85vh] w-full max-w-5xl overflow-y-auto';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={contentClassName}>
        <CreateMentorForm variant="dialog" initialValues={initialValues} />
      </DialogContent>
    </Dialog>
  );
}

// no-op: dummy change to exercise run-tests label / E2E trigger
