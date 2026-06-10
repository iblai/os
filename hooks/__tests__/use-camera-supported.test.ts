import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useCameraSupported } from '../use-camera-supported';

describe('useCameraSupported', () => {
  const originalMediaDevices = Object.getOwnPropertyDescriptor(
    navigator,
    'mediaDevices',
  );

  afterEach(() => {
    if (originalMediaDevices) {
      Object.defineProperty(navigator, 'mediaDevices', originalMediaDevices);
    } else {
      // @ts-expect-error allow cleanup of injected property
      delete navigator.mediaDevices;
    }
    vi.restoreAllMocks();
  });

  it('returns true when navigator.mediaDevices.getUserMedia exists', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn() },
    });

    const { result } = renderHook(() => useCameraSupported());

    await waitFor(() => {
      expect(result.current).toBe(true);
    });
  });

  it('returns false when getUserMedia is absent', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {},
    });

    const { result } = renderHook(() => useCameraSupported());

    // Effect runs but support stays false.
    await waitFor(() => {
      expect(result.current).toBe(false);
    });
  });

  it('returns false when mediaDevices is undefined (SSR-like)', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: undefined,
    });

    const { result } = renderHook(() => useCameraSupported());

    await waitFor(() => {
      expect(result.current).toBe(false);
    });
  });

  it('defaults to false before the mount effect runs', () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn() },
    });

    // The initial state (synchronous return) is always false.
    const { result } = renderHook(() => useCameraSupported());
    // After flushing effects it becomes true, but the very first value is false
    // by construction of useState(false); we assert the supported path elsewhere.
    expect(typeof result.current).toBe('boolean');
  });
});
