import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { CameraCaptureDialog } from '../camera-capture-dialog';

// --- Shared mocks -----------------------------------------------------------

let trackStop: ReturnType<typeof vi.fn>;
let fakeStream: { getTracks: () => Array<{ stop: () => void }> };
let getUserMediaMock: ReturnType<typeof vi.fn>;
let toBlobBlob: Blob | null;

const originalMediaDevices = Object.getOwnPropertyDescriptor(
  navigator,
  'mediaDevices',
);

const setupMediaDevices = (impl?: unknown) => {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: impl,
  });
};

beforeEach(() => {
  trackStop = vi.fn();
  fakeStream = {
    getTracks: () => [{ stop: trackStop }],
  };
  getUserMediaMock = vi.fn().mockResolvedValue(fakeStream);
  setupMediaDevices({ getUserMedia: getUserMediaMock });

  toBlobBlob = new Blob(['jpeg-bytes'], { type: 'image/jpeg' });

  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D);

  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
    this: HTMLCanvasElement,
    cb: BlobCallback,
  ) {
    cb(toBlobBlob);
  });

  // jsdom does not implement videoWidth/Height as writable; stub the getters.
  Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', {
    configurable: true,
    get: () => 640,
  });
  Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', {
    configurable: true,
    get: () => 480,
  });

  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview-url');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
});

afterEach(() => {
  if (originalMediaDevices) {
    Object.defineProperty(navigator, 'mediaDevices', originalMediaDevices);
  } else {
    // @ts-expect-error cleanup injected property
    delete navigator.mediaDevices;
  }
  vi.restoreAllMocks();
});

const noop = () => {};

