import { format, isSameDay, isSameYear } from 'date-fns';

/**
 * A conversation's timestamp compact enough for a list row, the way mail
 * lists show it (and the SDK's profile History tab): the time for today,
 * "Oct 15" for this year, "Oct 15, 2024" before that. Empty for a missing or
 * invalid value. The full date stays in the conversation preview.
 */
export function formatSessionShortDate(
  value?: string | null,
  now: Date = new Date(),
): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  if (isSameDay(date, now)) return format(date, 'p');
  if (isSameYear(date, now)) return format(date, 'MMM d');
  return format(date, 'MMM d, yyyy');
}
