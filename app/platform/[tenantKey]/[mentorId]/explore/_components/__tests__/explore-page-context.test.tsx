import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import React from 'react';
import {
  ExplorePageContext,
  useExplorePageContext,
  ExplorePageContextValue,
  CUSTOM_MENTORS_LIMIT,
} from '../explore-page-context';

/**
 * Test suite for ExplorePageContext
 *
 * Tests the context provider and useExplorePageContext hook.
 */
describe('ExplorePageContext', () => {
  const mockContextValue: ExplorePageContextValue = {
    tenantKey: 'test-tenant',
    username: 'test-user',
    debouncedSearch: '',
    isSearching: false,
    filters: {
      categories: null,
      subjects: null,
      llm_providers: null,
      types: null,
      is_featured: null,
    },
    createdBy: 'my-organization',
    includeMainPublicMentors: false,
    togglingMentorId: null,
    toggleFavorite: vi.fn(),
    handleMentorClick: vi.fn(),
    starredMentorsLoading: false,
    setStarredMentorsLoading: vi.fn(),
    customMentorsLoading: false,
    setCustomMentorsLoading: vi.fn(),
    featuredMentorsLoading: false,
    setFeaturedMentorsLoading: vi.fn(),
    defaultMentorsLoading: false,
    setDefaultMentorsLoading: vi.fn(),
  };

  describe('useExplorePageContext', () => {
    it('throws error when used outside of ExplorePageContextProvider', () => {
      // Suppress console.error for this test since we expect an error
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      expect(() => {
        renderHook(() => useExplorePageContext());
      }).toThrow(
        'useExplorePageContext must be used within ExplorePageContextProvider',
      );

      consoleSpy.mockRestore();
    });

    it('returns context value when used within ExplorePageContextProvider', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ExplorePageContext.Provider value={mockContextValue}>
          {children}
        </ExplorePageContext.Provider>
      );

      const { result } = renderHook(() => useExplorePageContext(), { wrapper });

      expect(result.current).toBe(mockContextValue);
      expect(result.current.tenantKey).toBe('test-tenant');
      expect(result.current.username).toBe('test-user');
    });

    it('provides access to all context properties', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ExplorePageContext.Provider value={mockContextValue}>
          {children}
        </ExplorePageContext.Provider>
      );

      const { result } = renderHook(() => useExplorePageContext(), { wrapper });

      expect(result.current.tenantKey).toBe('test-tenant');
      expect(result.current.username).toBe('test-user');
      expect(result.current.debouncedSearch).toBe('');
      expect(result.current.isSearching).toBe(false);
      expect(result.current.filters).toEqual({
        categories: null,
        subjects: null,
        llm_providers: null,
        types: null,
        is_featured: null,
      });
      expect(result.current.createdBy).toBe('my-organization');
      expect(result.current.includeMainPublicMentors).toBe(false);
      expect(result.current.togglingMentorId).toBeNull();
      expect(result.current.starredMentorsLoading).toBe(false);
      expect(result.current.customMentorsLoading).toBe(false);
      expect(result.current.featuredMentorsLoading).toBe(false);
      expect(result.current.defaultMentorsLoading).toBe(false);
    });

    it('provides access to context functions', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ExplorePageContext.Provider value={mockContextValue}>
          {children}
        </ExplorePageContext.Provider>
      );

      const { result } = renderHook(() => useExplorePageContext(), { wrapper });

      expect(typeof result.current.toggleFavorite).toBe('function');
      expect(typeof result.current.handleMentorClick).toBe('function');
      expect(typeof result.current.setStarredMentorsLoading).toBe('function');
      expect(typeof result.current.setCustomMentorsLoading).toBe('function');
      expect(typeof result.current.setFeaturedMentorsLoading).toBe('function');
      expect(typeof result.current.setDefaultMentorsLoading).toBe('function');
    });
  });

  describe('CUSTOM_MENTORS_LIMIT', () => {
    it('exports the correct value', () => {
      expect(CUSTOM_MENTORS_LIMIT).toBe(6);
    });

    it('is a number type', () => {
      expect(typeof CUSTOM_MENTORS_LIMIT).toBe('number');
    });
  });
});
