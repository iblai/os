'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SendNotificationDialog } from '@/components/modals/send-notification-dialog';
import { IblPagination } from '@/components/ibl-pagination';
import { FlaggedPrompt } from './types';
import { FlaggedPromptsSummary } from './flagged-prompts-summary';
// import { ViolationCategories } from './violation-categories';
import { FlaggedPromptsFilters } from './flagged-prompts-filters';
import { FlaggedPromptsList } from './flagged-prompts-list';
import { FlaggedPromptDetail } from './flagged-prompt-detail';
import { useFlaggedPromptsWithPagination } from './use-flagged-prompts-with-pagination';

const FlaggedPromptMobileDetail = dynamic(
  () =>
    import('./flagged-prompt-mobile-detail').then((mod) => ({
      default: mod.FlaggedPromptMobileDetail,
    })),
  { ssr: false },
);

interface FlaggedPromptsModalProps {
  isOpen: boolean;
  onClose: () => void;
  mentorId: string;
  tenantKey: string;
  username: string;
}

export function FlaggedPromptsModal({
  isOpen,
  onClose,
  mentorId,
  tenantKey,
  username,
}: FlaggedPromptsModalProps) {
  const [selectedPrompt, setSelectedPrompt] = useState<FlaggedPrompt | null>(
    null,
  );
  const [isSendNotificationOpen, setIsSendNotificationOpen] = useState(false);
  const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(false);

  const {
    paginatedPrompts,
    totalFlagged,
    searchQuery,
    setSearchQuery,
    filterType,
    setFilterType,
    dateRange,
    setDateRange,
    currentPage,
    totalPages,
    handlePageChange,
  } = useFlaggedPromptsWithPagination({
    tenantKey,
    username,
    mentorId,
    itemsPerPage: 5,
  });

  // const violationCategories = [
  //   'Inappropriate Language',
  //   'Offensive Content',
  //   'Harmful Content',
  //   'Policy Violation',
  //   'Spam',
  // ];

  const handlePromptClick = (prompt: FlaggedPrompt) => {
    setSelectedPrompt(prompt);
    if (window.innerWidth < 768) {
      setIsMobileDetailOpen(true);
    }
  };

  const handleContactUser = () => {
    if (selectedPrompt) {
      setIsSendNotificationOpen(true);
    }
  };

  const handleDeleteSuccess = () => {
    setSelectedPrompt(null);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="flex h-[90vh] max-w-6xl flex-col p-0">
          <DialogHeader className="flex-shrink-0 border-b border-gray-200 px-6 pt-6 pb-4">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl font-semibold text-gray-900">
                Flagged Prompts
              </DialogTitle>
            </div>
          </DialogHeader>

          <div className="scrollbar-hide flex-1 overflow-y-auto p-4">
            <div className="space-y-6">
              <FlaggedPromptsSummary totalFlagged={totalFlagged} />

              {/* <ViolationCategories categories={violationCategories} /> */}

              <FlaggedPromptsFilters
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                filterType={filterType}
                onFilterTypeChange={setFilterType}
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
              />

              {totalFlagged === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <p className="text-sm text-gray-500">
                    No flagged prompts found
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="space-y-4">
                    <FlaggedPromptsList
                      prompts={paginatedPrompts}
                      selectedPrompt={selectedPrompt}
                      onPromptClick={handlePromptClick}
                    />
                    <IblPagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      onPageChange={handlePageChange}
                    />
                  </div>

                  <FlaggedPromptDetail
                    prompt={selectedPrompt}
                    onContactUser={handleContactUser}
                    onDeleteSuccess={handleDeleteSuccess}
                  />
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <SendNotificationDialog
        open={isSendNotificationOpen}
        onOpenChange={setIsSendNotificationOpen}
        preSelectedUser={
          selectedPrompt
            ? {
                id: selectedPrompt.userId,
                name: selectedPrompt.userFullName,
                email: selectedPrompt.userEmail,
                avatar: selectedPrompt.avatarUrl,
              }
            : undefined
        }
      />

      {isMobileDetailOpen && (
        <FlaggedPromptMobileDetail
          isOpen={isMobileDetailOpen}
          onOpenChange={setIsMobileDetailOpen}
          prompt={selectedPrompt}
          onDeleteSuccess={handleDeleteSuccess}
        />
      )}
    </>
  );
}
