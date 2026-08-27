import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
} from '@testing-library/react';

import { BinaryCanvasComponent } from '../binary-canvas-component';

// ============================================================================
// MOCKS
// ============================================================================

const { mockFetchArtifact, mockDownloadBlob } = vi.hoisted(() => ({
  mockFetchArtifact: vi.fn(),
  mockDownloadBlob: vi.fn(),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useLazyGetArtifactQuery: () => [mockFetchArtifact],
}));

vi.mock('@/components/canvas/canvas-export-handlers', () => ({
  downloadBlob: mockDownloadBlob,
}));

const pdfArtifact = {
  id: 42,
  title: 'report.pdf',
  file_extension: 'pdf',
  is_binary: true,
  mime_type: 'application/pdf',
  binary_content: btoa('%PDF-1.4 fake'),
};

const requiredProps = {
  artifactId: 42,
  org: 'test-org',
  userId: 'testuser',
};

// ============================================================================
// TESTS
// ============================================================================

describe('BinaryCanvasComponent', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    // jsdom lacks these
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:fake-url');
    globalThis.URL.revokeObjectURL = vi.fn();
    mockFetchArtifact.mockReturnValue({
      unwrap: () => Promise.resolve(pdfArtifact),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('fetches the artifact detail (the only endpoint serving the bytes) on mount', async () => {
    render(<BinaryCanvasComponent {...requiredProps} title="report.pdf" />);

    await waitFor(() =>
      expect(mockFetchArtifact).toHaveBeenCalledWith({
        id: 42,
        org: 'test-org',
        userId: 'testuser',
      }),
    );
  });

  it('renders a pdf preview in an iframe once loaded', async () => {
    render(<BinaryCanvasComponent {...requiredProps} title="report.pdf" />);

    const iframe = await screen.findByTestId('binary-canvas-pdf');
    expect(iframe).toHaveAttribute('src', 'blob:fake-url');
    expect(screen.getByTestId('binary-canvas-title')).toHaveTextContent(
      'report.pdf',
    );
  });

  it('renders an image preview for image artifacts', async () => {
    mockFetchArtifact.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          ...pdfArtifact,
          title: 'chart.png',
          file_extension: 'png',
          mime_type: 'image/png',
          binary_content: btoa('fake-png'),
        }),
    });

    render(<BinaryCanvasComponent {...requiredProps} title="chart.png" />);

    expect(
      await screen.findByTestId('binary-canvas-image'),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('binary-canvas-pdf')).not.toBeInTheDocument();
  });

  it('renders svg from its text content (svg is a text artifact on the wire)', async () => {
    mockFetchArtifact.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          id: 42,
          title: 'linear_plot.svg',
          file_extension: 'svg',
          is_binary: false,
          mime_type: null,
          binary_content: null,
          content: '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
        }),
    });

    render(
      <BinaryCanvasComponent {...requiredProps} title="linear_plot.svg" />,
    );

    expect(
      await screen.findByTestId('binary-canvas-image'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('binary-canvas-export'));
    const [blob, filename] = mockDownloadBlob.mock.calls[0];
    expect(filename).toBe('linear_plot.svg');
    expect((blob as Blob).type).toBe('image/svg+xml');
  });

  it('shows a graceful preview error for malformed svg (LLM &nbsp; output) instead of a broken render', async () => {
    mockFetchArtifact.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          id: 42,
          title: 'linear_plot.svg',
          file_extension: 'svg',
          is_binary: false,
          binary_content: null,
          content:
            '<svg xmlns="http://www.w3.org/2000/svg"><text>a&nbsp;b</text></svg>',
        }),
    });

    render(
      <BinaryCanvasComponent {...requiredProps} title="linear_plot.svg" />,
    );

    expect(
      await screen.findByTestId('binary-canvas-preview-error'),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('binary-canvas-image')).not.toBeInTheDocument();
    // No duplicate button in the panel — the header Export stays enabled and
    // still saves the original file.
    expect(
      screen.queryByTestId('binary-canvas-download'),
    ).not.toBeInTheDocument();
    const exportButton = screen.getByTestId('binary-canvas-export');
    expect(exportButton).toBeEnabled();
    fireEvent.click(exportButton);
    expect(mockDownloadBlob).toHaveBeenCalledWith(
      expect.any(Blob),
      'linear_plot.svg',
    );
  });

  it('shows the preview error for pdf payloads without the %PDF header', async () => {
    mockFetchArtifact.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          ...pdfArtifact,
          binary_content: btoa('<html>not a pdf</html>'),
        }),
    });

    render(<BinaryCanvasComponent {...requiredProps} title="report.pdf" />);

    expect(
      await screen.findByTestId('binary-canvas-preview-error'),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('binary-canvas-pdf')).not.toBeInTheDocument();
  });

  it('falls back to the preview error when an image fails to render', async () => {
    mockFetchArtifact.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          ...pdfArtifact,
          title: 'chart.png',
          file_extension: 'png',
          mime_type: 'image/png',
          binary_content: btoa('not-really-a-png'),
        }),
    });

    render(<BinaryCanvasComponent {...requiredProps} title="chart.png" />);

    // png bytes can't be validated upfront — the <img> error signal is the
    // detection path.
    const img = await screen.findByTestId('binary-canvas-image');
    fireEvent.error(img);

    expect(
      await screen.findByTestId('binary-canvas-preview-error'),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('binary-canvas-image')).not.toBeInTheDocument();
  });

  it('shows the download fallback for non-displayable binaries', async () => {
    mockFetchArtifact.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          ...pdfArtifact,
          title: 'archive.zip',
          file_extension: 'zip',
          mime_type: 'application/zip',
        }),
    });

    render(<BinaryCanvasComponent {...requiredProps} title="archive.zip" />);

    expect(
      await screen.findByTestId('binary-canvas-fallback'),
    ).toBeInTheDocument();
    // The panel carries no button of its own — export lives in the header.
    expect(
      screen.queryByTestId('binary-canvas-download'),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('binary-canvas-export'));
    expect(mockDownloadBlob).toHaveBeenCalledWith(
      expect.any(Blob),
      'archive.zip',
    );
  });

  it('exports the original bytes with the original filename — no format conversion', async () => {
    render(<BinaryCanvasComponent {...requiredProps} title="report.pdf" />);

    await screen.findByTestId('binary-canvas-pdf');
    fireEvent.click(screen.getByTestId('binary-canvas-export'));

    expect(mockDownloadBlob).toHaveBeenCalledTimes(1);
    const [blob, filename] = mockDownloadBlob.mock.calls[0];
    expect(filename).toBe('report.pdf');
    expect((blob as Blob).type).toBe('application/pdf');
    // jsdom's Blob has no .text(); read it the FileReader way.
    const text = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(blob as Blob);
    });
    expect(text).toBe('%PDF-1.4 fake');
  });

  it('renders no editing affordances — no toolbar, rename, or version menu', async () => {
    const { container } = render(
      <BinaryCanvasComponent {...requiredProps} title="report.pdf" />,
    );

    await screen.findByTestId('binary-canvas-pdf');

    // The rich-text toolbar's structural pieces must be absent.
    expect(container.querySelector('.tiptap')).toBeNull();
    expect(container.querySelector('[contenteditable]')).toBeNull();
    expect(screen.queryByTestId('canvas-highlight-popup')).toBeNull();
    // Export is a single plain button, not the PDF/DOCX/Markdown menu.
    expect(screen.queryByText('pdfDocument')).toBeNull();
    expect(screen.queryByText('microsoftWord')).toBeNull();
    expect(screen.queryByText('markdownDocument')).toBeNull();
  });

  it('disables export until the file is loaded', () => {
    mockFetchArtifact.mockReturnValue({
      unwrap: () => new Promise(() => {}),
    });

    render(<BinaryCanvasComponent {...requiredProps} title="report.pdf" />);

    expect(screen.getByTestId('binary-canvas-loading')).toBeInTheDocument();
    expect(screen.getByTestId('binary-canvas-export')).toBeDisabled();
  });

  it('shows an error state with retry when the fetch fails, and recovers', async () => {
    mockFetchArtifact.mockReturnValueOnce({
      unwrap: () => Promise.reject(new Error('boom')),
    });

    render(<BinaryCanvasComponent {...requiredProps} title="report.pdf" />);

    expect(
      await screen.findByTestId('binary-canvas-error'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('binary-canvas-retry'));
    expect(await screen.findByTestId('binary-canvas-pdf')).toBeInTheDocument();
  });

  it('errors out when the artifact has no binary content', async () => {
    mockFetchArtifact.mockReturnValue({
      unwrap: () => Promise.resolve({ ...pdfArtifact, binary_content: null }),
    });

    render(<BinaryCanvasComponent {...requiredProps} title="report.pdf" />);

    expect(
      await screen.findByTestId('binary-canvas-error'),
    ).toBeInTheDocument();
  });

  it('errors out when artifact context is missing', async () => {
    render(<BinaryCanvasComponent title="report.pdf" />);

    expect(
      await screen.findByTestId('binary-canvas-error'),
    ).toBeInTheDocument();
    expect(mockFetchArtifact).not.toHaveBeenCalled();
  });

  it('calls onClose from the close button', async () => {
    const onClose = vi.fn();
    render(
      <BinaryCanvasComponent
        {...requiredProps}
        title="report.pdf"
        onClose={onClose}
      />,
    );

    await screen.findByTestId('binary-canvas-pdf');
    fireEvent.click(screen.getByTestId('binary-canvas-close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('revokes the object URL on unmount', async () => {
    const { unmount } = render(
      <BinaryCanvasComponent {...requiredProps} title="report.pdf" />,
    );

    await screen.findByTestId('binary-canvas-pdf');
    unmount();
    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith(
      'blob:fake-url',
    );
  });
});
