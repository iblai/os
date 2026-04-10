'use client';

import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FlaggedPrompt } from './types';
import { useState } from 'react';
import { DeleteModerationLogModal } from './delete-moderation-log-modal';

interface FlaggedPromptDetailProps {
  prompt: FlaggedPrompt | null;
  onContactUser: () => void;
  onDeleteSuccess?: () => void;
}

export function FlaggedPromptDetail({
  prompt,
  onDeleteSuccess,
}: FlaggedPromptDetailProps) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  return (
    <div className="scrollbar-hide hidden max-h-[500px] flex-col overflow-y-auto rounded-lg border bg-white p-6 shadow-sm md:flex">
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
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-100">
                <span className="text-sm font-medium text-blue-600">
                  {
                    prompt.userEmail?.charAt(0)?.toUpperCase() || 'A' //A for Anonymous
                  }
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
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-100">
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

          <DeleteModerationLogModal
            isOpen={showDeleteModal}
            onClose={() => setShowDeleteModal(false)}
            logId={prompt.id}
            onDeleteSuccess={onDeleteSuccess}
          />
        </>
      ) : (
        <div className="flex h-full items-center justify-center text-gray-500">
          Select a flagged prompt to view details.
        </div>
      )}
    </div>
  );
}
