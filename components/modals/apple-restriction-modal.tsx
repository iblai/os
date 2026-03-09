import {
  Dialog,
  DialogTitle,
  DialogHeader,
  DialogContent,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export function AppleRestrictionModal({ isOpen, onClose }: Props) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            <span>Subscription Not Available</span>
          </DialogTitle>
          <DialogDescription className="pt-4 text-sm text-gray-600">
            Unfortunately, due to Apple restrictions, you can't subscribe to our plans through the
            app for iPhone and iPad.
          </DialogDescription>
        </DialogHeader>
        <div className="my-3 text-sm text-gray-600">
          <p>
            Instead, go to{' '}
            <a
              href="https://www.ibl.ai/pricing"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#2563EB] underline"
            >
              www.ibl.ai/pricing
            </a>{' '}
            to pick your plan and upgrade.
          </p>
        </div>
        <DialogFooter>
          <Button onClick={onClose} className="ibl-button-primary cursor-pointer">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
