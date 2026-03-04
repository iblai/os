import React from 'react';
import { useParams } from 'next/navigation';

import {
  useExportChatHistoryMutation,
  useGetChatHistoryExportStatusQuery,
} from '@iblai/iblai-js/data-layer';
import { REPORT_NAME } from '@/lib/constants';
import { TenantKeyMentorIdParams } from '@/lib/types';
import { useNavigate } from '@/hooks/user-navigate';
import { ChatHistoryFilter } from '@/hooks/use-history';
import { toast } from 'sonner';
import { format } from 'date-fns';

export function useExportChatHistory() {
  const { tenantKey, mentorId } = useParams<TenantKeyMentorIdParams>();
  const [shouldPoll, setShouldPoll] = React.useState(false);
  const { getMentorId } = useNavigate();
  const activeMentorId = getMentorId() || mentorId;

  const [exportChatHistory, { isLoading: isExportChatHistoryLoading, data: exportData }] =
    useExportChatHistoryMutation();

  const { data: exportStatus } = useGetChatHistoryExportStatusQuery(
    {
      key: tenantKey,
      reportName: REPORT_NAME,
      mentorUniqueId: activeMentorId,
    },
    {
      skip: !exportData?.data?.state,
      pollingInterval: shouldPoll ? 2000 : 0,
    },
  );

  React.useEffect(() => {
    if (exportStatus?.data?.status?.state === 'completed') {
      if (exportStatus?.data?.status?.url) {
        window.open(exportStatus?.data?.status?.url, '_blank');
      }
      setShouldPoll(false);
      return;
    }
    if (exportStatus?.data?.status?.state === 'error') {
      setShouldPoll(false);
      toast.error('Failed to export chat history');
      return;
    }
  }, [exportStatus?.data?.status?.state]);

  async function handleExport(filters: ChatHistoryFilter) {
    try {
      await exportChatHistory({
        key: tenantKey,
        requestBody: {
          report_name: REPORT_NAME,
          // @ts-ignore
          end_date: filters.dateRange?.to ? format(filters.dateRange?.to, 'yyyy-MM-dd') : undefined,
          start_date: filters.dateRange?.from
            ? format(filters.dateRange?.from, 'yyyy-MM-dd')
            : undefined,
          // @ts-expect-error setiment not expected
          sentiment: filters.sentiment,
          topics: filters.topics,
          mentor: activeMentorId,
        },
      }).unwrap();
      setShouldPoll(true);
    } catch (error) {
      setShouldPoll(false);
      console.error(JSON.stringify({ tenant: tenantKey, error }));
    }
  }

  const isExporting = isExportChatHistoryLoading || shouldPoll;

  return {
    exportStatus,
    handleExport,
    isExporting,
  };
}
