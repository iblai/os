/**
 * Utilities for binary artifacts — files the agent shares from its sandbox VM
 * (pdf, xlsx, zip, …). The backend marks them with `is_binary` / `mime_type`
 * and serves the bytes base64-encoded in `binary_content` on the artifact
 * detail endpoint only (streamed and embedded payloads null it out), so the
 * bytes are always fetched from the REST detail endpoint on demand.
 */

import type { Artifact } from '@iblai/iblai-api';

/**
 * Runtime-only fields the API returns on artifacts but that the pinned
 * `@iblai/iblai-api` model predates. Intersect with `Artifact` when reading.
 */
export type BinaryArtifactApiFields = {
  is_binary?: boolean;
  mime_type?: string | null;
  binary_content?: string | null;
};

export type ArtifactWithBinaryFields = Artifact & BinaryArtifactApiFields;

/**
 * Extensions the backend can produce as binary artifacts, mapped to their
 * mime types. Text extensions (md, py, html, …) intentionally absent: those
 * keep the regular text-canvas flow. Images are not artifacts (they stay
 * download links), but are mapped defensively.
 */
const BINARY_EXTENSION_MIME_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  zip: 'application/zip',
  gz: 'application/gzip',
  tar: 'application/x-tar',
  '7z': 'application/x-7z-compressed',
  rar: 'application/vnd.rar',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  odt: 'application/vnd.oasis.opendocument.text',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  odp: 'application/vnd.oasis.opendocument.presentation',
  epub: 'application/epub+zip',
  sqlite: 'application/vnd.sqlite3',
  db: 'application/vnd.sqlite3',
  parquet: 'application/vnd.apache.parquet',
  bin: 'application/octet-stream',
  exe: 'application/octet-stream',
  wasm: 'application/wasm',
  // svg is text on the wire (is_binary=false, bytes in `content`), but it
  // must render in the image viewer, not the rich-text editor — see
  // shouldUseBinaryCanvas / artifactFileToBlob.
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
};

/**
 * Mime types the side canvas can actually display: PDFs via the browser's
 * embedded viewer, images via an `<img>` preview. Text formats (txt, md,
 * svg, …) never reach this path — they arrive as text artifacts and open in
 * the regular editable canvas. Formats browsers cannot render natively
 * (docx, xlsx, zip, …) get the Download flow instead.
 */
const isCanvasRenderableMimeType = (mime: string): boolean =>
  mime === 'application/pdf' || mime.startsWith('image/');

const normalizeExtension = (fileExtension?: string | null): string =>
  (fileExtension ?? '').trim().toLowerCase().replace(/^\./, '');

/** Best-effort mime type for a binary artifact. */
export const resolveBinaryMimeType = (
  fileExtension?: string | null,
  mimeType?: string | null,
): string | undefined => {
  if (mimeType && mimeType.trim()) return mimeType.trim();
  return BINARY_EXTENSION_MIME_TYPES[normalizeExtension(fileExtension)];
};

/**
 * Whether an artifact is binary. The explicit `is_binary` flag (REST) wins;
 * live stream events don't carry it, so fall back to the extension map.
 */
export const isBinaryArtifact = (info: {
  isBinary?: boolean | null;
  mimeType?: string | null;
  fileExtension?: string | null;
}): boolean => {
  if (typeof info.isBinary === 'boolean') return info.isBinary;
  if (info.mimeType && info.mimeType.trim()) {
    const mime = info.mimeType.trim().toLowerCase();
    return !mime.startsWith('text/') && mime !== 'application/json';
  }
  return normalizeExtension(info.fileExtension) in BINARY_EXTENSION_MIME_TYPES;
};

/**
 * Whether a binary artifact can be shown in the side canvas ("Open Canvas")
 * rather than only exported ("Download").
 */
export const canOpenBinaryInCanvas = (info: {
  mimeType?: string | null;
  fileExtension?: string | null;
}): boolean => {
  const mime = resolveBinaryMimeType(info.fileExtension, info.mimeType);
  return mime !== undefined && isCanvasRenderableMimeType(mime);
};

