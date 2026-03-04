import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import {
  useListArtifactVersionsQuery,
  useSetCurrentVersionMutation,
  useLazyGetArtifactVersionQuery,
  useLazyListArtifactVersionsQuery,
} from '@iblai/iblai-js/data-layer';
import { normalizeContentToMarkdown } from '@/components/canvas/canvas-utils';
import { markdownToHtml } from '@/lib/utils';

export interface VersionHistoryEntry {
  id: string;
  label: string;
  content: string;
  timestamp: string;
  versionId?: number;
  isCurrent?: boolean;
  versionNumber?: number;
}

export interface UseCanvasVersionNavigationProps {
  artifactId?: number;
  org?: string;
  userId?: string;
  metadataVersionNumber?: number;
  editorRef: React.MutableRefObject<{
    commands?: { setContent?: (content: string, emitUpdate?: boolean) => void };
  } | null>;
  applyProgrammaticContent: (content: string) => void;
  onVersionChange?: (versionId: string, isCurrent: boolean) => void;
  isStreamingArtifact?: boolean;
  isContentUpdating?: boolean;
  isInitialLoading?: boolean;
  debouncedSaveCancel?: () => void;
}

// Retry configuration for version fetching
const VERSION_FETCH_RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 500,
  maxDelayMs: 4000,
};

// Check if an error indicates the version doesn't exist yet (retriable)
// vs the artifact doesn't exist (not retriable - likely wrong artifact ID)
const isRetriableVersionError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;

  const err = error as { status?: number; data?: { detail?: string } | string };

  // Only retry on 404 errors
  if (err.status !== 404) return false;

  // Check error message to distinguish between artifact not found vs version not found
  const detail = typeof err.data === 'string' ? err.data : (err.data?.detail ?? '');

  // "No Artifact matches the given query" suggests wrong artifact ID - don't retry
  if (detail.toLowerCase().includes('no artifact matches')) {
    return false;
  }

  // Other 404s (like version not found) are retriable
  return true;
};

// Exponential backoff delay calculation
const getRetryDelay = (attempt: number): number => {
  const delay = VERSION_FETCH_RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt);
  // Add jitter to prevent thundering herd
  const jitter = Math.random() * 100;
  return Math.min(delay + jitter, VERSION_FETCH_RETRY_CONFIG.maxDelayMs);
};

