import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useMentorProvider } from '../use-mentor-redirect';

// Mock @/features/mentors/api-slice
const mockFetchMentors = vi.fn();
const mockFetchSeedMentors = vi.fn();
vi.mock('@/features/mentors/api-slice', () => ({
  useLazySeedMentorsQuery: () => [mockFetchSeedMentors],
  useLazyGetMentorsQuery: () => [mockFetchMentors],
}));

describe('useMentorProvider', () => {
  const defaultProps = {
    onAuthSuccess: vi.fn(),
    onAuthFailure: vi.fn(),
    redirectToAuthSpa: vi.fn(),
    redirectToMentor: vi.fn(),
    redirectToNoMentorsPage: vi.fn(),
    redirectToCreateMentor: vi.fn(),
    username: 'testuser',
    tenantKey: 'tenant-1',
    isAdmin: false,
    isMainTenant: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchMentors.mockReset();
    mockFetchSeedMentors.mockReset();
  });

  describe('initial state', () => {
    it('should start with isLoading true', () => {
      mockFetchMentors.mockResolvedValue({ data: { results: [] } });

      const { result } = renderHook(() => useMentorProvider(defaultProps));

      expect(result.current.isLoading).toBe(true);
    });
  });

  describe('recent mentors flow', () => {
    it('should redirect to recent mentor when available', async () => {
      mockFetchMentors.mockResolvedValueOnce({
        data: { results: [{ slug: 'recent-mentor' }] },
      });

      renderHook(() => useMentorProvider(defaultProps));

      await waitFor(() => {
        expect(defaultProps.redirectToMentor).toHaveBeenCalledWith('tenant-1', 'recent-mentor');
      });

      expect(defaultProps.onAuthSuccess).toHaveBeenCalled();
    });
  });

  describe('featured mentors flow', () => {
    it('should redirect to featured mentor when no recent mentors', async () => {
      // First call - recent mentors - empty
      mockFetchMentors.mockResolvedValueOnce({
        data: { results: [] },
      });
      // Second call - featured mentors
      mockFetchMentors.mockResolvedValueOnce({
        data: { results: [{ slug: 'featured-mentor', metadata: {} }] },
      });

      renderHook(() => useMentorProvider(defaultProps));

      await waitFor(() => {
        expect(defaultProps.redirectToMentor).toHaveBeenCalledWith('tenant-1', 'featured-mentor');
      });
    });

    it('should redirect to default featured mentor for main tenant non-admin', async () => {
      // Recent mentors - empty
      mockFetchMentors.mockResolvedValueOnce({
        data: { results: [] },
      });
      // Featured mentors with default
      mockFetchMentors.mockResolvedValueOnce({
        data: {
          results: [
            { slug: 'featured-1', metadata: {} },
            { slug: 'default-mentor', metadata: { default: true } },
          ],
        },
      });

      renderHook(() =>
        useMentorProvider({
          ...defaultProps,
          isMainTenant: true,
          isAdmin: false,
        }),
      );

      await waitFor(() => {
        expect(defaultProps.redirectToMentor).toHaveBeenCalledWith('tenant-1', 'default-mentor');
      });
    });

    it('should redirect to default featured mentor for admin', async () => {
      // Recent mentors - empty
      mockFetchMentors.mockResolvedValueOnce({
        data: { results: [] },
      });
      // Featured mentors with default
      mockFetchMentors.mockResolvedValueOnce({
        data: {
          results: [
            { slug: 'featured-1', metadata: {} },
            { slug: 'default-mentor', metadata: { default: true } },
          ],
        },
      });

      renderHook(() =>
        useMentorProvider({
          ...defaultProps,
          isAdmin: true,
        }),
      );

      await waitFor(() => {
        expect(defaultProps.redirectToMentor).toHaveBeenCalledWith('tenant-1', 'default-mentor');
      });
    });

    it('should redirect to first featured mentor when no default', async () => {
      // Recent mentors - empty
      mockFetchMentors.mockResolvedValueOnce({
        data: { results: [] },
      });
      // Featured mentors without default
      mockFetchMentors.mockResolvedValueOnce({
        data: {
          results: [
            { slug: 'featured-1', metadata: {} },
            { slug: 'featured-2', metadata: {} },
          ],
        },
      });

      renderHook(() => useMentorProvider(defaultProps));

      await waitFor(() => {
        expect(defaultProps.redirectToMentor).toHaveBeenCalledWith('tenant-1', 'featured-1');
      });
    });
  });

  describe('non-featured mentors flow', () => {
    it('should redirect to non-featured mentor when no featured mentors', async () => {
      // Recent mentors - empty
      mockFetchMentors.mockResolvedValueOnce({
        data: { results: [] },
      });
      // Featured mentors - empty
      mockFetchMentors.mockResolvedValueOnce({
        data: { results: [] },
      });
      // Non-featured mentors
      mockFetchMentors.mockResolvedValueOnce({
        data: { results: [{ slug: 'non-featured-mentor' }] },
      });

      renderHook(() => useMentorProvider(defaultProps));

      await waitFor(() => {
        expect(defaultProps.redirectToMentor).toHaveBeenCalledWith(
          'tenant-1',
          'non-featured-mentor',
        );
      });
    });
  });

  describe('no mentors flow - admin', () => {
    it('should seed mentors and redirect for admin when no mentors exist', async () => {
      // Recent mentors - empty
      mockFetchMentors.mockResolvedValueOnce({
        data: { results: [] },
      });
      // Featured mentors - empty
      mockFetchMentors.mockResolvedValueOnce({
        data: { results: [] },
      });
      // Non-featured mentors - empty
      mockFetchMentors.mockResolvedValueOnce({
        data: { results: [] },
      });
      // Seed mentors
      mockFetchSeedMentors.mockResolvedValueOnce({
        data: { details: 'Mentors seeded successfully' },
      });
      // Featured mentors after seed
      mockFetchMentors.mockResolvedValueOnce({
        data: { results: [{ slug: 'seeded-mentor' }] },
      });

      renderHook(() =>
        useMentorProvider({
          ...defaultProps,
          isAdmin: true,
        }),
      );

      await waitFor(() => {
        expect(mockFetchSeedMentors).toHaveBeenCalled();
        expect(defaultProps.redirectToMentor).toHaveBeenCalledWith('tenant-1', 'seeded-mentor');
      });
    });

    it('should redirect to create mentor when seeding fails', async () => {
      // Recent mentors - empty
      mockFetchMentors.mockResolvedValueOnce({
        data: { results: [] },
      });
      // Featured mentors - empty
      mockFetchMentors.mockResolvedValueOnce({
        data: { results: [] },
      });
      // Non-featured mentors - empty
      mockFetchMentors.mockResolvedValueOnce({
        data: { results: [] },
      });
      // Seed mentors - no details (failure)
      mockFetchSeedMentors.mockResolvedValueOnce({
        data: { details: null },
      });

      renderHook(() =>
        useMentorProvider({
          ...defaultProps,
          isAdmin: true,
        }),
      );

      await waitFor(() => {
        expect(defaultProps.redirectToCreateMentor).toHaveBeenCalled();
      });
    });
  });

  describe('no mentors flow - non-admin', () => {
    it('should redirect to no mentors page for non-admin when no mentors exist', async () => {
      // Recent mentors - empty
      mockFetchMentors.mockResolvedValueOnce({
        data: { results: [] },
      });
      // Featured mentors - empty
      mockFetchMentors.mockResolvedValueOnce({
        data: { results: [] },
      });
      // Non-featured mentors - empty
      mockFetchMentors.mockResolvedValueOnce({
        data: { results: [] },
      });

      renderHook(() => useMentorProvider(defaultProps));

      await waitFor(() => {
        expect(defaultProps.redirectToNoMentorsPage).toHaveBeenCalled();
      });
    });
  });

  describe('error handling', () => {
    it('should handle errors and redirect to auth SPA', async () => {
      const error = new Error('API Error');
      mockFetchMentors.mockRejectedValueOnce(error);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      renderHook(() => useMentorProvider(defaultProps));

      await waitFor(() => {
        expect(defaultProps.onAuthFailure).toHaveBeenCalledWith('Unexpected error: API Error');
        expect(defaultProps.redirectToAuthSpa).toHaveBeenCalled();
      });

      consoleSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });

    it('should handle non-Error exceptions', async () => {
      mockFetchMentors.mockRejectedValueOnce('String error');

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      renderHook(() => useMentorProvider(defaultProps));

      await waitFor(() => {
        expect(defaultProps.onAuthFailure).toHaveBeenCalledWith('Unexpected error: String error');
      });

      consoleSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });
  });

  describe('loading state', () => {
    it('should set isLoading to false after completion', async () => {
      mockFetchMentors.mockResolvedValueOnce({
        data: { results: [{ slug: 'mentor' }] },
      });

      const { result } = renderHook(() => useMentorProvider(defaultProps));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  describe('edge cases', () => {
    it('should handle undefined results in API response', async () => {
      mockFetchMentors.mockResolvedValueOnce({
        data: { results: undefined },
      });
      mockFetchMentors.mockResolvedValueOnce({
        data: { results: [{ slug: 'featured' }] },
      });

      renderHook(() => useMentorProvider(defaultProps));

      await waitFor(() => {
        expect(defaultProps.redirectToMentor).toHaveBeenCalledWith('tenant-1', 'featured');
      });
    });

    it('should handle mentor with undefined slug', async () => {
      mockFetchMentors.mockResolvedValueOnce({
        data: { results: [{ slug: undefined }] },
      });

      renderHook(() => useMentorProvider(defaultProps));

      await waitFor(() => {
        expect(defaultProps.redirectToMentor).toHaveBeenCalledWith('tenant-1', '');
      });
    });

    it('should handle undefined results in non-featured mentors', async () => {
      // Recent mentors - empty
      mockFetchMentors.mockResolvedValueOnce({
        data: { results: [] },
      });
      // Featured mentors - empty
      mockFetchMentors.mockResolvedValueOnce({
        data: { results: [] },
      });
      // Non-featured mentors - undefined results
      mockFetchMentors.mockResolvedValueOnce({
        data: { results: undefined },
      });

      renderHook(() => useMentorProvider(defaultProps));

      await waitFor(() => {
        expect(defaultProps.redirectToNoMentorsPage).toHaveBeenCalled();
      });
    });

    it('should handle non-featured mentor with undefined slug', async () => {
      // Recent mentors - empty
      mockFetchMentors.mockResolvedValueOnce({
        data: { results: [] },
      });
      // Featured mentors - empty
      mockFetchMentors.mockResolvedValueOnce({
        data: { results: [] },
      });
      // Non-featured mentors with undefined slug
      mockFetchMentors.mockResolvedValueOnce({
        data: { results: [{ slug: undefined }] },
      });

      renderHook(() => useMentorProvider(defaultProps));

      await waitFor(() => {
        expect(defaultProps.redirectToMentor).toHaveBeenCalledWith('tenant-1', '');
      });
    });

    it('should handle seeded mentors with empty results after seed', async () => {
      // Recent mentors - empty
      mockFetchMentors.mockResolvedValueOnce({
        data: { results: [] },
      });
      // Featured mentors - empty
      mockFetchMentors.mockResolvedValueOnce({
        data: { results: [] },
      });
      // Non-featured mentors - empty
      mockFetchMentors.mockResolvedValueOnce({
        data: { results: [] },
      });
      // Seed mentors - success
      mockFetchSeedMentors.mockResolvedValueOnce({
        data: { details: 'Mentors seeded' },
      });
      // Featured mentors after seed - still empty
      mockFetchMentors.mockResolvedValueOnce({
        data: { results: [] },
      });

      const { result } = renderHook(() =>
        useMentorProvider({
          ...defaultProps,
          isAdmin: true,
        }),
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // When seeding returns details but no mentors found after,
      // the function just ends without redirect
      expect(defaultProps.redirectToMentor).not.toHaveBeenCalled();
      expect(defaultProps.redirectToCreateMentor).not.toHaveBeenCalled();
    });

    it('should handle seeded mentors with undefined results after seed', async () => {
      // Recent mentors - empty
      mockFetchMentors.mockResolvedValueOnce({
        data: { results: [] },
      });
      // Featured mentors - empty
      mockFetchMentors.mockResolvedValueOnce({
        data: { results: [] },
      });
      // Non-featured mentors - empty
      mockFetchMentors.mockResolvedValueOnce({
        data: { results: [] },
      });
      // Seed mentors - success
      mockFetchSeedMentors.mockResolvedValueOnce({
        data: { details: 'Mentors seeded' },
      });
      // Featured mentors after seed - undefined results
      mockFetchMentors.mockResolvedValueOnce({
        data: { results: undefined },
      });

      const { result } = renderHook(() =>
        useMentorProvider({
          ...defaultProps,
          isAdmin: true,
        }),
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should handle seeded mentor with undefined slug', async () => {
      // Recent mentors - empty
      mockFetchMentors.mockResolvedValueOnce({
        data: { results: [] },
      });
      // Featured mentors - empty
      mockFetchMentors.mockResolvedValueOnce({
        data: { results: [] },
      });
      // Non-featured mentors - empty
      mockFetchMentors.mockResolvedValueOnce({
        data: { results: [] },
      });
      // Seed mentors - success
      mockFetchSeedMentors.mockResolvedValueOnce({
        data: { details: 'Mentors seeded' },
      });
      // Featured mentors after seed - has mentor with undefined slug
      mockFetchMentors.mockResolvedValueOnce({
        data: { results: [{ slug: undefined }] },
      });

      renderHook(() =>
        useMentorProvider({
          ...defaultProps,
          isAdmin: true,
        }),
      );

      await waitFor(() => {
        expect(defaultProps.redirectToMentor).toHaveBeenCalledWith('tenant-1', '');
      });
    });

    it('should handle main tenant non-admin without default mentor', async () => {
      // Recent mentors - empty
      mockFetchMentors.mockResolvedValueOnce({
        data: { results: [] },
      });
      // Featured mentors without default
      mockFetchMentors.mockResolvedValueOnce({
        data: {
          results: [
            { slug: 'featured-1', metadata: {} },
            { slug: 'featured-2', metadata: { default: false } },
          ],
        },
      });

      renderHook(() =>
        useMentorProvider({
          ...defaultProps,
          isMainTenant: true,
          isAdmin: false,
        }),
      );

      await waitFor(() => {
        // Should fall through to first featured mentor
        expect(defaultProps.redirectToMentor).toHaveBeenCalledWith('tenant-1', 'featured-1');
      });
    });

    it('should handle featured mentor without metadata', async () => {
      // Recent mentors - empty
      mockFetchMentors.mockResolvedValueOnce({
        data: { results: [] },
      });
      // Featured mentors without metadata
      mockFetchMentors.mockResolvedValueOnce({
        data: {
          results: [{ slug: 'featured-1' }],
        },
      });

      renderHook(() => useMentorProvider(defaultProps));

      await waitFor(() => {
        expect(defaultProps.redirectToMentor).toHaveBeenCalledWith('tenant-1', 'featured-1');
      });
    });

    it('should handle default mentor with undefined slug', async () => {
      // Recent mentors - empty
      mockFetchMentors.mockResolvedValueOnce({
        data: { results: [] },
      });
      // Featured mentors with default that has undefined slug
      mockFetchMentors.mockResolvedValueOnce({
        data: {
          results: [{ slug: undefined, metadata: { default: true } }],
        },
      });

      renderHook(() =>
        useMentorProvider({
          ...defaultProps,
          isAdmin: true,
        }),
      );

      await waitFor(() => {
        expect(defaultProps.redirectToMentor).toHaveBeenCalledWith('tenant-1', '');
      });
    });

    it('should call onAuthSuccess when it is provided', async () => {
      mockFetchMentors.mockResolvedValueOnce({
        data: { results: [{ slug: 'mentor' }] },
      });

      renderHook(() => useMentorProvider(defaultProps));

      await waitFor(() => {
        expect(defaultProps.onAuthSuccess).toHaveBeenCalled();
      });
    });

    it('should work when onAuthSuccess is not provided', async () => {
      mockFetchMentors.mockResolvedValueOnce({
        data: { results: [{ slug: 'mentor' }] },
      });

      const propsWithoutCallback = {
        ...defaultProps,
        onAuthSuccess: undefined,
      };

      renderHook(() => useMentorProvider(propsWithoutCallback));

      await waitFor(() => {
        expect(defaultProps.redirectToMentor).toHaveBeenCalled();
      });
    });

    it('should handle featured mentors with undefined data', async () => {
      // Recent mentors - empty
      mockFetchMentors.mockResolvedValueOnce({
        data: { results: [] },
      });
      // Featured mentors - data undefined
      mockFetchMentors.mockResolvedValueOnce({
        data: undefined,
      });
      // Non-featured mentors
      mockFetchMentors.mockResolvedValueOnce({
        data: { results: [{ slug: 'non-featured' }] },
      });

      renderHook(() => useMentorProvider(defaultProps));

      await waitFor(() => {
        expect(defaultProps.redirectToMentor).toHaveBeenCalledWith('tenant-1', 'non-featured');
      });
    });

    it('should handle main tenant non-admin with default mentor with undefined slug', async () => {
      // Recent mentors - empty
      mockFetchMentors.mockResolvedValueOnce({
        data: { results: [] },
      });
      // Featured mentors with default that has undefined slug
      mockFetchMentors.mockResolvedValueOnce({
        data: {
          results: [{ slug: undefined, metadata: { default: true } }],
        },
      });

      renderHook(() =>
        useMentorProvider({
          ...defaultProps,
          isMainTenant: true,
          isAdmin: false,
        }),
      );

      await waitFor(() => {
        expect(defaultProps.redirectToMentor).toHaveBeenCalledWith('tenant-1', '');
      });
    });

    it('should handle first featured mentor with undefined slug when no default', async () => {
      // Recent mentors - empty
      mockFetchMentors.mockResolvedValueOnce({
        data: { results: [] },
      });
      // Featured mentors without default - first has undefined slug
      mockFetchMentors.mockResolvedValueOnce({
        data: {
          results: [
            { slug: undefined, metadata: {} },
            { slug: 'second-mentor', metadata: {} },
          ],
        },
      });

      renderHook(() => useMentorProvider(defaultProps));

      await waitFor(() => {
        expect(defaultProps.redirectToMentor).toHaveBeenCalledWith('tenant-1', '');
      });
    });
  });
});
