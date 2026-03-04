import { htmlToMarkdown } from '@/lib/utils';

/**
 * Resolve artifact ID from multiple sources with priority order
 * Priority: direct artifactId prop > metadata > currentArtifact
 */
export const resolveArtifactIdFromSources = (
  artifactId: number | undefined,
  metadataId: number | undefined,
  currentArtifactId: number | undefined,
): number | undefined => {
  if (typeof artifactId === 'number' && Number.isFinite(artifactId)) {
    return artifactId;
  }
  if (metadataId) return metadataId;
  if (currentArtifactId) return currentArtifactId;
  return undefined;
};

/**
 * Result type for shouldProcessEditorChange
 */
export type EditorChangeDecision = {
  shouldProcess: boolean;
  shouldMarkEdited: boolean;
  reason: 'suppressed' | 'not_initialized' | 'not_viewing_current' | 'unchanged' | 'process';
};

/**
 * Determine if an editor change should be processed and saved
 */
export const shouldProcessEditorChange = (
  suppressNextOnChange: boolean,
  hasInitializedEditor: boolean,
  isViewingCurrentVersion: boolean,
  markdownTrimmed: string,
  lastSavedMarkdownTrimmed: string,
): EditorChangeDecision => {
  if (suppressNextOnChange) {
    return { shouldProcess: false, shouldMarkEdited: false, reason: 'suppressed' };
  }

  if (!hasInitializedEditor) {
    return { shouldProcess: false, shouldMarkEdited: false, reason: 'not_initialized' };
  }

  if (!isViewingCurrentVersion) {
    return { shouldProcess: false, shouldMarkEdited: false, reason: 'not_viewing_current' };
  }

  if (markdownTrimmed === lastSavedMarkdownTrimmed) {
    return { shouldProcess: false, shouldMarkEdited: false, reason: 'unchanged' };
  }

  return { shouldProcess: true, shouldMarkEdited: true, reason: 'process' };
};

/**
 * Result type for highlight input key handler
 */
export type HighlightKeyAction = { action: 'submit' } | { action: 'dismiss' } | { action: 'none' };

/**
 * Determine action based on key press in highlight input
 */
export const getHighlightInputKeyAction = (key: string): HighlightKeyAction => {
  if (key === 'Enter') {
    return { action: 'submit' };
  }
  if (key === 'Escape') {
    return { action: 'dismiss' };
  }
  return { action: 'none' };
};

/**
 * Sanitize a filename by removing invalid characters
 */
export const sanitizeFilename = (name: string): string => {
  const sanitized = name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim();
  if (!sanitized) {
    return 'artifact';
  }
  return sanitized.slice(0, 120);
};

/**
 * Escape HTML special characters
 */
export const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/**
 * Normalize content to markdown format - converts HTML to markdown if needed
 */
export const normalizeContentToMarkdown = (content?: string): string => {
  if (!content) return '';
  const trimmed = content.trim();
  if (trimmed.startsWith('<')) {
    return htmlToMarkdown(trimmed);
  }
  return trimmed;
};

/**
 * Get initial editor content - converts HTML to markdown if needed
 */
export const getInitialEditorContent = (content?: string): string => {
  if (content && content.trim() !== '') {
    const trimmed = content.trim();
    if (trimmed.startsWith('<')) {
      return htmlToMarkdown(trimmed);
    }
    return trimmed;
  }
  return '';
};

/**
 * Safely parse a value as a Record object
 */
export const safeParseRecord = (value: unknown): Record<string, unknown> | undefined => {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch (error) {
      console.error('[Canvas] Failed to parse artifact metadata payload', error);
    }
    return undefined;
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
};

/**
 * Merge multiple Record objects into one
 */
export const mergeRecords = (
  ...sources: Array<Record<string, unknown> | undefined>
): Record<string, unknown> | undefined => {
  const merged: Record<string, unknown> = {};
  let hasValues = false;

  sources.forEach((source) => {
    if (!source) return;
    Object.entries(source).forEach(([key, value]) => {
      if (value !== undefined) {
        merged[key] = value;
        hasValues = true;
      }
    });
  });

  return hasValues ? merged : undefined;
};

