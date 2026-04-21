import React from 'react';

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { cn } from '@/lib/utils';

interface IblPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
  disableNumberedButtons?: boolean;
}

export const IblPagination: React.FC<IblPaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  disabled = false,
  disableNumberedButtons = false,
}) => {
  // Calculate which page numbers to show
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];

    // Always show first page
    pages.push(1);

    // Calculate middle pages
    let startPage = Math.max(2, currentPage - 1);
    let endPage = Math.min(totalPages - 1, currentPage + 1);

    // Adjust if we're at the beginning or end
    if (currentPage <= 2) {
      endPage = Math.min(totalPages - 1, 4);
    } else if (currentPage >= totalPages - 1) {
      startPage = Math.max(2, totalPages - 3);
    }

    // Add ellipsis before middle pages if needed
    if (startPage > 2) {
      pages.push('ellipsis-start');
    }

    // Add middle pages
    for (let i = startPage; i <= endPage; i++) {
      if (i !== 1 && i !== totalPages) {
        pages.push(i);
      }
    }

    // Add ellipsis after middle pages if needed
    if (endPage < totalPages - 1) {
      pages.push('ellipsis-end');
    }

    // Always show last page if there is more than one page
    if (totalPages > 1) {
      pages.push(totalPages);
    }

    return pages;
  };

  if (totalPages <= 1) {
    return null; // Don't show pagination if there's only one page
  }

  return (
    <Pagination>
      <PaginationContent>
        {/* Previous Button */}
        <PaginationItem>
          <PaginationPrevious
            size="sm"
            onClick={(e) => {
              e.preventDefault();
              if (!disabled && currentPage > 1) {
                onPageChange(currentPage - 1);
              }
            }}
            aria-disabled={currentPage === 1 || disabled}
            className={cn(
              'cursor-pointer',
              (currentPage === 1 || disabled) &&
                'pointer-events-none opacity-50',
            )}
          />
        </PaginationItem>

        {/* Page Numbers - Hide  when disableNumberedButtons is true */}
        {!disableNumberedButtons &&
          getPageNumbers().map((page, index) => (
            <PaginationItem key={index}>
              {page === 'ellipsis-start' || page === 'ellipsis-end' ? (
                <PaginationEllipsis />
              ) : (
                <PaginationLink
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault();
                    if (!disabled && typeof page === 'number') {
                      onPageChange(page);
                    }
                  }}
                  isActive={page === currentPage}
                  className={cn(
                    'cursor-pointer',
                    disabled && 'pointer-events-none opacity-50',
                  )}
                >
                  {page}
                </PaginationLink>
              )}
            </PaginationItem>
          ))}

        {/* Next Button */}
        <PaginationItem>
          <PaginationNext
            size="sm"
            onClick={(e) => {
              e.preventDefault();
              if (!disabled && currentPage < totalPages) {
                onPageChange(currentPage + 1);
              }
            }}
            aria-disabled={currentPage === totalPages || disabled}
            className={cn(
              'cursor-pointer',
              (currentPage === totalPages || disabled) &&
                'pointer-events-none opacity-50',
            )}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
};

export default IblPagination;
