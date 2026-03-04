import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { redirectToAuthSpaJoinTenant } from '@/lib/utils';
import Logo from '../logo';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  tenantKey: string;
};

export function AuthModal({ isOpen, onClose, tenantKey }: Props) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Welcome to mentorAI</DialogTitle>
        </DialogHeader>
        <DialogDescription className="sr-only">
          Please login to continue using the chat.
        </DialogDescription>
        <div className="text-sm text-gray-500 text-center mt-4">
          Create an account or login to continue
        </div>
        <div className="flex justify-center">
          <Logo tenantKey={tenantKey} />
        </div>
        <div className="flex justify-end mt-4">
          <Button
            onClick={() => redirectToAuthSpaJoinTenant(tenantKey)}
            className="ibl-button-primary cursor-pointer"
          >
            Login To Chat
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
