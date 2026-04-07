'use client';

import type React from 'react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, PenSquare, Trash2 } from 'lucide-react';
import Image from 'next/image';

interface ProjectItemProps {
  project: { id: string; title: string };
  isActive?: boolean;
  onClick: () => void;
  isOpen?: boolean;
  onRename: (projectId: string, currentName: string) => void;
  onDelete: (projectId: string, projectName: string) => void;
}

export function ProjectItem({
  project,
  isActive = false,
  onClick,
  isOpen = false,
  onRename,
  onDelete,
}: ProjectItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const handleRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRename(project.id, project.title);
    setShowMenu(false);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(project.id, project.title);
    setShowMenu(false);
  };

  return (
    <div
      className="group relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        if (!showMenu) {
          setIsHovered(false);
        }
      }}
    >
      <Button
        variant="ghost"
        className={cn(
          'flex h-8 w-full items-center justify-start gap-2 rounded-md px-2 py-1 hover:bg-[#c9d8f8]',
          isHovered || showMenu ? 'bg-[#c9d8f8]' : 'hover:bg-[#c9d8f8]',
          isActive ? 'text-blue-600' : 'text-gray-700',
        )}
        onClick={onClick}
      >
        <div className="flex flex-shrink-0 items-center justify-center">
          {isOpen ? (
            <Image
              src="/icons/open-folder.svg"
              alt="Open Folder"
              width={16}
              height={16}
              className={cn(isActive ? 'text-blue-600' : 'text-gray-500')}
            />
          ) : (
            <Image
              src="/icons/projects.svg"
              alt="Close Folder"
              width={16}
              height={16}
              className={cn(isActive ? 'text-blue-600' : 'text-gray-500')}
            />
          )}
        </div>
        <span
          className={cn(
            'flex-1 truncate text-left text-sm',
            isActive ? 'font-medium text-blue-600' : 'text-gray-700',
            isHovered || showMenu || isActive ? 'pr-8' : 'pr-2',
          )}
        >
          {project.title}
        </span>
      </Button>

      {(isHovered || showMenu || isActive) && (
        <div className="absolute top-1/2 right-2 z-10 -translate-y-1/2">
          <DropdownMenu
            open={showMenu}
            onOpenChange={(open) => {
              setShowMenu(open);
              if (!open) {
                setIsHovered(false);
              }
            }}
          >
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 p-0 hover:bg-gray-200/50"
                onClick={(e) => {
                  e.stopPropagation();
                }}
                onMouseEnter={() => setIsHovered(true)}
              >
                <MoreHorizontal className="h-4 w-4 text-gray-500" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="z-50">
              <DropdownMenuItem onClick={handleRename}>
                <PenSquare className="mr-2 h-4 w-4" />
                <span>Rename Project</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDelete}>
                <Trash2 className="mr-2 h-4 w-4" />
                <span>Delete Project</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}
