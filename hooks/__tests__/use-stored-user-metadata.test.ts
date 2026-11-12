import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import { useStoredUserMetadata } from '../use-stored-user-metadata';

describe('useStoredUserMetadata', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("reads the current user's metadata from the user_metadata key", () => {
    window.localStorage.setItem(
      'user_metadata',
      JSON.stringify({
        name: 'Ada Lovelace',
        public_metadata: { language: 'fr' },
      }),
    );
    const { result } = renderHook(() => useStoredUserMetadata());
    expect(result.current[0]).toEqual({
      name: 'Ada Lovelace',
      public_metadata: { language: 'fr' },
    });
  });

  it('is null when the key is absent', () => {
    const { result } = renderHook(() => useStoredUserMetadata());
    expect(result.current[0]).toBeNull();
  });

  it('writes the key through the setter', () => {
    const { result } = renderHook(() => useStoredUserMetadata());
    act(() => {
      result.current[1]({ name: 'Grace Hopper' });
    });
    expect(
      JSON.parse(window.localStorage.getItem('user_metadata') ?? 'null'),
    ).toEqual({
      name: 'Grace Hopper',
    });
  });
});
