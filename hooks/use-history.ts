import React from 'react';
import { useParams } from 'next/navigation';

import { format } from 'date-fns';
import { DateRange } from 'react-day-picker';

import {
  useGetChatHistoryFilterQuery,
  useGetChatHistoryQuery,
  useGetMentorPublicSettingsQuery,
} from '@iblai/iblai-js/data-layer';
import { TenantKeyMentorIdParams } from '@/lib/types';
import { ANONYMOUS_USERNAME } from '@/lib/constants';
import { useUserIsOnTrial, useUsername } from '@/hooks/use-user';
import { useNavigate } from '@/hooks/user-navigate';
import { useSearchParams } from 'next/navigation';

export type ChatHistoryFilter = {
  dateRange: DateRange | undefined;
  sentiment: string | undefined;
  topics: string | undefined;
  users: string | undefined;
};

export function useHistoryWithPagination(itemsPerPage = 10) {
  const { tenantKey, mentorId } = useParams<TenantKeyMentorIdParams>();
  const username = useUsername();
  const [currentPage, setCurrentPage] = React.useState(1);
  const userIsOnTrial = useUserIsOnTrial();
  const searchParams = useSearchParams();
  const isAccessingPublicRoute = !!searchParams.get('token');
  const { getMentorId } = useNavigate();
  const activeMentorId = getMentorId() || mentorId;
  const { data: mentorPublicSettings } = useGetMentorPublicSettingsQuery({
    mentor: activeMentorId,
    org: tenantKey,
    // @ts-ignore
    userId: username ?? ANONYMOUS_USERNAME,
  });

  const { data: chatHistoryFilter } = useGetChatHistoryFilterQuery(
    {
      org: tenantKey,
      // @ts-ignore
      userId: username ?? '',
      mentorId: mentorPublicSettings?.mentor_unique_id,
    },
    { skip: userIsOnTrial || isAccessingPublicRoute },
  );

  const [filters, setFilters] = React.useState<ChatHistoryFilter>({
    dateRange: undefined,
    sentiment: undefined,
    topics: undefined,
    users: undefined,
  });

  const {
    data: chatHistory,
    isLoading: isChatHistoryLoading,
    isFetching: isChatHistoryFetching,
  } = useGetChatHistoryQuery(
    {
      org: tenantKey,
      // @ts-ignore
      userId: username ?? '',
      endDate: filters.dateRange?.to ? format(filters.dateRange.to, 'yyyy-MM-dd') : undefined,
      mentor: activeMentorId,
      pageSize: itemsPerPage,
      page: currentPage,
      sentiment: filters.sentiment,
      startDate: filters.dateRange?.from ? format(filters.dateRange.from, 'yyyy-MM-dd') : undefined,
      topics: filters.topics,
      filterUserId: filters.users,
    },
    {
      skip: (chatHistoryFilter === undefined && userIsOnTrial) || isAccessingPublicRoute,
    },
  );

  // Effect to reset current page when filters change
  React.useEffect(() => {
    setCurrentPage(1); // Reset current page state
  }, []);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    // Scroll to top of the list when changing pages
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Calculate total pages based on count and limit
  const totalPages = chatHistory ? Math.ceil(chatHistory.count / itemsPerPage) : 0;

  return {
    chatHistory,
    isChatHistoryLoading,
    isChatHistoryFetching,
    filters,
    setFilters,
    currentPage,
    totalPages,
    handlePageChange,
    chatHistoryFilter,
  };
}
