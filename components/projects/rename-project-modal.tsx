'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useParams } from 'next/navigation';
import { TenantKeyMentorIdParams } from '@/lib/types';
import { useUsername } from '@/hooks/use-user';
import { useUpdateUserProjectMutation } from '@iblai/iblai-js/data-layer';
import { toast } from 'sonner';

interface RenameProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  currentName: string;
  onSuccess?: () => void;
}

export function RenameProjectModal({
  isOpen,
  onClose,
  projectId,
  currentName,
  onSuccess,
}: RenameProjectModalProps) {
  const [projectName, setProjectName] = useState(currentName);

  const { tenantKey } = useParams<TenantKeyMentorIdParams>();
  const username = useUsername();
  const [updateProject, { isLoading }] = useUpdateUserProjectMutation();

  // Reset the form when the modal opens/closes or currentName changes
  React.useEffect(() => {
    if (isOpen) {
      setProjectName(currentName);
    }
  }, [isOpen, currentName]);

  const handleRename = async () => {
    if (projectName.trim() && username && tenantKey) {
      try {
        await updateProject({
          tenantKey,
          username,
          id: parseInt(projectId),
          data: {
            name: projectName.trim(),
          },
        }).unwrap();

        // Reset form and close modal
        setProjectName('');
        onClose();
        onSuccess?.();

        // Show success toast
        toast.success('Project renamed successfully');
      } catch (error) {
        toast.error('Failed to rename project');
        console.error(JSON.stringify({ tenant: tenantKey, error }));
      }
    }
  };

  const handleCancel = () => {
    setProjectName(currentName);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="w-[95vw] max-w-2xl gap-0 overflow-hidden p-0"
        style={{
          height: 'auto',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <DialogHeader className="flex-shrink-0 border-b border-gray-200 bg-white px-6 py-4">
          <DialogTitle className="text-xl font-semibold text-gray-900">
            Rename Project
          </DialogTitle>
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 px-6 py-6">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Project Name
            </label>
            <Input
              placeholder="Enter new project name"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="h-12 rounded-lg border-2 border-gray-200 px-4 text-base focus:border-blue-500 focus:ring-0"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleRename();
                } else if (e.key === 'Escape') {
                  handleCancel();
                }
              }}
              autoFocus
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-shrink-0 justify-end gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isLoading}
            className="bg-transparent px-6"
          >
            Cancel
          </Button>
          <Button
            onClick={handleRename}
            disabled={
              !projectName.trim() ||
              isLoading ||
              projectName.trim() === currentName
            }
            className="ibl-button-primary"
          >
            {isLoading ? 'Renaming...' : 'Rename Project'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
