'use client';

import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface FlaggedPromptsSummaryProps {
  totalFlagged: number;
}

export function FlaggedPromptsSummary({
  totalFlagged,
}: FlaggedPromptsSummaryProps) {
  const t = useTranslations('flaggedPromptsFlaggedPromptsSummary');
  return (
    <div className="rounded-lg border p-4">
      <div className="mb-3 flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-blue-600" />
        <span className="font-semibold text-gray-900">
          {t('totalFlaggedPrompts', { count: totalFlagged })}
        </span>
      </div>
      <p className="text-sm leading-relaxed text-gray-900">
        {t('description')}
      </p>
    </div>
  );
}
