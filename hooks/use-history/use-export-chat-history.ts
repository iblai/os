import { useCallback } from 'react';
import { useParams } from 'next/navigation';
import { format } from 'date-fns';

import { useReports } from '@iblai/iblai-js/web-containers';
import { TenantKeyMentorIdParams } from '@/lib/types';
import { useNavigate } from '@/hooks/user-navigate';
import { ChatHistoryFilter } from '@/hooks/use-history';
import { REPORT_NAME } from '@/lib/constants';

export function useExportChatHistory() {
  const { tenantKey, mentorId } = useParams<TenantKeyMentorIdParams>();
  const { getMentorId } = useNavigate();
  const activeMentorId = getMentorId() || mentorId;

  const { initializeReportDownload, isGenerating } = useReports({
    tenantKey,
    selectedMentorId: activeMentorId,
  });

  const handleExport = useCallback(
    (filters: ChatHistoryFilter) => {
      initializeReportDownload({
        report: {
          report_name: REPORT_NAME,
        },
        autoDownload: true,
        extraRequestBody: {
          end_date: filters.dateRange?.to ? format(filters.dateRange?.to, 'yyyy-MM-dd') : undefined,
          start_date: filters.dateRange?.from
            ? format(filters.dateRange?.from, 'yyyy-MM-dd')
            : undefined,
          sentiment: filters.sentiment,
          topics: filters.topics,
          source:window.location.origin
        },
      });
    },
    [initializeReportDownload],
  );

  return {
    handleExport,
    isExporting: isGenerating,
  };
}
