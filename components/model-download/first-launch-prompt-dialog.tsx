'use client';

import React from 'react';
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
  const { shouldShowFirstLaunchPrompt, startDownload, dismissFirstLaunchPrompt } =
    useModelDownload();

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
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
              <HardDrive className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <AlertDialogTitle>Download Local AI Model?</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-left space-y-3">
            <p>
              We detected that you have Ollama installed. Would you like to download the{' '}
              <strong>Phi Mini 3</strong> model for local AI processing?
            </p>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Model size:</span>
                <span className="font-medium">~2.4 GB</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Required space:</span>
                <span className="font-medium">5 GB free</span>
              </div>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              You can always download the model later from the navbar menu.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleLater}>
            <X className="h-4 w-4 mr-2" />
            Later
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            Download Now
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
