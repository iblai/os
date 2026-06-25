'use client';

export const dynamic = 'force-dynamic';

import { AnalyticsReportDownload } from '@iblai/web-containers';
import { useParams } from 'next/navigation';

export default function ReportDownloadPage() {
  const { tenantKey, reportName } = useParams<{
    tenantKey: string;
    reportName: string;
  }>();

  return (
    <AnalyticsReportDownload
      platform_key={tenantKey}
      report_name={reportName}
    />
  );
}
