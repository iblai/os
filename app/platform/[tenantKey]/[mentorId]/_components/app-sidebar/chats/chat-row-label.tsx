'use client';

import {
  getCurrentArtifactTitle,
  getFirstHumanMessageWithContent,
  getFirstMessageWithContent,
} from '@/lib/utils';

export type ChatRow = {
  session_id: string;
  title?: string | null;
  mentor?: { unique_id?: string | null; profile_image?: string | null } | null;
  messages?: unknown;
};

// Single-line label for a chat row: the session title, then the user's first
// message, then any first message, then an artifact title. Whitespace/newlines
// are collapsed so the row always truncates to one line.
export function chatRowLabel(row: ChatRow, noContentLabel: string): string {
  const title = typeof row.title === 'string' ? row.title.trim() : '';
  const messages = (row.messages as unknown[]) ?? [];
  const content =
    title ||
    getFirstHumanMessageWithContent(messages as never) ||
    getFirstMessageWithContent(messages as never) ||
    getCurrentArtifactTitle(messages as never) ||
    '';
  const oneLine = content.replace(/\s+/g, ' ').trim();
  return oneLine || noContentLabel;
}
