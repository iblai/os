'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface CameraCaptureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCapture: (file: File) => void;
  facingMode?: 'user' | 'environment';
}

const CAMERA_UNAVAILABLE_ERROR = 'Camera is not available in this browser.';
const CAMERA_PERMISSION_ERROR =
  'Unable to access the camera. Please grant permission and make sure a camera is connected.';

export const CameraCaptureDialog = ({
  open,
  onOpenChange,
  onCapture,
  facingMode = 'user',
}: CameraCaptureDialogProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const capturedBlobRef = useRef<Blob | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);

  // Stop every track on the active stream and detach it from the <video>.
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Revoke and clear any preview object URL + captured blob.
  const clearCaptured = useCallback(() => {
    setCapturedUrl((prev) => {
      if (prev) {
        URL.revokeObjectURL(prev);
      }
      return null;
    });
    capturedBlobRef.current = null;
  }, []);

  // Start the live camera stream. Re-runs while the dialog is open and there
  // is no captured still on screen (so "Retake" restarts the preview).
  useEffect(() => {
    if (!open || capturedUrl) {
      return;
    }

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setError(CAMERA_UNAVAILABLE_ERROR);
      return;
    }

    let cancelled = false;
    setError(null);

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode } })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(CAMERA_PERMISSION_ERROR);
        }
      });

    return () => {
      cancelled = true;
      stopStream();
    };
  }, [open, capturedUrl, facingMode, stopStream]);

  // Cleanup on unmount: never leave the camera light on and revoke any URL.
  useEffect(() => {
    return () => {
      stopStream();
      clearCaptured();
    };
  }, [stopStream, clearCaptured]);

  const handleClose = useCallback(() => {
    stopStream();
    clearCaptured();
    setError(null);
    onOpenChange(false);
  }, [stopStream, clearCaptured, onOpenChange]);

  const handleDialogOpenChange = (next: boolean) => {
    if (!next) {
      handleClose();
      return;
    }
    /* istanbul ignore next -- @preserve Radix only fires onOpenChange(true) via its own trigger, which this controlled dialog does not render */
    onOpenChange(next);
  };

  const handleCapture = () => {
    const video = videoRef.current;
    /* istanbul ignore next -- @preserve defensive: the Capture button only renders while the <video> ref is attached */
    if (!video) {
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          return;
        }
        capturedBlobRef.current = blob;
        const url = URL.createObjectURL(blob);
        // Stop the live stream once we have the still.
        stopStream();
        setCapturedUrl(url);
      },
      'image/jpeg',
      0.92,
    );
  };

  const handleRetake = () => {
    clearCaptured();
  };

  const handleUsePhoto = () => {
    const blob = capturedBlobRef.current;
    /* istanbul ignore next -- @preserve defensive: the Use Photo button only renders once a still blob exists */
    if (!blob) {
      return;
    }
    const file = new File([blob], `camera-photo-${Date.now()}.jpg`, {
      type: 'image/jpeg',
    });
    onCapture(file);
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Take a photo</DialogTitle>
        </DialogHeader>

        {error ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-gray-600">{error}</p>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                aria-label="Close camera"
              >
                Close
              </Button>
            </DialogFooter>
          </div>
        ) : capturedUrl ? (
          <div className="flex flex-col gap-4">
            <img
              src={capturedUrl}
              alt="Captured photo preview"
              className="w-full rounded-lg bg-black"
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleRetake}
                aria-label="Retake photo"
              >
                <RotateCcw className="h-4 w-4" />
                Retake
              </Button>
              <Button
                type="button"
                onClick={handleUsePhoto}
                aria-label="Use photo"
              >
                Use Photo
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full rounded-lg bg-black"
              data-testid="camera-video"
            />
            <DialogFooter>
              <Button
                type="button"
                onClick={handleCapture}
                aria-label="Capture photo"
              >
                <Camera className="h-4 w-4" />
                Capture
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
