import { describe, it, expect } from 'vitest';
import {
  artifactFileToBlob,
  base64ToBlob,
  getBinaryStreamBehavior,
  buildBinaryFilename,
  canOpenBinaryInCanvas,
  isBinaryArtifact,
  isImageMimeType,
  resolveBinaryMimeType,
  shouldUseBinaryCanvas,
} from '../binary-artifact-utils';

describe('resolveBinaryMimeType', () => {
  it('prefers an explicit mime type', () => {
    expect(resolveBinaryMimeType('pdf', 'application/x-custom')).toBe(
      'application/x-custom',
    );
  });

  it('maps known binary extensions', () => {
    expect(resolveBinaryMimeType('pdf')).toBe('application/pdf');
    expect(resolveBinaryMimeType('zip')).toBe('application/zip');
    expect(resolveBinaryMimeType('xlsx')).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
  });

  it('normalizes case and leading dots', () => {
    expect(resolveBinaryMimeType('.PDF')).toBe('application/pdf');
  });

  it('returns undefined for text extensions and unknowns', () => {
    expect(resolveBinaryMimeType('md')).toBeUndefined();
    expect(resolveBinaryMimeType('nope')).toBeUndefined();
    expect(resolveBinaryMimeType(undefined)).toBeUndefined();
  });

  it('ignores a blank mime type', () => {
    expect(resolveBinaryMimeType('pdf', '  ')).toBe('application/pdf');
  });
});

describe('isBinaryArtifact', () => {
  it('honors the explicit is_binary flag in both directions', () => {
    expect(isBinaryArtifact({ isBinary: true, fileExtension: 'md' })).toBe(
      true,
    );
    // Explicit false wins even for a binary-looking extension.
    expect(isBinaryArtifact({ isBinary: false, fileExtension: 'pdf' })).toBe(
      false,
    );
  });

  it('classifies by mime type when no flag is present', () => {
    expect(isBinaryArtifact({ mimeType: 'application/pdf' })).toBe(true);
    expect(isBinaryArtifact({ mimeType: 'text/markdown' })).toBe(false);
    expect(isBinaryArtifact({ mimeType: 'application/json' })).toBe(false);
  });

  it('falls back to the extension map (live streaming events)', () => {
    expect(isBinaryArtifact({ fileExtension: 'pdf' })).toBe(true);
    expect(isBinaryArtifact({ fileExtension: 'zip' })).toBe(true);
    expect(isBinaryArtifact({ fileExtension: 'md' })).toBe(false);
    expect(isBinaryArtifact({ fileExtension: 'py' })).toBe(false);
    expect(isBinaryArtifact({})).toBe(false);
  });
});

describe('canOpenBinaryInCanvas', () => {
  it('allows pdf', () => {
    expect(canOpenBinaryInCanvas({ fileExtension: 'pdf' })).toBe(true);
    expect(canOpenBinaryInCanvas({ mimeType: 'application/pdf' })).toBe(true);
  });

  it('allows images', () => {
    expect(canOpenBinaryInCanvas({ fileExtension: 'png' })).toBe(true);
    expect(canOpenBinaryInCanvas({ mimeType: 'image/jpeg' })).toBe(true);
  });

  it('rejects archives, office docs and unknowns', () => {
    expect(canOpenBinaryInCanvas({ fileExtension: 'zip' })).toBe(false);
    expect(canOpenBinaryInCanvas({ fileExtension: 'xlsx' })).toBe(false);
    expect(canOpenBinaryInCanvas({ fileExtension: 'docx' })).toBe(false);
    expect(canOpenBinaryInCanvas({})).toBe(false);
  });

  it('allows svg (rendered as an image)', () => {
    expect(canOpenBinaryInCanvas({ fileExtension: 'svg' })).toBe(true);
  });
});

describe('shouldUseBinaryCanvas', () => {
  it('routes svg to the binary canvas even though the API marks it text', () => {
    // svg streams as a text artifact (is_binary: false) — raw XML must not
    // land in the rich-text editor.
    expect(
      shouldUseBinaryCanvas({ isBinary: false, fileExtension: 'svg' }),
    ).toBe(true);
    expect(shouldUseBinaryCanvas({ fileExtension: 'svg' })).toBe(true);
  });

  it('matches isBinaryArtifact for everything else', () => {
    expect(shouldUseBinaryCanvas({ fileExtension: 'pdf' })).toBe(true);
    expect(shouldUseBinaryCanvas({ fileExtension: 'md' })).toBe(false);
    expect(
      shouldUseBinaryCanvas({ isBinary: false, fileExtension: 'pdf' }),
    ).toBe(false);
  });
});

