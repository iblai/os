import { useState, useMemo, useEffect } from 'react';
import { useDebounce } from 'use-debounce';
import type { DateRange } from 'react-day-picker';
import { useGetModerationLogsQuery } from '@iblai/iblai-js/data-layer';
import { FlaggedPrompt } from './types';

const DEFAULT_DEBOUNCE_DELAY = 500;

interface UseFlaggedPromptsWithPaginationParams {
  tenantKey: string;
  username: string;
  mentorId: string;
  itemsPerPage?: number;
  debounceDelay?: number;
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return 'just now';
}

export function useFlaggedPromptsWithPagination({
  tenantKey,
  username,
  mentorId,
  itemsPerPage = 5,
  debounceDelay = DEFAULT_DEBOUNCE_DELAY,
}: UseFlaggedPromptsWithPaginationParams) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery] = useDebounce(searchQuery, debounceDelay);
  const [filterType, setFilterType] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(1);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchQuery, filterType, dateRange]);

  const targetSystem =
    filterType === 'moderation'
      ? ('Moderation System' as const)
      : filterType === 'safety'
        ? ('Safety System' as const)
        : undefined;

  const startTime = dateRange?.from ? dateRange.from.toISOString() : undefined;
  const endTime = dateRange?.to ? dateRange.to.toISOString() : undefined;

  const { data: moderationLogsData, isLoading } = useGetModerationLogsQuery({
    org: tenantKey,
    username,
    // @ts-ignore
    mentor: mentorId,
    page: currentPage,
    pageSize: itemsPerPage,
    search: debouncedSearchQuery || undefined,
    targetSystem,
    startTime,
    endTime,
  });

  const paginatedPrompts = useMemo(() => {
    if (!moderationLogsData?.results) return [];

    return moderationLogsData.results.map(
      (log): FlaggedPrompt => ({
        id: String(log.id),
        userId: log.username || 'unknown',
        userEmail: log.username || 'N/A',
        userFullName: log.username || 'Unknown User',
        type:
          log.target_system === 'Moderation System'
            ? ('Moderation' as const)
            : ('Safety' as const),
        prompt: log.prompt,
        systemResponse: log.reason,
        timestamp: new Date(log.date_created).toLocaleString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        }),
        timeAgo: getTimeAgo(new Date(log.date_created)),
        fullDate: new Date(log.date_created).toLocaleString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        }),
      }),
    );
  }, [moderationLogsData]);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const totalFlagged = moderationLogsData?.count ?? 0;
  const totalPages = Math.ceil(totalFlagged / itemsPerPage);

  return {
    paginatedPrompts,
    totalFlagged,
    isLoading,
    searchQuery,
    setSearchQuery,
    filterType,
    setFilterType,
    dateRange,
    setDateRange,
    currentPage,
    totalPages,
    handlePageChange,
  };
}
