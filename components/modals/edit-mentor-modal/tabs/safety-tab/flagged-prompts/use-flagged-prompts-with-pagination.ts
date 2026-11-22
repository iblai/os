import { useState, useMemo, useEffect } from 'react';
import { useDebounce } from 'use-debounce';
import type { DateRange } from 'react-day-picker';
import {
  useGetModerationLogsQuery,
  useGetSafetyLogsQuery,
} from '@iblai/iblai-js/data-layer';
import { FlaggedPrompt } from './types';

const DEFAULT_DEBOUNCE_DELAY = 500;

interface UseFlaggedPromptsWithPaginationParams {
  tenantKey: string;
  username: string;
  mentorId: string;
  itemsPerPage?: number;
  debounceDelay?: number;
}

interface FlaggedLog {
  id: number;
  username?: string | null;
  prompt: string;
  reason: string;
  date_created: string;
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

function toFlaggedPrompt(
  log: FlaggedLog,
  type: FlaggedPrompt['type'],
): FlaggedPrompt {
  const formatted = new Date(log.date_created).toLocaleString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return {
    id: String(log.id),
    userId: log.username || 'unknown',
    userEmail: log.username || 'N/A',
    userFullName: log.username || 'Unknown User',
    type,
    prompt: log.prompt,
    systemResponse: log.reason,
    timestamp: formatted,
    timeAgo: getTimeAgo(new Date(log.date_created)),
    fullDate: formatted,
  };
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
  const [filterType, setFilterType] = useState<string>('moderation');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(1);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchQuery, filterType, dateRange]);

  const startTime = dateRange?.from ? dateRange.from.toISOString() : undefined;
  const endTime = dateRange?.to ? dateRange.to.toISOString() : undefined;

  const isSafety = filterType === 'safety';
  const queryArgs = {
    org: tenantKey,
    userId: username,
    mentor: mentorId,
    ordering: '-date_created',
    page: currentPage,
    pageSize: itemsPerPage,
    search: debouncedSearchQuery || undefined,
    startTime,
    endTime,
  };

  const moderationQuery = useGetModerationLogsQuery(queryArgs, {
    skip: isSafety,
    refetchOnMountOrArgChange: true,
  });
  const safetyQuery = useGetSafetyLogsQuery(queryArgs, {
    skip: !isSafety,
    refetchOnMountOrArgChange: true,
  });
  const { data, isLoading } = isSafety ? safetyQuery : moderationQuery;

  const paginatedPrompts = useMemo(
    () =>
      (data?.results ?? []).map((log) =>
        toFlaggedPrompt(log, isSafety ? 'Safety' : 'Moderation'),
      ),
    [data, isSafety],
  );

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const totalFlagged = data?.count ?? 0;
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
