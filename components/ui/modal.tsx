'use client';

import type * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  noPadding?: boolean;
  maxWidth?: string;
  className?: string;
  hideCloseButton?: boolean;
}

export function Modal({
  isOpen,
  onClose,
  children,
  title,
  className,
}: ModalProps) {
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogTitle></DialogTitle>
      <DialogContent
        className={`${className} mx-auto p-0`} // Add mx-auto to ensure consistent margins
        onEscapeKeyDown={onClose}
        onInteractOutside={onClose}
      >
        {title && (
          <DialogHeader>
            <DialogTitle className="text-left whitespace-nowrap">
              {title}
            </DialogTitle>
          </DialogHeader>
        )}
        {children}
      </DialogContent>
    </Dialog>
  );
}