/** Whether a mime type should render as an image preview in the canvas. */
export const isImageMimeType = (mimeType?: string | null): boolean =>
  Boolean(mimeType && mimeType.trim().toLowerCase().startsWith('image/'));

/**
 * Whether an artifact belongs in the read-only binary canvas rather than the
 * rich-text editor. This is `isBinaryArtifact` plus the svg special case:
 * svg streams as a text artifact (`is_binary: false`), but raw XML is
 * useless in the text editor — it renders as an image instead.
 */
export const shouldUseBinaryCanvas = (info: {
  isBinary?: boolean | null;
  mimeType?: string | null;
  fileExtension?: string | null;
}): boolean =>
  normalizeExtension(info.fileExtension) === 'svg' || isBinaryArtifact(info);

/**
 * Streaming behavior for a new artifact, keyed off the only field the stream
 * events carry (file_extension). Text artifacts open the canvas at stream
 * start and stream into it; binary/viewer artifacts have nothing to stream
 * into the editor (their file exists only on the detail endpoint once the
 * version is finalized), so they open — if displayable at all — at stream
 * end. Non-displayable binaries (zip, xlsx, …) never open the canvas; the
 * chat chip offers Download instead.
 */
export const getBinaryStreamBehavior = (
  fileExtension?: string | null,
): {
  isBinary: boolean;
  openCanvasOnStreamStart: boolean;
  openCanvasOnStreamEnd: boolean;
} => {
  const isBinary = shouldUseBinaryCanvas({ fileExtension });
  return {
    isBinary,
    openCanvasOnStreamStart: !isBinary,
    openCanvasOnStreamEnd:
      !isBinary || canOpenBinaryInCanvas({ fileExtension }),
  };
};

/**
 * Build the downloadable/previewable file for an artifact fetched from the
 * detail endpoint: binary artifacts carry base64 `binary_content`; text-based
 * viewable files (svg) carry their source in `content`.
 */
export const artifactFileToBlob = (
  artifact: {
    content?: string | null;
    binary_content?: string | null;
    mime_type?: string | null;
    file_extension?: string | null;
  },
  fallbackExtension?: string | null,
  fallbackMimeType?: string | null,
): { blob: Blob; extension?: string; mimeType: string } | null => {
  const extension = artifact.file_extension || fallbackExtension || undefined;
  const mimeType =
    resolveBinaryMimeType(extension, artifact.mime_type ?? fallbackMimeType) ??
    'application/octet-stream';
  if (artifact.binary_content) {
    return {
      blob: base64ToBlob(artifact.binary_content, mimeType),
      extension,
      mimeType,
    };
  }
  if (artifact.content) {
    return {
      blob: new Blob([artifact.content], { type: mimeType }),
      extension,
      mimeType,
    };
  }
  return null;
};

/** Decode the API's base64 `binary_content` payload into a Blob. */
export const base64ToBlob = (
  base64: string,
  mimeType: string = 'application/octet-stream',
): Blob => {
  // Strip whitespace/newlines some encoders inject into long base64 payloads.
  const clean = base64.replace(/\s/g, '');
  const byteString = atob(clean);
  const bytes = new Uint8Array(byteString.length);
  for (let i = 0; i < byteString.length; i++) {
    bytes[i] = byteString.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
};

/**
 * Filename for exporting a binary artifact: keeps the artifact's own
 * extension and avoids doubling it when the title already carries it
 * (backend titles binary artifacts by filename, e.g. "report.pdf").
 */
export const buildBinaryFilename = (
  title: string | undefined | null,
  fileExtension?: string | null,
): string => {
  const ext = normalizeExtension(fileExtension);
  const base = (title ?? '').trim() || 'artifact';
  if (!ext) return base;
  if (base.toLowerCase().endsWith(`.${ext}`)) return base;
  return `${base}.${ext}`;
};
