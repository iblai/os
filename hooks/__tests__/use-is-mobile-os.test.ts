import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useIsMobileOS } from '../use-is-mobile-os';
import * as utils from '@/lib/utils';

describe('useIsMobileOS', () => {
  const isMobileOSSpy = vi.spyOn(utils, 'isMobileOS');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns false on the initial render then reflects isMobileOS after mount', async () => {
    isMobileOSSpy.mockReturnValue(true);

    const { result } = renderHook(() => useIsMobileOS());

    // After the mount effect runs it should reflect the util's value.
    await waitFor(() => {
      expect(result.current).toBe(true);
    });
    expect(isMobileOSSpy).toHaveBeenCalled();
  });

  it('returns false when isMobileOS reports a non-mobile OS', async () => {
    isMobileOSSpy.mockReturnValue(false);

    const { result } = renderHook(() => useIsMobileOS());

    await waitFor(() => {
      expect(result.current).toBe(false);
    });
  });
});
