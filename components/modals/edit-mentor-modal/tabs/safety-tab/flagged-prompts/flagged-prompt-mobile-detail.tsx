'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { FlaggedPrompt } from './types';
import { useState } from 'react';
import { DeleteModerationLogModal } from './delete-moderation-log-modal';

interface FlaggedPromptMobileDetailProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  prompt: FlaggedPrompt | null;
  onDeleteSuccess?: () => void;
}

export function FlaggedPromptMobileDetail({
  isOpen,
  onOpenChange,
  prompt,
  onDeleteSuccess,
}: FlaggedPromptMobileDetailProps) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] max-w-lg flex-col p-0">
        <DialogHeader className="border-b border-gray-200 px-6 pt-6 pb-4">
          <DialogTitle className="text-lg font-semibold text-gray-900">
            Flagged Prompt Details
          </DialogTitle>
        </DialogHeader>
        <div className="scrollbar-hide flex-1 overflow-y-auto p-6">
          {prompt ? (
            <>
              <div className="mb-4">
                <h3 className="mb-1 text-base font-semibold text-gray-700">
                  Flagged by {prompt.type} System
                </h3>
                <span className="text-sm text-gray-500">{prompt.fullDate}</span>
              </div>

              <div className="space-y-6">
                {/* User Prompt */}
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100">
                    <span className="text-sm font-medium text-blue-600">
                      {prompt.userEmail?.charAt(0)?.toUpperCase() || 'A'}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-700">
                      {prompt.userEmail}
                    </div>
                    <p className="mt-1 text-sm whitespace-pre-line text-gray-500">
                      {prompt.prompt}
                    </p>
                  </div>
                </div>

                {/* System Response */}
                <div className="flex items-start gap-3 border-t border-gray-200 pt-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100">
                    <span className="text-sm font-medium text-gray-600">
                      {prompt.type.charAt(0).toUpperCase()}S
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-700">
                      {prompt.type} System
                    </div>
                    <p className="mt-1 text-sm whitespace-pre-line text-gray-500">
                      {prompt.systemResponse}
                    </p>
                  </div>
                </div>

                {/* Delete Button */}
                <div className="border-t border-gray-200 pt-4">
                  <Button
                    onClick={() => setShowDeleteModal(true)}
                    className="ibl-button-primary flex w-full items-center justify-center gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </div>

              {prompt && (
                <DeleteModerationLogModal
                  isOpen={showDeleteModal}
                  onClose={() => setShowDeleteModal(false)}
                  logId={prompt.id}
                  onDeleteSuccess={() => {
                    onDeleteSuccess?.();
                    onOpenChange(false);
                  }}
                />
              )}
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
