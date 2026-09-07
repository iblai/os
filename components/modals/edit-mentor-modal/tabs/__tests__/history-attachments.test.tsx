import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

import {
  HistoryAttachments,
  isImageAttachment,
  normalizeHistoryFile,
  normalizeHistoryFiles,
} from '../history-attachments';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('normalizeHistoryFile', () => {
  it('accepts a bare URL string and derives the name from the path', () => {
    expect(
      normalizeHistoryFile('https://cdn.example.com/chat/abc/report.pdf'),
    ).toEqual({
      url: 'https://cdn.example.com/chat/abc/report.pdf',
      fileName: 'report.pdf',
      fileType: 'pdf',
    });
  });

  it('ignores the query string when deriving the name', () => {
    // Presigned S3 urls carry a signature that must not leak into the label.
    const result = normalizeHistoryFile(
      'https://s3.amazonaws.com/chat/photo.png?AWSAccessKeyId=AKIA&Signature=xyz',
    );
    expect(result?.fileName).toBe('photo.png');
    expect(result?.fileType).toBe('image/png');
  });

  it('percent-decodes an escaped filename', () => {
    expect(
      normalizeHistoryFile('https://x.test/my%20report.pdf')?.fileName,
    ).toBe('my report.pdf');
  });

  it('keeps the raw segment when the escape is malformed', () => {
    expect(normalizeHistoryFile('https://x.test/bad%ZZ.pdf')?.fileName).toBe(
      'bad%ZZ.pdf',
    );
  });

  it('reads url, name and content type from an object entry', () => {
    expect(
      normalizeHistoryFile({
        url: 'https://x.test/a.bin',
        file_name: 'Quarterly.xlsx',
        content_type: 'application/vnd.ms-excel',
      }),
    ).toEqual({
      url: 'https://x.test/a.bin',
      fileName: 'Quarterly.xlsx',
      fileType: 'application/vnd.ms-excel',
    });
  });

  it.each([
    ['file_url', { file_url: 'https://x.test/a.png' }],
    ['fileUrl', { fileUrl: 'https://x.test/a.png' }],
    ['download_url', { download_url: 'https://x.test/a.png' }],
    ['src', { src: 'https://x.test/a.png' }],
    ['link', { link: 'https://x.test/a.png' }],
  ])('accepts %s as the url key', (_label, entry) => {
    expect(normalizeHistoryFile(entry)?.url).toBe('https://x.test/a.png');
  });

  it.each([
    ['fileName', { fileName: 'a.txt' }],
    ['name', { name: 'a.txt' }],
    ['filename', { filename: 'a.txt' }],
    ['title', { title: 'a.txt' }],
  ])('accepts %s as the name key', (_label, entry) => {
    expect(normalizeHistoryFile(entry)?.fileName).toBe('a.txt');
  });

  it.each([
    ['contentType', { name: 'a', contentType: 'text/plain' }],
    ['mime_type', { name: 'a', mime_type: 'text/plain' }],
    ['fileType', { name: 'a', fileType: 'text/plain' }],
  ])('accepts %s as the type key', (_label, entry) => {
    expect(normalizeHistoryFile(entry)?.fileType).toBe('text/plain');
  });

  it('uses the last path segment, which for a bare host is the host', () => {
    expect(normalizeHistoryFile({ url: 'https://x.test' })?.fileName).toBe(
      'x.test',
    );
  });

  it('falls back to the url as the label when no segment is derivable', () => {
    expect(normalizeHistoryFile({ url: '/' })?.fileName).toBe('/');
    expect(normalizeHistoryFile('/')?.fileName).toBe('/');
  });

  it('returns an empty type when there is no extension and no content type', () => {
    expect(normalizeHistoryFile({ name: 'README' })?.fileType).toBe('');
  });

  it.each([null, undefined, '', '   ', 42, {}, { url: '  ' }])(
    'returns null for the unusable entry %s',
    (entry) => {
      expect(normalizeHistoryFile(entry as never)).toBeNull();
    },
  );
});

describe('isImageAttachment', () => {
  it('is true for an image content type', () => {
    expect(
      isImageAttachment({
        url: 'u',
        fileName: 'x.bin',
        fileType: 'image/jpeg',
      }),
    ).toBe(true);
  });

  it('is true for an image extension when the type is unknown', () => {
    expect(
      isImageAttachment({ url: 'u', fileName: 'holiday.WEBP', fileType: '' }),
    ).toBe(true);
  });

  it('is false for a non-image', () => {
    expect(
      isImageAttachment({
        url: 'u',
        fileName: 'notes.pdf',
        fileType: 'application/pdf',
      }),
    ).toBe(false);
  });
});

describe('normalizeHistoryFiles', () => {
  it('returns an empty array for a non-array value', () => {
    expect(normalizeHistoryFiles(undefined)).toEqual([]);
    expect(normalizeHistoryFiles(null)).toEqual([]);
    expect(normalizeHistoryFiles({} as never)).toEqual([]);
  });

  it('drops unusable entries but keeps the rest', () => {
    const result = normalizeHistoryFiles([
      'https://x.test/a.png',
      null,
      {},
      { url: 'https://x.test/b.pdf' },
    ]);
    expect(result.map((f) => f.fileName)).toEqual(['a.png', 'b.pdf']);
  });
});

describe('<HistoryAttachments />', () => {
  it('renders nothing when there are no files', () => {
    const { container } = render(
      <HistoryAttachments files={[]} idPrefix="p" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when every entry is unusable', () => {
    const { container } = render(
      <HistoryAttachments files={[null, {}]} idPrefix="p" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders an image inline', () => {
    render(
      <HistoryAttachments files={['https://x.test/pic.png']} idPrefix="p" />,
    );
    const img = screen.getByRole('img', { name: 'pic.png' });
    expect(img).toHaveAttribute('src', 'https://x.test/pic.png');
  });

  it('renders a non-image as a file card showing name and type', () => {
    render(
      <HistoryAttachments
        files={[
          { url: 'https://x.test/r.pdf', content_type: 'application/pdf' },
        ]}
        idPrefix="p"
      />,
    );
    expect(screen.getByText('r.pdf')).toBeInTheDocument();
    expect(screen.getByText('application/pdf')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('renders a mix of images and files together', () => {
    render(
      <HistoryAttachments
        files={['https://x.test/a.png', 'https://x.test/b.pdf']}
        idPrefix="p"
      />,
    );
    expect(screen.getByRole('img', { name: 'a.png' })).toBeInTheDocument();
    expect(screen.getByText('b.pdf')).toBeInTheDocument();
  });

  it('opens the image in a new tab when clicked', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(
      <HistoryAttachments files={['https://x.test/pic.png']} idPrefix="p" />,
    );
    fireEvent.click(screen.getByRole('img', { name: 'pic.png' }));
    expect(open).toHaveBeenCalledWith(
      'https://x.test/pic.png',
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('falls back to a card when the image fails to load', () => {
    render(
      <HistoryAttachments files={['https://x.test/broken.png']} idPrefix="p" />,
    );
    fireEvent.error(screen.getByRole('img', { name: 'broken.png' }));
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('broken.png')).toBeInTheDocument();
  });
});
