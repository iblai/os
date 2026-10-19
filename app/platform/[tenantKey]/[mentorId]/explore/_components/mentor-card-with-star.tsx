'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Star, Loader2, Sparkles } from 'lucide-react';

import { Card } from '@/components/ui/card';
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
  // The search endpoints send category names; the SDK types them as objects.
  categories?: Array<string | { name?: string | null }> | null;
  is_featured?: boolean;
  starred?: boolean;
}

interface MentorCardWithStarProps {
  mentor: MentorWithProfile;
}

export function MentorCardWithStar({ mentor }: MentorCardWithStarProps) {
  const t = useTranslations('exploreMentorCard');
  const { handleMentorClick, toggleFavorite, togglingMentorId, username } =
    useExplorePageContext();

  const mentorId = String(mentor.id);
  const isStarred = mentor.starred === true;
  const isToggling = togglingMentorId === mentorId;
  const isDisabled = isToggling || !username;
  const category = (mentor.categories ?? [])
    .map((c) => (typeof c === 'string' ? c : c?.name))
    .find(Boolean);
  const favoriteLabel = isStarred
    ? t('removeFromFavorites')
    : t('addToFavorites');

  const handleCardClick = () => {
    handleMentorClick(mentor);
  };

  const handleCardKeyDown = (e: React.KeyboardEvent) => {
    // Don't navigate if the star button is focused
    if ((e.target as HTMLElement).closest('[data-favorite-toggle]')) {
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleMentorClick(mentor);
    }
  };

  return (
    <Card
      className="group h-full cursor-pointer rounded-xl border border-gray-200 bg-white p-4 shadow-none transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-[#38A1E5]/50 hover:shadow-[0_8px_24px_-12px_rgba(56,161,229,0.45)] focus-visible:ring-2 focus-visible:ring-[#38A1E5] focus-visible:ring-offset-2 focus-visible:outline-none motion-reduce:transition-none motion-reduce:hover:translate-y-0"
      onClick={handleCardClick}
      tabIndex={0}
      onKeyDown={handleCardKeyDown}
      aria-label={`Explore agent: ${mentor.name}. ${mentor.description || ''}`}
    >
      <div className="flex items-start gap-3">
        <Avatar className="h-11 w-11 shrink-0 rounded-full ring-1 ring-gray-200">
          <AvatarImage
            src={mentor.profile_image}
            alt={mentor.name}
            className="object-cover"
          />
          <AvatarFallback className="bg-[#EAF4FC] text-sm font-medium text-[#1F6FA8]">
            {mentor.name.substring(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 pt-0.5">
          <h3
            className="truncate text-sm font-semibold text-gray-900"
            title={mentor.name}
          >
            {mentor.name}
          </h3>
          {(mentor.is_featured || category) && (
            <div className="mt-1 flex min-w-0 items-center gap-1.5">
              {mentor.is_featured && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#EAF4FC] px-2 py-0.5 text-[11px] font-medium text-[#1F6FA8] ring-1 ring-[#38A1E5]/30 ring-inset">
                  <Sparkles className="h-3 w-3" aria-hidden="true" />
                  {t('featured')}
                </span>
              )}
              {category && (
                <span className="truncate rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700">
                  {category}
                </span>
              )}
            </div>
          )}
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              data-favorite-toggle
              onClick={(e) => {
                e.stopPropagation();
                toggleFavorite(mentor, e);
              }}
              className="-mt-1 -mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-[#38A1E5] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={favoriteLabel}
              disabled={isDisabled}
            >
              {isToggling ? (
                <Loader2 className="h-4 w-4 animate-spin text-[#38A1E5]" />
              ) : (
                <Star
                  className={`h-4 w-4 ${
                    isStarred
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-gray-400 group-hover:text-gray-500 hover:text-amber-500'
                  }`}
                />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent>{favoriteLabel}</TooltipContent>
        </Tooltip>
      </div>
      {mentor.description && (
        <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-gray-600">
          {mentor.description}
        </p>
      )}
      {mentor.updated_at && (
        <p className="mt-auto pt-3 text-xs text-gray-500">
          {t('updatedOn', { date: formatDateString(mentor.updated_at) })}
        </p>
      )}
    </Card>
  );
}
