import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FileAttachmentsList } from '../file-attachments-list';

type AttachedFile = Parameters<
  typeof FileAttachmentsList
>[0]['attachedFiles'][number];

const buildFile = (overrides: Partial<AttachedFile> = {}): AttachedFile => ({
  id: 'file-1',
  fileName: 'photo.png',
  fileType: 'image/png',
  fileSize: 1024,
  uploadStatus: 'success',
  uploadProgress: 100,
  ...overrides,
});

const renderList = (
  attachedFiles: AttachedFile[],
  handlers: {
    onRemoveFile?: (id: string) => void;
    onRetryFile?: (id: string) => void;
  } = {},
) =>
  render(
    <FileAttachmentsList
      attachedFiles={attachedFiles}
      onRemoveFile={handlers.onRemoveFile ?? vi.fn()}
      onRetryFile={handlers.onRetryFile ?? vi.fn()}
    />,
  );

describe('FileAttachmentsList', () => {
  it('renders nothing when there are no attached files', () => {
    const { container } = renderList([]);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when attachedFiles is undefined', () => {
    const { container } = render(
      <FileAttachmentsList
        attachedFiles={undefined as unknown as AttachedFile[]}
        onRemoveFile={vi.fn()}
        onRetryFile={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders one attachment chip per file', () => {
    renderList([
      buildFile({ id: 'a', fileName: 'a.png' }),
      buildFile({ id: 'b', fileName: 'b.png' }),
    ]);
    expect(screen.getAllByTestId('attachment-chip')).toHaveLength(2);
  });

  it('shows the file extension derived from the mime type', () => {
    renderList([buildFile({ fileType: 'image/png' })]);
    expect(screen.getByText('png')).toBeInTheDocument();
  });

  it('falls back to FILE when the mime type has no subtype', () => {
    renderList([buildFile({ fileType: 'pdf' })]);
    expect(screen.getByText('FILE')).toBeInTheDocument();
  });

  it('shows progress and disables removal while uploading', () => {
    renderList([buildFile({ uploadStatus: 'uploading', uploadProgress: 42 })]);
    expect(screen.getAllByText(/42%/).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /remove file/i })).toBeDisabled();
  });

  it('shows the retry count while uploading after a retry', () => {
    const { container } = renderList([
      buildFile({
        uploadStatus: 'uploading',
        uploadProgress: 30,
        retryCount: 2,
      }),
    ]);
    expect(container.textContent).toContain('(retry 2)');
  });

  it('renders a success chip', () => {
    renderList([buildFile({ uploadStatus: 'success' })]);
    expect(screen.getByTestId('attachment-chip')).toBeInTheDocument();
  });

  it('renders a processing chip', () => {
    renderList([buildFile({ uploadStatus: 'processing' })]);
    expect(screen.getByTestId('attachment-chip')).toBeInTheDocument();
  });

  it('renders a pending chip', () => {
    renderList([buildFile({ uploadStatus: 'pending' })]);
    expect(screen.getByTestId('attachment-chip')).toBeInTheDocument();
  });

  it('calls onRetryFile when the retry button on an errored file is clicked', () => {
    const onRetryFile = vi.fn();
    renderList([buildFile({ id: 'err-1', uploadStatus: 'error' })], {
      onRetryFile,
    });
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(onRetryFile).toHaveBeenCalledWith('err-1');
  });

  it('calls onRemoveFile when the remove button is clicked', () => {
    const onRemoveFile = vi.fn();
    renderList([buildFile({ id: 'rm-1', uploadStatus: 'success' })], {
      onRemoveFile,
    });
    fireEvent.click(screen.getByRole('button', { name: /remove file/i }));
    expect(onRemoveFile).toHaveBeenCalledWith('rm-1');
  });
});