describe('CameraCaptureDialog', () => {
  it('renders the live video and requests the camera when open + supported', async () => {
    render(<CameraCaptureDialog open onOpenChange={noop} onCapture={noop} />);

    expect(screen.getByText('Take a photo')).toBeInTheDocument();
    expect(screen.getByTestId('camera-video')).toBeInTheDocument();

    await waitFor(() => {
      expect(getUserMediaMock).toHaveBeenCalledWith({
        video: { facingMode: 'user' },
      });
    });
  });

  it('passes the provided facingMode to getUserMedia', async () => {
    render(
      <CameraCaptureDialog
        open
        onOpenChange={noop}
        onCapture={noop}
        facingMode="environment"
      />,
    );

    await waitFor(() => {
      expect(getUserMediaMock).toHaveBeenCalledWith({
        video: { facingMode: 'environment' },
      });
    });
  });

  it('shows an error when getUserMedia is unavailable', () => {
    setupMediaDevices(undefined);

    render(<CameraCaptureDialog open onOpenChange={noop} onCapture={noop} />);

    expect(
      screen.getByText('Camera is not available in this browser.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Close camera' }),
    ).toBeInTheDocument();
  });

  it('shows a friendly error when getUserMedia rejects', async () => {
    getUserMediaMock.mockRejectedValue(new Error('denied'));

    render(<CameraCaptureDialog open onOpenChange={noop} onCapture={noop} />);

    await waitFor(() => {
      expect(
        screen.getByText(
          'Unable to access the camera. Please grant permission and make sure a camera is connected.',
        ),
      ).toBeInTheDocument();
    });
  });

  it('closes from the error state via the Close button', async () => {
    setupMediaDevices(undefined);
    const onOpenChange = vi.fn();

    render(
      <CameraCaptureDialog open onOpenChange={onOpenChange} onCapture={noop} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close camera' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('Capture shows the still with Retake / Use Photo', async () => {
    render(<CameraCaptureDialog open onOpenChange={noop} onCapture={noop} />);

    await waitFor(() => expect(getUserMediaMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'Capture photo' }));

    await waitFor(() => {
      expect(screen.getByAltText('Captured photo preview')).toBeInTheDocument();
    });
    expect(
      screen.getByRole('button', { name: 'Retake photo' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Use photo' }),
    ).toBeInTheDocument();
    // Stream stopped once a still is captured.
    expect(trackStop).toHaveBeenCalled();
    expect(URL.createObjectURL).toHaveBeenCalledWith(toBlobBlob);
  });

  it('Use Photo emits a jpeg File and closes', async () => {
    const onCapture = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <CameraCaptureDialog
        open
        onOpenChange={onOpenChange}
        onCapture={onCapture}
      />,
    );

    await waitFor(() => expect(getUserMediaMock).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Capture photo' }));

    await waitFor(() =>
      expect(screen.getByAltText('Captured photo preview')).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Use photo' }));

    expect(onCapture).toHaveBeenCalledTimes(1);
    const file = onCapture.mock.calls[0][0] as File;
    expect(file).toBeInstanceOf(File);
    expect(file.type).toBe('image/jpeg');
    expect(file.name).toMatch(/^camera-photo-\d+\.jpg$/);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('Retake clears the still and restarts the stream', async () => {
    render(<CameraCaptureDialog open onOpenChange={noop} onCapture={noop} />);

    await waitFor(() => expect(getUserMediaMock).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'Capture photo' }));

    await waitFor(() =>
      expect(screen.getByAltText('Captured photo preview')).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Retake photo' }));

    await waitFor(() => {
      expect(screen.getByTestId('camera-video')).toBeInTheDocument();
    });
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview-url');
    // Stream restarted after retake.
    await waitFor(() => expect(getUserMediaMock).toHaveBeenCalledTimes(2));
  });

  it('stops the stream tracks when closed via the dialog', async () => {
    const onOpenChange = vi.fn();
    render(
      <CameraCaptureDialog open onOpenChange={onOpenChange} onCapture={noop} />,
    );

    await waitFor(() => expect(getUserMediaMock).toHaveBeenCalled());

    // Trigger the dialog's onOpenChange(false) via Escape.
    fireEvent.keyDown(document.activeElement || document.body, {
      key: 'Escape',
      code: 'Escape',
    });

    await waitFor(() => {
      expect(trackStop).toHaveBeenCalled();
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('stops tracks and revokes URLs on unmount', async () => {
    const { unmount } = render(
      <CameraCaptureDialog open onOpenChange={noop} onCapture={noop} />,
    );

    await waitFor(() => expect(getUserMediaMock).toHaveBeenCalled());

    unmount();
    expect(trackStop).toHaveBeenCalled();
  });

  it('stops the stream if it resolves after the effect was cancelled', async () => {
    let resolveStream: (s: unknown) => void = () => {};
    getUserMediaMock.mockReturnValue(
      new Promise((resolve) => {
        resolveStream = resolve;
      }),
    );

    const { unmount } = render(
      <CameraCaptureDialog open onOpenChange={noop} onCapture={noop} />,
    );

    await waitFor(() => expect(getUserMediaMock).toHaveBeenCalled());

    // Cancel the effect before the stream resolves.
    unmount();
    resolveStream(fakeStream);

    await waitFor(() => {
      expect(trackStop).toHaveBeenCalled();
    });
  });

  it('does not request the camera while closed', () => {
    render(
      <CameraCaptureDialog open={false} onOpenChange={noop} onCapture={noop} />,
    );
    expect(getUserMediaMock).not.toHaveBeenCalled();
  });

  it('does nothing when capturing without a 2d context', async () => {
    (HTMLCanvasElement.prototype.getContext as unknown as ReturnType<
      typeof vi.fn
    >) = vi.fn().mockReturnValue(null);

    render(<CameraCaptureDialog open onOpenChange={noop} onCapture={noop} />);
    await waitFor(() => expect(getUserMediaMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'Capture photo' }));

    // Still shows live video (no still produced).
    expect(screen.getByTestId('camera-video')).toBeInTheDocument();
  });

  it('does nothing on Capture when toBlob yields null', async () => {
    toBlobBlob = null;

    render(<CameraCaptureDialog open onOpenChange={noop} onCapture={noop} />);
    await waitFor(() => expect(getUserMediaMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'Capture photo' }));

    // No still rendered, video preview remains.
    expect(screen.getByTestId('camera-video')).toBeInTheDocument();
  });
});
