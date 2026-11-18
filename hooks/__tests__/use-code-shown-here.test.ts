import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCodeShownHere } from '../use-code-shown-here';

let phone = false;
vi.mock('@/types/tauri', () => ({ isTauriPhone: () => phone }));

describe('useCodeShownHere', () => {
  beforeEach(() => {
    phone = false;
    localStorage.clear();
  });

  it('shows Code inside the desktop app', () => {
    expect(renderHook(() => useCodeShownHere(true)).result.current).toBe(true);
  });

  it('shows nothing outside Tauri, and leaves a pairing flag alone there', () => {
    localStorage.setItem('ibl_remote_code_ready', 'true');
    expect(renderHook(() => useCodeShownHere(false)).result.current).toBe(
      false,
    );
    expect(localStorage.getItem('ibl_remote_code_ready')).toBe('true');
  });

  it('hides Code on a phone for now, and stops a paired phone routing its turns there', () => {
    phone = true;
    localStorage.setItem('ibl_remote_code_ready', 'true');
    const seen = vi.fn();
    window.addEventListener('local-storage', seen);

    expect(renderHook(() => useCodeShownHere(true)).result.current).toBe(false);

    expect(localStorage.getItem('ibl_remote_code_ready')).toBe('false');
    expect(seen).toHaveBeenCalledTimes(1);
    window.removeEventListener('local-storage', seen);
  });

  it('survives a blocked storage', () => {
    phone = true;
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    try {
      expect(renderHook(() => useCodeShownHere(true)).result.current).toBe(
        false,
      );
    } finally {
      vi.restoreAllMocks();
    }
  });
});
