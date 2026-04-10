'use client';

import type React from 'react';
import { useState, useEffect } from 'react';

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
import { Repeat } from 'lucide-react';
import {
  useCreateTrainingDocumentRetrainScheduleMutation,
  useGetTrainingDocumentRetrainScheduleQuery,
} from '@iblai/iblai-js/data-layer';
import { useParams } from 'next/navigation';
import { TenantKeyMentorIdParams } from '@/lib/types';
import { useUsername } from '@/hooks/use-user';
import { toast } from 'sonner';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  dataset: {
    id: string;
    document_name: string;
    url: string;
  };
};

export function RetrainScheduleModal({ isOpen, onClose, dataset }: Props) {
  const username = useUsername();
  const { tenantKey } = useParams<TenantKeyMentorIdParams>();
  const { data, isLoading } = useGetTrainingDocumentRetrainScheduleQuery({
    documentId: dataset.id,
    org: tenantKey,
    // @ts-expect-error
    userId: username,
  });
  const [setRetrainInterval, { isLoading: isSettingRetrainInterval }] =
    useCreateTrainingDocumentRetrainScheduleMutation();

  const [retrainIntervalDays, setRetrainIntervalDays] = useState<number>(
    data?.retrain_interval_days ?? 0,
  );

  // Update state when data is fetched
  useEffect(() => {
    if (
      data?.retrain_interval_days !== undefined &&
      data.retrain_interval_days !== null
    ) {
      setRetrainIntervalDays(data.retrain_interval_days);
    }
  }, [data]);

  const isDisabled = isLoading || isSettingRetrainInterval;

  const activeButtonClass =
    'h-9 px-4 bg-gradient-to-r from-[#2563EB] to-[#93C5FD] text-white hover:text-white hover:opacity-90 border-none';
  const inactiveButtonClass = 'h-9 px-4';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await setRetrainInterval({
        documentId: dataset.id,
        org: tenantKey,
        requestBody: {
          retrain_interval_days: retrainIntervalDays,
        },
      }).unwrap();
      toast.success('Successfully updated retrain interval');
    } catch (error) {
      toast.error('Failed to update retrain interval');
      console.log(error);
      console.error(JSON.stringify({ tenant: tenantKey, error }));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] max-w-[95vw] overflow-x-hidden overflow-y-auto sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle className="ibl-dialog-title">
            Schedule Retraining
          </DialogTitle>
          <DialogDescription className="mt-4 text-left">
            Configure automatic retraining schedule for <br />{' '}
            <span className="font-medium break-all">
              {dataset.document_name || dataset.url}
            </span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          {/* Retrain Interval */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Repeat className="h-4 w-4" />
              Retrain Interval
            </Label>

            {/* Preset Buttons */}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isDisabled}
                onClick={() => setRetrainIntervalDays(1)}
                className={
                  retrainIntervalDays === 1
                    ? activeButtonClass
                    : inactiveButtonClass
                }
              >
                Daily (1 day)
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isDisabled}
                onClick={() => setRetrainIntervalDays(7)}
                className={
                  retrainIntervalDays === 7
                    ? activeButtonClass
                    : inactiveButtonClass
                }
              >
                Weekly (7 days)
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isDisabled}
                onClick={() => setRetrainIntervalDays(30)}
                className={
                  retrainIntervalDays === 30
                    ? activeButtonClass
                    : inactiveButtonClass
                }
              >
                Monthly (30 days)
              </Button>
            </div>

            {/* Custom Days Input */}
            <div className="space-y-2">
              <Label htmlFor="interval-days" className="text-sm font-medium">
                Custom Interval (days)
              </Label>
              <Input
                id="interval-days"
                type="number"
                min="0"
                disabled={isDisabled}
                value={retrainIntervalDays}
                onChange={(e) =>
                  setRetrainIntervalDays(Number.parseInt(e.target.value) || 0)
                }
                className="h-10"
                placeholder="Enter days"
              />
              <p className="text-muted-foreground text-xs">
                Dataset will retrain every {retrainIntervalDays}{' '}
                {retrainIntervalDays === 1 ? 'day' : 'days'}
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onClose()}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="ibl-button-primary"
              disabled={isDisabled}
            >
              Schedule Retraining
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
