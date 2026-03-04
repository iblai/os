'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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

export function CreateProjectModal({ isOpen, onClose }: CreateProjectModalProps) {
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
    if (projectName.trim() && selectedMentors.length > 0 && username && tenantKey) {
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
        navigateToMentorInProject(project.mentors[0]?.unique_id, String(project.id));
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
        className="max-w-4xl w-[95vw] p-0 gap-0 overflow-hidden"
        style={{
          height: 'auto',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b border-gray-200 bg-white flex-shrink-0">
          <DialogTitle className="text-xl font-semibold text-gray-900">New Project</DialogTitle>
        </DialogHeader>

        {/* Scrollable Content */}
        <div
          className="flex-1 px-6 py-6 space-y-6"
          style={{
            overflowY: 'auto',
            overflowX: 'hidden',
          }}
        >
          {/* Project Name Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Project Name</label>
            <Input
              placeholder="Project Name"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="text-base h-12 px-4 border-2 border-gray-200 rounded-lg focus:border-gray-200 focus:ring-0 focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCreate();
                }
              }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Select Mentors <span className="text-red-500">*</span>
              {selectedMentors.length > 0 && (
                <span className="text-blue-600 font-normal ml-2">
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

        <div className="flex-shrink-0 px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
          <Button variant="outline" onClick={handleCancel} className="px-6 bg-transparent">
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!projectName.trim() || selectedMentors.length === 0 || isLoading}
            className="px-6 text-white bg-gradient-to-r from-[#2563EB] to-[#93C5FD] hover:opacity-90"
          >
            {isLoading ? 'Creating...' : 'Save'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
