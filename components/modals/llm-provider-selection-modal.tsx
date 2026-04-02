'use client';

import React from 'react';

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogHeader,
  DialogDescription,
} from '@/components/ui/dialog';
import { LLMTab } from './edit-mentor-modal/tabs';

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export function LLMProviderSelectionModal({ isOpen, onClose }: Props) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] w-full max-w-5xl gap-3 overflow-y-auto">
        <DialogDescription className="sr-only">
          Select an LLM Provider from the list
        </DialogDescription>
        <DialogHeader className="mb-0">
          <DialogTitle className="ibl-dialog-title">LLM Providers</DialogTitle>
        </DialogHeader>
        <LLMTab showConfigurationHeader={false} />
      </DialogContent>
    </Dialog>
  );
}
