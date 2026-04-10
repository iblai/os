import { AlertTriangle } from 'lucide-react';

interface FlaggedPromptsSummaryProps {
  totalFlagged: number;
}

export function FlaggedPromptsSummary({
  totalFlagged,
}: FlaggedPromptsSummaryProps) {
  return (
    <div className="rounded-lg border p-4">
      <div className="mb-3 flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-blue-600" />
        <span className="font-semibold text-gray-900">
          {totalFlagged} Total Flagged Prompts
        </span>
      </div>
      <p className="text-sm leading-relaxed text-gray-900">
        Review prompts that have been flagged by our automated moderation and
        safety systems. Each flagged prompt includes the user's information, the
        flagged content, and the system's analysis. Use the contact feature to
        reach out to users directly through the notification system for
        follow-up or clarification.
      </p>
    </div>
  );
}