/**
 * Find a value by key in a nested object structure (BFS search)
 */
export const findValueByKey = (
  root: Record<string, unknown> | undefined,
  keyCandidates: string[],
): unknown => {
  if (!root) {
    return undefined;
  }

  const normalizedKeys = keyCandidates.map((key) => key.toLowerCase());
  const queue: Array<Record<string, unknown>> = [root];
  const visited = new Set<Record<string, unknown>>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current)) {
      continue;
    }
    visited.add(current);

    for (const [key, value] of Object.entries(current)) {
      if (normalizedKeys.includes(key.toLowerCase())) {
        if (value !== undefined && value !== null && value !== '') {
          return value;
        }
      }

      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        queue.push(value as Record<string, unknown>);
      }
    }
  }

  return undefined;
};

/**
 * Coerce a value to a number if possible
 */
export const coerceNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed) {
      const parsed = Number(trimmed);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return undefined;
};

/**
 * Coerce a value to a non-empty string if possible
 */
export const coerceString = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  return undefined;
};

/**
 * Strip markdown formatting characters to get plain text
 */
const stripMarkdownFormatting = (text: string): string => {
  return (
    text
      // Remove bold/italic markers
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/_([^_]+)_/g, '$1')
      // Remove inline code
      .replace(/`([^`]+)`/g, '$1')
      // Remove links, keep text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Remove heading markers but keep text
      .replace(/^#{1,6}\s+/gm, '')
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      .trim()
  );
};

/**
 * Find text in markdown accounting for formatting differences
 */
const findTextInMarkdown = (
  searchText: string,
  markdown: string,
): { start: number; end: number } | null => {
  // Strip formatting from search text (in case it has HTML artifacts)
  const cleanSearchText = stripMarkdownFormatting(searchText);
  if (!cleanSearchText) return null;

  // Try to find the text by sliding a window over the markdown
  // and checking if stripped versions match
  const words = cleanSearchText.split(/\s+/);
  const firstWord = words[0];

  // Find potential starting positions (where first word might be)
  let searchStart = 0;
  while (searchStart < markdown.length) {
    // Look for the first word in remaining markdown
    const strippedRemaining = stripMarkdownFormatting(markdown.slice(searchStart));
    const wordIndex = strippedRemaining.toLowerCase().indexOf(firstWord.toLowerCase());

    if (wordIndex === -1) break;

    // Map back to original markdown position
    // We need to find where this stripped position corresponds to in original
    let strippedPos = 0;
    let originalPos = searchStart;

    while (strippedPos < wordIndex && originalPos < markdown.length) {
      const char = markdown[originalPos];
      // Skip markdown formatting characters
      if (char === '*' || char === '_' || char === '`' || char === '#') {
        originalPos++;
        continue;
      }
      if (char === '[') {
        // Skip link syntax
        const linkEnd = markdown.indexOf(')', originalPos);
        if (linkEnd > originalPos) {
          // Find the ] to get just the text part
          const bracketEnd = markdown.indexOf(']', originalPos);
          if (bracketEnd > originalPos && bracketEnd < linkEnd) {
            // Include the link text
            originalPos++;
            continue;
          }
        }
      }
      strippedPos++;
      originalPos++;
    }

    // Now try to match the full text from this position
    const candidateStart = originalPos;
    let candidateEnd = candidateStart;

    // Find where the selection ends in original markdown
    const selectionWords = cleanSearchText.split(/\s+/);
    let matchedWords = 0;
    let currentPos = candidateStart;

    while (currentPos < markdown.length && matchedWords < selectionWords.length) {
      // Skip whitespace and formatting in markdown
      while (
        currentPos < markdown.length &&
        (/\s/.test(markdown[currentPos]) ||
          markdown[currentPos] === '*' ||
          markdown[currentPos] === '_')
      ) {
        currentPos++;
      }

      // Try to match current word
      const targetWord = selectionWords[matchedWords];
      let wordMatched = true;

      for (let i = 0; i < targetWord.length && currentPos < markdown.length; i++) {
        // Skip inline formatting
        while (
          currentPos < markdown.length &&
          (markdown[currentPos] === '*' ||
            markdown[currentPos] === '_' ||
            markdown[currentPos] === '`')
        ) {
          currentPos++;
        }

        if (currentPos >= markdown.length) {
          wordMatched = false;
          break;
        }

        if (markdown[currentPos].toLowerCase() !== targetWord[i].toLowerCase()) {
          wordMatched = false;
          break;
        }
        currentPos++;
      }

      if (wordMatched) {
        matchedWords++;
        candidateEnd = currentPos;
      } else {
        break;
      }
    }

    // If we matched all words, we found it
    if (matchedWords === selectionWords.length) {
      return { start: candidateStart, end: candidateEnd };
    }

    // Try next position
    searchStart = originalPos + 1;
  }

  return null;
};

