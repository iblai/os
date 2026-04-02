'use client';

import React from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Search, Check } from 'lucide-react';
import { useMentorsWithPagination } from '@/hooks/use-mentors';
import IblPagination from '@/components/ibl-pagination';
import { Spinner } from '@/components/spinner';

interface MentorSelectionGridProps {
  selectedMentorIds: string[];
  onMentorSelect: (mentor: any) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  itemsPerPage?: number;
  showSearch?: boolean;
  minHeight?: string;
}

export function MentorSelectionGrid({
  selectedMentorIds,
  onMentorSelect,
  searchQuery,
  onSearchChange,
  itemsPerPage = 8,
  showSearch = true,
  minHeight = '400px',
}: MentorSelectionGridProps) {
  const {
    mentors,
    isLoading: isMentorsLoading,
    isFetching: isMentorsFetching,
    currentPage,
    totalPages,
    setSearchQuery: setMentorSearch,
    handlePageChange,
  } = useMentorsWithPagination(itemsPerPage);

  // Update search query with debounce effect handled by the hook
  React.useEffect(() => {
    setMentorSearch(searchQuery);
  }, [searchQuery]);

  const isMentorSelected = (mentorId: string) => {
    return selectedMentorIds.includes(mentorId);
  };

  return (
    <div className="space-y-4">
      {showSearch && (
        <div className="relative">
          {isMentorsFetching ? (
            <Spinner className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-gray-400" />
          ) : (
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-gray-400" />
          )}
          <Input
            placeholder="Search Mentors"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-10 border-gray-200 pl-10 focus:border-blue-500 focus:ring-0"
          />
        </div>
      )}

      <div className="space-y-4">
        <div
          className="grid max-h-96 auto-rows-min grid-cols-1 items-start gap-3 overflow-y-auto rounded-lg border border-gray-200 p-4 md:max-h-none md:grid-cols-2"
          style={{ minHeight }}
        >
          {isMentorsLoading ? (
            <div className="col-span-full py-8 text-center text-gray-500">
              Loading mentors...
            </div>
          ) : mentors.length === 0 ? (
            <div className="col-span-full py-8 text-center text-gray-500">
              No mentors found matching your search.
            </div>
          ) : (
            mentors.map((mentor) => {
              const isSelected = isMentorSelected(mentor.unique_id || '');
              const isAlreadyAdded = selectedMentorIds.includes(
                mentor.unique_id || '',
              );

              return (
                <button
                  key={mentor.unique_id}
                  onClick={() => onMentorSelect(mentor)}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border-2 p-3 transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50'
                      : isAlreadyAdded
                        ? 'bg-blue-25 border-blue-300'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <Avatar className="h-12 w-12 flex-shrink-0">
                    <AvatarImage
                      src={(mentor as any).profile_image || '/placeholder.svg'}
                      alt={mentor.name}
                    />
                    <AvatarFallback>
                      {mentor.name.substring(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex min-w-0 flex-1 flex-col justify-start text-left">
                    <h4 className="truncate text-sm font-medium text-gray-900">
                      {mentor.name}
                    </h4>
                    <p className="line-clamp-2 text-xs text-gray-600">
                      {(mentor as any).description}
                    </p>
                  </div>
                  {isSelected && (
                    <div className="flex-shrink-0">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600">
                        <Check className="h-4 w-4 text-white" />
                      </div>
                    </div>
                  )}
                  {isAlreadyAdded && !isSelected && (
                    <div className="flex-shrink-0">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-400">
                        <Check className="h-4 w-4 text-white" />
                      </div>
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Pagination */}
        <IblPagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          disabled={isMentorsFetching || isMentorsLoading}
        />
      </div>
    </div>
  );
}
