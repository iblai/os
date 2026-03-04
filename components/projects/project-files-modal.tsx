'use client';

import React from 'react';
import { Search, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Table, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { DatasetItemList } from '@/components/modals/edit-mentor-modal/tabs/datasets-tab/dataset-item-list';
import IblPagination from '@/components/ibl-pagination';
import { AddResourceModal } from '@/components/modals/edit-mentor-modal/tabs/datasets-tab/add-resource-modal';
import { Spinner } from '@/components/spinner';
import { useDatasetsWithPagination } from '@/hooks/use-datasets';
import { useShowFreeTrialDialog } from '@/hooks/user-user-actions';

interface ProjectFilesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProjectFilesModal({ isOpen, onClose }: ProjectFilesModalProps) {
  const [showAddResourceModal, setShowAddResourceModal] = React.useState(false);
  const openAddResourceModal = () => setShowAddResourceModal(true);
  const closeAddResourceModal = () => setShowAddResourceModal(false);

  const { executeWithTrialCheck, isModalOpen, FreeTrialDialog, closeModal } =
    useShowFreeTrialDialog();

  const {
    datasets,
    isDatasetsLoading,
    isDatasetsFetching,
    searchQuery,
    setSearchQuery,
    currentPage,
    totalPages,
    handlePageChange,
  } = useDatasetsWithPagination();

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden p-0">
          <DialogHeader className="flex flex-row items-center justify-between space-y-0 p-6 pb-4">
            <DialogTitle className="text-xl font-semibold text-gray-900">Project Files</DialogTitle>
          </DialogHeader>

          <Separator className="bg-gray-200" />

          <div
            className="flex-1 p-3 lg:p-4 space-y-4"
            style={{
              overflowY: 'auto',
              overflowX: 'hidden',
            }}
          >
            <div className="space-y-4">
              <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                <div className="relative w-full sm:w-64">
                  {isDatasetsFetching ? (
                    <Spinner className="absolute top-2.5 left-2.5 h-4 w-4 text-gray-500" />
                  ) : (
                    <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-gray-500" />
                  )}
                  <Input
                    type="search"
                    placeholder="Search datasets..."
                    className="pl-8"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                  />
                </div>
                <Button
                  onClick={() => executeWithTrialCheck(() => openAddResourceModal())}
                  size="sm"
                  className="cursor-pointer bg-gradient-to-r from-[#2563EB] to-[#93C5FD] text-white hover:opacity-90"
                >
                  <Plus className="h-4 w-4" />
                  Add Files
                </Button>
              </div>
              <div className="overflow-hidden rounded-md border">
                <div className="overflow-x-auto sm:mx-0">
                  <div className="inline-block min-w-full align-middle">
                    {isDatasetsLoading ? (
                      <div className="flex items-center justify-center w-full py-10">
                        <Spinner />
                      </div>
                    ) : (
                      <Table className="min-w-full">
                        <TableHeader>
                          <TableRow className="bg-muted/50 border-b">
                            <TableHead className="p-3 text-left text-sm whitespace-nowrap text-[#646464]">
                              NAME
                            </TableHead>
                            <TableHead className="p-3 text-left text-sm whitespace-nowrap text-[#646464]">
                              TYPE
                            </TableHead>
                            <TableHead className="p-3 text-left text-sm whitespace-nowrap text-[#646464]">
                              TOKENS
                            </TableHead>
                            <TableHead className="p-3 text-left text-sm whitespace-nowrap text-[#646464]">
                              INTERVAL
                            </TableHead>
                            <TableHead className="p-3 text-left text-sm whitespace-nowrap text-[#646464]">
                              VISIBILITY
                            </TableHead>
                            <TableHead className="p-3 text-left text-sm whitespace-nowrap text-[#646464]">
                              STATUS
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        {/* @ts-expect-error - Type mismatch between RetrieverDocumentEmbedding[] and Dataset[], id property type difference */}
                        <DatasetItemList datasets={datasets?.results ?? []} />
                      </Table>
                    )}
                  </div>
                </div>
              </div>
              <IblPagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
                disabled={isDatasetsFetching || isDatasetsLoading}
              />
              {/* Add Resource Modal */}
              <AddResourceModal
                isOpen={showAddResourceModal}
                onClose={() => closeAddResourceModal()}
                keepParentOpen={true}
              />
              {isModalOpen && FreeTrialDialog && (
                <FreeTrialDialog isOpen={isModalOpen} onClose={closeModal} />
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
