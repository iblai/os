import React from 'react';
import { useParams } from 'next/navigation';

import { useDebounce } from 'use-debounce';

import { useUsername } from '@/hooks/use-user';
import { TenantKeyMentorIdParams } from '@/lib/types';
import {
  useGetMentorsQuery,
  useGetPublicMentorsQuery,
} from '@iblai/iblai-js/data-layer';

export function useMentorsWithPagination(itemsPerPage = 5) {
  const { tenantKey } = useParams<TenantKeyMentorIdParams>();
  const username = useUsername();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [debouncedSearchQuery] = useDebounce(searchQuery, 500);
  const [currentPage, setCurrentPage] = React.useState(1);

  const [queryParams, setQueryParams] = React.useState({
    limit: itemsPerPage,
    offset: 0,
    query: debouncedSearchQuery,
    orderBy: 'created_at',
    orderDirection: 'desc',
  });

  const {
    data: mentors,
    isLoading: isMentorsLoading,
    isFetching: isMentorsFetching,
    error: mentorsError,
  } = useGetMentorsQuery(
    {
      org: tenantKey,
      username: username ?? '',
      ...queryParams,
    },
    {
      skip: !tenantKey || !username,
      refetchOnMountOrArgChange: true,
    },
  );

  const {
    data: publicMentors,
    isLoading: isPublicMentorsLoading,
    isFetching: isPublicMentorsFetching,
    error: publicMentorsError,
  } = useGetPublicMentorsQuery(
    { ...queryParams },
    {
      skip: username,
      refetchOnMountOrArgChange: true,
    },
  );

  // Effect to update offset when page changes
  React.useEffect(() => {
    setQueryParams((prev) => ({
      ...prev,
      offset: (currentPage - 1) * itemsPerPage,
    }));
  }, [currentPage, itemsPerPage]);

  // Effect to update query parameter when search changes
  React.useEffect(() => {
    setQueryParams((prev) => ({
      ...prev,
      query: debouncedSearchQuery,
      offset: 0, // Reset to first page when search changes
    }));
    setCurrentPage(1); // Also reset current page state
  }, [debouncedSearchQuery]);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    // Scroll to top of the list when changing pages
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Calculate total pages based on count and limit
  const mentorsTotalPages = mentors
    ? Math.ceil(mentors.count / itemsPerPage)
    : 0;
  const publicMentorsTotalPages = publicMentors
    ? Math.ceil(publicMentors.count / itemsPerPage)
    : 0;
  const totalPages = username ? mentorsTotalPages : publicMentorsTotalPages;

  return {
    mentors: username ? mentors?.results || [] : publicMentors?.results || [],
    totalCount: username ? mentors?.count || 0 : publicMentors?.count || 0,
    isLoading: username ? isMentorsLoading : isPublicMentorsLoading,
    isFetching: username ? isMentorsFetching : isPublicMentorsFetching,
    error: username ? mentorsError : publicMentorsError,
    searchQuery,
    setSearchQuery,
    currentPage,
    totalPages,
    handlePageChange,
    queryParams,
    itemsPerPage,
  };
}
