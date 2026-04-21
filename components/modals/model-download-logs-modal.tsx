'use client';

import React, { useEffect, useRef } from 'react';
import { Trash2, Download } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useModelDownload } from '@/hooks/use-model-download';
import { InstallationLog } from '@/types/tauri';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

function LogEntry({ log }: { log: InstallationLog }) {
  const levelStyles: Record<string, string> = {
    info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    warn: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    error: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  };

  const timestamp = new Date(log.timestamp).toLocaleTimeString();

  return (
    <div className="flex items-start gap-2 border-b border-gray-100 py-2 last:border-0 dark:border-gray-800">
      <Badge
        variant="outline"
        className={`shrink-0 text-xs ${levelStyles[log.level] || ''}`}
      >
        {log.level.toUpperCase()}
      </Badge>
      <span className="shrink-0 font-mono text-xs text-gray-400 dark:text-gray-500">
        {timestamp}
      </span>
      <span className="text-sm break-all text-gray-700 dark:text-gray-300">
        {log.message}
      </span>
    </div>
  );
}

/**
 * Modal for displaying detailed installation logs
 */
export function ModelDownloadLogsModal({ isOpen, onClose }: Props) {
  const { state, clearLogs } = useModelDownload();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (scrollRef.current && isOpen) {
      const scrollElement = scrollRef.current.querySelector(
        '[data-radix-scroll-area-viewport]',
      );
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [state.logs.length, isOpen]);

  const handleExportLogs = () => {
    const logText = state.logs
      .map(
        (log) =>
          `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}`,
      )
      .join('\n');

    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `model-download-logs-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[80vh] max-w-2xl">
        <DialogHeader>
          <DialogTitle>Model Installation Logs</DialogTitle>
          <DialogDescription>
            Detailed logs for the Phi Mini 3 model download process.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {state.logs.length} log{' '}
            {state.logs.length === 1 ? 'entry' : 'entries'}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportLogs}
              disabled={state.logs.length === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearLogs}
              disabled={state.logs.length === 0}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Clear
            </Button>
          </div>
        </div>

        <ScrollArea
          className="h-[400px] rounded-md border bg-gray-50 p-4 dark:bg-gray-900"
          ref={scrollRef}
        >
          {state.logs.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              No logs available. Start a download to see logs.
            </p>
          ) : (
            <div className="space-y-1">
              {state.logs.map((log, index) => (
                <LogEntry key={`${log.timestamp}-${index}`} log={log} />
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Status indicator */}
        {state.status === 'downloading' && (
          <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500"></span>
            </span>
            Download in progress... ({Math.round(state.progress)}%)
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
