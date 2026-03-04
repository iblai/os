import { describe, it, expect } from 'vitest';
import { useIsomorphicLayoutEffect } from '../use-isomorphic-layout-effect';
import { useEffect, useLayoutEffect } from 'react';

describe('use-isomorphic-layout-effect', () => {
  it('should export useLayoutEffect in browser environment', () => {
    // In test environment with jsdom, window is defined
    expect(useIsomorphicLayoutEffect).toBeDefined();
    expect(typeof useIsomorphicLayoutEffect).toBe('function');
  });

  it('should be useLayoutEffect when window is defined', () => {
    // Since we're in a jsdom environment, window is defined
    expect(useIsomorphicLayoutEffect).toBe(useLayoutEffect);
  });

  it('should not be useEffect when window is defined', () => {
    // Verify it's specifically useLayoutEffect, not useEffect
    expect(useIsomorphicLayoutEffect).not.toBe(useEffect);
  });

  it('should handle the case when window is defined', () => {
    // Test that typeof window !== "undefined" is true in test environment
    expect(typeof window).not.toBe('undefined');
    expect(useIsomorphicLayoutEffect).toBe(useLayoutEffect);
  });
});
