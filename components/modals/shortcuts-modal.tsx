'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useShortcuts } from '@/hooks/use-shortcuts';
import { getUserOS } from '@/lib/utils';

function mapKeyboardKey(key: string): string {
  const userOS = getUserOS();

  // If the key is meta, return the appropriate key for the user's OS
  if (key === 'meta') {
    if (userOS === 'macOS') {
      return '⌘';
    }

    return 'Ctrl';
  }

  return key;
}

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

function KeyShortcut({ keys }: { keys: string }) {
  return (
    <div className="flex items-center gap-1">
      {keys.split('+').map((key, index) => (
        <span
          key={index}
          className="text-muted-foreground inline-flex min-w-[24px] items-center justify-center rounded border px-2 py-1 text-xs font-medium capitalize"
        >
          {mapKeyboardKey(key.trim())}
        </span>
      ))}
    </div>
  );
}

export function ShortcutsModal({ isOpen, onClose }: Props) {
  const shortcuts = useShortcuts();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl space-y-4">
        <DialogHeader>
          <DialogTitle className="ibl-dialog-title">
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-x-10 gap-y-4">
          {Object.entries(shortcuts).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-600">{value.label}</p>
              <KeyShortcut keys={value.keys} />
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
