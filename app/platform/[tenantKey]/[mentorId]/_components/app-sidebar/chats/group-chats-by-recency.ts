import { getLatestMessageTimestamp } from '@/lib/utils';

import { ChatRow } from './chat-row-label';

export type ChatRecencyGroupKey = 'last7' | 'last30' | 'older';

export type ChatRecencyGroup = {
  key: ChatRecencyGroupKey;
  rows: ChatRow[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

// Bucket chat rows by last-activity recency, derived from each row's latest
// message timestamp. Rows without a timestamp fall into "older". Buckets are
// returned in order and empty ones are omitted.
export function groupChatRowsByRecency(
  rows: ChatRow[],
  nowMs: number,
): ChatRecencyGroup[] {
  const last7: ChatRow[] = [];
  const last30: ChatRow[] = [];
  const older: ChatRow[] = [];

  for (const row of rows) {
    const ts = getLatestMessageTimestamp((row.messages as any[]) ?? []);
    const ageDays = ts === null ? Infinity : (nowMs - ts) / DAY_MS;
    if (ageDays <= 7) last7.push(row);
    else if (ageDays <= 30) last30.push(row);
    else older.push(row);
  }

  return [
    { key: 'last7' as const, rows: last7 },
    { key: 'last30' as const, rows: last30 },
    { key: 'older' as const, rows: older },
  ].filter((group) => group.rows.length > 0);
}