describe('getBinaryStreamBehavior', () => {
  it('text artifacts open at stream start and stream into the editor', () => {
    expect(getBinaryStreamBehavior('md')).toEqual({
      isBinary: false,
      openCanvasOnStreamStart: true,
      openCanvasOnStreamEnd: true,
    });
  });

  it('displayable binaries (pdf, svg, images) open only at stream end', () => {
    for (const ext of ['pdf', 'svg', 'png']) {
      expect(getBinaryStreamBehavior(ext)).toEqual({
        isBinary: true,
        openCanvasOnStreamStart: false,
        openCanvasOnStreamEnd: true,
      });
    }
  });

  it('non-displayable binaries (zip, xlsx) never open the canvas', () => {
    for (const ext of ['zip', 'xlsx', 'docx']) {
      expect(getBinaryStreamBehavior(ext)).toEqual({
        isBinary: true,
        openCanvasOnStreamStart: false,
        openCanvasOnStreamEnd: false,
      });
    }
  });

  it('treats an unknown/missing extension as streamable text', () => {
    expect(getBinaryStreamBehavior(undefined).openCanvasOnStreamStart).toBe(
      true,
    );
    expect(getBinaryStreamBehavior('txt').openCanvasOnStreamStart).toBe(true);
  });
});

describe('artifactFileToBlob', () => {
  it('decodes binary_content when present', () => {
    const file = artifactFileToBlob({
      binary_content: btoa('pdf bytes'),
      mime_type: 'application/pdf',
      file_extension: 'pdf',
    });

    expect(file).not.toBeNull();
    expect(file!.blob.type).toBe('application/pdf');
    expect(file!.extension).toBe('pdf');
    expect(file!.mimeType).toBe('application/pdf');
  });

  it('falls back to text content for text-based viewable files (svg)', () => {
    const file = artifactFileToBlob({
      content: '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
      binary_content: null,
      file_extension: 'svg',
    });

    expect(file).not.toBeNull();
    expect(file!.blob.type).toBe('image/svg+xml');
  });

  it('prefers binary_content over content', () => {
    const file = artifactFileToBlob({
      content: 'text',
      binary_content: btoa('bytes'),
      file_extension: 'pdf',
    });

    expect(file!.blob.type).toBe('application/pdf');
    expect(file!.blob.size).toBe('bytes'.length);
  });

  it('uses the fallback extension/mime when the artifact lacks them', () => {
    const file = artifactFileToBlob({ binary_content: btoa('x') }, 'zip', null);

    expect(file!.extension).toBe('zip');
    expect(file!.mimeType).toBe('application/zip');
  });

  it('returns null when there is nothing to download', () => {
    expect(artifactFileToBlob({ file_extension: 'pdf' })).toBeNull();
    expect(
      artifactFileToBlob({ content: '', binary_content: null }),
    ).toBeNull();
  });
});

describe('isImageMimeType', () => {
  it('detects image mime types', () => {
    expect(isImageMimeType('image/png')).toBe(true);
    expect(isImageMimeType('IMAGE/JPEG')).toBe(true);
  });

  it('rejects non-images and empties', () => {
    expect(isImageMimeType('application/pdf')).toBe(false);
    expect(isImageMimeType(undefined)).toBe(false);
    expect(isImageMimeType('')).toBe(false);
  });
});

// jsdom's Blob has no .text(); read it the FileReader way.
const blobText = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });

describe('base64ToBlob', () => {
  it('decodes base64 into a blob with the given mime type', async () => {
    const base64 = btoa('hello bytes');
    const blob = base64ToBlob(base64, 'application/pdf');

    expect(blob.type).toBe('application/pdf');
    expect(await blobText(blob)).toBe('hello bytes');
  });

  it('tolerates whitespace/newlines inside the payload', async () => {
    const base64 = btoa('chunked');
    const noisy = `${base64.slice(0, 4)}\n${base64.slice(4)} `;
    const blob = base64ToBlob(noisy, 'application/zip');

    expect(await blobText(blob)).toBe('chunked');
  });

  it('defaults to octet-stream', () => {
    expect(base64ToBlob(btoa('x')).type).toBe('application/octet-stream');
  });
});

describe('buildBinaryFilename', () => {
  it('appends the extension when missing', () => {
    expect(buildBinaryFilename('report', 'pdf')).toBe('report.pdf');
  });

  it('does not double an extension the title already carries', () => {
    expect(buildBinaryFilename('report.pdf', 'pdf')).toBe('report.pdf');
    expect(buildBinaryFilename('Report.PDF', 'pdf')).toBe('Report.PDF');
  });

  it('falls back to a generic name for empty titles', () => {
    expect(buildBinaryFilename('', 'zip')).toBe('artifact.zip');
    expect(buildBinaryFilename(undefined, 'zip')).toBe('artifact.zip');
  });

  it('keeps the bare title when no extension is known', () => {
    expect(buildBinaryFilename('mystery-file')).toBe('mystery-file');
  });
});
