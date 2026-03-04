'use client';

import React from 'react';

import { Plus, Search } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useNavigate } from '@/hooks/user-navigate';
import { useUserIsStudent } from '@/hooks/use-user';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAppDispatch } from '@/lib/hooks';
import { analyticsActions } from '@/features/analytics/slice';
import { useParams, usePathname } from 'next/navigation';
import { useShowFreeTrialDialog } from '@/hooks/user-user-actions';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import IblPagination from '@/components/ibl-pagination';
import { useMentorsWithPagination } from '@/hooks/use-mentors';
import { Spinner } from '@/components/spinner';
import { TenantKeyMentorIdParams } from '@/lib/types';
import { isLoggedIn } from '@/lib/utils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  hideCreateButton?: boolean;
}

export function MyMentorsModal({ isOpen, onClose, hideCreateButton = false }: Props) {
  const { mentorId } = useParams<TenantKeyMentorIdParams>();
  const dispatch = useAppDispatch();
  const pathname = usePathname();
  const { openCreateMentorModal, navigateToMentor } = useNavigate();
  const { executeWithTrialCheck, isModalOpen, FreeTrialDialog, closeModal } =
    useShowFreeTrialDialog();
  const userIsStudent = useUserIsStudent();

  // Use same pattern as NavBar to detect analytics
  const isAnalyticsViewActive = pathname.includes('/analytics');

  const {
    mentors,
    isLoading,
    isFetching,
    currentPage,
    totalPages,
    searchQuery,
    setSearchQuery,
    handlePageChange,
  } = useMentorsWithPagination(6);

  const handleMentorClick = async (mentor: any) => {
    if (isAnalyticsViewActive) {
      // If analytics view is active, update the selected mentor for the iframe
      dispatch(
        analyticsActions.setSelectedMentor({
          slug: mentor.slug,
          name: mentor.name,
          profileImage: mentor.profile_image,
          unique_id: mentor.unique_id,
        }),
      );
      onClose();
      return;
    } else {
      // Normal navigation behavior
      if (mentor.unique_id === mentorId) {
        if (pathname.includes('/projects/')) {
          navigateToMentor(mentor.unique_id);
        }
      } else {
        navigateToMentor(mentor.unique_id);
      }
      onClose();
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="mx-auto max-h-[90vh] w-full max-w-7xl overflow-hidden">
          <div className="flex max-h-[calc(90vh-3rem)] flex-col space-y-6 overflow-hidden">
            <DialogHeader>
              <DialogTitle className="ibl-dialog-title">My Mentors</DialogTitle>
            </DialogHeader>
            <div className="mb-6 flex items-center justify-between gap-4">
              <div className="relative w-full max-w-xs">
                <Input
                  type="search"
                  placeholder="Search mentors"
                  className="w-full py-2 pr-4 pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {isFetching ? (
                  <Spinner className="absolute top-2.5 left-2.5 h-4 w-4 text-gray-500" />
                ) : (
                  <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-gray-500" />
                )}
              </div>
              {isLoggedIn() && !hideCreateButton && !userIsStudent && (
                <Button
                  className="cursor-pointer bg-gradient-to-r from-blue-600 to-blue-300 text-white hover:opacity-90"
                  onClick={() => executeWithTrialCheck(openCreateMentorModal)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create
                </Button>
              )}
            </div>
            <div className="min-h-0 flex-1 grid grid-cols-1 gap-3 overflow-y-auto px-1 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
              {mentors.map((mentor) => {
                return (
                  <div
                    // @ts-ignore
                    key={mentor.id}
                    className="flex cursor-pointer flex-col rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition-colors hover:border-blue-500 hover:shadow"
                    // @ts-ignore
                    onClick={() => handleMentorClick(mentor)}
                  >
                    <div className="mb-3 flex items-center gap-4">
                      <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-md">
                        <Avatar className="h-full w-full rounded-none">
                          <AvatarImage
                            // @ts-ignore
                            src={mentor.profile_image || '/placeholder.svg'}
                            alt={mentor.name}
                          />
                          <AvatarFallback>AI</AvatarFallback>
                        </Avatar>
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="mb-1 text-base font-medium text-gray-700">{mentor.name}</h3>
                      </div>
                    </div>
                    <p className="mb-3 text-sm text-gray-600 line-clamp-2">
                      {/* @ts-ignore */}
                      {mentor.description}
                    </p>
                    <div className="mt-auto"></div>
                  </div>
                );
              })}
            </div>
            <IblPagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
              disabled={isFetching || isLoading}
            />
          </div>
        </DialogContent>
      </Dialog>
      {isModalOpen && FreeTrialDialog && (
        <FreeTrialDialog isOpen={isModalOpen} onClose={closeModal} />
      )}
    </>
  );
}
