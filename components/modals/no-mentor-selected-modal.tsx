'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useNavigate } from '@/hooks/user-navigate';

interface NoMentorSelectedModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NoMentorSelectedModal({
  isOpen,
  onClose,
}: NoMentorSelectedModalProps) {
  const { navigateToExplore } = useNavigate();

  const handleExplore = () => {
    onClose();
    navigateToExplore();
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>No Agent Selected</AlertDialogTitle>
          <AlertDialogDescription>
            You need to select an agent before starting a new chat. Would you
            like to explore available agents?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose} className="ibl-button-primary">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleExplore}
            className="border-input bg-background text-accent-foreground hover:bg-accent hover:text-accent-foreground border"
          >
            Explore Agents
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
