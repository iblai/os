import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ImageMessage } from '../image-message';

// Mock FileCard so we can assert the fallback without depending on its markup.
vi.mock('../file-card', () => ({
  FileCard: ({
    fileName,
    fileType,
  }: {
    fileName: string;
    fileType: string;
  }) => (
    <div data-testid="file-card">
      {fileName}:{fileType}
    </div>
  ),
}));

describe('ImageMessage', () => {
  it('renders the image with its src and alt when a url is provided', () => {
    render(
      <ImageMessage
        url="blob:preview-123"
        fileName="photo.jpg"
        setPreviewImage={vi.fn()}
      />,
    );

    const img = screen.getByRole('img', { name: 'photo.jpg' });
    expect(img).toHaveAttribute('src', 'blob:preview-123');
    expect(screen.queryByTestId('file-card')).not.toBeInTheDocument();
  });

  it('calls setPreviewImage with the url when the image is clicked', () => {
    const setPreviewImage = vi.fn();
    render(
      <ImageMessage
        url="blob:preview-123"
        fileName="photo.jpg"
        setPreviewImage={setPreviewImage}
      />,
    );

    fireEvent.click(screen.getByRole('img', { name: 'photo.jpg' }));
    expect(setPreviewImage).toHaveBeenCalledWith('blob:preview-123');
  });

  it('falls back to the FileCard when the image fails to load', () => {
    render(
      <ImageMessage
        url="blob:broken"
        fileName="photo.jpg"
        setPreviewImage={vi.fn()}
      />,
    );

    fireEvent.error(screen.getByRole('img', { name: 'photo.jpg' }));

    const card = screen.getByTestId('file-card');
    expect(card).toHaveTextContent('photo.jpg:image/*');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('renders the FileCard immediately when the url is empty', () => {
    render(
      <ImageMessage url="" fileName="photo.jpg" setPreviewImage={vi.fn()} />,
    );

    expect(screen.getByTestId('file-card')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('recovers and shows the image when a good url arrives after an earlier error', () => {
    // A camera/file attachment can first render with a non-viewable presigned
    // PUT upload url (the <img> errors), then re-render with a viewable url
    // (local object-URL preview or processed server file_url). The error state
    // must not be sticky.
    const { rerender } = render(
      <ImageMessage
        url="blob:non-viewable-presigned-put"
        fileName="camera-photo.jpg"
        setPreviewImage={vi.fn()}
      />,
    );

    fireEvent.error(screen.getByRole('img', { name: 'camera-photo.jpg' }));
    expect(screen.getByTestId('file-card')).toBeInTheDocument();

    rerender(
      <ImageMessage
        url="blob:good-local-preview"
        fileName="camera-photo.jpg"
        setPreviewImage={vi.fn()}
      />,
    );

    expect(screen.queryByTestId('file-card')).not.toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'camera-photo.jpg' }),
    ).toHaveAttribute('src', 'blob:good-local-preview');
  });
});
