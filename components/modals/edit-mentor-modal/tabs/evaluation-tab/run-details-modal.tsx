'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { format } from 'date-fns';

import {
  useGetEvalRunQuery,
  useListEvalScoresQuery,
} from '@iblai/iblai-js/data-layer';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Spinner } from '@/components/spinner';
import { TenantKeyMentorIdParams } from '@/lib/types';
import { useUsername } from '@/hooks/use-user';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  datasetName: string;
  runName: string;
};

export function RunDetailsModal({
  isOpen,
  onClose,
  datasetName,
  runName,
}: Props) {
  const { tenantKey } = useParams<TenantKeyMentorIdParams>();
  const username = useUsername();

  const { data: run, isLoading: isRunLoading } = useGetEvalRunQuery(
    {
      org: tenantKey,
      userId: username ?? '',
      datasetName,
      runName,
    },
    { skip: !tenantKey || !username || !isOpen },
  );

  const { data: scoresResponse, isLoading: isScoresLoading } =
    useListEvalScoresQuery(
      {
        org: tenantKey,
        userId: username ?? '',
        dataset_run_id: run?.id,
        page: 1,
        limit: 100,
      },
      { skip: !tenantKey || !username || !run?.id },
    );

  const scoresByTrace = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const score of scoresResponse?.data ?? []) {
      map.set(score.trace_id, score.value);
    }
    return map;
  }, [scoresResponse?.data]);

  const items = run?.dataset_run_items ?? [];
  const isLoading = isRunLoading || isScoresLoading;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="w-full max-w-4xl">
        <DialogHeader>
          <DialogTitle className="ibl-dialog-title">{runName}</DialogTitle>
          <DialogDescription>
            {run?.created_at
              ? `Started ${format(new Date(run.created_at), 'PPP p')}`
              : 'Evaluation run details and per-item scores.'}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto rounded-md border">
          {isLoading ? (
            <div className="flex w-full items-center justify-center py-10">
              <Spinner />
            </div>
          ) : items.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-600">
              This run has no items yet. It may still be in progress.
            </div>
          ) : (
            <Table className="min-w-full">
              <TableHeader>
                <TableRow className="bg-muted/50 border-b">
                  <TableHead className="p-3 text-left text-sm text-[#646464]">
                    DATASET ITEM
                  </TableHead>
                  <TableHead className="p-3 text-left text-sm text-[#646464]">
                    TRACE
                  </TableHead>
                  <TableHead className="p-3 text-left text-sm text-[#646464]">
                    SCORE
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id} className="text-sm">
                    <TableCell className="max-w-0 p-3 text-gray-700">
                      <span className="block truncate">
                        {item.dataset_item_id}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-0 p-3 text-gray-700">
                      <span className="block truncate">{item.trace_id}</span>
                    </TableCell>
                    <TableCell className="p-3 whitespace-nowrap text-gray-700">
                      {scoresByTrace.has(item.trace_id)
                        ? scoresByTrace.get(item.trace_id)
                        : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
