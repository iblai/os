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

export function FlaggedPromptDetail({ prompt, onDeleteSuccess }: FlaggedPromptDetailProps) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  return (
    <div className="hidden md:flex border rounded-lg p-6 bg-white shadow-sm flex-col max-h-[500px] overflow-y-auto scrollbar-hide">
      {prompt ? (
        <>
          <div className="mb-4">
            <h3 className="text-base font-semibold text-gray-700 mb-1">
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
                <div className="font-medium text-gray-700">{prompt.userEmail}</div>
                <p className="text-sm text-gray-500 mt-1 whitespace-pre-line">{prompt.prompt}</p>
              </div>
            </div>

            {/* System Response */}
            <div className="flex items-start gap-3 pt-4 border-t border-gray-200">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-100">
                <span className="text-sm font-medium text-gray-600">
                  {prompt.type.charAt(0).toUpperCase()}S
                </span>
              </div>
              <div className="flex-1">
                <div className="font-medium text-gray-700">{prompt.type} System</div>
                <p className="text-sm text-gray-500 mt-1 whitespace-pre-line">
                  {prompt.systemResponse}
                </p>
              </div>
            </div>

            {/* Delete Button */}
            <div className="pt-4 border-t border-gray-200">
              <Button
                onClick={() => setShowDeleteModal(true)}
                className="ibl-button-primary w-full flex items-center justify-center gap-2"
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
        <div className="flex items-center justify-center h-full text-gray-500">
          Select a flagged prompt to view details.
        </div>
      )}
    </div>
  );
}
