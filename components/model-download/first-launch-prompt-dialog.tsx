'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Download, X, HardDrive } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useModelDownload } from '@/hooks/use-model-download';

/**
 * Dialog shown on first launch when Ollama is installed but the model is not
 * Prompts user to download the Phi Mini 3 model
 */
export function FirstLaunchPromptDialog() {
  const t = useTranslations('modelDownloadFirstLaunchPromptDialog');
  const {
    shouldShowFirstLaunchPrompt,
    startDownload,
    dismissFirstLaunchPrompt,
  } = useModelDownload();

  const handleDownload = () => {
    dismissFirstLaunchPrompt();
    startDownload();
  };

  const handleLater = () => {
    dismissFirstLaunchPrompt();
  };

  if (!shouldShowFirstLaunchPrompt) {
    return null;
  }

  return (
    <AlertDialog open={shouldShowFirstLaunchPrompt} onOpenChange={handleLater}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="mb-2 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
              <HardDrive className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <AlertDialogTitle>{t('title')}</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="space-y-3 text-left">
            <p>
              {t.rich('description', {
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </p>
            <div className="space-y-2 rounded-lg bg-gray-50 p-3 text-sm dark:bg-gray-800">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">
                  {t('modelSizeLabel')}
                </span>
                <span className="font-medium">{t('modelSizeValue')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">
                  {t('requiredSpaceLabel')}
                </span>
                <span className="font-medium">{t('requiredSpaceValue')}</span>
              </div>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('downloadLaterHint')}
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleLater}>
            <X className="mr-2 h-4 w-4" />
            {t('later')}
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleDownload}>
            <Download className="mr-2 h-4 w-4" />
            {t('downloadNow')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
