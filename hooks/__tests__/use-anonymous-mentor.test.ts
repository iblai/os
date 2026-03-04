import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAccessingPublicRoute } from '../use-anonymous-mentor';

// Mock the auth context
const mockUseAuthContext = vi.fn();
vi.mock('@iblai/iblai-js/web-utils', () => ({
  useAuthContext: () => mockUseAuthContext(),
}));

describe('useAccessingPublicRoute', () => {
  it('should return true when user is accessing public route', () => {
    mockUseAuthContext.mockReturnValue({
      userIsAccessingPublicRoute: true,
    });

    const { result } = renderHook(() => useAccessingPublicRoute());

    expect(result.current).toBe(true);
  });

  it('should return false when user is not accessing public route', () => {
    mockUseAuthContext.mockReturnValue({
      userIsAccessingPublicRoute: false,
    });

    const { result } = renderHook(() => useAccessingPublicRoute());

    expect(result.current).toBe(false);
  });

  it('should return undefined when userIsAccessingPublicRoute is undefined', () => {
    mockUseAuthContext.mockReturnValue({
      userIsAccessingPublicRoute: undefined,
    });

    const { result } = renderHook(() => useAccessingPublicRoute());

    expect(result.current).toBeUndefined();
  });

  it('should update when auth context changes', () => {
    mockUseAuthContext.mockReturnValue({
      userIsAccessingPublicRoute: false,
    });

    const { result, rerender } = renderHook(() => useAccessingPublicRoute());

    expect(result.current).toBe(false);

    mockUseAuthContext.mockReturnValue({
      userIsAccessingPublicRoute: true,
    });

    rerender();

    expect(result.current).toBe(true);
  });
});
