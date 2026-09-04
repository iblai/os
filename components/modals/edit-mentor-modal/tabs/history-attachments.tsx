'use client';

import React from 'react';

import { FileCard } from '@/components/chat/chat-messages/file-card';
import { ImageMessage } from '@/components/chat/chat-messages/image-message';

/**
 * Attachments as they arrive on a chat-history message.
 *
 * `GET /dm/api/ai-analytics/orgs/{org}/users/{user}/chat-history/` returns
 * `human_files` and `ai_files` alongside `human`/`ai` on every message. The
 * generated API client does not model them (`ChatHistoryItem` is only
 * `{ type, content, timestamp }`), and every array observed in the test tenant
 * was empty, so the element shape is not yet confirmed. We therefore accept the
 * plausible spellings — a bare URL string, or an object keyed by any of the
 * usual name/url/content-type variants — and normalize before rendering.
 * Once the real shape is known this can collapse to a single field per value.
 */
export type HistoryFile = string | Record<string, unknown> | null | undefined;

export type NormalizedHistoryFile = {
  url: string;
  fileName: string;
  fileType: string;
};

const IMAGE_EXTENSIONS = [
  'jpg',
  'jpeg',
  'png',
  'gif',
  'svg',
  'webp',
  'bmp',
  'avif',
  'heic',
];

const URL_KEYS = ['url', 'file_url', 'fileUrl', 'download_url', 'src', 'link'];
const NAME_KEYS = ['file_name', 'fileName', 'name', 'filename', 'title'];
const TYPE_KEYS = ['content_type', 'contentType', 'mime_type', 'fileType'];

function firstString(
  source: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

/** Filename from a URL path, ignoring any query string. */
function fileNameFromUrl(url: string): string {
  const path = url.split('?')[0].split('#')[0];
  const last = path.split('/').filter(Boolean).pop() ?? '';
  try {
    return decodeURIComponent(last);
  } catch {
    // A malformed percent-escape shouldn't lose us the whole name.
    return last;
  }
}

function extensionOf(name: string): string {
  const ext = name.split('.').pop() ?? '';
  return ext === name ? '' : ext.toLowerCase();
}

/**
 * Coerce one raw entry into something renderable. Returns `null` when the entry
 * carries neither a url nor a name — there is nothing meaningful to show.
 */
export function normalizeHistoryFile(
  file: HistoryFile,
): NormalizedHistoryFile | null {
  if (typeof file === 'string') {
    const url = file.trim();
    if (!url) return null;
    const fileName = fileNameFromUrl(url) || url;
    return { url, fileName, fileType: inferType(fileName, undefined) };
  }

  if (!file || typeof file !== 'object') return null;

  const url = firstString(file, URL_KEYS) ?? '';
  const fileName =
    firstString(file, NAME_KEYS) ?? (url ? fileNameFromUrl(url) : '');
  if (!url && !fileName) return null;

  return {
    url,
    fileName: fileName || url,
    fileType: inferType(fileName, firstString(file, TYPE_KEYS)),
  };
}

/** Prefer the server's content type; fall back to the file extension. */
function inferType(fileName: string, contentType: string | undefined): string {
  if (contentType) return contentType;
  const ext = extensionOf(fileName);
  if (!ext) return '';
  return IMAGE_EXTENSIONS.includes(ext) ? `image/${ext}` : ext;
}

export function isImageAttachment(file: NormalizedHistoryFile): boolean {
  if (file.fileType.startsWith('image/')) return true;
  // A bare extension survives in fileType when no content type was supplied.
  return IMAGE_EXTENSIONS.includes(extensionOf(file.fileName));
}

export function normalizeHistoryFiles(
  files: HistoryFile[] | null | undefined,
): NormalizedHistoryFile[] {
  if (!Array.isArray(files)) return [];
  return files
    .map(normalizeHistoryFile)
    .filter((file): file is NormalizedHistoryFile => file !== null);
}

type Props = {
  files: HistoryFile[] | null | undefined;
  /** Distinguishes the human/ai keys when both render under one message. */
  idPrefix: string;
};

/**
 * Renders the attachments on one history message: images inline, everything
 * else as a file card. Returns null when there is nothing to show, so callers
 * can drop it in unconditionally.
 */
export function HistoryAttachments({ files, idPrefix }: Props) {
  const normalized = normalizeHistoryFiles(files);
  if (normalized.length === 0) return null;

  return (
    <div className="mt-2 flex flex-col gap-2" data-testid="history-attachments">
      {normalized.map((file, index) => (
        <React.Fragment key={`${idPrefix}-file-${index}`}>
          {isImageAttachment(file) ? (
            <ImageMessage
              url={file.url}
              fileName={file.fileName}
              setPreviewImage={(url) =>
                window.open(url, '_blank', 'noopener,noreferrer')
              }
            />
          ) : (
            <FileCard fileName={file.fileName} fileType={file.fileType} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
