'use client';

import React from 'react';
import { Star, Loader2 } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
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
  const { handleMentorClick, toggleFavorite, togglingMentorId, username } = useExplorePageContext();

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
      className="cursor-pointer hover:shadow-md transition-shadow border border-[#D0E0FF] rounded-lg bg-[#F5F8FF] md:h-full"
      onClick={handleCardClick}
      tabIndex={0}
      onKeyDown={handleCardKeyDown}
      aria-label={`Explore mentor: ${mentor.name}. ${mentor.description || ''}`}
    >
      <CardContent className="p-6 md:h-full">
        <div className="flex items-start gap-4 md:h-full">
          <Avatar className="h-12 w-12 shrink-0 rounded-full">
            <AvatarImage src={mentor.profile_image} alt={mentor.name} className="object-cover" />
            <AvatarFallback>{mentor.name.substring(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-sm text-gray-900">{mentor.name}</h3>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(mentor, e);
                    }}
                    className="p-1 hover:bg-gray-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label={isStarred ? 'Remove from favorites' : 'Add to favorites'}
                    disabled={isDisabled}
                  >
                    {isToggling ? (
                      <Loader2 className="h-4 w-4 text-[#38A1E5] animate-spin" />
                    ) : (
                      <Star
                        className={`h-4 w-4 ${
                          isStarred
                            ? 'text-[#38A1E5] fill-current'
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
            <p className="text-sm mb-3 leading-relaxed text-gray-600">{mentor.description}</p>
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
