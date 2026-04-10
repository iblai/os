'use client';

import React from 'react';
import { Star, Loader2 } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import { formatDateString } from '@/lib/utils';
import { useExplorePageContext } from './explore-page-context';

interface MentorWithProfile {
  id: string | number;
  name: string;
  unique_id?: string;
  profile_image?: string;
  description?: string;
  updated_at?: string | null;
  metadata?: any;
}

interface MentorCardWithStarProps {
  mentor: MentorWithProfile;
}

export function MentorCardWithStar({ mentor }: MentorCardWithStarProps) {
  const { handleMentorClick, toggleFavorite, togglingMentorId, username } =
    useExplorePageContext();

  const mentorId = String(mentor.id);
  const isStarred = (mentor as any)?.starred === true;
  const isToggling = togglingMentorId === mentorId;
  const isDisabled = isToggling || !username;

  const handleCardClick = () => {
    handleMentorClick(mentor);
  };

  const handleCardKeyDown = (e: React.KeyboardEvent) => {
    // Don't navigate if the star button is focused
    if ((e.target as HTMLElement).closest('button[aria-label*="favorites"]')) {
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleMentorClick(mentor);
    }
  };

  return (
    <Card
      className="cursor-pointer rounded-lg border border-[#D0E0FF] bg-[#F5F8FF] transition-shadow hover:shadow-md md:h-full"
      onClick={handleCardClick}
      tabIndex={0}
      onKeyDown={handleCardKeyDown}
      aria-label={`Explore mentor: ${mentor.name}. ${mentor.description || ''}`}
    >
      <CardContent className="p-6 md:h-full">
        <div className="flex items-start gap-4 md:h-full">
          <Avatar className="h-12 w-12 shrink-0 rounded-full">
            <AvatarImage
              src={mentor.profile_image}
              alt={mentor.name}
              className="object-cover"
            />
            <AvatarFallback>
              {mentor.name.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-900">
                {mentor.name}
              </h3>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(mentor, e);
                    }}
                    className="rounded p-1 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label={
                      isStarred ? 'Remove from favorites' : 'Add to favorites'
                    }
                    disabled={isDisabled}
                  >
                    {isToggling ? (
                      <Loader2 className="h-4 w-4 animate-spin text-[#38A1E5]" />
                    ) : (
                      <Star
                        className={`h-4 w-4 ${
                          isStarred
                            ? 'fill-current text-[#38A1E5]'
                            : 'text-gray-400 hover:text-[#38A1E5]'
                        }`}
                      />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  {isStarred ? 'Unset as favorite' : 'Set as favorite'}
                </TooltipContent>
              </Tooltip>
            </div>
            <p className="mb-3 text-sm leading-relaxed text-gray-600">
              {mentor.description}
            </p>
            {mentor.updated_at && (
              <p className="text-xs text-gray-500">
                Updated on {formatDateString(mentor.updated_at)}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
