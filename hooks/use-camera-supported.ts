'use client';

import { useEffect, useState } from 'react';

/**
 * Returns true when the browser exposes the `getUserMedia` camera API.
 *
 * This requires a secure context (https/localhost) and a device with a
 * camera. Mirrors the mounted-state pattern of `useIsMobileOS` so SSR
 * renders a stable `false` before hydration.
 */
export function useCameraSupported(): boolean {
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    setSupported(
      typeof navigator !== 'undefined' &&
        !!navigator.mediaDevices?.getUserMedia,
    );
  }, []);
  return supported;
}
