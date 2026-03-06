'use client';

import React from 'react';

import { Search, Plus } from 'lucide-react';

import { Table, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DatasetItemList } from './dataset-item-list';
import IblPagination from '@/components/ibl-pagination';
import { useDatasetsWithPagination } from '@/hooks/use-datasets';
import { useShowFreeTrialDialog } from '@/hooks/user-user-actions';
import { AddResourceModal } from '@/components/modals/edit-mentor-modal/tabs/datasets-tab/add-resource-modal';
import { Spinner } from '@/components/spinner';
import type { Dataset } from './dataset-item';

interface DatasetsTabProps {
  onSelect?: (dataset: Dataset) => void;
  selectedDatasetId?: string;
}

export function DatasetsTab({ onSelect, selectedDatasetId }: DatasetsTabProps = {}) {
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
      <div className="lg:block flex-shrink-0 p-4 border-b border-gray-200 bg-white h-[73px] flex items-center">
        <div>
          <h3 className="text-base font-medium text-gray-900 mb-1">Datasets</h3>
          <p className="text-gray-600 text-xs">Manage training datasets and knowledge sources.</p>
        </div>
      </div>
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
              Add Resource
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
                    <DatasetItemList
                      // @ts-ignore - Type mismatch between RetrieverDocumentEmbedding[] and Dataset[], id property type difference
                      datasets={datasets?.results ?? []}
                      onSelect={onSelect}
                      selectedDatasetId={selectedDatasetId}
                    />
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
    </>
  );
}