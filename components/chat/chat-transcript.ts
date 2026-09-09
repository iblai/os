import type { Message } from '@iblai/iblai-js/web-utils';

/**
 * Labels for a rendered transcript. Supplied by the caller from the i18n
 * catalog so this module stays pure (no React, no next-intl).
 */
export type TranscriptLabels = {
  /** One-line header placed at the top of the file. */
  header: string;
  /** Label for messages authored by the user. */
  roleUser: string;
  /** Label for messages authored by the assistant (usually the mentor name). */
  roleAi: string;
};

const SEPARATOR = '----';

/**
 * Strip inline markdown from a single non-code segment.
 *
 * Links keep their URL — a plain-text transcript has nowhere else to put it.
 */
const flattenInlineSegment = (segment: string): string =>
  segment
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\(([^)]*)\)/g, '$1 ($2)')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2');

/**
 * Flatten one line: inline code spans are unwrapped verbatim, everything else
 * goes through the inline stripper. Splitting on backticks first keeps `*` and
 * `_` inside code from being read as emphasis.
 */
const flattenInline = (line: string): string =>
  line
    .split(/(`[^`]*`)/g)
    .map((segment) =>
      segment.length >= 2 && segment.startsWith('`') && segment.endsWith('`')
        ? segment.slice(1, -1)
        : flattenInlineSegment(segment),
    )
    .join('');

const flattenBlockLine = (line: string): string => {
  let out = line.replace(/^(\s*)#{1,6}\s+/, '$1');
  out = out.replace(/^(\s*)(?:>\s?)+/, '$1');
  out = out.replace(/^(\s*)[-*+]\s+/, '$1- ');
  return flattenInline(out);
};

/**
 * Convert markdown to readable plain text, PRESERVING newlines — the
 * transcript's structure is its line breaks. (Deliberately not
 * `stripMarkdownFormatting` from canvas-utils, which collapses all whitespace
 * to single spaces.)
 */
export const flattenMarkdown = (content: string): string => {
  if (!content) {
    return '';
  }
  let inFence = false;
  return content
    .split('\n')
    .map((line) => {
      if (/^\s*(?:```|~~~)/.test(line)) {
        inFence = !inFence;
        return null;
      }
      return inFence ? line : flattenBlockLine(line);
    })
    .filter((line): line is string => line !== null)
    .join('\n');
};

/** Messages that belong in a transcript: visible, non-system. */
const isTranscribable = (message: Message): boolean =>
  message.visible !== false && message.role !== 'system';

const renderMessage = (message: Message, labels: TranscriptLabels): string => {
  const label = message.role === 'user' ? labels.roleUser : labels.roleAi;
  return `[${label}] ${message.timestamp}\n${flattenMarkdown(message.content)}\n\n${SEPARATOR}\n`;
};

/** Build the plain-text transcript for a whole conversation. */
export const buildTranscript = (
  messages: Message[],
  labels: TranscriptLabels,
): string =>
  `${labels.header}\n\n${messages
    .filter(isTranscribable)
    .map((message) => renderMessage(message, labels))
    .join('\n')}`;

/** Build the plain-text transcript for a single message. */
export const buildMessageTranscript = (
  message: Message,
  labels: TranscriptLabels,
): string => buildTranscript([message], labels);
