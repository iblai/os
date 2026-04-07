'use client';

import React, { useState } from 'react';
import {
  Download,
  CheckCircle,
  XCircle,
  Loader2,
  HardDrive,
  RefreshCw,
  X,
  Terminal,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useModelDownload } from '@/hooks/use-model-download';
import { ModelDownloadState, OsType } from '@/types/tauri';
import { ModelDownloadLogsModal } from '@/components/modals/model-download-logs-modal';

interface StatusBadgeProps {
  status: ModelDownloadState['status'];
  progress: number;
  osType: OsType | null;
}

function StatusBadge({ status, progress, osType }: StatusBadgeProps) {
  // On Windows, don't show percentage - just show "Downloading..."
  const isWindows = osType === 'windows';

  switch (status) {
    case 'downloading':
      return (
        <Badge variant="secondary" className="gap-1 text-xs">
          <Loader2 className="h-3 w-3 animate-spin" />
          {isWindows ? 'Downloading...' : `${Math.round(progress)}%`}
        </Badge>
      );
    case 'completed':
      return (
        <Badge variant="default" className="gap-1 bg-green-500 text-xs">
          <CheckCircle className="h-3 w-3" />
          Ready
        </Badge>
      );
    case 'error':
      return (
        <Badge variant="destructive" className="gap-1 text-xs">
          <XCircle className="h-3 w-3" />
          Error
        </Badge>
      );
    case 'cancelled':
      return (
        <Badge variant="outline" className="gap-1 text-xs">
          <X className="h-3 w-3" />
          Cancelled
        </Badge>
      );
    case 'checking':
      return (
        <Badge variant="secondary" className="gap-1 text-xs">
          <Loader2 className="h-3 w-3 animate-spin" />
          Checking
        </Badge>
      );
    default:
      return null;
  }
}

/**
 * Model download status indicator for the navbar
 * Shows download progress and provides controls for managing local AI model
 */
export function ModelDownloadStatus() {
  const {
    isAvailable,
    state,
    ollamaStatus,
    osType,
    startDownload,
    cancelDownload,
    installOllama,
    checkStatus,
    resetState,
  } = useModelDownload();

  const [showDetails, setShowDetails] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);

  // Don't render if not in Tauri app
  if (!isAvailable) {
    return null;
  }

  const showDownloadButton =
    (state.status === 'idle' ||
      state.status === 'cancelled' ||
      state.status === 'error') &&
    ollamaStatus?.installed &&
    !ollamaStatus?.model_installed;

  const showInstallOllamaButton =
    ollamaStatus !== null && !ollamaStatus?.installed;
  const isDownloading = state.status === 'downloading';
  const isWindows = osType === 'windows';

  return (
    <>
      <DropdownMenu open={showDetails} onOpenChange={setShowDetails}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative"
                aria-label="Local AI model status"
              >
                <HardDrive className="h-5 w-5" />
                {/* Status indicator dot */}
                {state.status === 'downloading' && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-blue-500"></span>
                  </span>
                )}
                {state.status === 'completed' && (
                  <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-green-500" />
                )}
                {state.status === 'error' && (
                  <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-red-500" />
                )}
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">Local AI Model</TooltipContent>
        </Tooltip>

        <DropdownMenuContent align="end" className="w-[320px] p-4">
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">Phi Mini 3 Model</h4>
              <StatusBadge
                status={state.status}
                progress={state.progress}
                osType={osType}
              />
            </div>

            {/* Model Manager Status */}
            <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
              <div className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${
                    ollamaStatus?.installed ? 'bg-green-500' : 'bg-red-500'
                  }`}
                />
                <span>
                  Model Manager:{' '}
                  {ollamaStatus?.installed ? 'Installed' : 'Not installed'}
                </span>
              </div>
              {ollamaStatus?.installed && (
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      ollamaStatus?.running ? 'bg-green-500' : 'bg-yellow-500'
                    }`}
                  />
                  <span>
                    Service: {ollamaStatus?.running ? 'Running' : 'Stopped'}
                  </span>
                </div>
              )}
            </div>

            {/* Progress Bar - hidden on Windows */}
            {isDownloading && !isWindows && (
              <div className="space-y-2">
                <Progress value={state.progress} className="h-2" />
                <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                  {state.message}
                </p>
              </div>
            )}
            {/* Simple downloading message on Windows */}
            {isDownloading && isWindows && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {state.message}
              </p>
            )}

            {/* Error Message */}
            {state.status === 'error' && state.error && (
              <div className="rounded bg-red-50 p-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                {state.error}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              {showInstallOllamaButton && (
                <Button onClick={installOllama} size="sm" className="flex-1">
                  <Download className="mr-2 h-4 w-4" />
                  Install Model Manager
                </Button>
              )}

              {showDownloadButton && (
                <Button onClick={startDownload} size="sm" className="flex-1">
                  <Download className="mr-2 h-4 w-4" />
                  Download Model
                </Button>
              )}

              {isDownloading && (
                <Button
                  onClick={cancelDownload}
                  variant="outline"
                  size="sm"
                  className="flex-1"
                >
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
              )}

              {(state.status === 'completed' ||
                state.status === 'error' ||
                state.status === 'cancelled') && (
                <Button onClick={checkStatus} variant="outline" size="sm">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </Button>
              )}

              {state.status === 'error' && (
                <Button onClick={resetState} variant="ghost" size="sm">
                  Reset
                </Button>
              )}
            </div>

            {/* View Logs Link */}
            {state.logs.length > 0 && (
              <button
                onClick={() => {
                  setShowDetails(false);
                  setShowLogsModal(true);
                }}
                className="flex items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
              >
                <Terminal className="h-3 w-3" />
                View logs ({state.logs.length})
              </button>
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Logs Modal */}
      <ModelDownloadLogsModal
        isOpen={showLogsModal}
        onClose={() => setShowLogsModal(false)}
      />
    </>
  );
}