// Sleep utility
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export function useCanvasVersionNavigation({
  artifactId,
  org,
  userId,
  metadataVersionNumber,
  editorRef,
  applyProgrammaticContent,
  onVersionChange,
  isStreamingArtifact = false,
  isContentUpdating = false,
  isInitialLoading = false,
  debouncedSaveCancel,
}: UseCanvasVersionNavigationProps) {
  // Version state
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);
  const [activeVersionIsCurrent, setActiveVersionIsCurrent] = useState(true);
  const [isVersionLoading, setIsVersionLoading] = useState(false);
  const [versionHistory, setVersionHistory] = useState<VersionHistoryEntry[]>([]);

  // Refs
  const hasUserNavigatedVersionRef = useRef(false);
  const wasOnCurrentVersionBeforeSaveRef = useRef(false);
  const suppressNextOnChangeRef = useRef(false);
  const lastSavedMarkdownRef = useRef<string | null>(null);
  // Prevent sync effect from overriding version state after streaming updates
  const justUpdatedFromStreamingRef = useRef(false);

  // Track if initial versions fetch succeeded (to enable RTK Query caching)
  const [initialFetchDone, setInitialFetchDone] = useState(false);
  const initialFetchAttemptedRef = useRef(false);

  // API hooks
  const [fetchArtifactVersion] = useLazyGetArtifactVersionQuery();
  const [fetchVersionsList] = useLazyListArtifactVersionsQuery();
  const [setCurrentVersionMutation] = useSetCurrentVersionMutation();

  // Query for versions - event-driven refetch (no polling)
  // Versions are refetched on:
  // 1. Initial load (via retry logic below)
  // 2. After manual save (PUT endpoint) completes
  // 3. After mentor streaming ends (artifact-stream-end event)
  // 4. After title update (via PUT endpoint)
  // 5. After version restore
  const { data: versionsData, refetch: refetchVersions } = useListArtifactVersionsQuery(
    {
      id: artifactId ?? 0,
      org: org ?? '',
      userId: userId ?? '',
    },
    {
      skip: !artifactId || !org || !userId || !initialFetchDone,
    },
  );

  // Initial fetch with retry logic for list versions
  useEffect(() => {
    if (!artifactId || !org || !userId) return;
    if (initialFetchAttemptedRef.current) return;

    initialFetchAttemptedRef.current = true;

    const fetchWithRetry = async () => {
      let attempt = 0;
      let lastError: unknown = null;

      while (attempt <= VERSION_FETCH_RETRY_CONFIG.maxRetries) {
        try {
          await fetchVersionsList({
            id: artifactId,
            org: org,
            userId: userId,
          }).unwrap();

          // Success - enable RTK Query caching for subsequent refetches
          setInitialFetchDone(true);
          return;
        } catch (error) {
          lastError = error;

          // Check if this error is retriable
          if (!isRetriableVersionError(error)) {
            // Non-retriable error (e.g., wrong artifact ID) - log and stop
            console.error('[Canvas] Failed to list versions - non-retriable error:', {
              artifactId,
              error,
            });
            // Still mark as done to prevent infinite attempts, but versions will be empty
            setInitialFetchDone(true);
            return;
          }

          // Retriable error - check if we have retries left
          if (attempt < VERSION_FETCH_RETRY_CONFIG.maxRetries) {
            const delay = getRetryDelay(attempt);
            await sleep(delay);
            attempt++;
          } else {
            // All retries exhausted
            console.error('[Canvas] Failed to list versions after retries:', {
              artifactId,
              attempts: attempt + 1,
              error,
            });
            // Mark as done to enable RTK Query caching (manual refetch can still succeed later)
            setInitialFetchDone(true);
            return;
          }
        }
      }

      // If we get here, all attempts failed but we still enable caching
      if (lastError) {
        setInitialFetchDone(true);
      }
    };

    void fetchWithRetry();
  }, [artifactId, org, userId, fetchVersionsList]);

  // Reset initial fetch state when artifact changes
  useEffect(() => {
    initialFetchAttemptedRef.current = false;
    setInitialFetchDone(false);
  }, [artifactId]);

  // Computed values
  const isViewingCurrentVersion = activeVersionIsCurrent;
  const isVersionNavDisabled =
    isStreamingArtifact || isContentUpdating || isInitialLoading || isVersionLoading;

  // Update version history from API data
  useEffect(() => {
    if (versionsData && versionsData.length > 0) {
      const sortedVersions = [...versionsData].sort(
        (a, b) => (a.version_number ?? 0) - (b.version_number ?? 0),
      );
      const formattedVersions = sortedVersions.map((v) => ({
        id: `v${v.version_number}`,
        label: `v${v.version_number}`,
        content: v.content,
        timestamp: v.date_created,
        versionId: v.id,
        isCurrent: v.is_current,
        versionNumber: v.version_number,
      }));
      setVersionHistory(formattedVersions);

      const currentVer = sortedVersions.find((v) => v.is_current);
      if (currentVer) {
        const currentId = `v${currentVer.version_number}`;
        setCurrentVersion(currentId);

        if (
          wasOnCurrentVersionBeforeSaveRef.current &&
          activeVersionId &&
          activeVersionId !== currentId
        ) {
          const newCurrentVersion = formattedVersions.find((v) => v.id === currentId);
          if (newCurrentVersion) {
            suppressNextOnChangeRef.current = true;
            hasUserNavigatedVersionRef.current = false;

            const normalizedContent = normalizeContentToMarkdown(newCurrentVersion.content);
            setActiveVersionId(currentId);
            setActiveVersionIsCurrent(true);
            setCurrentVersion(currentId);
            lastSavedMarkdownRef.current = normalizedContent;

            setTimeout(() => {
              const currentEditor = editorRef.current as any;
              if (currentEditor?.commands?.setContent) {
                const wasFocused = !!currentEditor.isFocused;
                const selection = currentEditor.state?.selection;
                const selectionRange = selection
                  ? { from: selection.from, to: selection.to }
                  : null;
                const htmlContent = markdownToHtml(normalizedContent);
                currentEditor.commands.setContent(htmlContent, false);

                if (wasFocused && selectionRange) {
                  requestAnimationFrame(() => {
                    if (!currentEditor || currentEditor.isDestroyed) return;
                    const docSize = currentEditor.state.doc.content.size;
                    const from = Math.min(selectionRange.from, docSize);
                    const to = Math.min(selectionRange.to, docSize);
                    currentEditor.chain().focus().setTextSelection({ from, to }).run();
                  });
                }
              }
            }, 0);

            setTimeout(() => {
              suppressNextOnChangeRef.current = false;
            }, 100);

            wasOnCurrentVersionBeforeSaveRef.current = false;
          }
        } else if (!activeVersionId) {
          setActiveVersionId(currentId);
          setActiveVersionIsCurrent(true);
        }
      }
    }
  }, [versionsData, activeVersionId, editorRef]);

  // Explicit override for version index when we know it should be at the latest
  const [versionIndexOverride, setVersionIndexOverride] = useState<number | null>(null);

  // Current version index and navigation state
  const currentVersionIndex = useMemo(() => {
    // Use override if set (useful after streaming updates before history syncs)
    if (versionIndexOverride !== null && versionIndexOverride >= 0) {
      return versionIndexOverride;
    }
    const targetId = activeVersionId ?? currentVersion;
    if (!targetId || versionHistory.length === 0) return -1;
    const foundIndex = versionHistory.findIndex((v) => v.id === targetId);
    // If we're viewing the current version but can't find it, assume we're at the end
    if (foundIndex === -1 && activeVersionIsCurrent && versionHistory.length > 0) {
      return versionHistory.length - 1;
    }
    return foundIndex;
  }, [
    activeVersionId,
    currentVersion,
    versionHistory,
    activeVersionIsCurrent,
    versionIndexOverride,
  ]);

  const canGoPrevious = currentVersionIndex > 0;
  const canGoNext = currentVersionIndex < versionHistory.length - 1 && currentVersionIndex >= 0;

  // Clear version index override when history updates
  useEffect(() => {
    if (versionIndexOverride !== null && versionHistory.length > 0) {
      const targetId = activeVersionId ?? currentVersion;
      const foundIndex = versionHistory.findIndex((v) => v.id === targetId);
      if (foundIndex >= 0) {
        // History now has our version, clear override
        setVersionIndexOverride(null);
      }
    }
  }, [versionHistory, activeVersionId, currentVersion, versionIndexOverride]);

  // Track last initialized metadata version to detect when opening different versions from chat
  const lastInitializedMetadataVersionRef = useRef<number | null>(null);

  // Initialize version from metadata
  useEffect(() => {
    if (!versionsData || versionsData.length === 0) return;
    if (hasUserNavigatedVersionRef.current) return;

    // Determine target version: metadata version if provided and valid, otherwise current version
    const targetVersionNumber =
      metadataVersionNumber && versionsData.find((v) => v.version_number === metadataVersionNumber)
        ? metadataVersionNumber
        : versionsData.find((v) => v.is_current)?.version_number;

    if (!targetVersionNumber) return;

    // Check if we need to re-initialize: either no activeVersionId yet,
    // or metadataVersionNumber changed (user opened a different version from chat)
    const needsInit =
      !activeVersionId ||
      (metadataVersionNumber !== undefined &&
        metadataVersionNumber !== lastInitializedMetadataVersionRef.current);

    if (!needsInit) return;

    const targetId = `v${targetVersionNumber}`;
    const targetVersion = versionsData.find((v) => v.version_number === targetVersionNumber);
    if (!targetVersion) return;

    // Track the version we're initializing
    lastInitializedMetadataVersionRef.current = metadataVersionNumber ?? null;

    setActiveVersionId(targetId);
    setActiveVersionIsCurrent(!!targetVersion.is_current);
    suppressNextOnChangeRef.current = true;
    const normalized = normalizeContentToMarkdown(targetVersion.content);
    setCurrentVersion(targetId);
    lastSavedMarkdownRef.current = normalized;

    // Also apply the content to editor if available
    if (editorRef.current?.commands?.setContent) {
      const htmlContent = markdownToHtml(normalized);
      editorRef.current.commands.setContent(htmlContent, false);
    }

    setTimeout(() => {
      suppressNextOnChangeRef.current = false;
    }, 200);
  }, [versionsData, metadataVersionNumber, activeVersionId, editorRef]);

  // Sync activeVersionIsCurrent with versionsData
  useEffect(() => {
    if (!activeVersionId || !versionsData) return;
    // Skip sync if we just updated from streaming - wait for API to catch up
    if (justUpdatedFromStreamingRef.current) {
      return;
    }
    const match = versionsData.find((v) => `v${v.version_number}` === activeVersionId);
    if (match) {
      setActiveVersionIsCurrent(!!match.is_current);
    }
  }, [activeVersionId, versionsData]);

  // View a specific version
  const viewVersion = useCallback(
    async (versionId: string) => {
      const version = versionHistory.find((v) => v.id === versionId);
      if (!version) return;

      if (!artifactId || !org || !userId || !version.versionId) {
        return;
      }

      hasUserNavigatedVersionRef.current = true;
      setIsVersionLoading(true);

      debouncedSaveCancel?.();

      // Retry logic with exponential backoff for version fetching
      let lastError: unknown = null;
      let attempt = 0;

      while (attempt <= VERSION_FETCH_RETRY_CONFIG.maxRetries) {
        try {
          const fetchedVersion = await fetchArtifactVersion({
            id: artifactId,
            org: org,
            userId: userId,
            versionId: version.versionId,
          }).unwrap();

          const nextContent = normalizeContentToMarkdown(
            fetchedVersion.content ?? version.content ?? '',
          );
          const isCurrent = !!fetchedVersion.is_current;
          const nextId =
            `v${fetchedVersion.version_number ?? version.versionNumber ?? ''}` || versionId;

          setActiveVersionId(nextId);
          setActiveVersionIsCurrent(isCurrent);
          setCurrentVersion(nextId);
          applyProgrammaticContent(nextContent);

          setVersionHistory((prev) =>
            prev.map((v) =>
              v.id === version.id
                ? {
                    ...v,
                    content: nextContent,
                    isCurrent,
                    versionNumber: fetchedVersion.version_number ?? v.versionNumber,
                  }
                : {
                    ...v,
                    isCurrent: isCurrent ? false : v.isCurrent,
                  },
            ),
          );

          onVersionChange?.(nextId, isCurrent);
          setIsVersionLoading(false);
          return; // Success - exit the retry loop
        } catch (error) {
          lastError = error;

          // Check if this error is retriable (version not found yet vs artifact not found)
          if (!isRetriableVersionError(error)) {
            // Non-retriable error (e.g., wrong artifact ID) - log and break immediately
            console.error('[Canvas] Failed to load version - non-retriable error:', {
              artifactId,
              versionId: version.versionId,
              error,
            });
            break;
          }

          // Retriable error - check if we have retries left
          if (attempt < VERSION_FETCH_RETRY_CONFIG.maxRetries) {
            const delay = getRetryDelay(attempt);
            await sleep(delay);
            attempt++;
            // Don't log on retries - only log if all retries fail
          } else {
            // All retries exhausted
            console.error('[Canvas] Failed to load version after retries:', {
              artifactId,
              versionId: version.versionId,
              attempts: attempt + 1,
              error,
            });
            break;
          }
        }
      }

      // If we get here, all attempts failed
      if (lastError) {
        toast.error('Unable to load version');
        suppressNextOnChangeRef.current = false;
      }
      setIsVersionLoading(false);
    },
    [
      versionHistory,
      fetchArtifactVersion,
      artifactId,
      org,
      userId,
      applyProgrammaticContent,
      debouncedSaveCancel,
      onVersionChange,
    ],
  );

  // Navigate to previous version
  const handlePreviousVersion = useCallback(async () => {
    if (!canGoPrevious || currentVersionIndex <= 0) return;
    const previousVersion = versionHistory[currentVersionIndex - 1];
    if (previousVersion) {
      await viewVersion(previousVersion.id);
    }
  }, [canGoPrevious, currentVersionIndex, versionHistory, viewVersion]);

  // Navigate to next version
  const handleNextVersion = useCallback(async () => {
    if (!canGoNext || currentVersionIndex >= versionHistory.length - 1) return;
    const nextVersion = versionHistory[currentVersionIndex + 1];
    if (nextVersion) {
      await viewVersion(nextVersion.id);
    }
  }, [canGoNext, currentVersionIndex, versionHistory, viewVersion]);

  // Get latest version ID
  const latestVersionId = useMemo(
    () => versionHistory.find((v) => v.isCurrent)?.id ?? currentVersion,
    [versionHistory, currentVersion],
  );

  // Back to latest version
  const handleBackToLatest = useCallback(() => {
    if (latestVersionId) {
      void viewVersion(latestVersionId);
    }
  }, [latestVersionId, viewVersion]);

  // Restore current version
  const handleRestoreVersion = useCallback(async () => {
    if (!activeVersionId) return;
    const version = versionHistory.find((v) => v.id === activeVersionId);
    if (!version || !version.versionId || !artifactId || !org || !userId) {
      return;
    }
    try {
      await setCurrentVersionMutation({
        id: artifactId,
        org: org,
        userId: userId,
        requestBody: { version_id: version.versionId },
      }).unwrap();
      await refetchVersions();
      await viewVersion(version.id);
      setActiveVersionIsCurrent(true);
      toast.success('Version restored');
    } catch (error) {
      console.error('[Canvas] Error restoring version:', error);
      toast.error('Failed to restore version');
    }
  }, [
    activeVersionId,
    versionHistory,
    artifactId,
    org,
    userId,
    setCurrentVersionMutation,
    refetchVersions,
    viewVersion,
  ]);

  // Update version after streaming
  const updateVersionAfterStreaming = useCallback(
    (
      versionNumber: number,
      content: string,
      startIndex?: number,
      endIndex?: number,
      previousContent?: string,
    ) => {
      const nextVersionId = `v${versionNumber}`;

      // Prevent sync effect from overriding our state until API catches up
      justUpdatedFromStreamingRef.current = true;

      setActiveVersionId(nextVersionId);
      setActiveVersionIsCurrent(true);
      setCurrentVersion(nextVersionId);

      // Reset user navigation flag - they should be on the latest version now
      hasUserNavigatedVersionRef.current = false;

      setVersionHistory((prev) => {
        const withoutCurrent = prev.map((v) =>
          v.id === nextVersionId ? v : { ...v, isCurrent: false },
        );
        const existingIndex = withoutCurrent.findIndex((v) => v.id === nextVersionId);
        const normalizedContent = normalizeContentToMarkdown(
          startIndex !== undefined && endIndex !== undefined && previousContent
            ? previousContent.slice(0, startIndex) + content + previousContent.slice(endIndex)
            : content,
        );
        const nextEntry = {
          id: nextVersionId,
          label: nextVersionId,
          content: normalizedContent,
          timestamp: new Date().toISOString(),
          versionId: withoutCurrent[existingIndex]?.versionId,
          isCurrent: true,
          versionNumber,
        };
        if (existingIndex >= 0) {
          withoutCurrent[existingIndex] = {
            ...withoutCurrent[existingIndex],
            ...nextEntry,
          };
          // Set override to existing index (version is being updated in place)
          setVersionIndexOverride(existingIndex);
        } else {
          withoutCurrent.push(nextEntry);
          // Set override to the last index (new version added)
          setVersionIndexOverride(withoutCurrent.length - 1);
        }
        return withoutCurrent.sort((a, b) => (a.versionNumber ?? 0) - (b.versionNumber ?? 0));
      });

      // Allow sync after API has time to update (after refetch)
      setTimeout(() => {
        justUpdatedFromStreamingRef.current = false;
      }, 3000);
    },
    [],
  );

  // Reset version navigation when artifact changes
  const resetVersionNavigation = useCallback(() => {
    hasUserNavigatedVersionRef.current = false;
    setActiveVersionId(null);
    setActiveVersionIsCurrent(true);
  }, []);

  // Mark was on current version before save
  const markWasOnCurrentVersionBeforeSave = useCallback(() => {
    wasOnCurrentVersionBeforeSaveRef.current = isViewingCurrentVersion;
  }, [isViewingCurrentVersion]);

  // Silently go to latest version without loading from API
  // Useful after manual saves or updates
  const silentlyGoToLatest = useCallback(() => {
    const latestVersion = versionHistory.find((v) => v.isCurrent);
    if (latestVersion) {
      justUpdatedFromStreamingRef.current = true;
      hasUserNavigatedVersionRef.current = false;
      setActiveVersionId(latestVersion.id);
      setActiveVersionIsCurrent(true);
      setCurrentVersion(latestVersion.id);
      // Set override to latest version index
      const latestIndex = versionHistory.findIndex((v) => v.isCurrent);
      if (latestIndex >= 0) {
        setVersionIndexOverride(latestIndex);
      }

      setTimeout(() => {
        justUpdatedFromStreamingRef.current = false;
      }, 3000);
    } else if (versionHistory.length > 0) {
      // Fallback: if no version marked as current, go to the last one
      const lastVersion = versionHistory[versionHistory.length - 1];
      justUpdatedFromStreamingRef.current = true;
      hasUserNavigatedVersionRef.current = false;
      setActiveVersionId(lastVersion.id);
      setActiveVersionIsCurrent(true);
      setCurrentVersion(lastVersion.id);
      setVersionIndexOverride(versionHistory.length - 1);

      setTimeout(() => {
        justUpdatedFromStreamingRef.current = false;
      }, 3000);
    }
  }, [versionHistory]);

  return {
    // State
    currentVersion,
    activeVersionId,
    activeVersionIsCurrent,
    isVersionLoading,
    versionHistory,
    versionsData,
    isViewingCurrentVersion,
    isVersionNavDisabled,
    currentVersionIndex,
    canGoPrevious,
    canGoNext,
    latestVersionId,

    // Refs
    suppressNextOnChangeRef,
    hasUserNavigatedVersionRef,
    lastSavedMarkdownRef,

    // Actions
    viewVersion,
    handlePreviousVersion,
    handleNextVersion,
    handleBackToLatest,
    handleRestoreVersion,
    refetchVersions,
    updateVersionAfterStreaming,
    resetVersionNavigation,
    markWasOnCurrentVersionBeforeSave,
    silentlyGoToLatest,

    // State setters
    setActiveVersionId,
    setActiveVersionIsCurrent,
    setCurrentVersion,
    setVersionHistory,
  };
}
