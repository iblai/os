import { useCallback } from 'react';
import { useParams } from 'next/navigation';
import { format } from 'date-fns';

import { useReports } from '@iblai/web-containers';
import { TenantKeyMentorIdParams } from '@/lib/types';
import { useNavigate } from '@/hooks/user-navigate';
import { ChatHistoryFilter } from '@/hooks/use-history';
import { ANONYMOUS_USERNAME, REPORT_NAME } from '@/lib/constants';
import { useGetMentorPublicSettingsQuery } from '@iblai/iblai-js/data-layer';
import { useUsername } from '../use-user';

export function useExportChatHistory() {
  const { tenantKey, mentorId } = useParams<TenantKeyMentorIdParams>();
  const { getMentorId } = useNavigate();
  const username = useUsername();
  const activeMentorId = getMentorId() || mentorId;

  const { data: mentorPublicSettings } = useGetMentorPublicSettingsQuery({
    mentor: activeMentorId,
    org: tenantKey,
    // @ts-ignore
    userId: username ?? ANONYMOUS_USERNAME,
  });

  const { initializeReportDownload, isGenerating } = useReports({
    tenantKey,
    selectedMentorId: activeMentorId,
    selectedMentorDbId: mentorPublicSettings?.mentor_id
      ? String(mentorPublicSettings.mentor_id)
      : undefined,
  });

  const handleExport = useCallback(
    (filters: ChatHistoryFilter) => {
      initializeReportDownload({
        report: {
          report_name: REPORT_NAME,
        },
        autoDownload: true,
        extraRequestBody: {
          end_date: filters.dateRange?.to
            ? format(filters.dateRange?.to, 'yyyy-MM-dd')
            : undefined,
          start_date: filters.dateRange?.from
            ? format(filters.dateRange?.from, 'yyyy-MM-dd')
            : undefined,
          sentiment: filters.sentiment,
          topics: filters.topics,
          source: window.location.origin,
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
