'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useParams } from 'next/navigation';
import { ProjectPageParams } from '@/lib/types';
import { useUsername } from '@/hooks/use-user';
import {
  useUpdateUserProjectMutation,
  useGetUserProjectDetailsQuery,
} from '@iblai/iblai-js/data-layer';
import { toast } from 'sonner';
import { MentorSelectionGrid } from '@/components/mentors/mentor-selection-grid';

interface AddMentorToProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
}

export function AddMentorToProjectModal({
  isOpen,
  onClose,
  projectName,
}: AddMentorToProjectModalProps) {
  const { tenantKey, projectId } = useParams<ProjectPageParams>();
  const username = useUsername();
  const [updateProject] = useUpdateUserProjectMutation();

  // Fetch current project data to get mentor details
  const { data: project } = useGetUserProjectDetailsQuery(
    {
      tenantKey: tenantKey || '',
      username: username || '',
      id: parseInt(projectId || '0'),
    },
    {
      skip: !tenantKey || !username || !projectId,
    },
  );

  const [searchQuery, setSearchQuery] = React.useState('');

  const handleMentorSelect = async (mentor: any) => {
    if (!username || !tenantKey || !projectId) return;

    // Don't add if already added
    if (isMentorAlreadyAdded(mentor.unique_id)) return;

    try {
      await updateProject({
        tenantKey,
        username,
        id: parseInt(projectId),
        data: {
          mentors_to_add: [mentor.unique_id],
        },
      }).unwrap();

      toast.success('Agent added to project');
    } catch (error) {
      console.error(JSON.stringify(error));
      toast.error('Failed to add agent to project');
      console.error(JSON.stringify({ tenant: tenantKey, error }));
    }
  };

  const isMentorAlreadyAdded = (mentorId: string) => {
    return (
      project?.mentors?.some((mentor: any) => mentor.unique_id === mentorId) ||
      false
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex max-h-[80vh] w-[95vw] max-w-4xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-gray-200 px-6 py-4">
          <DialogTitle className="text-xl font-semibold text-gray-900">
            Add Agent to {projectName}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {/* Available Agents Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                Available Agents
              </h3>
            </div>

            <MentorSelectionGrid
              selectedMentorIds={
                project?.mentors?.map((m: any) => m.unique_id) || []
              }
              onMentorSelect={handleMentorSelect}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              itemsPerPage={8}
              showSearch={true}
              minHeight="200px"
            />
          </div>
        </div>

        <div className="flex flex-shrink-0 justify-end border-t border-gray-200 bg-gray-50 px-6 py-4">
          <Button
            variant="outline"
            onClick={onClose}
            className="bg-transparent"
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
