import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

import { useAllowMentorSelection } from '../use-allow-mentor-selection';

let mockSearchParams = new URLSearchParams();
let mockEmbedMode = false;
let mockIsLoggedIn = true;

vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
}));

vi.mock('@/hooks/use-embed-mode', () => ({
  useEmbedMode: () => mockEmbedMode,
}));

vi.mock('@/lib/utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/utils')>()),
  isLoggedIn: () => mockIsLoggedIn,
}));

describe('useAllowMentorSelection', () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams();
    mockEmbedMode = false;
    mockIsLoggedIn = true;
  });

  it('is false for an anonymous embed viewer even with the flag', () => {
    mockEmbedMode = true;
    mockIsLoggedIn = false;
    mockSearchParams = new URLSearchParams(
      'embed=true&allow-mentor-selection=true',
    );
    expect(renderHook(() => useAllowMentorSelection()).result.current).toBe(
      false,
    );
  });

  it('is true in embed mode with allow-mentor-selection=true', () => {
    mockEmbedMode = true;
    mockSearchParams = new URLSearchParams(
      'embed=true&allow-mentor-selection=true',
    );
    expect(renderHook(() => useAllowMentorSelection()).result.current).toBe(
      true,
    );
  });

  it('is false in embed mode without the flag', () => {
    mockEmbedMode = true;
    mockSearchParams = new URLSearchParams('embed=true');
    expect(renderHook(() => useAllowMentorSelection()).result.current).toBe(
      false,
    );
  });

  it('is false outside embed mode even with the flag', () => {
    mockSearchParams = new URLSearchParams('allow-mentor-selection=true');
    expect(renderHook(() => useAllowMentorSelection()).result.current).toBe(
      false,
    );
  });
});
