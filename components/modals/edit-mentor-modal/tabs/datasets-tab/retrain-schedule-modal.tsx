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
import { useTranslations } from 'next-intl';

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
  const t = useTranslations('datasetsTabRetrainScheduleModal');
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
      toast.success(t('toastSuccess'));
    } catch (error) {
      toast.error(t('toastError'));
      console.log(error);
      console.error(JSON.stringify({ tenant: tenantKey, error }));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] max-w-[95vw] overflow-x-hidden overflow-y-auto sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle className="ibl-dialog-title">
            {t('dialogTitle')}
          </DialogTitle>
          <DialogDescription className="mt-4 text-left">
            {t('dialogDescription')} <br />{' '}
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
              {t('retrainIntervalLabel')}
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
                {t('presetDaily')}
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
                {t('presetWeekly')}
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
                {t('presetMonthly')}
              </Button>
            </div>

            {/* Custom Days Input */}
            <div className="space-y-2">
              <Label htmlFor="interval-days" className="text-sm font-medium">
                {t('customIntervalLabel')}
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
                placeholder={t('customIntervalPlaceholder')}
              />
              <p className="text-muted-foreground text-xs">
                {t('retrainIntervalHint', {
                  days: retrainIntervalDays,
                  unit:
                    retrainIntervalDays === 1 ? t('dayUnit') : t('daysUnit'),
                })}
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onClose()}>
              {t('cancelButton')}
            </Button>
            <Button
              type="submit"
              className="ibl-button-primary"
              disabled={isDisabled}
            >
              {t('submitButton')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
