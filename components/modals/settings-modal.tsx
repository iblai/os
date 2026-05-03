// Updated SettingsModal.tsx with offset-based pagination
'use client';

import React from 'react';
import { Search, Plus } from 'lucide-react';
import { useEditMentorAndRefreshListMutation } from '@iblai/iblai-js/data-layer';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { EditMentorModal } from '@/components/modals/edit-mentor-modal';
import { useParams } from 'next/navigation';
import { TenantKeyMentorIdParams } from '@/lib/types';
import { useUserIsStudent, useUsername } from '@/hooks/use-user';
import { formatDateString, getLLMProviderDetails } from '@/lib/utils';
import { useNavigate } from '@/hooks/user-navigate';
import { MODALS } from '@/lib/constants';
import { IblPagination } from '@/components/ibl-pagination';
import { useMentorsWithPagination } from '@/hooks/use-mentors';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const {
    openCreateMentorModal,
    openEditMentorModal,
    closeEditMentorModal,
    showEditMentorModal,
  } = useNavigate();
  const username = useUsername();
  const userIsStudent = useUserIsStudent();
  const { tenantKey } = useParams<TenantKeyMentorIdParams>();
  const [editMentorAndRefresh, { isLoading: isEditingMentor }] =
    useEditMentorAndRefreshListMutation();

  const {
    mentors,
    isLoading,
    isFetching,
    searchQuery,
    setSearchQuery,
    currentPage,
    totalPages,
    handlePageChange,
  } = useMentorsWithPagination();

  async function toggleMentorFeaturedStatus(
    mentorId: string,
    checked: boolean,
  ) {
    try {
      await editMentorAndRefresh({
        mentor: mentorId,
        org: tenantKey,
        // @ts-expect-error - userId parameter may not exist in API BUT passed from legacy code
        userId: username ?? '',
        formData: {
          is_featured: checked,
        },
      }).unwrap();
      toast.success('Agent featured status updated');
    } catch (error) {
      toast.error('Failed to update agent featured status');
      console.error(JSON.stringify({ tenant: tenantKey, error }));
    }
  }

  const isDisabled = isEditingMentor || isLoading;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-h-[90vh] max-w-7xl px-4 py-6 sm:p-6">
          <DialogDescription className="sr-only">
            Showing the list of agents available in your tenant
          </DialogDescription>
          <DialogHeader>
            <DialogTitle className="ibl-dialog-title">Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 overflow-hidden px-[2px]">
            <div className="mb-4">
              <p className="mt-2 pt-[10px] text-sm text-gray-700">
                Showing the list of agents available in your tenant
              </p>
            </div>

            <div className="space-y-4 sm:flex sm:items-center sm:justify-between sm:space-y-0">
              <div className="relative flex-1 sm:max-w-sm">
                <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-gray-500" />
                <Input
                  type="search"
                  placeholder="Search agents"
                  className="w-full pl-9"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  autoComplete="off"
                />
              </div>
              {!userIsStudent && (
                <Button
                  className="w-full cursor-pointer gap-2 bg-gradient-to-r from-[#84B9FE] via-[#6779F5] to-[#D4A9F7] text-white hover:text-white hover:opacity-90 sm:w-auto"
                  onClick={() => openCreateMentorModal()}
                >
                  <Plus className="h-4 w-4" />
                  Create Agent
                </Button>
              )}
            </div>

            <div className="w-full">
              <div className="w-full align-middle">
                <div className="ring-opacity-5 w-full overflow-hidden shadow ring-1 ring-gray-300 md:rounded-lg">
                  <div className="max-h-[350px] overflow-y-auto">
                    <Table className="w-full divide-y divide-gray-200">
                      <TableHeader className="sticky top-0 z-10 bg-gray-50">
                        <TableRow>
                          <TableHead className="w-[15%] px-3 py-3.5 text-left text-xs font-medium tracking-wider text-gray-700 uppercase">
                            Name
                          </TableHead>
                          <TableHead
                            scope="col"
                            className="w-[15%] px-3 py-3.5 text-left text-xs font-medium tracking-wider text-gray-700 uppercase"
                          >
                            LLM
                          </TableHead>
                          <TableHead
                            scope="col"
                            className="px-3 py-3.5 text-left text-xs font-medium tracking-wider text-gray-700 uppercase"
                          >
                            Provider
                          </TableHead>
                          <TableHead
                            scope="col"
                            className="px-3 py-3.5 text-left text-xs font-medium tracking-wider text-gray-700 uppercase"
                          >
                            Description
                          </TableHead>
                          <TableHead
                            scope="col"
                            className="w-[30%] px-3 py-3.5 text-left text-xs font-medium tracking-wider text-gray-700 uppercase"
                          >
                            Updated On
                          </TableHead>
                          <TableHead
                            scope="col"
                            className="px-3 py-3.5 text-left text-xs font-medium tracking-wider text-gray-700 uppercase"
                          >
                            Featured
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="divide-y divide-gray-200 bg-white">
                        {mentors?.map((mentor) => (
                          <TableRow
                            key={mentor?.id}
                            className="bg-white even:bg-gray-50"
                          >
                            <TableCell className="px-3 py-4 whitespace-nowrap">
                              <div
                                className="max-w-[200px] cursor-pointer truncate text-sm font-medium text-blue-600 hover:text-blue-800"
                                onClick={() => {
                                  if (userIsStudent) return;

                                  openEditMentorModal(
                                    MODALS.EDIT_MENTOR.tabs.settings,
                                    mentor.unique_id,
                                  );
                                }}
                              >
                                {mentor?.name}
                              </div>
                            </TableCell>
                            <TableCell className="px-3 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {/* @ts-expect-error - llm_name property may not exist on mentor type */}
                                {mentor?.llm_name}
                              </div>
                            </TableCell>
                            <TableCell className="px-3 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {
                                  // @ts-expect-error llm_provider property may not exist on mentor type
                                  getLLMProviderDetails(mentor?.llm_provider)
                                    .name
                                }
                              </div>
                            </TableCell>
                            <TableCell className="px-3 py-4 whitespace-nowrap">
                              <div className="max-w-xs truncate text-sm text-gray-900">
                                {/* @ts-expect-error - description property may not exist on mentor type */}
                                {mentor?.description}
                              </div>
                            </TableCell>
                            <TableCell className="px-3 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {/* @ts-expect-error - updated_at property may not exist on mentor type */}
                                {formatDateString(mentor?.updated_at)}
                              </div>
                            </TableCell>
                            <TableCell className="px-3 py-4 whitespace-nowrap">
                              <Switch
                                checked={mentor?.is_featured ?? false}
                                onCheckedChange={(checked) =>
                                  toggleMentorFeaturedStatus(
                                    // @ts-expect-error - unique_id property may not exist on mentor type
                                    mentor?.unique_id,
                                    checked,
                                  )
                                }
                                disabled={isDisabled}
                                aria-label={`Toggle featured status for ${mentor?.name || 'agent'}`}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-center gap-2 py-2">
              {mentors && (
                <IblPagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={handlePageChange}
                  disabled={isFetching || isLoading}
                />
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {showEditMentorModal && (
        <EditMentorModal
          isOpen={showEditMentorModal}
          onClose={closeEditMentorModal}
        />
      )}
    </>
  );
}
