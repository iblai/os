'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';

import { useStartEvalRunMutation } from '@iblai/iblai-js/data-layer';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TenantKeyMentorIdParams } from '@/lib/types';
import { useUsername } from '@/hooks/use-user';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  datasetName: string;
  mentorUniqueId: string;
};

export function StartRunModal({
  isOpen,
  onClose,
  datasetName,
  mentorUniqueId,
}: Props) {
  const { tenantKey } = useParams<TenantKeyMentorIdParams>();
  const username = useUsername();
  const [runName, setRunName] = React.useState('');

  const [startRun, { isLoading }] = useStartEvalRunMutation();

  async function handleStartRun() {
    try {
      await startRun({
        org: tenantKey,
        userId: username ?? '',
        datasetName,
        body: {
          mentor_unique_id: mentorUniqueId,
          run_name: runName.trim() || undefined,
        },
      }).unwrap();
      toast.success('Evaluation run started');
      setRunName('');
      onClose();
    } catch (error) {
      console.error(error);
      toast.error('Failed to start evaluation run');
    }
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="w-full max-w-md">
        <DialogHeader>
          <DialogTitle className="ibl-dialog-title">
            Start Evaluation Run
          </DialogTitle>
          <DialogDescription>
            Run this agent against every item in{' '}
            <span className="font-medium">{datasetName}</span>. Results show up
            in the table once the run completes.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="eval-run-name">Run name (optional)</Label>
            <Input
              id="eval-run-name"
              placeholder="e.g. baseline-v1"
              value={runName}
              onChange={(event) => setRunName(event.target.value)}
              maxLength={255}
              disabled={isLoading}
              autoFocus
            />
          </div>
        </div>
        <DialogFooter className="gap-3">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            className="bg-gradient-to-r from-[#2563EB] to-[#93C5FD] text-white hover:opacity-90"
            onClick={handleStartRun}
            disabled={isLoading}
          >
            {isLoading ? 'Starting...' : 'Start Run'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