/**
 * Calculate markdown indices from selected text
 * This is crucial for partial updates to work correctly
 * The selected text comes from HTML but we need to find it in markdown
 */
export const calculateMarkdownIndices = (
  selectedTextStr: string,
  markdownContent: string,
): { start: number; end: number } | null => {
  if (!selectedTextStr || !markdownContent) return null;

  // Try direct match first (works if text is identical)
  let startIndex = markdownContent.indexOf(selectedTextStr);
  if (startIndex >= 0) {
    return { start: startIndex, end: startIndex + selectedTextStr.length };
  }

  // Try with normalized whitespace
  const normalizedSelected = selectedTextStr.replace(/\s+/g, ' ').trim();
  startIndex = markdownContent.indexOf(normalizedSelected);
  if (startIndex >= 0) {
    return { start: startIndex, end: startIndex + normalizedSelected.length };
  }

  // Use smart matching that accounts for markdown formatting
  const smartMatch = findTextInMarkdown(selectedTextStr, markdownContent);
  if (smartMatch) {
    return smartMatch;
  }

  // Fallback: try to find using first and last significant words
  const words = normalizedSelected.split(/\s+/).filter((w) => w.length > 2);
  if (words.length >= 2) {
    const firstWord = words[0];
    const lastWord = words[words.length - 1];

    // Find first word
    const firstWordIndex = markdownContent.toLowerCase().indexOf(firstWord.toLowerCase());
    if (firstWordIndex >= 0) {
      // Find last word after first word
      const searchAfter = firstWordIndex + firstWord.length;
      const lastWordIndex = markdownContent
        .toLowerCase()
        .indexOf(lastWord.toLowerCase(), searchAfter);

      if (lastWordIndex > firstWordIndex) {
        return {
          start: firstWordIndex,
          end: lastWordIndex + lastWord.length,
        };
      }
    }
  }

  // Last resort: fuzzy match with first part of text
  const firstChunk = normalizedSelected.slice(0, Math.min(50, normalizedSelected.length));
  const strippedChunk = stripMarkdownFormatting(firstChunk);
  const strippedMarkdown = stripMarkdownFormatting(markdownContent);

  const fuzzyIndex = strippedMarkdown.indexOf(strippedChunk);
  if (fuzzyIndex >= 0) {
    // Map fuzzy index back to original markdown (approximate)
    const ratio = markdownContent.length / strippedMarkdown.length;
    const approxStart = Math.floor(fuzzyIndex * ratio);
    const approxEnd = Math.min(
      Math.floor((fuzzyIndex + normalizedSelected.length) * ratio),
      markdownContent.length,
    );
    return { start: approxStart, end: approxEnd };
  }

  return null;
};

/**
 * Strip HTML and get plain text
 */
export const stripHtml = (html: string): string => {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
};

/**
 * Split text into lines that fit within a given width for PDF export
 */
export const splitTextIntoLines = (text: string, maxWidth: number, pdf: any): string[] => {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  words.forEach((word) => {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = pdf.getTextWidth(testLine);

    if (testWidth > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
};
