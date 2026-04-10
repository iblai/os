import React from 'react';
import { useParams } from 'next/navigation';

import { useDebounce } from 'use-debounce';

import { useUsername } from '@/hooks/use-user';
import { useNavigate } from '@/hooks/user-navigate';
import { TenantKeyMentorIdParams } from '@/lib/types';
import { useGetTrainingDocumentsQuery } from '@iblai/iblai-js/data-layer';

export function useDatasetsWithPagination(itemsPerPage = 5) {
  const { tenantKey, mentorId } = useParams<TenantKeyMentorIdParams>();
  const username = useUsername();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [debouncedSearchQuery] = useDebounce(searchQuery, 500);
  const [currentPage, setCurrentPage] = React.useState(1);
  const { getMentorId } = useNavigate();
  const [isTraining, setIsTraining] = React.useState(false);

  const activeMentorId = getMentorId() || mentorId;

  const [queryParams, setQueryParams] = React.useState({
    limit: itemsPerPage,
    offset: 0,
    query: debouncedSearchQuery,
  });

  const {
    data: datasets,
    isLoading: isDatasetsLoading,
    isFetching: isDatasetsFetching,
  } = useGetTrainingDocumentsQuery(
    {
      org: tenantKey,
      pathway: activeMentorId,
      limit: queryParams.limit,
      offset: queryParams.offset,
      search: queryParams.query,
      // @ts-ignore
      userId: username ?? '',
    },
    {
      skip: !activeMentorId,
      pollingInterval: isTraining ? 2000 : 0,
    },
  );

  React.useEffect(() => {
    if (!isDatasetsFetching) {
      const _isTraining = datasets?.results?.some((dataset) => {
        if (dataset.training_status === 'pending') {
          return true;
        }
        return false;
      });

      if (_isTraining === undefined) return;

      setIsTraining(_isTraining);
    }
  }, [isDatasetsFetching]);

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
  const totalPages = datasets ? Math.ceil(datasets?.count / itemsPerPage) : 0;

  return {
    datasets,
    isDatasetsLoading,
    isDatasetsFetching,
    searchQuery,
    setSearchQuery,
    currentPage,
    totalPages,
    handlePageChange,
  };
}
