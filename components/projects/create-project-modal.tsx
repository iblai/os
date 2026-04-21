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
import { useCreateUserProjectMutation } from '@iblai/iblai-js/data-layer';
import { toast } from 'sonner';
import { MentorSelectionGrid } from '@/components/mentors/mentor-selection-grid';
import { chatActions } from '@iblai/iblai-js/web-utils';
import { useDispatch } from 'react-redux';
import { useNavigate } from '@/hooks/user-navigate';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateProjectModal({
  isOpen,
  onClose,
}: CreateProjectModalProps) {
  const dispatch = useDispatch();
  const [projectName, setProjectName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMentors, setSelectedMentors] = useState<any[]>([]);
  const { navigateToMentorInProject } = useNavigate();

  const { tenantKey } = useParams<TenantKeyMentorIdParams>();
  const username = useUsername();
  const [createUserProject, { isLoading }] = useCreateUserProjectMutation();

  const toggleMentorSelection = (mentor: any) => {
    setSelectedMentors((prev) => {
      const isSelected = prev.some((m) => m.unique_id === mentor.unique_id);
      if (isSelected) {
        return prev.filter((m) => m.unique_id !== mentor.unique_id);
      } else {
        return [...prev, mentor];
      }
    });
  };

  const handleCreate = async () => {
    if (
      projectName.trim() &&
      selectedMentors.length > 0 &&
      username &&
      tenantKey
    ) {
      try {
        const project = await createUserProject({
          tenantKey,
          username,
          data: {
            name: projectName.trim(),
            description: '', // No description field in new design
            shared: false,
            mentors_to_add: selectedMentors.map((mentor) => mentor.unique_id),
          },
        }).unwrap();

        // Reset form
        setProjectName('');
        setSelectedMentors([]);
        setSearchQuery('');
        onClose();

        // Show success toast
        toast.success('Project created successfully');
        dispatch(chatActions.setShouldStartNewChat(true));

        // Navigate to project page
        navigateToMentorInProject(
          project.mentors[0]?.unique_id,
          String(project.id),
        );
      } catch (error) {
        toast.error('Failed to create project');
        console.error(JSON.stringify({ tenant: tenantKey, error }));
      }
    }
  };

  const handleCancel = () => {
    setProjectName('');
    setSelectedMentors([]);
    setSearchQuery('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="w-[95vw] max-w-4xl gap-0 overflow-hidden p-0"
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
            New Project
          </DialogTitle>
        </DialogHeader>

        {/* Scrollable Content */}
        <div
          className="flex-1 space-y-6 px-6 py-6"
          style={{
            overflowY: 'auto',
            overflowX: 'hidden',
          }}
        >
          {/* Project Name Input */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Project Name
            </label>
            <Input
              placeholder="Project Name"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="h-12 rounded-lg border-2 border-gray-200 px-4 text-base focus:border-gray-200 focus:ring-0 focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCreate();
                }
              }}
            />
          </div>

          <div>
            <label className="mb-3 block text-sm font-medium text-gray-700">
              Select Mentors <span className="text-red-500">*</span>
              {selectedMentors.length > 0 && (
                <span className="ml-2 font-normal text-blue-600">
                  ({selectedMentors.length} selected)
                </span>
              )}
            </label>

            <MentorSelectionGrid
              selectedMentorIds={selectedMentors.map((m) => m.unique_id)}
              onMentorSelect={toggleMentorSelection}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              itemsPerPage={8}
              showSearch={true}
              minHeight="400px"
            />
          </div>
        </div>

        <div className="flex flex-shrink-0 justify-end gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4">
          <Button
            variant="outline"
            onClick={handleCancel}
            className="bg-transparent px-6"
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={
              !projectName.trim() || selectedMentors.length === 0 || isLoading
            }
            className="bg-gradient-to-r from-[#2563EB] to-[#93C5FD] px-6 text-white hover:opacity-90"
          >
            {isLoading ? 'Creating...' : 'Save'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
