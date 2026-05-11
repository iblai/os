'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { format } from 'date-fns';
import { Eye, Plus, Trash } from 'lucide-react';

import {
  useGetMentorSettingsQuery,
  useListEvalDatasetsQuery,
  useListEvalRunsQuery,
} from '@iblai/iblai-js/data-layer';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Spinner } from '@/components/spinner';
import IblPagination from '@/components/ibl-pagination';
import { TenantKeyMentorIdParams } from '@/lib/types';
import { useUsername } from '@/hooks/use-user';

import { StartRunModal } from './start-run-modal';
import { RunDetailsModal } from './run-details-modal';
import { DeleteRunModal } from './delete-run-modal';

const PAGE_SIZE = 10;

type RunMetadata = Record<string, unknown> & {
  mentor_unique_id?: string;
};

export function EvaluationTab() {
  const { tenantKey, mentorId } = useParams<TenantKeyMentorIdParams>();
  const username = useUsername();

  const [selectedDataset, setSelectedDataset] = React.useState<string>('');
  const [page, setPage] = React.useState(1);
  const [showStartRunModal, setShowStartRunModal] = React.useState(false);
  const [viewRunName, setViewRunName] = React.useState<string | null>(null);
  const [runToDelete, setRunToDelete] = React.useState<string | null>(null);

  const { data: mentorSettings } = useGetMentorSettingsQuery(
    {
      mentor: mentorId,
      org: tenantKey,
      // @ts-expect-error userId is not part of the typed args but the API accepts it
      userId: username ?? '',
    },
    { skip: !mentorId || !tenantKey || !username },
  );

  const mentorUniqueId = mentorSettings?.mentor_unique_id ?? '';

  const { data: datasetsResponse, isLoading: isDatasetsLoading } =
    useListEvalDatasetsQuery(
      { org: tenantKey, userId: username ?? '', page: 1, limit: 100 },
      { skip: !tenantKey || !username },
    );

  const datasets = datasetsResponse?.data ?? [];

  const {
    data: runsResponse,
    isLoading: isRunsLoading,
    isFetching: isRunsFetching,
  } = useListEvalRunsQuery(
    {
      org: tenantKey,
      userId: username ?? '',
      datasetName: selectedDataset,
      page,
      limit: PAGE_SIZE,
    },
    { skip: !tenantKey || !username || !selectedDataset },
  );

  // Filter runs to ones started against this mentor.
  const filteredRuns = React.useMemo(() => {
    const items = runsResponse?.data ?? [];
    if (!mentorUniqueId) return items;
    return items.filter(
      (run) =>
        (run.metadata as RunMetadata | undefined)?.mentor_unique_id ===
        mentorUniqueId,
    );
  }, [runsResponse?.data, mentorUniqueId]);

  const totalPages = runsResponse?.meta.total_pages ?? 0;

  return (
    <>
      <div className="flex h-[73px] flex-shrink-0 items-center border-b border-gray-200 bg-white p-4 lg:block">
        <div>
          <h3 className="mb-1 text-base font-medium text-gray-900">Evals</h3>
          <p className="text-xs text-gray-600">
            Run this agent against an evaluation dataset and review the results.
          </p>
        </div>
      </div>
      <div
        className="flex-1 space-y-4 p-3 lg:p-4"
        style={{
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div className="w-full sm:w-72">
            <Select
              value={selectedDataset}
              onValueChange={(value) => {
                setSelectedDataset(value);
                setPage(1);
              }}
              disabled={isDatasetsLoading || datasets.length === 0}
            >
              <SelectTrigger aria-label="Select dataset">
                <SelectValue
                  placeholder={
                    isDatasetsLoading
                      ? 'Loading datasets...'
                      : datasets.length === 0
                        ? 'No datasets available'
                        : 'Select a dataset'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {datasets.map((dataset) => (
                  <SelectItem key={dataset.name} value={dataset.name}>
                    {dataset.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={() => setShowStartRunModal(true)}
            disabled={!selectedDataset || !mentorUniqueId}
            className="cursor-pointer bg-gradient-to-r from-[#2563EB] to-[#93C5FD] text-white hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            New Run
          </Button>
        </div>

        {!selectedDataset ? (
          <div className="rounded-md border bg-gray-50 p-6 text-center text-sm text-gray-600">
            Select a dataset to view evaluation runs for this agent. Datasets
            are managed in tenant settings.
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border">
            <div className="overflow-x-auto sm:mx-0">
              <div className="inline-block min-w-full align-middle">
                {isRunsLoading ? (
                  <div className="flex w-full items-center justify-center py-10">
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
                          CREATED
                        </TableHead>
                        <TableHead className="p-3 text-left text-sm whitespace-nowrap text-[#646464]">
                          ITEMS
                        </TableHead>
                        <TableHead
                          className="p-3 text-right text-sm whitespace-nowrap text-[#646464]"
                          aria-label="Actions"
                        >
                          <span className="sr-only">Actions</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRuns.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={4}
                            className="p-6 text-center text-sm text-gray-600"
                          >
                            {isRunsFetching
                              ? 'Loading...'
                              : 'No runs yet for this agent on the selected dataset.'}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredRuns.map((run) => (
                          <TableRow
                            key={run.id}
                            className="text-sm hover:bg-blue-50"
                          >
                            <TableCell className="max-w-0 p-3 text-gray-700">
                              <span className="block truncate font-medium">
                                {run.name}
                              </span>
                            </TableCell>
                            <TableCell className="p-3 whitespace-nowrap text-gray-700">
                              {run.created_at
                                ? format(new Date(run.created_at), 'PPP p')
                                : '—'}
                            </TableCell>
                            <TableCell className="p-3 whitespace-nowrap text-gray-700">
                              {run.dataset_run_items?.length ?? 0}
                            </TableCell>
                            <TableCell className="p-3">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="cursor-pointer"
                                  onClick={() => setViewRunName(run.name)}
                                  aria-label={`View run ${run.name}`}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="cursor-pointer"
                                  onClick={() => setRunToDelete(run.name)}
                                  aria-label={`Delete run ${run.name}`}
                                >
                                  <Trash className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          </div>
        )}

        {selectedDataset && totalPages > 1 && (
          <IblPagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
            disabled={isRunsFetching || isRunsLoading}
          />
        )}
      </div>

      {showStartRunModal && selectedDataset && mentorUniqueId && (
        <StartRunModal
          isOpen={showStartRunModal}
          onClose={() => setShowStartRunModal(false)}
          datasetName={selectedDataset}
          mentorUniqueId={mentorUniqueId}
        />
      )}

      {viewRunName && selectedDataset && (
        <RunDetailsModal
          isOpen={!!viewRunName}
          onClose={() => setViewRunName(null)}
          datasetName={selectedDataset}
          runName={viewRunName}
        />
      )}

      {runToDelete && selectedDataset && (
        <DeleteRunModal
          isOpen={!!runToDelete}
          onClose={() => setRunToDelete(null)}
          datasetName={selectedDataset}
          runName={runToDelete}
        />
      )}
    </>
  );
}
