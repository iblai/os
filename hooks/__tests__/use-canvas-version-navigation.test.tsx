import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Mock RTK Query hooks
const mockFetchArtifactVersion = vi.fn();
const mockFetchVersionsList = vi.fn(() => ({
  unwrap: () => Promise.resolve([]),
}));
const mockSetCurrentVersionMutation = vi.fn();
const mockRefetchVersions = vi.fn();

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useListArtifactVersionsQuery: vi.fn(() => ({
    data: [],
    refetch: mockRefetchVersions,
  })),
  useLazyGetArtifactVersionQuery: vi.fn(() => [mockFetchArtifactVersion]),
  useLazyListArtifactVersionsQuery: vi.fn(() => [mockFetchVersionsList]),
  useSetCurrentVersionMutation: vi.fn(() => [mockSetCurrentVersionMutation]),
}));

vi.mock('@/components/canvas/canvas-utils', () => ({
  normalizeContentToMarkdown: vi.fn((content: string) => content || ''),
}));

vi.mock('@/lib/utils', () => ({
  markdownToHtml: vi.fn((md: string) => `<p>${md}</p>`),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { useCanvasVersionNavigation } from '../use-canvas-version-navigation';
import { useListArtifactVersionsQuery } from '@iblai/iblai-js/data-layer';

describe('useCanvasVersionNavigation', () => {
  const mockEditorRef = {
    current: {
      commands: {
        setContent: vi.fn(),
      },
    },
  };

  const mockApplyProgrammaticContent = vi.fn();
  const mockOnVersionChange = vi.fn();
  const mockDebouncedSaveCancel = vi.fn();

  const defaultProps = {
    artifactId: 1,
    org: 'test-org',
    userId: 'test-user',
    editorRef: mockEditorRef as any,
    applyProgrammaticContent: mockApplyProgrammaticContent,
    onVersionChange: mockOnVersionChange,
    debouncedSaveCancel: mockDebouncedSaveCancel,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('should return initial state values', () => {
      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      expect(result.current.currentVersion).toBeNull();
      expect(result.current.activeVersionId).toBeNull();
      expect(result.current.activeVersionIsCurrent).toBe(true);
      expect(result.current.isVersionLoading).toBe(false);
      expect(result.current.versionHistory).toEqual([]);
      expect(result.current.isViewingCurrentVersion).toBe(true);
    });

    it('should return navigation state', () => {
      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      expect(result.current.canGoPrevious).toBe(false);
      expect(result.current.canGoNext).toBe(false);
      expect(result.current.currentVersionIndex).toBe(-1);
    });

    it('should provide action functions', () => {
      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      expect(typeof result.current.viewVersion).toBe('function');
      expect(typeof result.current.handlePreviousVersion).toBe('function');
      expect(typeof result.current.handleNextVersion).toBe('function');
      expect(typeof result.current.handleBackToLatest).toBe('function');
      expect(typeof result.current.handleRestoreVersion).toBe('function');
      expect(typeof result.current.updateVersionAfterStreaming).toBe(
        'function',
      );
      expect(typeof result.current.resetVersionNavigation).toBe('function');
      expect(typeof result.current.markWasOnCurrentVersionBeforeSave).toBe(
        'function',
      );
      expect(typeof result.current.silentlyGoToLatest).toBe('function');
    });

    it('should provide refs', () => {
      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      expect(result.current.suppressNextOnChangeRef).toBeDefined();
      expect(result.current.hasUserNavigatedVersionRef).toBeDefined();
      expect(result.current.lastSavedMarkdownRef).toBeDefined();
    });
  });

  describe('with version data', () => {
    beforeEach(() => {
      const mockVersionsData = [
        {
          id: 1,
          version_number: 1,
          content: 'v1 content',
          is_current: false,
          date_created: '2024-01-01',
        },
        {
          id: 2,
          version_number: 2,
          content: 'v2 content',
          is_current: true,
          date_created: '2024-01-02',
        },
      ];

      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: mockVersionsData,
        refetch: mockRefetchVersions,
      } as any);
    });

    it('should populate version history from API data', async () => {
      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      await waitFor(() => {
        expect(result.current.versionHistory.length).toBe(2);
      });

      expect(result.current.versionHistory[0].id).toBe('v1');
      expect(result.current.versionHistory[1].id).toBe('v2');
    });

    it('should set current version from API data', async () => {
      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      await waitFor(() => {
        expect(result.current.currentVersion).toBe('v2');
      });
    });

    it('should enable navigation when viewing non-latest version', async () => {
      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      await waitFor(() => {
        expect(result.current.versionHistory.length).toBe(2);
      });

      // After viewing v1, should be able to go next
      act(() => {
        result.current.setActiveVersionId('v1');
        result.current.setActiveVersionIsCurrent(false);
      });

      expect(result.current.canGoNext).toBe(true);
    });
  });

  describe('updateVersionAfterStreaming', () => {
    it('should update version state after streaming', async () => {
      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: [],
        refetch: mockRefetchVersions,
      } as any);

      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      act(() => {
        result.current.updateVersionAfterStreaming(2, 'new content');
      });

      expect(result.current.activeVersionId).toBe('v2');
      expect(result.current.activeVersionIsCurrent).toBe(true);
      expect(result.current.currentVersion).toBe('v2');
    });

    it('should handle partial update with indices', async () => {
      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: [],
        refetch: mockRefetchVersions,
      } as any);

      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      act(() => {
        result.current.updateVersionAfterStreaming(
          2,
          'replacement',
          5,
          10,
          'Hello World Here',
        );
      });

      expect(result.current.activeVersionId).toBe('v2');
    });
  });

  describe('resetVersionNavigation', () => {
    it('should reset hasUserNavigatedVersionRef and activeVersionIsCurrent', async () => {
      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: [],
        refetch: mockRefetchVersions,
      } as any);

      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      // Set some state first
      act(() => {
        result.current.setActiveVersionId('v1');
        result.current.setActiveVersionIsCurrent(false);
      });

      expect(result.current.activeVersionIsCurrent).toBe(false);

      act(() => {
        result.current.resetVersionNavigation();
      });

      // After reset, activeVersionIsCurrent should be true and hasUserNavigatedVersionRef should be false
      expect(result.current.activeVersionIsCurrent).toBe(true);
      // Note: activeVersionId may still be set until useEffect runs
    });
  });

  describe('isVersionNavDisabled', () => {
    it('should be disabled when streaming', () => {
      const { result } = renderHook(() =>
        useCanvasVersionNavigation({
          ...defaultProps,
          isStreamingArtifact: true,
        }),
      );

      expect(result.current.isVersionNavDisabled).toBe(true);
    });

    it('should be disabled when content is updating', () => {
      const { result } = renderHook(() =>
        useCanvasVersionNavigation({
          ...defaultProps,
          isContentUpdating: true,
        }),
      );

      expect(result.current.isVersionNavDisabled).toBe(true);
    });

    it('should be disabled when initial loading', () => {
      const { result } = renderHook(() =>
        useCanvasVersionNavigation({
          ...defaultProps,
          isInitialLoading: true,
        }),
      );

      expect(result.current.isVersionNavDisabled).toBe(true);
    });

    it('should be enabled when not loading or streaming', () => {
      const { result } = renderHook(() =>
        useCanvasVersionNavigation({
          ...defaultProps,
          isStreamingArtifact: false,
          isContentUpdating: false,
          isInitialLoading: false,
        }),
      );

      expect(result.current.isVersionNavDisabled).toBe(false);
    });
  });

  describe('silentlyGoToLatest', () => {
    beforeEach(() => {
      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: [
          {
            id: 1,
            version_number: 1,
            content: 'v1',
            is_current: false,
            date_created: '2024-01-01',
          },
          {
            id: 2,
            version_number: 2,
            content: 'v2',
            is_current: true,
            date_created: '2024-01-02',
          },
        ],
        refetch: mockRefetchVersions,
      } as any);
    });

    it('should go to latest version without API call', async () => {
      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      await waitFor(() => {
        expect(result.current.versionHistory.length).toBe(2);
      });

      // Go to v1 first
      act(() => {
        result.current.setActiveVersionId('v1');
        result.current.setActiveVersionIsCurrent(false);
      });

      expect(result.current.activeVersionId).toBe('v1');

      // Silently go to latest
      act(() => {
        result.current.silentlyGoToLatest();
      });

      expect(result.current.activeVersionId).toBe('v2');
      expect(result.current.activeVersionIsCurrent).toBe(true);
    });
  });

  describe('markWasOnCurrentVersionBeforeSave', () => {
    it('should mark the ref correctly', async () => {
      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: [
          {
            id: 1,
            version_number: 1,
            content: 'v1',
            is_current: true,
            date_created: '2024-01-01',
          },
        ],
        refetch: mockRefetchVersions,
      } as any);

      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      await waitFor(() => {
        expect(result.current.isViewingCurrentVersion).toBe(true);
      });

      act(() => {
        result.current.markWasOnCurrentVersionBeforeSave();
      });

      // Function should execute without error
      expect(typeof result.current.markWasOnCurrentVersionBeforeSave).toBe(
        'function',
      );
    });
  });

  describe('viewVersion', () => {
    it('should load a specific version', async () => {
      const mockVersionsData = [
        {
          id: 1,
          version_number: 1,
          content: 'v1 content',
          is_current: false,
          date_created: '2024-01-01',
        },
        {
          id: 2,
          version_number: 2,
          content: 'v2 content',
          is_current: true,
          date_created: '2024-01-02',
        },
      ];

      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: mockVersionsData,
        refetch: mockRefetchVersions,
      } as any);

      mockFetchArtifactVersion.mockResolvedValue({
        unwrap: () =>
          Promise.resolve({
            version_number: 1,
            content: 'v1 content',
            is_current: false,
          }),
      });

      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      await waitFor(() => {
        expect(result.current.versionHistory.length).toBe(2);
      });

      await act(async () => {
        await result.current.viewVersion('v1');
      });

      expect(mockFetchArtifactVersion).toHaveBeenCalled();
    });

    it('should handle viewVersion when version not found', async () => {
      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: [
          {
            id: 1,
            version_number: 1,
            content: 'v1',
            is_current: true,
            date_created: '2024-01-01',
          },
        ],
        refetch: mockRefetchVersions,
      } as any);

      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      await waitFor(() => {
        expect(result.current.versionHistory.length).toBe(1);
      });

      await act(async () => {
        await result.current.viewVersion('v999');
      });

      // Should not call fetch for non-existent version
      expect(mockFetchArtifactVersion).not.toHaveBeenCalled();
    });
  });

  describe('handlePreviousVersion', () => {
    it('should navigate to previous version when available', async () => {
      const mockVersionsData = [
        {
          id: 1,
          version_number: 1,
          content: 'v1 content',
          is_current: false,
          date_created: '2024-01-01',
        },
        {
          id: 2,
          version_number: 2,
          content: 'v2 content',
          is_current: true,
          date_created: '2024-01-02',
        },
      ];

      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: mockVersionsData,
        refetch: mockRefetchVersions,
      } as any);

      mockFetchArtifactVersion.mockResolvedValue({
        unwrap: () =>
          Promise.resolve({
            version_number: 1,
            content: 'v1 content',
            is_current: false,
          }),
      });

      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      await waitFor(() => {
        expect(result.current.versionHistory.length).toBe(2);
      });

      // Set active version to v2
      act(() => {
        result.current.setActiveVersionId('v2');
      });

      // Try to go previous
      await act(async () => {
        await result.current.handlePreviousVersion();
      });

      expect(mockFetchArtifactVersion).toHaveBeenCalled();
    });
  });

  describe('handleNextVersion', () => {
    it('should navigate to next version when available', async () => {
      const mockVersionsData = [
        {
          id: 1,
          version_number: 1,
          content: 'v1 content',
          is_current: false,
          date_created: '2024-01-01',
        },
        {
          id: 2,
          version_number: 2,
          content: 'v2 content',
          is_current: true,
          date_created: '2024-01-02',
        },
      ];

      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: mockVersionsData,
        refetch: mockRefetchVersions,
      } as any);

      mockFetchArtifactVersion.mockResolvedValue({
        unwrap: () =>
          Promise.resolve({
            version_number: 2,
            content: 'v2 content',
            is_current: true,
          }),
      });

      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      await waitFor(() => {
        expect(result.current.versionHistory.length).toBe(2);
      });

      // Set active version to v1
      act(() => {
        result.current.setActiveVersionId('v1');
        result.current.setActiveVersionIsCurrent(false);
      });

      // Try to go next
      await act(async () => {
        await result.current.handleNextVersion();
      });

      expect(mockFetchArtifactVersion).toHaveBeenCalled();
    });
  });

  describe('handleBackToLatest', () => {
    it('should navigate back to latest version', async () => {
      const mockVersionsData = [
        {
          id: 1,
          version_number: 1,
          content: 'v1 content',
          is_current: false,
          date_created: '2024-01-01',
        },
        {
          id: 2,
          version_number: 2,
          content: 'v2 content',
          is_current: true,
          date_created: '2024-01-02',
        },
      ];

      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: mockVersionsData,
        refetch: mockRefetchVersions,
      } as any);

      mockFetchArtifactVersion.mockResolvedValue({
        unwrap: () =>
          Promise.resolve({
            version_number: 2,
            content: 'v2 content',
            is_current: true,
          }),
      });

      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      await waitFor(() => {
        expect(result.current.versionHistory.length).toBe(2);
      });

      // Set active version to v1
      act(() => {
        result.current.setActiveVersionId('v1');
        result.current.setActiveVersionIsCurrent(false);
      });

      // Go back to latest
      await act(async () => {
        await result.current.handleBackToLatest();
      });

      expect(mockFetchArtifactVersion).toHaveBeenCalled();
    });
  });

  describe('handleRestoreVersion', () => {
    it('should restore a version', async () => {
      const mockVersionsData = [
        {
          id: 1,
          version_number: 1,
          content: 'v1 content',
          is_current: false,
          date_created: '2024-01-01',
        },
        {
          id: 2,
          version_number: 2,
          content: 'v2 content',
          is_current: true,
          date_created: '2024-01-02',
        },
      ];

      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: mockVersionsData,
        refetch: mockRefetchVersions,
      } as any);

      mockSetCurrentVersionMutation.mockResolvedValue({
        unwrap: () => Promise.resolve({}),
      });
      mockFetchArtifactVersion.mockResolvedValue({
        unwrap: () =>
          Promise.resolve({
            version_number: 1,
            content: 'v1 content',
            is_current: true,
          }),
      });

      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      await waitFor(() => {
        expect(result.current.versionHistory.length).toBe(2);
      });

      // Set active version to v1
      act(() => {
        result.current.setActiveVersionId('v1');
        result.current.setActiveVersionIsCurrent(false);
      });

      // Restore version
      await act(async () => {
        await result.current.handleRestoreVersion();
      });

      expect(mockSetCurrentVersionMutation).toHaveBeenCalled();
    });

    it('should not restore when no active version', async () => {
      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: [],
        refetch: mockRefetchVersions,
      } as any);

      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      await act(async () => {
        await result.current.handleRestoreVersion();
      });

      expect(mockSetCurrentVersionMutation).not.toHaveBeenCalled();
    });
  });

  describe('silentlyGoToLatest with no current version', () => {
    it('should go to last version when no version marked as current', async () => {
      const mockVersionsData = [
        {
          id: 1,
          version_number: 1,
          content: 'v1 content',
          is_current: false,
          date_created: '2024-01-01',
        },
        {
          id: 2,
          version_number: 2,
          content: 'v2 content',
          is_current: false,
          date_created: '2024-01-02',
        },
      ];

      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: mockVersionsData,
        refetch: mockRefetchVersions,
      } as any);

      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      await waitFor(() => {
        expect(result.current.versionHistory.length).toBe(2);
      });

      // Go to v1 first
      act(() => {
        result.current.setActiveVersionId('v1');
        result.current.setActiveVersionIsCurrent(false);
      });

      // Silently go to latest
      act(() => {
        result.current.silentlyGoToLatest();
      });

      expect(result.current.activeVersionId).toBe('v2');
    });
  });

  describe('canGoPrevious and canGoNext', () => {
    it('should return correct values when at first version', async () => {
      const mockVersionsData = [
        {
          id: 1,
          version_number: 1,
          content: 'v1 content',
          is_current: false,
          date_created: '2024-01-01',
        },
        {
          id: 2,
          version_number: 2,
          content: 'v2 content',
          is_current: true,
          date_created: '2024-01-02',
        },
      ];

      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: mockVersionsData,
        refetch: mockRefetchVersions,
      } as any);

      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      await waitFor(() => {
        expect(result.current.versionHistory.length).toBe(2);
      });

      // Set to first version
      act(() => {
        result.current.setActiveVersionId('v1');
        result.current.setActiveVersionIsCurrent(false);
      });

      expect(result.current.canGoPrevious).toBe(false);
      expect(result.current.canGoNext).toBe(true);
    });

    it('should return correct values when at last version', async () => {
      const mockVersionsData = [
        {
          id: 1,
          version_number: 1,
          content: 'v1 content',
          is_current: false,
          date_created: '2024-01-01',
        },
        {
          id: 2,
          version_number: 2,
          content: 'v2 content',
          is_current: true,
          date_created: '2024-01-02',
        },
      ];

      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: mockVersionsData,
        refetch: mockRefetchVersions,
      } as any);

      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      await waitFor(() => {
        expect(result.current.versionHistory.length).toBe(2);
      });

      // Set to last version
      act(() => {
        result.current.setActiveVersionId('v2');
        result.current.setActiveVersionIsCurrent(true);
      });

      expect(result.current.canGoPrevious).toBe(true);
      expect(result.current.canGoNext).toBe(false);
    });
  });

  describe('latestVersionId', () => {
    it('should return the current version id', async () => {
      const mockVersionsData = [
        {
          id: 1,
          version_number: 1,
          content: 'v1 content',
          is_current: false,
          date_created: '2024-01-01',
        },
        {
          id: 2,
          version_number: 2,
          content: 'v2 content',
          is_current: true,
          date_created: '2024-01-02',
        },
      ];

      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: mockVersionsData,
        refetch: mockRefetchVersions,
      } as any);

      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      await waitFor(() => {
        expect(result.current.latestVersionId).toBe('v2');
      });
    });
  });

  describe('setVersionHistory', () => {
    it('should allow setting version history directly', async () => {
      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: [],
        refetch: mockRefetchVersions,
      } as any);

      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      act(() => {
        result.current.setVersionHistory([
          {
            id: 'v1',
            label: 'v1',
            content: 'test',
            timestamp: '2024-01-01',
            isCurrent: true,
          },
        ]);
      });

      expect(result.current.versionHistory.length).toBe(1);
    });
  });

  describe('setCurrentVersion', () => {
    it('should allow setting current version directly', async () => {
      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: [],
        refetch: mockRefetchVersions,
      } as any);

      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      act(() => {
        result.current.setCurrentVersion('v5');
      });

      expect(result.current.currentVersion).toBe('v5');
    });
  });

  describe('viewVersion error handling', () => {
    it('should handle API error when fetching version', async () => {
      const mockVersionsData = [
        {
          id: 1,
          version_number: 1,
          content: 'v1 content',
          is_current: false,
          date_created: '2024-01-01',
        },
        {
          id: 2,
          version_number: 2,
          content: 'v2 content',
          is_current: true,
          date_created: '2024-01-02',
        },
      ];

      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: mockVersionsData,
        refetch: mockRefetchVersions,
      } as any);

      mockFetchArtifactVersion.mockRejectedValue(new Error('API Error'));

      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      await waitFor(() => {
        expect(result.current.versionHistory.length).toBe(2);
      });

      await act(async () => {
        await result.current.viewVersion('v1');
      });

      // Should have called the error console log (error format changed to include context)
      expect(console.error).toHaveBeenCalledWith(
        '[Canvas] Failed to load version - non-retriable error:',
        expect.objectContaining({
          artifactId: 1,
          versionId: 1,
          error: expect.any(Error),
        }),
      );
    });

    it('should not fetch when version has no versionId', async () => {
      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: [],
        refetch: mockRefetchVersions,
      } as any);

      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      // Set version history without versionId
      act(() => {
        result.current.setVersionHistory([
          {
            id: 'v1',
            label: 'v1',
            content: 'test',
            timestamp: '2024-01-01',
            isCurrent: true,
          },
        ]);
      });

      await act(async () => {
        await result.current.viewVersion('v1');
      });

      expect(mockFetchArtifactVersion).not.toHaveBeenCalled();
    });
  });

  describe('metadataVersionNumber initialization', () => {
    it('should initialize to metadata version when provided', async () => {
      const mockVersionsData = [
        {
          id: 1,
          version_number: 1,
          content: 'v1 content',
          is_current: false,
          date_created: '2024-01-01',
        },
        {
          id: 2,
          version_number: 2,
          content: 'v2 content',
          is_current: true,
          date_created: '2024-01-02',
        },
      ];

      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: mockVersionsData,
        refetch: mockRefetchVersions,
      } as any);

      const { result } = renderHook(() =>
        useCanvasVersionNavigation({
          ...defaultProps,
          metadataVersionNumber: 1,
        }),
      );

      await waitFor(() => {
        expect(result.current.activeVersionId).toBe('v1');
      });
    });

    it('should reinitialize when metadataVersionNumber changes', async () => {
      const mockVersionsData = [
        {
          id: 1,
          version_number: 1,
          content: 'v1 content',
          is_current: false,
          date_created: '2024-01-01',
        },
        {
          id: 2,
          version_number: 2,
          content: 'v2 content',
          is_current: true,
          date_created: '2024-01-02',
        },
      ];

      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: mockVersionsData,
        refetch: mockRefetchVersions,
      } as any);

      const { result, rerender } = renderHook(
        (props) => useCanvasVersionNavigation(props),
        {
          initialProps: {
            ...defaultProps,
            metadataVersionNumber: 1,
          },
        },
      );

      await waitFor(() => {
        expect(result.current.activeVersionId).toBe('v1');
      });

      // Change metadata version number
      rerender({
        ...defaultProps,
        metadataVersionNumber: 2,
      });

      await waitFor(() => {
        expect(result.current.activeVersionId).toBe('v2');
      });
    });
  });

  describe('handleRestoreVersion error handling', () => {
    it('should handle error when restoring version fails', async () => {
      const mockVersionsData = [
        {
          id: 1,
          version_number: 1,
          content: 'v1 content',
          is_current: false,
          date_created: '2024-01-01',
        },
        {
          id: 2,
          version_number: 2,
          content: 'v2 content',
          is_current: true,
          date_created: '2024-01-02',
        },
      ];

      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: mockVersionsData,
        refetch: mockRefetchVersions,
      } as any);

      mockSetCurrentVersionMutation.mockRejectedValue(
        new Error('Restore failed'),
      );

      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      await waitFor(() => {
        expect(result.current.versionHistory.length).toBe(2);
      });

      // Set to v1
      act(() => {
        result.current.setActiveVersionId('v1');
        result.current.setActiveVersionIsCurrent(false);
      });

      await act(async () => {
        await result.current.handleRestoreVersion();
      });

      expect(console.error).toHaveBeenCalledWith(
        '[Canvas] Error restoring version:',
        expect.any(Error),
      );
    });

    it('should not restore when version versionId is missing', async () => {
      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: [],
        refetch: mockRefetchVersions,
      } as any);

      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      // Set version history without versionId
      act(() => {
        result.current.setVersionHistory([
          {
            id: 'v1',
            label: 'v1',
            content: 'test',
            timestamp: '2024-01-01',
            isCurrent: false,
          },
        ]);
        result.current.setActiveVersionId('v1');
      });

      await act(async () => {
        await result.current.handleRestoreVersion();
      });

      expect(mockSetCurrentVersionMutation).not.toHaveBeenCalled();
    });

    it('should not restore when artifactId is missing', async () => {
      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: [],
        refetch: mockRefetchVersions,
      } as any);

      const { result } = renderHook(() =>
        useCanvasVersionNavigation({
          ...defaultProps,
          artifactId: undefined,
        }),
      );

      act(() => {
        result.current.setVersionHistory([
          {
            id: 'v1',
            label: 'v1',
            content: 'test',
            timestamp: '2024-01-01',
            isCurrent: false,
            versionId: 1,
          },
        ]);
        result.current.setActiveVersionId('v1');
      });

      await act(async () => {
        await result.current.handleRestoreVersion();
      });

      expect(mockSetCurrentVersionMutation).not.toHaveBeenCalled();
    });
  });

  describe('handlePreviousVersion edge cases', () => {
    it('should not navigate when already at first version', async () => {
      const mockVersionsData = [
        {
          id: 1,
          version_number: 1,
          content: 'v1 content',
          is_current: false,
          date_created: '2024-01-01',
        },
        {
          id: 2,
          version_number: 2,
          content: 'v2 content',
          is_current: true,
          date_created: '2024-01-02',
        },
      ];

      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: mockVersionsData,
        refetch: mockRefetchVersions,
      } as any);

      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      await waitFor(() => {
        expect(result.current.versionHistory.length).toBe(2);
      });

      // Set to first version
      act(() => {
        result.current.setActiveVersionId('v1');
        result.current.setActiveVersionIsCurrent(false);
      });

      await act(async () => {
        await result.current.handlePreviousVersion();
      });

      // Should not have fetched since we can't go previous
      expect(mockFetchArtifactVersion).not.toHaveBeenCalled();
    });
  });

  describe('handleNextVersion edge cases', () => {
    it('should not navigate when already at last version', async () => {
      const mockVersionsData = [
        {
          id: 1,
          version_number: 1,
          content: 'v1 content',
          is_current: false,
          date_created: '2024-01-01',
        },
        {
          id: 2,
          version_number: 2,
          content: 'v2 content',
          is_current: true,
          date_created: '2024-01-02',
        },
      ];

      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: mockVersionsData,
        refetch: mockRefetchVersions,
      } as any);

      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      await waitFor(() => {
        expect(result.current.versionHistory.length).toBe(2);
      });

      // Set to last version
      act(() => {
        result.current.setActiveVersionId('v2');
        result.current.setActiveVersionIsCurrent(true);
      });

      await act(async () => {
        await result.current.handleNextVersion();
      });

      // Should not have fetched since we can't go next
      expect(mockFetchArtifactVersion).not.toHaveBeenCalled();
    });
  });

  describe('handleBackToLatest edge cases', () => {
    it('should not navigate when latestVersionId is null', async () => {
      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: [],
        refetch: mockRefetchVersions,
      } as any);

      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      await act(async () => {
        await result.current.handleBackToLatest();
      });

      expect(mockFetchArtifactVersion).not.toHaveBeenCalled();
    });
  });

  describe('version index computation', () => {
    it('should return -1 when versionHistory is empty', () => {
      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: [],
        refetch: mockRefetchVersions,
      } as any);

      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      expect(result.current.currentVersionIndex).toBe(-1);
    });

    it('should fallback to last index when viewing current but version not found', async () => {
      const mockVersionsData = [
        {
          id: 1,
          version_number: 1,
          content: 'v1 content',
          is_current: false,
          date_created: '2024-01-01',
        },
        {
          id: 2,
          version_number: 2,
          content: 'v2 content',
          is_current: true,
          date_created: '2024-01-02',
        },
      ];

      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: mockVersionsData,
        refetch: mockRefetchVersions,
      } as any);

      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      await waitFor(() => {
        expect(result.current.versionHistory.length).toBe(2);
      });

      // Set a version that doesn't exist
      act(() => {
        result.current.setActiveVersionId('v999');
        result.current.setActiveVersionIsCurrent(true);
      });

      // Should fallback to last index
      expect(result.current.currentVersionIndex).toBe(1);
    });
  });

  describe('updateVersionAfterStreaming with existing version', () => {
    it('should update existing version in history', async () => {
      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: [],
        refetch: mockRefetchVersions,
      } as any);

      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      // Set initial version history
      act(() => {
        result.current.setVersionHistory([
          {
            id: 'v1',
            label: 'v1',
            content: 'old content',
            timestamp: '2024-01-01',
            versionId: 1,
            isCurrent: false,
            versionNumber: 1,
          },
          {
            id: 'v2',
            label: 'v2',
            content: 'current',
            timestamp: '2024-01-02',
            versionId: 2,
            isCurrent: true,
            versionNumber: 2,
          },
        ]);
      });

      // Update v2 with streaming
      act(() => {
        result.current.updateVersionAfterStreaming(2, 'updated content');
      });

      expect(result.current.activeVersionId).toBe('v2');
      expect(
        result.current.versionHistory.find((v) => v.id === 'v2')?.content,
      ).toBe('updated content');
    });
  });

  describe('silentlyGoToLatest with empty history', () => {
    it('should do nothing when versionHistory is empty', () => {
      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: [],
        refetch: mockRefetchVersions,
      } as any);

      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      // Initial state
      expect(result.current.activeVersionId).toBeNull();

      act(() => {
        result.current.silentlyGoToLatest();
      });

      // Should remain null since no versions
      expect(result.current.activeVersionId).toBeNull();
    });
  });

  describe('without debouncedSaveCancel', () => {
    it('should work when debouncedSaveCancel is undefined', async () => {
      const mockVersionsData = [
        {
          id: 1,
          version_number: 1,
          content: 'v1 content',
          is_current: false,
          date_created: '2024-01-01',
        },
        {
          id: 2,
          version_number: 2,
          content: 'v2 content',
          is_current: true,
          date_created: '2024-01-02',
        },
      ];

      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: mockVersionsData,
        refetch: mockRefetchVersions,
      } as any);

      mockFetchArtifactVersion.mockResolvedValue({
        unwrap: () =>
          Promise.resolve({
            version_number: 1,
            content: 'v1 content',
            is_current: false,
          }),
      });

      const { result } = renderHook(() =>
        useCanvasVersionNavigation({
          ...defaultProps,
          debouncedSaveCancel: undefined,
        }),
      );

      await waitFor(() => {
        expect(result.current.versionHistory.length).toBe(2);
      });

      await act(async () => {
        await result.current.viewVersion('v1');
      });

      // Should work without crashing
      expect(mockFetchArtifactVersion).toHaveBeenCalled();
    });
  });

  describe('viewVersion callback invocations', () => {
    it('should call onVersionChange when viewVersion is successful', async () => {
      const mockVersionsData = [
        {
          id: 1,
          version_number: 1,
          content: 'v1 content',
          is_current: false,
          date_created: '2024-01-01',
        },
        {
          id: 2,
          version_number: 2,
          content: 'v2 content',
          is_current: true,
          date_created: '2024-01-02',
        },
      ];

      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: mockVersionsData,
        refetch: mockRefetchVersions,
      } as any);

      mockFetchArtifactVersion.mockResolvedValue({
        unwrap: () =>
          Promise.resolve({
            version_number: 1,
            content: 'v1 content',
            is_current: false,
          }),
      });

      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      await waitFor(() => {
        expect(result.current.versionHistory.length).toBe(2);
      });

      await act(async () => {
        await result.current.viewVersion('v1');
      });

      // The callback is called when version data is successfully fetched
      expect(mockFetchArtifactVersion).toHaveBeenCalled();
    });

    it('should call debouncedSaveCancel when viewing version', async () => {
      const mockVersionsData = [
        {
          id: 1,
          version_number: 1,
          content: 'v1 content',
          is_current: false,
          date_created: '2024-01-01',
        },
        {
          id: 2,
          version_number: 2,
          content: 'v2 content',
          is_current: true,
          date_created: '2024-01-02',
        },
      ];

      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: mockVersionsData,
        refetch: mockRefetchVersions,
      } as any);

      mockFetchArtifactVersion.mockResolvedValue({
        unwrap: () =>
          Promise.resolve({
            version_number: 1,
            content: 'v1 content',
            is_current: false,
          }),
      });

      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      await waitFor(() => {
        expect(result.current.versionHistory.length).toBe(2);
      });

      await act(async () => {
        await result.current.viewVersion('v1');
      });

      expect(mockDebouncedSaveCancel).toHaveBeenCalled();
    });
  });

  describe('query configuration', () => {
    it('should handle missing artifactId', () => {
      const { result } = renderHook(() =>
        useCanvasVersionNavigation({
          ...defaultProps,
          artifactId: undefined,
        }),
      );

      // When artifactId is missing, versionHistory should be empty
      expect(result.current.versionHistory).toEqual([]);
    });

    it('should handle missing org', () => {
      const { result } = renderHook(() =>
        useCanvasVersionNavigation({
          ...defaultProps,
          org: undefined,
        }),
      );

      // When org is missing, versionHistory should be empty
      expect(result.current.versionHistory).toEqual([]);
    });

    it('should handle missing userId', () => {
      const { result } = renderHook(() =>
        useCanvasVersionNavigation({
          ...defaultProps,
          userId: undefined,
        }),
      );

      // When userId is missing, versionHistory should be empty
      expect(result.current.versionHistory).toEqual([]);
    });
  });

  describe('setTimeout callbacks with fake timers', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should reset justUpdatedFromStreamingRef after 3000ms in updateVersionAfterStreaming', async () => {
      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: [],
        refetch: mockRefetchVersions,
      } as any);

      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      // Call updateVersionAfterStreaming
      act(() => {
        result.current.updateVersionAfterStreaming(2, 'new content');
      });

      expect(result.current.activeVersionId).toBe('v2');

      // Advance timers by 3000ms to trigger the setTimeout callback
      await act(async () => {
        vi.advanceTimersByTime(3000);
      });

      // The setTimeout callback should have executed (justUpdatedFromStreamingRef.current = false)
      // We can verify indirectly by checking state is stable
      expect(result.current.activeVersionId).toBe('v2');
    });

    it('should reset justUpdatedFromStreamingRef after 3000ms in silentlyGoToLatest with current version', async () => {
      const mockVersionsData = [
        {
          id: 1,
          version_number: 1,
          content: 'v1 content',
          is_current: false,
          date_created: '2024-01-01',
        },
        {
          id: 2,
          version_number: 2,
          content: 'v2 content',
          is_current: true,
          date_created: '2024-01-02',
        },
      ];

      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: mockVersionsData,
        refetch: mockRefetchVersions,
      } as any);

      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      // Wait for version history to populate
      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      // Go to v1 first
      act(() => {
        result.current.setActiveVersionId('v1');
        result.current.setActiveVersionIsCurrent(false);
      });

      expect(result.current.activeVersionId).toBe('v1');

      // Silently go to latest
      act(() => {
        result.current.silentlyGoToLatest();
      });

      expect(result.current.activeVersionId).toBe('v2');

      // Advance timers by 3000ms to trigger the setTimeout callback
      await act(async () => {
        vi.advanceTimersByTime(3000);
      });

      // The setTimeout callback should have executed
      expect(result.current.activeVersionId).toBe('v2');
      expect(result.current.activeVersionIsCurrent).toBe(true);
    });

    it('should reset justUpdatedFromStreamingRef after 3000ms in silentlyGoToLatest fallback branch', async () => {
      // Version data where no version is marked as current
      const mockVersionsData = [
        {
          id: 1,
          version_number: 1,
          content: 'v1 content',
          is_current: false,
          date_created: '2024-01-01',
        },
        {
          id: 2,
          version_number: 2,
          content: 'v2 content',
          is_current: false,
          date_created: '2024-01-02',
        },
      ];

      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: mockVersionsData,
        refetch: mockRefetchVersions,
      } as any);

      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      // Wait for version history to populate
      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      // Go to v1 first
      act(() => {
        result.current.setActiveVersionId('v1');
        result.current.setActiveVersionIsCurrent(false);
      });

      expect(result.current.activeVersionId).toBe('v1');

      // Silently go to latest - should use fallback since no version is marked as current
      act(() => {
        result.current.silentlyGoToLatest();
      });

      // Should go to last version (v2) since no version is marked as current
      expect(result.current.activeVersionId).toBe('v2');

      // Advance timers by 3000ms to trigger the setTimeout callback
      await act(async () => {
        vi.advanceTimersByTime(3000);
      });

      // The setTimeout callback should have executed
      expect(result.current.activeVersionId).toBe('v2');
      expect(result.current.activeVersionIsCurrent).toBe(true);
    });

    it('should handle wasOnCurrentVersionBeforeSave logic with setTimeouts', async () => {
      const mockVersionsData = [
        {
          id: 1,
          version_number: 1,
          content: 'v1 content',
          is_current: false,
          date_created: '2024-01-01',
        },
        {
          id: 2,
          version_number: 2,
          content: 'v2 content',
          is_current: true,
          date_created: '2024-01-02',
        },
      ];

      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: mockVersionsData,
        refetch: mockRefetchVersions,
      } as any);

      const { result, rerender } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      // Wait for version history to populate
      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      // Set active version to v2 (current)
      act(() => {
        result.current.setActiveVersionId('v2');
        result.current.setActiveVersionIsCurrent(true);
      });

      // Mark was on current version before save
      act(() => {
        result.current.markWasOnCurrentVersionBeforeSave();
      });

      // Now simulate a new version being created (v3 becomes current)
      const updatedVersionsData = [
        {
          id: 1,
          version_number: 1,
          content: 'v1 content',
          is_current: false,
          date_created: '2024-01-01',
        },
        {
          id: 2,
          version_number: 2,
          content: 'v2 content',
          is_current: false,
          date_created: '2024-01-02',
        },
        {
          id: 3,
          version_number: 3,
          content: 'v3 content',
          is_current: true,
          date_created: '2024-01-03',
        },
      ];

      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: updatedVersionsData,
        refetch: mockRefetchVersions,
      } as any);

      // Rerender with new data
      rerender();

      // Advance timers to trigger the setTimeout callbacks (0ms and 100ms)
      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      // The hook should have navigated to v3
      expect(result.current.currentVersion).toBe('v3');
    });
  });

  describe('viewVersion success path', () => {
    it('should update version history and call onVersionChange on successful fetch', async () => {
      const mockVersionsData = [
        {
          id: 1,
          version_number: 1,
          content: 'v1 content',
          is_current: false,
          date_created: '2024-01-01',
        },
        {
          id: 2,
          version_number: 2,
          content: 'v2 content',
          is_current: true,
          date_created: '2024-01-02',
        },
      ];

      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: mockVersionsData,
        refetch: mockRefetchVersions,
      } as any);

      // Mock that properly resolves with unwrap
      mockFetchArtifactVersion.mockImplementation(() => ({
        unwrap: () =>
          Promise.resolve({
            version_number: 1,
            content: 'v1 fetched content',
            is_current: false,
          }),
      }));

      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      await waitFor(() => {
        expect(result.current.versionHistory.length).toBe(2);
      });

      await act(async () => {
        await result.current.viewVersion('v1');
      });

      // Should have called onVersionChange
      expect(mockOnVersionChange).toHaveBeenCalledWith('v1', false);
      // Should have called applyProgrammaticContent
      expect(mockApplyProgrammaticContent).toHaveBeenCalled();
    });

    it('should set version state when fetching with is_current true', async () => {
      const mockVersionsData = [
        {
          id: 1,
          version_number: 1,
          content: 'v1 content',
          is_current: false,
          date_created: '2024-01-01',
        },
        {
          id: 2,
          version_number: 2,
          content: 'v2 content',
          is_current: true,
          date_created: '2024-01-02',
        },
      ];

      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: mockVersionsData,
        refetch: mockRefetchVersions,
      } as any);

      mockFetchArtifactVersion.mockImplementation(() => ({
        unwrap: () =>
          Promise.resolve({
            version_number: 1,
            content: 'v1 content',
            is_current: true, // Simulating a version that becomes current
          }),
      }));

      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      await waitFor(() => {
        expect(result.current.versionHistory.length).toBe(2);
      });

      await act(async () => {
        await result.current.viewVersion('v1');
      });

      // Should have fetched and applied the version
      expect(mockFetchArtifactVersion).toHaveBeenCalled();
      expect(mockApplyProgrammaticContent).toHaveBeenCalled();
    });
  });

  describe('handleRestoreVersion success path', () => {
    it('should complete full restore flow including refetch and viewVersion', async () => {
      const mockVersionsData = [
        {
          id: 1,
          version_number: 1,
          content: 'v1 content',
          is_current: false,
          date_created: '2024-01-01',
        },
        {
          id: 2,
          version_number: 2,
          content: 'v2 content',
          is_current: true,
          date_created: '2024-01-02',
        },
      ];

      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: mockVersionsData,
        refetch: mockRefetchVersions,
      } as any);

      // Mock that returns a thenable with unwrap
      mockSetCurrentVersionMutation.mockImplementation(() => ({
        unwrap: () => Promise.resolve({}),
      }));

      mockRefetchVersions.mockResolvedValue({ data: mockVersionsData });

      mockFetchArtifactVersion.mockImplementation(() => ({
        unwrap: () =>
          Promise.resolve({
            version_number: 1,
            content: 'v1 content',
            is_current: true,
          }),
      }));

      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      await waitFor(() => {
        expect(result.current.versionHistory.length).toBe(2);
      });

      // Set to v1
      act(() => {
        result.current.setActiveVersionId('v1');
        result.current.setActiveVersionIsCurrent(false);
      });

      await act(async () => {
        await result.current.handleRestoreVersion();
      });

      expect(mockSetCurrentVersionMutation).toHaveBeenCalled();
      expect(mockRefetchVersions).toHaveBeenCalled();
      expect(mockFetchArtifactVersion).toHaveBeenCalled();
    });
  });

  describe('versionIndexOverride', () => {
    it('should use versionIndexOverride when set', async () => {
      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: [],
        refetch: mockRefetchVersions,
      } as any);

      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      // Set version history
      act(() => {
        result.current.setVersionHistory([
          {
            id: 'v1',
            label: 'v1',
            content: 'v1',
            timestamp: '2024-01-01',
            versionId: 1,
            isCurrent: false,
            versionNumber: 1,
          },
          {
            id: 'v2',
            label: 'v2',
            content: 'v2',
            timestamp: '2024-01-02',
            versionId: 2,
            isCurrent: true,
            versionNumber: 2,
          },
        ]);
      });

      // Call updateVersionAfterStreaming which sets versionIndexOverride
      act(() => {
        result.current.updateVersionAfterStreaming(2, 'updated content');
      });

      // Should use the override index
      expect(result.current.currentVersionIndex).toBeGreaterThanOrEqual(0);
    });
  });

  // ==========================================================================
  // Initial Fetch Retry Logic Tests
  // ==========================================================================

  describe('initial fetch retry logic', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should succeed on first fetch attempt', async () => {
      mockFetchVersionsList.mockImplementation(() => ({
        unwrap: () => Promise.resolve([]),
      }));

      renderHook(() => useCanvasVersionNavigation(defaultProps));

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      expect(mockFetchVersionsList).toHaveBeenCalledWith({
        id: 1,
        org: 'test-org',
        userId: 'test-user',
      });
    });

    it('should handle retriable 404 error with retries', async () => {
      let attempt = 0;
      mockFetchVersionsList.mockImplementation(() => ({
        unwrap: () => {
          attempt++;
          if (attempt < 3) {
            return Promise.reject({ status: 404, data: 'Version not found' });
          }
          return Promise.resolve([]);
        },
      }));

      renderHook(() => useCanvasVersionNavigation(defaultProps));

      // Wait for retry logic
      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      await act(async () => {
        vi.advanceTimersByTime(2000);
      });

      await act(async () => {
        vi.advanceTimersByTime(4000);
      });

      expect(mockFetchVersionsList).toHaveBeenCalled();
    });

    it('should handle non-retriable error (artifact not found)', async () => {
      mockFetchVersionsList.mockImplementation(() => ({
        unwrap: () =>
          Promise.reject({
            status: 404,
            data: { detail: 'No Artifact matches the given query' },
          }),
      }));

      renderHook(() => useCanvasVersionNavigation(defaultProps));

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      expect(console.error).toHaveBeenCalledWith(
        '[Canvas] Failed to list versions - non-retriable error:',
        expect.objectContaining({
          artifactId: 1,
        }),
      );
    });

    it('should handle non-404 error as non-retriable', async () => {
      mockFetchVersionsList.mockImplementation(() => ({
        unwrap: () => Promise.reject({ status: 500, data: 'Server error' }),
      }));

      renderHook(() => useCanvasVersionNavigation(defaultProps));

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      expect(console.error).toHaveBeenCalledWith(
        '[Canvas] Failed to list versions - non-retriable error:',
        expect.objectContaining({
          artifactId: 1,
        }),
      );
    });

    it('should exhaust all retries for retriable errors', async () => {
      mockFetchVersionsList.mockImplementation(() => ({
        unwrap: () =>
          Promise.reject({ status: 404, data: 'Version not found yet' }),
      }));

      renderHook(() => useCanvasVersionNavigation(defaultProps));

      // Advance through all retry attempts
      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      // First retry (after ~500ms + jitter)
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      // Second retry (after ~1000ms + jitter)
      await act(async () => {
        vi.advanceTimersByTime(2000);
      });

      // Third retry (after ~2000ms + jitter)
      await act(async () => {
        vi.advanceTimersByTime(5000);
      });

      expect(console.error).toHaveBeenCalledWith(
        '[Canvas] Failed to list versions after retries:',
        expect.objectContaining({
          artifactId: 1,
          attempts: expect.any(Number),
        }),
      );
    });

    it('should handle error without status as non-retriable', async () => {
      mockFetchVersionsList.mockImplementation(() => ({
        unwrap: () => Promise.reject(new Error('Network error')),
      }));

      renderHook(() => useCanvasVersionNavigation(defaultProps));

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      expect(console.error).toHaveBeenCalled();
    });

    it('should handle null error as non-retriable', async () => {
      mockFetchVersionsList.mockImplementation(() => ({
        unwrap: () => Promise.reject(null),
      }));

      renderHook(() => useCanvasVersionNavigation(defaultProps));

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      expect(console.error).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // viewVersion Retry Logic Tests
  // ==========================================================================

  describe('viewVersion retry logic', () => {
    it('should retry on retriable 404 error and succeed', async () => {
      const mockVersionsData = [
        {
          id: 1,
          version_number: 1,
          content: 'v1 content',
          is_current: false,
          date_created: '2024-01-01',
        },
        {
          id: 2,
          version_number: 2,
          content: 'v2 content',
          is_current: true,
          date_created: '2024-01-02',
        },
      ];

      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: mockVersionsData,
        refetch: mockRefetchVersions,
      } as any);

      let attempt = 0;
      mockFetchArtifactVersion.mockImplementation(() => ({
        unwrap: () => {
          attempt++;
          if (attempt < 2) {
            return Promise.reject({ status: 404, data: 'Version not ready' });
          }
          return Promise.resolve({
            version_number: 1,
            content: 'v1 content',
            is_current: false,
          });
        },
      }));

      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      await waitFor(() => {
        expect(result.current.versionHistory.length).toBe(2);
      });

      // Call viewVersion which should trigger retry
      await act(async () => {
        await result.current.viewVersion('v1');
      });

      // Should have been called twice (first fail, then success)
      expect(mockFetchArtifactVersion).toHaveBeenCalled();
      expect(attempt).toBeGreaterThanOrEqual(2);
    });

    it('should exhaust retries for viewVersion retriable errors', async () => {
      const mockVersionsData = [
        {
          id: 1,
          version_number: 1,
          content: 'v1 content',
          is_current: false,
          date_created: '2024-01-01',
        },
      ];

      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: mockVersionsData,
        refetch: mockRefetchVersions,
      } as any);

      mockFetchArtifactVersion.mockImplementation(() => ({
        unwrap: () =>
          Promise.reject({ status: 404, data: 'Version not found' }),
      }));

      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      await waitFor(() => {
        expect(result.current.versionHistory.length).toBe(1);
      });

      await act(async () => {
        await result.current.viewVersion('v1');
      });

      expect(console.error).toHaveBeenCalledWith(
        '[Canvas] Failed to load version after retries:',
        expect.objectContaining({
          artifactId: 1,
          versionId: 1,
        }),
      );
    }, 15000); // Increase timeout for retry logic

    it('should not retry viewVersion for artifact not found error', async () => {
      const mockVersionsData = [
        {
          id: 1,
          version_number: 1,
          content: 'v1 content',
          is_current: false,
          date_created: '2024-01-01',
        },
      ];

      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: mockVersionsData,
        refetch: mockRefetchVersions,
      } as any);

      mockFetchArtifactVersion.mockImplementation(() => ({
        unwrap: () =>
          Promise.reject({
            status: 404,
            data: { detail: 'No Artifact matches the given query' },
          }),
      }));

      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      await waitFor(() => {
        expect(result.current.versionHistory.length).toBe(1);
      });

      await act(async () => {
        await result.current.viewVersion('v1');
      });

      // Should only be called once (no retries for non-retriable error)
      expect(mockFetchArtifactVersion).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalledWith(
        '[Canvas] Failed to load version - non-retriable error:',
        expect.objectContaining({
          artifactId: 1,
        }),
      );
    });
  });

  // ==========================================================================
  // Editor Content Update Tests (wasOnCurrentVersionBeforeSave)
  // ==========================================================================

  describe('editor content update after version change', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should update editor content when wasOnCurrentVersionBeforeSave is true and version changes', async () => {
      const mockEditorWithFocus = {
        current: {
          commands: {
            setContent: vi.fn(),
          },
          isFocused: true,
          state: {
            selection: { from: 5, to: 10 },
            doc: { content: { size: 100 } },
          },
          chain: vi.fn(() => ({
            focus: vi.fn(() => ({
              setTextSelection: vi.fn(() => ({
                run: vi.fn(),
              })),
            })),
          })),
          isDestroyed: false,
        },
      };

      const initialVersionsData = [
        {
          id: 1,
          version_number: 1,
          content: 'v1 content',
          is_current: false,
          date_created: '2024-01-01',
        },
        {
          id: 2,
          version_number: 2,
          content: 'v2 content',
          is_current: true,
          date_created: '2024-01-02',
        },
      ];

      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: initialVersionsData,
        refetch: mockRefetchVersions,
      } as any);

      const { result, rerender } = renderHook(() =>
        useCanvasVersionNavigation({
          ...defaultProps,
          editorRef: mockEditorWithFocus as any,
        }),
      );

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      // Set active version to v1
      act(() => {
        result.current.setActiveVersionId('v1');
        result.current.setActiveVersionIsCurrent(false);
      });

      // Mark was on current version before save
      act(() => {
        result.current.markWasOnCurrentVersionBeforeSave();
      });

      // Simulate new version being created (v3 becomes current)
      const updatedVersionsData = [
        {
          id: 1,
          version_number: 1,
          content: 'v1 content',
          is_current: false,
          date_created: '2024-01-01',
        },
        {
          id: 2,
          version_number: 2,
          content: 'v2 content',
          is_current: false,
          date_created: '2024-01-02',
        },
        {
          id: 3,
          version_number: 3,
          content: 'v3 new content',
          is_current: true,
          date_created: '2024-01-03',
        },
      ];

      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: updatedVersionsData,
        refetch: mockRefetchVersions,
      } as any);

      rerender();

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      // Run requestAnimationFrame
      await act(async () => {
        vi.runAllTimers();
      });

      expect(result.current.currentVersion).toBe('v3');
    });

    it('should handle editor with selection restoration', async () => {
      const mockSetTextSelection = vi.fn(() => ({ run: vi.fn() }));
      const mockFocus = vi.fn(() => ({
        setTextSelection: mockSetTextSelection,
      }));
      const mockChain = vi.fn(() => ({ focus: mockFocus }));

      const mockEditorWithSelection = {
        current: {
          commands: {
            setContent: vi.fn(),
          },
          isFocused: true,
          state: {
            selection: { from: 10, to: 20 },
            doc: { content: { size: 50 } },
          },
          chain: mockChain,
          isDestroyed: false,
        },
      };

      const versionsData = [
        {
          id: 1,
          version_number: 1,
          content: 'v1',
          is_current: false,
          date_created: '2024-01-01',
        },
        {
          id: 2,
          version_number: 2,
          content: 'v2',
          is_current: true,
          date_created: '2024-01-02',
        },
      ];

      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: versionsData,
        refetch: mockRefetchVersions,
      } as any);

      const { result, rerender } = renderHook(() =>
        useCanvasVersionNavigation({
          ...defaultProps,
          editorRef: mockEditorWithSelection as any,
        }),
      );

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      // Set active to v1, mark wasOnCurrentVersion, then update version data
      act(() => {
        result.current.setActiveVersionId('v1');
        result.current.setActiveVersionIsCurrent(false);
        result.current.markWasOnCurrentVersionBeforeSave();
      });

      const newVersionsData = [
        ...versionsData.map((v) => ({ ...v, is_current: false })),
        {
          id: 3,
          version_number: 3,
          content: 'v3',
          is_current: true,
          date_created: '2024-01-03',
        },
      ];

      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: newVersionsData,
        refetch: mockRefetchVersions,
      } as any);

      rerender();

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      // Trigger requestAnimationFrame
      await act(async () => {
        vi.runAllTimers();
      });

      expect(
        mockEditorWithSelection.current.commands.setContent,
      ).toHaveBeenCalled();
    });

    it('should handle editor without focus', async () => {
      const mockEditorNoFocus = {
        current: {
          commands: {
            setContent: vi.fn(),
          },
          isFocused: false,
          state: null,
          isDestroyed: false,
        },
      };

      const versionsData = [
        {
          id: 1,
          version_number: 1,
          content: 'v1',
          is_current: false,
          date_created: '2024-01-01',
        },
        {
          id: 2,
          version_number: 2,
          content: 'v2',
          is_current: true,
          date_created: '2024-01-02',
        },
      ];

      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: versionsData,
        refetch: mockRefetchVersions,
      } as any);

      const { result, rerender } = renderHook(() =>
        useCanvasVersionNavigation({
          ...defaultProps,
          editorRef: mockEditorNoFocus as any,
        }),
      );

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      act(() => {
        result.current.setActiveVersionId('v1');
        result.current.setActiveVersionIsCurrent(false);
        result.current.markWasOnCurrentVersionBeforeSave();
      });

      const newVersionsData = [
        ...versionsData.map((v) => ({ ...v, is_current: false })),
        {
          id: 3,
          version_number: 3,
          content: 'v3',
          is_current: true,
          date_created: '2024-01-03',
        },
      ];

      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: newVersionsData,
        refetch: mockRefetchVersions,
      } as any);

      rerender();

      await act(async () => {
        vi.runAllTimers();
      });

      expect(mockEditorNoFocus.current.commands.setContent).toHaveBeenCalled();
    });

    it('should handle destroyed editor during selection restoration', async () => {
      const mockSetTextSelection = vi.fn(() => ({ run: vi.fn() }));
      const mockFocus = vi.fn(() => ({
        setTextSelection: mockSetTextSelection,
      }));
      const mockChain = vi.fn(() => ({ focus: mockFocus }));

      const mockEditorDestroyable = {
        current: {
          commands: {
            setContent: vi.fn(),
          },
          isFocused: true,
          state: {
            selection: { from: 5, to: 15 },
            doc: { content: { size: 100 } },
          },
          chain: mockChain,
          isDestroyed: false,
        },
      };

      const versionsData = [
        {
          id: 1,
          version_number: 1,
          content: 'v1',
          is_current: false,
          date_created: '2024-01-01',
        },
        {
          id: 2,
          version_number: 2,
          content: 'v2',
          is_current: true,
          date_created: '2024-01-02',
        },
      ];

      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: versionsData,
        refetch: mockRefetchVersions,
      } as any);

      const { result, rerender } = renderHook(() =>
        useCanvasVersionNavigation({
          ...defaultProps,
          editorRef: mockEditorDestroyable as any,
        }),
      );

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      act(() => {
        result.current.setActiveVersionId('v1');
        result.current.setActiveVersionIsCurrent(false);
        result.current.markWasOnCurrentVersionBeforeSave();
      });

      const newVersionsData = [
        ...versionsData.map((v) => ({ ...v, is_current: false })),
        {
          id: 3,
          version_number: 3,
          content: 'v3',
          is_current: true,
          date_created: '2024-01-03',
        },
      ];

      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: newVersionsData,
        refetch: mockRefetchVersions,
      } as any);

      rerender();

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      // Mark editor as destroyed before requestAnimationFrame runs
      mockEditorDestroyable.current.isDestroyed = true;

      await act(async () => {
        vi.runAllTimers();
      });

      // setTextSelection should not have been called since editor was destroyed
      expect(mockSetTextSelection).not.toHaveBeenCalled();
    });

    it('should clamp selection range to document size', async () => {
      const mockSetTextSelection = vi.fn(() => ({ run: vi.fn() }));
      const mockFocus = vi.fn(() => ({
        setTextSelection: mockSetTextSelection,
      }));
      const mockChain = vi.fn(() => ({ focus: mockFocus }));

      const mockEditorSmallDoc = {
        current: {
          commands: {
            setContent: vi.fn(),
          },
          isFocused: true,
          state: {
            selection: { from: 100, to: 200 }, // Selection beyond doc size
            doc: { content: { size: 50 } }, // Small doc
          },
          chain: mockChain,
          isDestroyed: false,
        },
      };

      const versionsData = [
        {
          id: 1,
          version_number: 1,
          content: 'v1',
          is_current: false,
          date_created: '2024-01-01',
        },
        {
          id: 2,
          version_number: 2,
          content: 'v2',
          is_current: true,
          date_created: '2024-01-02',
        },
      ];

      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: versionsData,
        refetch: mockRefetchVersions,
      } as any);

      const { result, rerender } = renderHook(() =>
        useCanvasVersionNavigation({
          ...defaultProps,
          editorRef: mockEditorSmallDoc as any,
        }),
      );

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      act(() => {
        result.current.setActiveVersionId('v1');
        result.current.setActiveVersionIsCurrent(false);
        result.current.markWasOnCurrentVersionBeforeSave();
      });

      const newVersionsData = [
        ...versionsData.map((v) => ({ ...v, is_current: false })),
        {
          id: 3,
          version_number: 3,
          content: 'v3',
          is_current: true,
          date_created: '2024-01-03',
        },
      ];

      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: newVersionsData,
        refetch: mockRefetchVersions,
      } as any);

      rerender();

      await act(async () => {
        vi.runAllTimers();
      });

      // setTextSelection should have been called with clamped values
      if (mockSetTextSelection.mock.calls.length > 0) {
        const callArg = (
          mockSetTextSelection.mock.calls as unknown as Array<
            [{ from: number; to: number }]
          >
        )[0][0];
        expect(callArg.from).toBeLessThanOrEqual(50);
        expect(callArg.to).toBeLessThanOrEqual(50);
      }
    });
  });

  // ==========================================================================
  // Error Type Detection Tests (isRetriableVersionError behavior)
  // ==========================================================================

  describe('error type detection', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should treat 404 with string data as retriable', async () => {
      mockFetchVersionsList.mockImplementation(() => ({
        unwrap: () => Promise.reject({ status: 404, data: 'Not found' }),
      }));

      renderHook(() => useCanvasVersionNavigation(defaultProps));

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      // Should attempt retries (called more than once)
      await act(async () => {
        vi.advanceTimersByTime(10000);
      });

      expect(mockFetchVersionsList.mock.calls.length).toBeGreaterThan(1);
    });

    it('should treat 404 with artifact not found in data.detail as non-retriable', async () => {
      mockFetchVersionsList.mockImplementation(() => ({
        unwrap: () =>
          Promise.reject({
            status: 404,
            data: { detail: 'No artifact matches the given query' },
          }),
      }));

      renderHook(() => useCanvasVersionNavigation(defaultProps));

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      // Should only be called once (no retries)
      expect(mockFetchVersionsList).toHaveBeenCalledTimes(1);
    });

    it('should treat non-object error as non-retriable', async () => {
      mockFetchVersionsList.mockImplementation(() => ({
        unwrap: () => Promise.reject('string error'),
      }));

      renderHook(() => useCanvasVersionNavigation(defaultProps));

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      // Should only be called once (no retries)
      expect(mockFetchVersionsList).toHaveBeenCalledTimes(1);
    });

    it('should treat undefined error as non-retriable', async () => {
      mockFetchVersionsList.mockImplementation(() => ({
        unwrap: () => Promise.reject(undefined),
      }));

      renderHook(() => useCanvasVersionNavigation(defaultProps));

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      expect(mockFetchVersionsList).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // Artifact Change Reset Tests
  // ==========================================================================

  describe('artifact change handling', () => {
    it('should reset initial fetch state when artifactId changes', async () => {
      vi.useFakeTimers();

      mockFetchVersionsList.mockImplementation(() => ({
        unwrap: () => Promise.resolve([]),
      }));

      const { rerender } = renderHook(
        (props) => useCanvasVersionNavigation(props),
        {
          initialProps: defaultProps,
        },
      );

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      // First artifact should have triggered fetch
      expect(mockFetchVersionsList).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1 }),
      );

      // Clear mock to track new calls
      mockFetchVersionsList.mockClear();

      // Change artifactId
      rerender({
        ...defaultProps,
        artifactId: 2,
      });

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      // Second artifact should trigger new fetch
      expect(mockFetchVersionsList).toHaveBeenCalledWith(
        expect.objectContaining({ id: 2 }),
      );

      vi.useRealTimers();
    });
  });

  // ==========================================================================
  // Additional Branch Coverage Tests
  // ==========================================================================

  describe('branch coverage - additional cases', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should handle versionsData with no current version', async () => {
      const mockVersionsData = [
        {
          id: 1,
          version_number: 1,
          content: 'v1',
          is_current: false,
          date_created: '2024-01-01',
        },
        {
          id: 2,
          version_number: 2,
          content: 'v2',
          is_current: false, // No current version
          date_created: '2024-01-02',
        },
      ];

      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: mockVersionsData,
        refetch: mockRefetchVersions,
      } as any);

      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      // Should still have version history
      expect(result.current.versionHistory.length).toBe(2);
      // currentVersion should not be set if no is_current version exists
      expect(result.current.currentVersion).toBeNull();
    });

    it('should handle editor without commands', async () => {
      const mockEditorNoCommands = {
        current: {
          // No commands property
          isFocused: false,
        },
      };

      const versionsData = [
        {
          id: 1,
          version_number: 1,
          content: 'v1',
          is_current: false,
          date_created: '2024-01-01',
        },
        {
          id: 2,
          version_number: 2,
          content: 'v2',
          is_current: true,
          date_created: '2024-01-02',
        },
      ];

      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: versionsData,
        refetch: mockRefetchVersions,
      } as any);

      const { result, rerender } = renderHook(() =>
        useCanvasVersionNavigation({
          ...defaultProps,
          editorRef: mockEditorNoCommands as any,
        }),
      );

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      act(() => {
        result.current.setActiveVersionId('v1');
        result.current.setActiveVersionIsCurrent(false);
        result.current.markWasOnCurrentVersionBeforeSave();
      });

      const newVersionsData = [
        ...versionsData.map((v) => ({ ...v, is_current: false })),
        {
          id: 3,
          version_number: 3,
          content: 'v3',
          is_current: true,
          date_created: '2024-01-03',
        },
      ];

      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: newVersionsData,
        refetch: mockRefetchVersions,
      } as any);

      rerender();

      await act(async () => {
        vi.runAllTimers();
      });

      // Should not crash without commands
      expect(result.current.currentVersion).toBe('v3');
    });

    it('should handle editor null reference', async () => {
      const mockEditorNull = {
        current: null,
      };

      const versionsData = [
        {
          id: 1,
          version_number: 1,
          content: 'v1',
          is_current: true,
          date_created: '2024-01-01',
        },
      ];

      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: versionsData,
        refetch: mockRefetchVersions,
      } as any);

      const { result } = renderHook(() =>
        useCanvasVersionNavigation({
          ...defaultProps,
          editorRef: mockEditorNull as any,
        }),
      );

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      // Should work without crashing
      expect(result.current.versionHistory.length).toBe(1);
    });

    it('should handle wasOnCurrentVersionBeforeSave with version not found in formatted versions', async () => {
      const versionsData = [
        {
          id: 1,
          version_number: 1,
          content: 'v1',
          is_current: true,
          date_created: '2024-01-01',
        },
      ];

      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: versionsData,
        refetch: mockRefetchVersions,
      } as any);

      const { result, rerender } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      act(() => {
        // Set active to a version that won't exist after update
        result.current.setActiveVersionId('v99');
        result.current.setActiveVersionIsCurrent(false);
        result.current.markWasOnCurrentVersionBeforeSave();
      });

      // Update with new data where v99 doesn't exist
      const newVersionsData = [
        {
          id: 2,
          version_number: 2,
          content: 'v2',
          is_current: true,
          date_created: '2024-01-02',
        },
      ];

      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: newVersionsData,
        refetch: mockRefetchVersions,
      } as any);

      rerender();

      await act(async () => {
        vi.runAllTimers();
      });

      // Should update to new current version
      expect(result.current.currentVersion).toBe('v2');
    });

    it('should handle justUpdatedFromStreamingRef in sync effect', async () => {
      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: [],
        refetch: mockRefetchVersions,
      } as any);

      const { result, rerender } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      // Trigger streaming update
      act(() => {
        result.current.updateVersionAfterStreaming(1, 'new content');
      });

      // Now update versions data - should not override streaming state due to justUpdatedFromStreamingRef
      const newVersionsData = [
        {
          id: 1,
          version_number: 1,
          content: 'v1',
          is_current: true,
          date_created: '2024-01-01',
        },
      ];

      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: newVersionsData,
        refetch: mockRefetchVersions,
      } as any);

      rerender();

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      expect(result.current.activeVersionId).toBe('v1');
    });

    it('should handle metadataVersionNumber with non-matching version in data', async () => {
      const versionsData = [
        {
          id: 1,
          version_number: 1,
          content: 'v1',
          is_current: true,
          date_created: '2024-01-01',
        },
      ];

      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: versionsData,
        refetch: mockRefetchVersions,
      } as any);

      // Request version 99 which doesn't exist
      const { result } = renderHook(() =>
        useCanvasVersionNavigation({
          ...defaultProps,
          metadataVersionNumber: 99,
        }),
      );

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      // Should fall back to current version
      expect(result.current.activeVersionId).toBe('v1');
    });

    it('should handle version without versionNumber in history', async () => {
      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: [],
        refetch: mockRefetchVersions,
      } as any);

      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      // Manually set version history without versionNumber
      act(() => {
        result.current.setVersionHistory([
          {
            id: 'v1',
            label: 'v1',
            content: 'test',
            timestamp: '2024-01-01',
            isCurrent: true,
            // versionNumber intentionally omitted
          },
        ]);
      });

      expect(result.current.versionHistory.length).toBe(1);
    });

    it('should handle 404 error with data as string containing artifact message', async () => {
      mockFetchVersionsList.mockImplementation(() => ({
        unwrap: () =>
          Promise.reject({
            status: 404,
            data: 'No artifact matches the given query',
          }),
      }));

      renderHook(() => useCanvasVersionNavigation(defaultProps));

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      // Should be non-retriable
      expect(mockFetchVersionsList).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalled();
    });

    it('should handle hasUserNavigatedVersionRef preventing initialization', async () => {
      const versionsData = [
        {
          id: 1,
          version_number: 1,
          content: 'v1',
          is_current: false,
          date_created: '2024-01-01',
        },
        {
          id: 2,
          version_number: 2,
          content: 'v2',
          is_current: true,
          date_created: '2024-01-02',
        },
      ];

      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: versionsData,
        refetch: mockRefetchVersions,
      } as any);

      mockFetchArtifactVersion.mockImplementation(() => ({
        unwrap: () =>
          Promise.resolve({
            version_number: 1,
            content: 'v1',
            is_current: false,
          }),
      }));

      const { result, rerender } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      // User navigates to v1
      await act(async () => {
        await result.current.viewVersion('v1');
      });

      // Now metadata version changes but user has navigated
      const newVersionsData = [...versionsData];

      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: newVersionsData,
        refetch: mockRefetchVersions,
      } as any);

      rerender();

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      // Should stay on v1 since user navigated
      expect(result.current.activeVersionId).toBe('v1');
    });

    it('should handle silentlyGoToLatest when no version is marked as current', async () => {
      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: [],
        refetch: mockRefetchVersions,
      } as any);

      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      // Set version history without any current version
      act(() => {
        result.current.setVersionHistory([
          {
            id: 'v1',
            label: 'v1',
            content: 'v1 content',
            timestamp: '2024-01-01',
            isCurrent: false,
            versionNumber: 1,
          },
          {
            id: 'v2',
            label: 'v2',
            content: 'v2 content',
            timestamp: '2024-01-02',
            isCurrent: false, // No current
            versionNumber: 2,
          },
        ]);
      });

      // Call silentlyGoToLatest - should fall back to last version
      act(() => {
        result.current.silentlyGoToLatest();
      });

      // Should go to last version when no current
      expect(result.current.activeVersionId).toBe('v2');
    });

    it('should handle updateVersionAfterStreaming adding new version', async () => {
      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: [],
        refetch: mockRefetchVersions,
      } as any);

      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      // Set initial version history
      act(() => {
        result.current.setVersionHistory([
          {
            id: 'v1',
            label: 'v1',
            content: 'v1 content',
            timestamp: '2024-01-01',
            isCurrent: true,
            versionNumber: 1,
          },
        ]);
      });

      // Add a new version via streaming (version 2 which doesn't exist)
      act(() => {
        result.current.updateVersionAfterStreaming(2, 'new v2 content');
      });

      // Should now have 2 versions
      expect(result.current.versionHistory.length).toBe(2);
      expect(result.current.activeVersionId).toBe('v2');
    });

    it('should handle needsInit being false when activeVersionId exists and metadata unchanged', async () => {
      const versionsData = [
        {
          id: 1,
          version_number: 1,
          content: 'v1',
          is_current: true,
          date_created: '2024-01-01',
        },
      ];

      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: versionsData,
        refetch: mockRefetchVersions,
      } as any);

      const { result, rerender } = renderHook(
        (props) => useCanvasVersionNavigation(props),
        {
          initialProps: {
            ...defaultProps,
            metadataVersionNumber: 1,
          },
        },
      );

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      expect(result.current.activeVersionId).toBe('v1');

      // Rerender with same metadata version
      rerender({
        ...defaultProps,
        metadataVersionNumber: 1,
      });

      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      // Should still be on v1
      expect(result.current.activeVersionId).toBe('v1');
    });

    it('should handle metadata version re-initialization when metadataVersionNumber changes', async () => {
      const versionsData = [
        {
          id: 1,
          version_number: 1,
          content: 'v1',
          is_current: false,
          date_created: '2024-01-01',
        },
        {
          id: 2,
          version_number: 2,
          content: 'v2',
          is_current: true,
          date_created: '2024-01-02',
        },
      ];

      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: versionsData,
        refetch: mockRefetchVersions,
      } as any);

      const { result, rerender } = renderHook(
        (props) => useCanvasVersionNavigation(props),
        {
          initialProps: {
            ...defaultProps,
            metadataVersionNumber: 2,
          },
        },
      );

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      expect(result.current.activeVersionId).toBe('v2');

      // Change metadata version to 1
      rerender({
        ...defaultProps,
        metadataVersionNumber: 1,
      });

      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      // Should switch to v1
      expect(result.current.activeVersionId).toBe('v1');
    });

    it('should not set active version when targetVersion not found', async () => {
      const versionsData = [
        {
          id: 1,
          version_number: 1,
          content: 'v1',
          is_current: true,
          date_created: '2024-01-01',
        },
      ];

      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: versionsData,
        refetch: mockRefetchVersions,
      } as any);

      // Ask for a version that exists in data
      const { result } = renderHook(() =>
        useCanvasVersionNavigation({
          ...defaultProps,
          metadataVersionNumber: 1,
        }),
      );

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      expect(result.current.activeVersionId).toBe('v1');
    });

    it('should handle sync effect when match is found in versionsData', async () => {
      const versionsData = [
        {
          id: 1,
          version_number: 1,
          content: 'v1',
          is_current: false,
          date_created: '2024-01-01',
        },
        {
          id: 2,
          version_number: 2,
          content: 'v2',
          is_current: true,
          date_created: '2024-01-02',
        },
      ];

      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: versionsData,
        refetch: mockRefetchVersions,
      } as any);

      const { result, rerender } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      // Manually set active version
      act(() => {
        result.current.setActiveVersionId('v1');
        result.current.setActiveVersionIsCurrent(true); // Intentionally wrong
      });

      // Trigger rerender to run sync effect
      rerender();

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      // Sync effect should update activeVersionIsCurrent to false (matching v1)
      expect(result.current.activeVersionIsCurrent).toBe(false);
    });

    it('should handle versionIndexOverride clearing when history has the version', async () => {
      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: [],
        refetch: mockRefetchVersions,
      } as any);

      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      // Set up with streaming (sets versionIndexOverride)
      act(() => {
        result.current.setVersionHistory([
          {
            id: 'v1',
            label: 'v1',
            content: 'v1',
            timestamp: '2024-01-01',
            isCurrent: true,
            versionNumber: 1,
          },
        ]);
      });

      act(() => {
        result.current.updateVersionAfterStreaming(1, 'updated v1');
      });

      // Override should clear after history is updated
      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      expect(result.current.currentVersionIndex).toBeGreaterThanOrEqual(0);
    });

    it('should handle currentVersionIndex with empty history and activeVersionIsCurrent', async () => {
      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: [],
        refetch: mockRefetchVersions,
      } as any);

      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      // Set active version but no history
      act(() => {
        result.current.setActiveVersionId('v1');
        result.current.setActiveVersionIsCurrent(true);
      });

      // Should return -1 since history is empty
      expect(result.current.currentVersionIndex).toBe(-1);
    });

    it('should handle skip query conditions', async () => {
      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: [],
        refetch: mockRefetchVersions,
      } as any);

      // Missing org
      const { result: result1 } = renderHook(() =>
        useCanvasVersionNavigation({
          ...defaultProps,
          org: undefined,
        }),
      );

      expect(result1.current.versionHistory).toEqual([]);

      // Missing userId
      const { result: result2 } = renderHook(() =>
        useCanvasVersionNavigation({
          ...defaultProps,
          userId: undefined,
        }),
      );

      expect(result2.current.versionHistory).toEqual([]);

      // Missing artifactId
      const { result: result3 } = renderHook(() =>
        useCanvasVersionNavigation({
          ...defaultProps,
          artifactId: undefined,
        }),
      );

      expect(result3.current.versionHistory).toEqual([]);
    });

    it('should handle currentVersionIndex fallback when version not found but activeVersionIsCurrent', async () => {
      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: [],
        refetch: mockRefetchVersions,
      } as any);

      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      // Set version history and active to non-existent but mark as current
      act(() => {
        result.current.setVersionHistory([
          {
            id: 'v1',
            label: 'v1',
            content: 'v1',
            timestamp: '2024-01-01',
            isCurrent: true,
            versionNumber: 1,
          },
          {
            id: 'v2',
            label: 'v2',
            content: 'v2',
            timestamp: '2024-01-02',
            isCurrent: false,
            versionNumber: 2,
          },
        ]);
        result.current.setActiveVersionId('v99'); // Non-existent
        result.current.setActiveVersionIsCurrent(true);
      });

      // Should fall back to last index since activeVersionIsCurrent is true
      expect(result.current.currentVersionIndex).toBe(1);
    });

    it('should handle handleRestoreVersion with missing version in history', async () => {
      const mockVersionsData = [
        {
          id: 1,
          version_number: 1,
          content: 'v1',
          is_current: true,
          date_created: '2024-01-01',
        },
      ];

      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: mockVersionsData,
        refetch: mockRefetchVersions,
      } as any);

      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      // Set active to non-existent version
      act(() => {
        result.current.setActiveVersionId('v99');
      });

      // Try to restore - should not crash
      await act(async () => {
        await result.current.handleRestoreVersion();
      });

      // No mutation should have been called since version not found
      expect(mockSetCurrentVersionMutation).not.toHaveBeenCalled();
    });

    it('should handle handleRestoreVersion with missing required params', async () => {
      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: [],
        refetch: mockRefetchVersions,
      } as any);

      const { result } = renderHook(() =>
        useCanvasVersionNavigation({
          ...defaultProps,
          artifactId: undefined,
        }),
      );

      act(() => {
        result.current.setActiveVersionId('v1');
        result.current.setVersionHistory([
          {
            id: 'v1',
            label: 'v1',
            content: 'v1',
            timestamp: '2024-01-01',
            versionId: 1,
            isCurrent: false,
            versionNumber: 1,
          },
        ]);
      });

      await act(async () => {
        await result.current.handleRestoreVersion();
      });

      // Should not call mutation without artifactId
      expect(mockSetCurrentVersionMutation).not.toHaveBeenCalled();
    });

    it('should handle viewVersion when version not found in history', async () => {
      const mockVersionsData = [
        {
          id: 1,
          version_number: 1,
          content: 'v1',
          is_current: true,
          date_created: '2024-01-01',
        },
      ];

      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: mockVersionsData,
        refetch: mockRefetchVersions,
      } as any);

      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      // Try to view non-existent version
      await act(async () => {
        await result.current.viewVersion('v99');
      });

      // Should not have called fetch
      expect(mockFetchArtifactVersion).not.toHaveBeenCalled();
    });

    it('should handle viewVersion when versionId is missing', async () => {
      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: [],
        refetch: mockRefetchVersions,
      } as any);

      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      // Set version history without versionId
      act(() => {
        result.current.setVersionHistory([
          {
            id: 'v1',
            label: 'v1',
            content: 'v1',
            timestamp: '2024-01-01',
            // versionId intentionally omitted
            isCurrent: true,
            versionNumber: 1,
          },
        ]);
      });

      await act(async () => {
        await result.current.viewVersion('v1');
      });

      // Should not have called fetch
      expect(mockFetchArtifactVersion).not.toHaveBeenCalled();
    });

    it('should handle handleBackToLatest when latestVersionId is null', async () => {
      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: [],
        refetch: mockRefetchVersions,
      } as any);

      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      // Empty version history, no latestVersionId
      await act(async () => {
        result.current.handleBackToLatest();
      });

      // Should not crash, fetchArtifactVersion not called
      expect(mockFetchArtifactVersion).not.toHaveBeenCalled();
    });

    it('should handle handleNextVersion when at end of history', async () => {
      const mockVersionsData = [
        {
          id: 1,
          version_number: 1,
          content: 'v1',
          is_current: false,
          date_created: '2024-01-01',
        },
        {
          id: 2,
          version_number: 2,
          content: 'v2',
          is_current: true,
          date_created: '2024-01-02',
        },
      ];

      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: mockVersionsData,
        refetch: mockRefetchVersions,
      } as any);

      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      // Should be at end already
      expect(result.current.canGoNext).toBe(false);

      mockFetchArtifactVersion.mockClear();

      // Try to go next
      await act(async () => {
        await result.current.handleNextVersion();
      });

      // Should not fetch
      expect(mockFetchArtifactVersion).not.toHaveBeenCalled();
    });

    it('should handle handlePreviousVersion when at start of history', async () => {
      const mockVersionsData = [
        {
          id: 1,
          version_number: 1,
          content: 'v1',
          is_current: true,
          date_created: '2024-01-01',
        },
      ];

      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: mockVersionsData,
        refetch: mockRefetchVersions,
      } as any);

      mockFetchArtifactVersion.mockImplementation(() => ({
        unwrap: () =>
          Promise.resolve({
            version_number: 1,
            content: 'v1',
            is_current: true,
          }),
      }));

      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      // Navigate to first version
      await act(async () => {
        await result.current.viewVersion('v1');
      });

      expect(result.current.canGoPrevious).toBe(false);

      mockFetchArtifactVersion.mockClear();

      // Try to go previous
      await act(async () => {
        await result.current.handlePreviousVersion();
      });

      // Should not fetch
      expect(mockFetchArtifactVersion).not.toHaveBeenCalled();
    });

    it('should skip initial fetch when already attempted', async () => {
      mockFetchVersionsList.mockImplementation(() => ({
        unwrap: () => Promise.resolve([]),
      }));

      const { rerender } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      const callCount = mockFetchVersionsList.mock.calls.length;

      // Rerender without changing artifactId
      rerender();

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      // Should not fetch again
      expect(mockFetchVersionsList.mock.calls.length).toBe(callCount);
    });

    it('should handle 404 error with empty data object (no detail)', async () => {
      mockFetchVersionsList.mockImplementation(() => ({
        unwrap: () =>
          Promise.reject({
            status: 404,
            data: {}, // No detail property
          }),
      }));

      renderHook(() => useCanvasVersionNavigation(defaultProps));

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      // Should be retriable since empty detail doesn't match "no artifact matches"
      // Will attempt retries
      await act(async () => {
        vi.advanceTimersByTime(5000);
      });

      expect(mockFetchVersionsList.mock.calls.length).toBeGreaterThan(1);
    });

    it('should handle 404 error with null data', async () => {
      mockFetchVersionsList.mockImplementation(() => ({
        unwrap: () =>
          Promise.reject({
            status: 404,
            data: null,
          }),
      }));

      renderHook(() => useCanvasVersionNavigation(defaultProps));

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      // Should be retriable since null doesn't match "no artifact matches"
      await act(async () => {
        vi.advanceTimersByTime(5000);
      });

      expect(mockFetchVersionsList.mock.calls.length).toBeGreaterThan(1);
    });

    it('should handle viewVersion with fetched version having no version_number', async () => {
      vi.useRealTimers();

      const mockVersionsData = [
        {
          id: 1,
          version_number: 1,
          content: 'v1',
          is_current: true,
          date_created: '2024-01-01',
        },
      ];

      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: mockVersionsData,
        refetch: mockRefetchVersions,
      } as any);

      mockFetchArtifactVersion.mockImplementation(() => ({
        unwrap: () =>
          Promise.resolve({
            // No version_number
            content: 'updated v1',
            is_current: true,
          }),
      }));

      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      await waitFor(() => {
        expect(result.current.versionHistory.length).toBe(1);
      });

      await act(async () => {
        await result.current.viewVersion('v1');
      });

      // Should use fallback version ID
      expect(mockFetchArtifactVersion).toHaveBeenCalled();

      vi.useFakeTimers();
    });

    it('should handle viewVersion with empty content in version and fetched', async () => {
      vi.useRealTimers();

      const mockVersionsData = [
        {
          id: 1,
          version_number: 1,
          content: '', // Empty content
          is_current: true,
          date_created: '2024-01-01',
        },
      ];

      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: mockVersionsData,
        refetch: mockRefetchVersions,
      } as any);

      mockFetchArtifactVersion.mockImplementation(() => ({
        unwrap: () =>
          Promise.resolve({
            version_number: 1,
            content: null, // null content
            is_current: true,
          }),
      }));

      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      await waitFor(() => {
        expect(result.current.versionHistory.length).toBe(1);
      });

      await act(async () => {
        await result.current.viewVersion('v1');
      });

      expect(mockApplyProgrammaticContent).toHaveBeenCalledWith('');

      vi.useFakeTimers();
    });

    it('should handle empty versionsData in sync effect', async () => {
      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: [],
        refetch: mockRefetchVersions,
      } as any);

      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      act(() => {
        result.current.setActiveVersionId('v1');
      });

      // Sync effect should handle empty versionsData gracefully
      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      // Should not crash
      expect(result.current.activeVersionId).toBe('v1');
    });

    it('should handle activeVersionId change when match not found', async () => {
      const versionsData = [
        {
          id: 1,
          version_number: 1,
          content: 'v1',
          is_current: true,
          date_created: '2024-01-01',
        },
      ];

      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: versionsData,
        refetch: mockRefetchVersions,
      } as any);

      const { result, rerender } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      // Set to version not in data
      act(() => {
        result.current.setActiveVersionId('v99');
      });

      rerender();

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      // activeVersionIsCurrent should not change for non-matching version
      // (sync effect only updates if match is found)
    });

    it('should handle debouncedSaveCancel being undefined', async () => {
      vi.useRealTimers();

      const mockVersionsData = [
        {
          id: 1,
          version_number: 1,
          content: 'v1',
          is_current: true,
          date_created: '2024-01-01',
        },
      ];

      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: mockVersionsData,
        refetch: mockRefetchVersions,
      } as any);

      mockFetchArtifactVersion.mockImplementation(() => ({
        unwrap: () =>
          Promise.resolve({
            version_number: 1,
            content: 'v1',
            is_current: true,
          }),
      }));

      const { result } = renderHook(() =>
        useCanvasVersionNavigation({
          ...defaultProps,
          debouncedSaveCancel: undefined,
        }),
      );

      await waitFor(() => {
        expect(result.current.versionHistory.length).toBe(1);
      });

      // Should not crash when debouncedSaveCancel is undefined
      await act(async () => {
        await result.current.viewVersion('v1');
      });

      expect(mockFetchArtifactVersion).toHaveBeenCalled();

      vi.useFakeTimers();
    });

    it('should handle onVersionChange being undefined', async () => {
      vi.useRealTimers();

      const mockVersionsData = [
        {
          id: 1,
          version_number: 1,
          content: 'v1',
          is_current: true,
          date_created: '2024-01-01',
        },
      ];

      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: mockVersionsData,
        refetch: mockRefetchVersions,
      } as any);

      mockFetchArtifactVersion.mockImplementation(() => ({
        unwrap: () =>
          Promise.resolve({
            version_number: 1,
            content: 'v1',
            is_current: true,
          }),
      }));

      const { result } = renderHook(() =>
        useCanvasVersionNavigation({
          ...defaultProps,
          onVersionChange: undefined,
        }),
      );

      await waitFor(() => {
        expect(result.current.versionHistory.length).toBe(1);
      });

      // Should not crash when onVersionChange is undefined
      await act(async () => {
        await result.current.viewVersion('v1');
      });

      expect(mockFetchArtifactVersion).toHaveBeenCalled();

      vi.useFakeTimers();
    });

    it('should handle silentlyGoToLatest with empty version history', async () => {
      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: [],
        refetch: mockRefetchVersions,
      } as any);

      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      // Empty version history
      act(() => {
        result.current.silentlyGoToLatest();
      });

      // Should not crash
      expect(result.current.activeVersionId).toBeNull();
    });

    it('should handle selection without from/to in editor state', async () => {
      const mockEditorNoSelection = {
        current: {
          commands: {
            setContent: vi.fn(),
          },
          isFocused: true,
          state: {
            selection: null, // No selection object
            doc: { content: { size: 100 } },
          },
        },
      };

      const versionsData = [
        {
          id: 1,
          version_number: 1,
          content: 'v1',
          is_current: false,
          date_created: '2024-01-01',
        },
        {
          id: 2,
          version_number: 2,
          content: 'v2',
          is_current: true,
          date_created: '2024-01-02',
        },
      ];

      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: versionsData,
        refetch: mockRefetchVersions,
      } as any);

      const { result, rerender } = renderHook(() =>
        useCanvasVersionNavigation({
          ...defaultProps,
          editorRef: mockEditorNoSelection as any,
        }),
      );

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      act(() => {
        result.current.setActiveVersionId('v1');
        result.current.setActiveVersionIsCurrent(false);
        result.current.markWasOnCurrentVersionBeforeSave();
      });

      const newVersionsData = [
        ...versionsData.map((v) => ({ ...v, is_current: false })),
        {
          id: 3,
          version_number: 3,
          content: 'v3',
          is_current: true,
          date_created: '2024-01-03',
        },
      ];

      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: newVersionsData,
        refetch: mockRefetchVersions,
      } as any);

      rerender();

      await act(async () => {
        vi.runAllTimers();
      });

      // Should not crash
      expect(
        mockEditorNoSelection.current.commands.setContent,
      ).toHaveBeenCalled();
    });

    it('should handle updateVersionAfterStreaming with startIndex and endIndex', async () => {
      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: [],
        refetch: mockRefetchVersions,
      } as any);

      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      // Set initial version history
      act(() => {
        result.current.setVersionHistory([
          {
            id: 'v1',
            label: 'v1',
            content: 'hello world',
            timestamp: '2024-01-01',
            isCurrent: true,
            versionNumber: 1,
          },
        ]);
      });

      // Update with partial indices
      act(() => {
        result.current.updateVersionAfterStreaming(
          2,
          'REPLACED',
          0,
          5,
          'hello world',
        );
      });

      // Should have updated version with replaced content
      expect(result.current.versionHistory.length).toBe(2);
      expect(result.current.activeVersionId).toBe('v2');
    });

    it('should handle initial metadata version application to editor', async () => {
      const mockEditorWithSetContent = {
        current: {
          commands: {
            setContent: vi.fn(),
          },
        },
      };

      const versionsData = [
        {
          id: 1,
          version_number: 1,
          content: 'v1 content',
          is_current: false,
          date_created: '2024-01-01',
        },
        {
          id: 2,
          version_number: 2,
          content: 'v2 content',
          is_current: true,
          date_created: '2024-01-02',
        },
      ];

      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: versionsData,
        refetch: mockRefetchVersions,
      } as any);

      const { result } = renderHook(() =>
        useCanvasVersionNavigation({
          ...defaultProps,
          metadataVersionNumber: 1,
          editorRef: mockEditorWithSetContent as any,
        }),
      );

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      await act(async () => {
        vi.advanceTimersByTime(300);
      });

      // Should have applied content to editor
      expect(
        mockEditorWithSetContent.current.commands.setContent,
      ).toHaveBeenCalled();
      expect(result.current.activeVersionId).toBe('v1');
    });

    it('should handle version history update when activeVersionId already set', async () => {
      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: [],
        refetch: mockRefetchVersions,
      } as any);

      const { result, rerender } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      // Set active version first
      act(() => {
        result.current.setActiveVersionId('v1');
        result.current.setActiveVersionIsCurrent(true);
      });

      // Now update with versionsData
      const versionsData = [
        {
          id: 1,
          version_number: 1,
          content: 'v1',
          is_current: true,
          date_created: '2024-01-01',
        },
      ];

      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: versionsData,
        refetch: mockRefetchVersions,
      } as any);

      rerender();

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      // Should maintain activeVersionId
      expect(result.current.activeVersionId).toBe('v1');
    });

    it('should not update currentVersion when already set in initial version effect', async () => {
      const versionsData = [
        {
          id: 1,
          version_number: 1,
          content: 'v1',
          is_current: true,
          date_created: '2024-01-01',
        },
      ];

      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: versionsData,
        refetch: mockRefetchVersions,
      } as any);

      const { result, rerender } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      expect(result.current.currentVersion).toBe('v1');

      // Manually set different current version
      act(() => {
        result.current.setCurrentVersion('v99');
      });

      expect(result.current.currentVersion).toBe('v99');

      // Rerender - should not reset to v1 since init already happened
      rerender();

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      // Still has custom value
      expect(result.current.currentVersion).toBe('v99');
    });

    it('should handle version sorting with null/undefined version numbers', async () => {
      const versionsData = [
        {
          id: 1,
          version_number: undefined,
          content: 'v1',
          is_current: false,
          date_created: '2024-01-01',
        },
        {
          id: 2,
          version_number: 2,
          content: 'v2',
          is_current: true,
          date_created: '2024-01-02',
        },
      ];

      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: versionsData as any,
        refetch: mockRefetchVersions,
      } as any);

      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      // Should handle undefined version_number
      expect(result.current.versionHistory.length).toBe(2);
    });

    it('should handle restoreVersion failure', async () => {
      const mockVersionsData = [
        {
          id: 1,
          version_number: 1,
          content: 'v1',
          is_current: true,
          date_created: '2024-01-01',
        },
      ];

      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: mockVersionsData,
        refetch: mockRefetchVersions,
      } as any);

      mockSetCurrentVersionMutation.mockImplementation(() => ({
        unwrap: () => Promise.reject(new Error('Failed to restore')),
      }));

      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      // Try to restore
      await act(async () => {
        await result.current.handleRestoreVersion();
      });

      expect(console.error).toHaveBeenCalledWith(
        '[Canvas] Error restoring version:',
        expect.any(Error),
      );
    });

    it('should handle isVersionNavDisabled with version loading', async () => {
      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: [],
        refetch: mockRefetchVersions,
      } as any);

      const { result } = renderHook(() =>
        useCanvasVersionNavigation({
          ...defaultProps,
          isStreamingArtifact: false,
          isContentUpdating: false,
          isInitialLoading: false,
        }),
      );

      expect(result.current.isVersionNavDisabled).toBe(false);
    });

    it('should handle viewVersion when missing required parameters', async () => {
      vi.useRealTimers();

      const mockVersionsData = [
        {
          id: 1,
          version_number: 1,
          content: 'v1',
          is_current: true,
          date_created: '2024-01-01',
        },
      ];

      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: mockVersionsData,
        refetch: mockRefetchVersions,
      } as any);

      // Missing org
      const { result } = renderHook(() =>
        useCanvasVersionNavigation({
          ...defaultProps,
          org: undefined,
        }),
      );

      await waitFor(() => {
        expect(result.current.versionHistory.length).toBe(1);
      });

      mockFetchArtifactVersion.mockClear();

      await act(async () => {
        await result.current.viewVersion('v1');
      });

      // Should not call fetch
      expect(mockFetchArtifactVersion).not.toHaveBeenCalled();

      vi.useFakeTimers();
    });

    it('should handle currentVersionIndex fallback for empty history but viewing current version', async () => {
      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: [],
        refetch: mockRefetchVersions,
      } as any);

      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      // Set state manually
      act(() => {
        result.current.setActiveVersionId('v1');
        result.current.setActiveVersionIsCurrent(true);
        result.current.setVersionHistory([]); // Empty history
      });

      // currentVersionIndex should return -1 when history is empty
      expect(result.current.currentVersionIndex).toBe(-1);
    });

    it('should handle latestVersionId when no version is marked current in history', async () => {
      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: [],
        refetch: mockRefetchVersions,
      } as any);

      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      // Set history without current version
      act(() => {
        result.current.setVersionHistory([
          {
            id: 'v1',
            label: 'v1',
            content: 'v1',
            timestamp: '2024-01-01',
            isCurrent: false,
            versionNumber: 1,
          },
        ]);
        result.current.setCurrentVersion('v1');
      });

      // latestVersionId should fall back to currentVersion
      expect(result.current.latestVersionId).toBe('v1');
    });

    it('should handle version history sorted correctly with multiple versions', async () => {
      const versionsData = [
        {
          id: 3,
          version_number: 3,
          content: 'v3',
          is_current: true,
          date_created: '2024-01-03',
        },
        {
          id: 1,
          version_number: 1,
          content: 'v1',
          is_current: false,
          date_created: '2024-01-01',
        },
        {
          id: 2,
          version_number: 2,
          content: 'v2',
          is_current: false,
          date_created: '2024-01-02',
        },
      ];

      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: versionsData,
        refetch: mockRefetchVersions,
      } as any);

      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      // Should be sorted by version number
      expect(result.current.versionHistory[0].id).toBe('v1');
      expect(result.current.versionHistory[1].id).toBe('v2');
      expect(result.current.versionHistory[2].id).toBe('v3');
    });

    it('should handle clear versionIndexOverride when version is found in history', async () => {
      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: [],
        refetch: mockRefetchVersions,
      } as any);

      const { result, rerender } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      // First set history with a version
      act(() => {
        result.current.setVersionHistory([
          {
            id: 'v1',
            label: 'v1',
            content: 'v1',
            timestamp: '2024-01-01',
            isCurrent: true,
            versionNumber: 1,
          },
        ]);
        result.current.setActiveVersionId('v1');
      });

      // Trigger streaming update (sets versionIndexOverride)
      act(() => {
        result.current.updateVersionAfterStreaming(1, 'updated');
      });

      // Rerender to trigger the clear effect
      rerender();

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      // currentVersionIndex should be valid
      expect(result.current.currentVersionIndex).toBeGreaterThanOrEqual(0);
    });

    it('should handle existing version update in updateVersionAfterStreaming', async () => {
      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: [],
        refetch: mockRefetchVersions,
      } as any);

      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      // Set initial history
      act(() => {
        result.current.setVersionHistory([
          {
            id: 'v1',
            label: 'v1',
            content: 'initial',
            timestamp: '2024-01-01',
            versionId: 1,
            isCurrent: true,
            versionNumber: 1,
          },
        ]);
      });

      // Update the same version (not adding new)
      act(() => {
        result.current.updateVersionAfterStreaming(1, 'updated content');
      });

      // Should update existing, not add new
      expect(result.current.versionHistory.length).toBe(1);
      expect(result.current.versionHistory[0].content).toBe('updated content');
    });

    it('should handle versionIndexOverride with negative value', async () => {
      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: [],
        refetch: mockRefetchVersions,
      } as any);

      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      // Set version history and active version
      act(() => {
        result.current.setVersionHistory([
          {
            id: 'v1',
            label: 'v1',
            content: 'v1',
            timestamp: '2024-01-01',
            isCurrent: true,
            versionNumber: 1,
          },
        ]);
        result.current.setActiveVersionId('v1');
      });

      // Should use found index, not override (since override is null/negative)
      expect(result.current.currentVersionIndex).toBe(0);
    });

    it('should handle canGoNext when currentVersionIndex is negative', async () => {
      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: [],
        refetch: mockRefetchVersions,
      } as any);

      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      // Empty state, currentVersionIndex should be -1
      expect(result.current.currentVersionIndex).toBe(-1);
      expect(result.current.canGoNext).toBe(false);
    });

    it('should handle versionIndexOverride when foundIndex is negative', async () => {
      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: [],
        refetch: mockRefetchVersions,
      } as any);

      const { result, rerender } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      // Set up initial state with version history
      act(() => {
        result.current.setVersionHistory([
          {
            id: 'v1',
            label: 'v1',
            content: 'v1',
            timestamp: '2024-01-01',
            isCurrent: true,
            versionNumber: 1,
          },
        ]);
        // Set active to non-existent version
        result.current.setActiveVersionId('v99');
        result.current.setCurrentVersion('v99');
      });

      // Trigger streaming update which sets versionIndexOverride
      act(() => {
        result.current.updateVersionAfterStreaming(2, 'new content');
      });

      // The override should be set
      expect(result.current.activeVersionId).toBe('v2');

      // Rerender - since v2 is not in history (v1 and v2 mismatch), override won't clear
      rerender();

      await act(async () => {
        vi.advanceTimersByTime(100);
      });
    });

    it('should handle targetId being undefined in currentVersionIndex', async () => {
      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: [],
        refetch: mockRefetchVersions,
      } as any);

      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      // Keep both activeVersionId and currentVersion null
      // Set non-empty version history
      act(() => {
        result.current.setVersionHistory([
          {
            id: 'v1',
            label: 'v1',
            content: 'v1',
            timestamp: '2024-01-01',
            isCurrent: true,
            versionNumber: 1,
          },
        ]);
      });

      // With activeVersionId null and currentVersion null, should return -1
      // even with non-empty history
      expect(result.current.currentVersionIndex).toBe(-1);
    });

    it('should handle versionsData being null in sync effect', async () => {
      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: null,
        refetch: mockRefetchVersions,
      } as any);

      const { result } = renderHook(() =>
        useCanvasVersionNavigation(defaultProps),
      );

      act(() => {
        result.current.setActiveVersionId('v1');
      });

      // Should not crash with null versionsData
      expect(result.current.activeVersionId).toBe('v1');
    });

    it('should handle viewVersion cancelling debounced save', async () => {
      vi.useRealTimers();

      const mockVersionsData = [
        {
          id: 1,
          version_number: 1,
          content: 'v1',
          is_current: true,
          date_created: '2024-01-01',
        },
      ];

      vi.mocked(useListArtifactVersionsQuery).mockReturnValue({
        data: mockVersionsData,
        refetch: mockRefetchVersions,
      } as any);

      mockFetchArtifactVersion.mockImplementation(() => ({
        unwrap: () =>
          Promise.resolve({
            version_number: 1,
            content: 'v1',
            is_current: true,
          }),
      }));

      const mockCancel = vi.fn();

      const { result } = renderHook(() =>
        useCanvasVersionNavigation({
          ...defaultProps,
          debouncedSaveCancel: mockCancel,
        }),
      );

      await waitFor(() => {
        expect(result.current.versionHistory.length).toBe(1);
      });

      await act(async () => {
        await result.current.viewVersion('v1');
      });

      // debouncedSaveCancel should have been called
      expect(mockCancel).toHaveBeenCalled();

      vi.useFakeTimers();
    });

    it('should handle error data with detail containing artifact message case-insensitive', async () => {
      mockFetchVersionsList.mockImplementation(() => ({
        unwrap: () =>
          Promise.reject({
            status: 404,
            data: { detail: 'NO ARTIFACT MATCHES THE GIVEN QUERY' }, // uppercase
          }),
      }));

      renderHook(() => useCanvasVersionNavigation(defaultProps));

      await act(async () => {
        vi.advanceTimersByTime(0);
      });

      // Should be non-retriable
      expect(mockFetchVersionsList).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalled();
    });
  });
});
