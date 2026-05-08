import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { FileUpload } from '../file-upload';

// Mock react-dropzone
const mockOpen = vi.fn();
let capturedOnDrop: ((files: File[]) => void) | undefined;

vi.mock('react-dropzone', () => ({
  useDropzone: (opts: { onDrop: (files: File[]) => void }) => {
    capturedOnDrop = opts.onDrop;
    return {
      getRootProps: () => ({ 'data-testid': 'dropzone' }),
      getInputProps: () => ({ 'data-testid': 'dropzone-input' }),
      open: mockOpen,
    };
  },
}));

function createMockFile(name: string, size = 1024): File {
  const file = new File(['x'.repeat(size)], name, {
    type: 'application/pdf',
  });
  return file;
}

describe('FileUpload component', () => {
  it('renders the upload card', () => {
    render(<FileUpload />);
    expect(screen.getByText('Upload your documents')).toBeInTheDocument();
    expect(
      screen.getByText(
        /Drag & drop files anywhere on the page or click to browse/,
      ),
    ).toBeInTheDocument();
  });

  it('calls onFilesUploaded when files are dropped', () => {
    const onFilesUploaded = vi.fn();
    render(<FileUpload onFilesUploaded={onFilesUploaded} />);

    const file = createMockFile('test.pdf');
    act(() => {
      capturedOnDrop?.([file]);
    });

    expect(onFilesUploaded).toHaveBeenCalledWith([file]);
  });

  it('displays uploaded files', () => {
    render(<FileUpload />);

    const file = createMockFile('report.pdf');
    act(() => {
      capturedOnDrop?.([file]);
    });

    expect(screen.getByText('report.pdf')).toBeInTheDocument();
    expect(screen.getByText(/Uploaded Files/)).toBeInTheDocument();
  });

  it('removes a file when remove button is clicked', () => {
    const onFilesUploaded = vi.fn();
    render(<FileUpload onFilesUploaded={onFilesUploaded} />);

    const file = createMockFile('test.pdf');
    act(() => {
      capturedOnDrop?.([file]);
    });

    expect(screen.getByText('test.pdf')).toBeInTheDocument();

    const removeButton = screen.getByRole('button', { name: 'Remove file' });
    fireEvent.click(removeButton);

    expect(screen.queryByText('test.pdf')).not.toBeInTheDocument();
    expect(onFilesUploaded).toHaveBeenLastCalledWith([]);
  });

  it('respects maxFiles limit', () => {
    render(<FileUpload maxFiles={1} />);

    const file1 = createMockFile('file1.pdf');
    const file2 = createMockFile('file2.pdf');
    act(() => {
      capturedOnDrop?.([file1, file2]);
    });

    expect(screen.getByText('file1.pdf')).toBeInTheDocument();
    expect(screen.queryByText('file2.pdf')).not.toBeInTheDocument();
  });

  it('prevents duplicate files', () => {
    render(<FileUpload />);

    const file = createMockFile('same.pdf');
    act(() => {
      capturedOnDrop?.([file]);
    });
    act(() => {
      capturedOnDrop?.([file]);
    });

    const matches = screen.getAllByText('same.pdf');
    expect(matches).toHaveLength(1);
  });

  it('shows drag overlay on document dragover', () => {
    render(<FileUpload />);

    act(() => {
      fireEvent.dragOver(document, { dataTransfer: { files: [] } });
    });

    expect(screen.getByText('Drop your files here')).toBeInTheDocument();
  });

  it('hides drag overlay on drop', () => {
    render(<FileUpload />);

    act(() => {
      fireEvent.dragOver(document, { dataTransfer: { files: [] } });
    });
    expect(screen.getByText('Drop your files here')).toBeInTheDocument();

    act(() => {
      fireEvent.drop(document, { dataTransfer: { files: [] } });
    });
    expect(screen.queryByText('Drop your files here')).not.toBeInTheDocument();
  });

  it('renders without onFilesUploaded callback', () => {
    render(<FileUpload />);

    const file = createMockFile('test.pdf');
    act(() => {
      capturedOnDrop?.([file]);
    });

    expect(screen.getByText('test.pdf')).toBeInTheDocument();
  });
});
