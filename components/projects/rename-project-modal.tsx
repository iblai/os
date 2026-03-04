'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
        className="max-w-2xl w-[95vw] p-0 gap-0 overflow-hidden"
        style={{
          height: 'auto',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b border-gray-200 bg-white flex-shrink-0">
          <DialogTitle className="text-xl font-semibold text-gray-900">Rename Project</DialogTitle>
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 px-6 py-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Project Name</label>
            <Input
              placeholder="Enter new project name"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="text-base h-12 px-4 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-0"
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
        <div className="flex-shrink-0 px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isLoading}
            className="px-6 bg-transparent"
          >
            Cancel
          </Button>
          <Button
            onClick={handleRename}
            disabled={!projectName.trim() || isLoading || projectName.trim() === currentName}
            className="ibl-button-primary"
          >
            {isLoading ? 'Renaming...' : 'Rename Project'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
