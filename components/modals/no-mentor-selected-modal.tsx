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

  const handleExplore = (event: React.MouseEvent) => {
    // Prevent Radix's default "close on action" behaviour. That auto-close
    // fires onOpenChange -> closeModal -> router.push(currentPath), a competing
    // navigation that runs last and clobbers the explore push below (leaving the
    // user on the current page). Navigating to the tenant-scoped explore page
    // (/platform/<tenantKey>/explore) is a route change with no ?modal= param,
    // so it closes this modal on its own — a single navigation, no race.
    event.preventDefault();
    navigateToExplore(true);
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
