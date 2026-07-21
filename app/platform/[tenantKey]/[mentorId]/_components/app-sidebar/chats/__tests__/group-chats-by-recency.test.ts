import { describe, it, expect } from 'vitest';

import { groupChatRowsByRecency } from '../group-chats-by-recency';
import type { ChatRow } from '../chat-row-label';

const NOW = new Date('2026-07-02T12:00:00.000Z').getTime();

const rowAt = (id: string, daysAgo: number | null): ChatRow => ({
  session_id: id,
  messages:
    daysAgo === null
      ? []
      : [
          {
            inserted_at: new Date(
              NOW - daysAgo * 24 * 60 * 60 * 1000,
            ).toISOString(),
          },
        ],
});

describe('groupChatRowsByRecency', () => {
  it('buckets rows into last7 / last30 / older by latest message age', () => {
    const rows = [
      rowAt('a', 2), // last7
      rowAt('b', 7), // last7 (boundary inclusive)
      rowAt('c', 15), // last30
      rowAt('d', 30), // last30 (boundary inclusive)
      rowAt('e', 45), // older
    ];
    const groups = groupChatRowsByRecency(rows, NOW);
    expect(groups.map((g) => g.key)).toEqual(['last7', 'last30', 'older']);
    expect(groups[0].rows.map((r) => r.session_id)).toEqual(['a', 'b']);
    expect(groups[1].rows.map((r) => r.session_id)).toEqual(['c', 'd']);
    expect(groups[2].rows.map((r) => r.session_id)).toEqual(['e']);
  });

  it('omits empty buckets and preserves order', () => {
    const groups = groupChatRowsByRecency([rowAt('a', 3), rowAt('b', 50)], NOW);
    expect(groups.map((g) => g.key)).toEqual(['last7', 'older']);
  });

  it('places rows with no timestamp into older', () => {
    const groups = groupChatRowsByRecency([rowAt('a', null)], NOW);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe('older');
  });

  it('returns an empty array for no rows', () => {
    expect(groupChatRowsByRecency([], NOW)).toEqual([]);
  });
});
