'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Trash2, Plus } from 'lucide-react';
import { useParams } from 'next/navigation';
import { ProjectPageParams } from '@/lib/types';
import { useUsername } from '@/hooks/use-user';
import { useUpdateUserProjectMutation } from '@iblai/iblai-js/data-layer';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useNavigate } from '@/hooks/user-navigate';

const MinimumMentorAlert = dynamic(
  () => import('./minimum-mentor-alert').then((mod) => ({ default: mod.MinimumMentorAlert })),
  {
    ssr: false,
  },
);

interface ProjectMentor {
  id: string;
  unique_id: string;
  name: string;
  avatar?: string;
  description?: string;
}

interface ProjectMentorsListProps {
  projectMentors: ProjectMentor[];
  onMentorRemoved?: () => void;
  onAddMentorClick?: () => void;
  showTitle?: boolean;
}

export function ProjectMentorsList({
  projectMentors,
  onMentorRemoved,
  onAddMentorClick,
  showTitle = false,
}: ProjectMentorsListProps) {
  const { tenantKey, projectId, mentorId } = useParams<ProjectPageParams>();
  const username = useUsername();
  const [updateProject] = useUpdateUserProjectMutation();
  const [showMinimumMentorAlert, setShowMinimumMentorAlert] = useState(false);
  const { navigateToProject } = useNavigate();

  const handleRemoveMentor = async (mentorUniqueId: string) => {
    if (!username || !tenantKey || !projectId) return;

    // Check if this is the last mentor
    if (projectMentors.length === 1) {
      setShowMinimumMentorAlert(true);
      return;
    }

    try {
      await updateProject({
        tenantKey,
        username,
        id: parseInt(projectId),
        data: {
          mentors_to_remove: [mentorUniqueId],
        },
      }).unwrap();

      toast.success('Mentor removed from project');

      // If the removed mentor is the currently active one, navigate to the first remaining mentor
      if (mentorId === mentorUniqueId) {
        const firstRemainingMentor = projectMentors.find(
          (mentor) => mentor.unique_id !== mentorUniqueId,
        );
        if (firstRemainingMentor) {
          navigateToProject(projectId, firstRemainingMentor.unique_id);
        }
      }

      // Call callback to refresh data
      onMentorRemoved?.();
    } catch (error) {
      console.error(JSON.stringify(error));
      toast.error('Failed to remove mentor');
      console.error(JSON.stringify({ tenant: tenantKey, error }));
    }
  };

  if (projectMentors.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600 mb-4">No mentors assigned to this project yet.</p>
        <p className="text-sm text-gray-500">Select mentors below to add them to your project.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showTitle && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-gray-900">Project Mentors</h2>
          </div>
          {onAddMentorClick && (
            <Button onClick={onAddMentorClick} className="ibl-button-primary">
              <Plus className="mr-2 h-4 w-4" />
              Add Mentor
            </Button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {projectMentors.map((mentor) => {
          const handleMentorSelect = () => {
            if (mentor.unique_id === mentorId) {
              return;
            }
            navigateToProject(projectId, mentor.unique_id);
          };

          const handleKeyDown = (event: React.KeyboardEvent) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              handleMentorSelect();
            }
          };

          return (
            <div
              key={mentor.id}
              className={cn(
                'bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow group h-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2',
                {
                  'border-blue-500': mentor.unique_id === mentorId,
                },
              )}
              onClick={handleMentorSelect}
              onKeyDown={handleKeyDown}
              tabIndex={0}
              role="button"
              aria-label={`Select mentor ${mentor.name}`}
            >
              <div className="flex items-start gap-3 h-full">
                <Avatar className="h-12 w-12 flex-shrink-0">
                  <AvatarImage src={mentor.avatar || '/placeholder.svg'} alt={mentor.name} />
                  <AvatarFallback>{mentor.name.substring(0, 2)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 flex flex-col h-full">
                  <h3 className="font-medium text-gray-900 text-sm mb-2">{mentor.name}</h3>
                  <p className="text-xs text-gray-600 line-clamp-2 flex-1">{mentor.description}</p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 focus:opacity-100"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={(event) => {
                        event.stopPropagation();
                        handleRemoveMentor(mentor.unique_id);
                      }}
                      className="cursor-pointer"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Remove from project
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          );
        })}
      </div>

      <MinimumMentorAlert open={showMinimumMentorAlert} onOpenChange={setShowMinimumMentorAlert} />
    </div>
  );
}
