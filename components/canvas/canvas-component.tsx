'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import {
  FileText,
  X,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Download,
  FileIcon,
  FileCode,
} from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import type { Artifact } from '@iblai/iblai-api';
import {
  useLazyGetArtifactQuery,
  useUpdateArtifactMutation,
  useLazyListArtifactsQuery,
  useEditSessionMutation,
} from '@iblai/iblai-js/data-layer';
import { cn, htmlToMarkdown, markdownToHtml } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  useCanvasSendMessageHandler,
  useCanvasUpdateDetector,
} from './canvas-send-message-handler';
import { useCanvasChatIntegration } from '@/hooks/use-canvas-chat-integration';
import {
  useCanvasRichTextEditor,
  CanvasRichTextEditorToolbar,
  CanvasRichTextEditorContent,
} from './canvas-rich-text-editor';
import { CanvasControls } from './canvas-controls';
import {
  normalizeContentToMarkdown,
  getInitialEditorContent,
  safeParseRecord,
  mergeRecords,
  findValueByKey,
  coerceNumber,
  coerceString,
  calculateMarkdownIndices,
  resolveArtifactIdFromSources,
  shouldProcessEditorChange,
  getHighlightInputKeyAction,
} from './canvas-utils';
import {
  exportAsPDF,
  exportAsDOCX,
  exportAsMarkdown,
} from './canvas-export-handlers';
import { useCanvasVersionNavigation } from '@/hooks/use-canvas-version-navigation';

// Import KaTeX CSS for math rendering
import 'katex/dist/katex.min.css';
// Import highlight.js theme for code syntax highlighting
import 'highlight.js/styles/github.css';

interface CanvasComponentProps {
  title?: string;
  content?: string;
  onClose?: () => void;
  isAnimating?: boolean;
  artifactId?: number;
  org?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
  sessionId?: string;
  tenantKey?: string;
  sendMessage?: (
    text: string,
    options?: { visible?: boolean; artifact?: any },
  ) => void;
  onArtifactUpdate?: (artifact: Artifact) => void;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const CANVAS_CONTENT_UPDATE_INTERVAL = 200;
const CANVAS_CONTENT_FORCE_UPDATE_INTERVAL = 1000;

export const countStreamingParagraphs = (value: string): number => {
  if (!value) return 0;
  if (value.includes('<p')) {
    const matches = value.match(/<p[\s>]/gi);
    return matches ? matches.length : 0;
  }
  const matches = value.match(/\r?\n\r?\n+/g);
  return matches ? matches.length : 0;
};

export const getStreamingUpdateInterval = (contentLength: number): number => {
  if (contentLength >= 20000) return 500;
  if (contentLength >= 10000) return 400;
  if (contentLength >= 5000) return 300;
  return CANVAS_CONTENT_UPDATE_INTERVAL;
};

export const getStreamingCharThreshold = (contentLength: number): number => {
  if (contentLength >= 20000) return 1200;
  if (contentLength >= 10000) return 800;
  if (contentLength >= 5000) return 500;
  return 200;
};

// Exported for testing - Get save status label
export const getSaveStatusLabel = (
  saveState: SaveState,
  saveError: string | null,
): string | null => {
  switch (saveState) {
    case 'saving':
      return 'Saving…';
    case 'saved':
      return 'All changes saved';
    case 'error':
      return saveError ?? 'Save failed';
    default:
      return null;
  }
};

// Exported for testing - Get save status CSS class
export const getSaveStatusClass = (saveState: SaveState): string => {
  if (saveState === 'error') return 'text-xs text-red-500';
  if (saveState === 'saved') return 'text-xs text-emerald-600';
  return 'text-xs text-gray-500';
};

// Exported for testing - Determine if overlay should show
export const getShouldShowOverlay = (
  showAnimation: boolean,
  isExporting: boolean,
  isInitialLoading: boolean,
  isVersionLoading: boolean,
  showUpdateAnimation: boolean,
  isStreamingWithNoContent: boolean,
): boolean => {
  return (
    showAnimation ||
    isExporting ||
    isInitialLoading ||
    isVersionLoading ||
    showUpdateAnimation ||
    isStreamingWithNoContent
  );
};

// Exported for testing - Get overlay message
export const getOverlayMessage = (
  isExporting: boolean,
  isInitialLoading: boolean,
  isVersionLoading: boolean,
  showUpdateAnimation: boolean,
  isContentUpdating: boolean,
  isStreamingWithNoContent: boolean,
): string => {
  if (isExporting) return 'Preparing document...';
  if (isInitialLoading) return 'Loading artifacts...';
  if (isVersionLoading) return 'Loading version...';
  if (showUpdateAnimation || isContentUpdating) return 'Updating content...';
  if (isStreamingWithNoContent) return 'Generating canvas content...';
  return 'Generating content...';
};

// Exported for testing - Derive markdown content from artifact or content prop
export const deriveMarkdownContent = (
  currentArtifact: { content?: string | null } | null,
  content: string,
  htmlToMarkdownFn: (html: string) => string,
): string => {
  if (currentArtifact) return currentArtifact.content ?? '';
  if (content && content.trim() !== '') {
    const trimmed = content.trim();
    if (trimmed.startsWith('<')) return htmlToMarkdownFn(trimmed);
    return trimmed;
  }
  return '';
};

// Exported for testing - Check if streaming with no content
export const isStreamingWithNoContentCheck = (
  isStreamingArtifact: boolean,
  editorContent: string | null | undefined,
): boolean => {
  return isStreamingArtifact && (!editorContent || editorContent.trim() === '');
};

// Exported for testing - Check if editing is disabled
export const isEditingDisabledCheck = (
  isViewingCurrentVersion: boolean,
  isContentUpdating: boolean,
): boolean => {
  return !isViewingCurrentVersion || isContentUpdating;
};

// Exported for testing - Check if streaming update should be skipped due to timing
export const shouldSkipStreamingUpdateByTiming = (
  timeSinceLastUpdate: number,
  updateInterval: number,
): boolean => {
  return timeSinceLastUpdate < updateInterval;
};

// Exported for testing - Check if streaming update should be skipped due to content threshold
export const shouldSkipStreamingUpdateByThreshold = (
  paragraphDelta: number,
  charDelta: number,
  minCharDelta: number,
  timeSinceLastUpdate: number,
  forceUpdateInterval: number,
): boolean => {
  return (
    paragraphDelta <= 0 &&
    charDelta < minCharDelta &&
    timeSinceLastUpdate < forceUpdateInterval
  );
};

// Exported for testing - Check if content is unchanged during streaming
export const isStreamingContentUnchanged = (
  normalized: string,
  currentContent: string,
): boolean => {
  return normalized === currentContent;
};

// Exported for testing - Build artifact payload for chat message
export const buildArtifactPayload = (
  artifact: {
    title?: string | null;
    file_extension?: string | null;
    id: number;
  },
  metadataTitle?: string | null,
  propTitle?: string,
): {
  title: string;
  file_extension: string;
  id: string;
  is_partial: boolean;
} => {
  return {
    title: artifact.title || metadataTitle || propTitle || 'Untitled Artifact',
    file_extension: artifact.file_extension || 'txt',
    id: String(artifact.id),
    is_partial: false,
  };
};

// Exported for testing - Check if artifact matches event
export const doesArtifactMatchEvent = (
  eventArtifactId: number | string | undefined,
  currentArtifactId: number | undefined,
  resolvedArtifactId: number | undefined,
  propArtifactId: number | undefined,
): boolean => {
  if (!eventArtifactId) return false;
  const eventId = Number(eventArtifactId);
  return (
    (currentArtifactId !== undefined &&
      eventId === Number(currentArtifactId)) ||
    (resolvedArtifactId !== undefined &&
      eventId === Number(resolvedArtifactId)) ||
    (propArtifactId !== undefined && eventId === Number(propArtifactId))
  );
};

// Exported for testing - Build partial content from indices
export const buildPartialContent = (
  previousContent: string,
  streamContent: string,
  startIndex: number,
  endIndex: number,
): string => {
  return (
    previousContent.slice(0, startIndex) +
    streamContent +
    previousContent.slice(endIndex)
  );
};

// Exported for testing - Check if save should be skipped
export const shouldSkipSave = (
  hasUserEdited: boolean,
  effectiveArtifactId: number | undefined,
  resolvedOrg: string | undefined,
  resolvedUserId: string | undefined,
  markdown: string,
  lastSavedMarkdown: string | null,
): boolean => {
  if (!hasUserEdited) return true;
  if (!effectiveArtifactId || !resolvedOrg || !resolvedUserId) return true;
  if (markdown.trim() === (lastSavedMarkdown ?? '').trim()) return true;
  return false;
};

// Exported for testing - Build save request body
export const buildSaveRequestBody = (
  markdown: string,
  title?: string | null,
): { content: string; title?: string } => {
  const requestBody: { content: string; title?: string } = {
    content: markdown,
  };
  if (title) requestBody.title = title;
  return requestBody;
};

// Exported for testing - Check if rename should proceed
export const shouldProceedWithRename = (
  trimmedTitle: string,
  currentTitle: string | null | undefined,
  propTitle: string,
): boolean => {
  return trimmedTitle !== (currentTitle ?? propTitle);
};

export function CanvasComponent({
  title = 'Untitled Artifact',
  content = '',
  onClose,
  isAnimating = false,
  artifactId,
  org,
  userId,
  metadata: _metadata,
  sessionId: _sessionId,
  sendMessage,
}: CanvasComponentProps) {
  const [showAnimation, setShowAnimation] = useState(false);
  const [editorContent, setEditorContent] = useState<string>(() =>
    getInitialEditorContent(content),
  );
  const editorContentValueRef = useRef(editorContent);
  const [displayTitle, setDisplayTitle] = useState<string>(title);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [currentArtifact, setCurrentArtifact] = useState<Artifact | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [showUpdateAnimation, setShowUpdateAnimation] = useState(false);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [renameTitle, setRenameTitle] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [isContentUpdating, setIsContentUpdating] = useState(false);
  const [previousContent, setPreviousContent] = useState<string | null>(null);
  const [isStreamingArtifact, setIsStreamingArtifact] = useState(false);

  // API hooks
  const [fetchArtifact] = useLazyGetArtifactQuery();
  const [fetchArtifacts] = useLazyListArtifactsQuery();
  const [updateArtifactMutation] = useUpdateArtifactMutation();
  const [editSession] = useEditSessionMutation();

  // Refs
  const pendingMarkdownRef = useRef<string | null>(null);
  const savedStatusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const isMountedRef = useRef(true);
  const hasUserEditedRef = useRef(false);
  const lastKnownVersionRef = useRef<number | null>(null);
  const editorRef = useRef<ReturnType<typeof useCanvasRichTextEditor>>(null);
  const hasInitializedEditorRef = useRef(false);
  // Cursor position to restore after save completes
  const cursorPositionBeforeSaveRef = useRef<{
    from: number;
    to: number;
    wasFocused: boolean;
  } | null>(null);

  // Content buffering for streaming updates
  const streamingContentBufferRef = useRef<{
    content: string;
    lastUpdateTime: number;
    updateTimer: ReturnType<typeof setTimeout> | null;
    lastAppliedContent: string;
    lastAppliedLength: number;
    lastAppliedParagraphs: number;
  }>({
    content: '',
    lastUpdateTime: 0,
    updateTimer: null,
    lastAppliedContent: '',
    lastAppliedLength: 0,
    lastAppliedParagraphs: 0,
  });

  // Text highlighting state
  const [selectedText, setSelectedText] = useState<{
    text: string;
    rect: DOMRect;
  } | null>(null);
  const [highlightInput, setHighlightInput] = useState('');
  const [showHighlightPopup, setShowHighlightPopup] = useState(false);
  const savedSelectionRef = useRef<Range | null>(null);
  const highlightInputRef = useRef<HTMLInputElement | null>(null);
  const [highlightRects, setHighlightRects] = useState<Array<DOMRect>>([]);
  const editorContentRef = useRef<HTMLDivElement | null>(null);

  // Resolve metadata
  const metadataRecord = useMemo(() => {
    const base = safeParseRecord(_metadata);
    if (!base) return undefined;
    return (
      mergeRecords(
        base,
        safeParseRecord(base.metadata),
        safeParseRecord(base.attributes),
        safeParseRecord(base.dataset),
        safeParseRecord(base.data),
        safeParseRecord(base.context),
      ) ?? base
    );
  }, [_metadata]);

  const resolvedSessionId = useMemo(() => {
    return (
      coerceString(_sessionId) ??
      coerceString(
        findValueByKey(metadataRecord, [
          'sessionId',
          'session_id',
          'session',
          'chat_session_id',
        ]),
      )
    );
  }, [_sessionId, metadataRecord]);

  const resolvedArtifactId = useMemo(() => {
    // Priority order for finding artifact ID in metadata:
    // 1. Explicit artifact ID keys (artifactId, artifact_id, artifactID)
    // 2. 'artifact' key (used in ArtifactVersion objects where 'id' is the version's ID)
    // IMPORTANT: We avoid using generic 'id' key as it can be confused with version ID
    // when metadata contains ArtifactVersion data (version.id vs artifact.id)
    const metadataId = coerceNumber(
      findValueByKey(metadataRecord, [
        'artifactId',
        'artifact_id',
        'artifactID',
        'artifact',
      ]),
    );
    return resolveArtifactIdFromSources(
      artifactId,
      metadataId,
      currentArtifact?.id,
    );
  }, [artifactId, metadataRecord, currentArtifact?.id]);

  const resolvedOrg = useMemo(() => {
    return (
      coerceString(org) ??
      coerceString(
        findValueByKey(metadataRecord, [
          'org',
          'tenant',
          'tenant_key',
          'organization',
          'platform',
          'org_key',
        ]),
      )
    );
  }, [metadataRecord, org]);

  const resolvedUserId = useMemo(() => {
    return (
      coerceString(userId) ??
      coerceString(
        findValueByKey(metadataRecord, [
          'user_id',
          'userId',
          'username',
          'user',
          'owner',
        ]),
      )
    );
  }, [metadataRecord, userId]);

  const metadataVersionNumber = useMemo(() => {
    const val = findValueByKey(metadataRecord, [
      'versionNumber',
      'version_number',
      'version',
    ]);
    return coerceNumber(val);
  }, [metadataRecord]);

  // Check if canvas was opened during streaming
  const metadataIsStreaming = useMemo(() => {
    const val = findValueByKey(metadataRecord, ['isStreaming', 'is_streaming']);
    return val === true || val === 'true';
  }, [metadataRecord]);

  const metadataTitle = useMemo(
    () =>
      coerceString(
        findValueByKey(metadataRecord, ['title', 'artifact_title', 'name']),
      ),
    [metadataRecord],
  );

  const effectiveArtifactId = resolvedArtifactId ?? currentArtifact?.id;

  // Apply programmatic content updates
  const applyProgrammaticContent = useCallback((rawContent: string) => {
    const normalized = normalizeContentToMarkdown(rawContent);
    hasUserEditedRef.current = false;
    setEditorContent(normalized);
    editorContentValueRef.current = normalized;
    streamingContentBufferRef.current.lastAppliedContent = normalized;
    streamingContentBufferRef.current.lastAppliedLength = normalized.length;
    streamingContentBufferRef.current.lastAppliedParagraphs =
      countStreamingParagraphs(normalized);
    const currentEditor = editorRef.current;
    if (currentEditor?.commands?.setContent) {
      const htmlContent = markdownToHtml(normalized);
      // setContent with false prevents onUpdate from firing and doesn't add to history
      currentEditor.commands.setContent(htmlContent, false);
      // Reset the editor's user edit tracking since this is a programmatic update
      (currentEditor as any).__hasUserEdited = false;
    }
  }, []);

  useEffect(() => {
    editorContentValueRef.current = editorContent;
  }, [editorContent]);

  // Version navigation hook
  const versionNav = useCanvasVersionNavigation({
    artifactId: effectiveArtifactId,
    org: resolvedOrg,
    userId: resolvedUserId,
    metadataVersionNumber,
    editorRef,
    applyProgrammaticContent,
    isStreamingArtifact,
    isContentUpdating,
    isInitialLoading,
  });

  const {
    versionsData,
    currentVersion,
    activeVersionId,
    activeVersionIsCurrent,
    isVersionLoading,
    versionHistory,
    isViewingCurrentVersion,
    isVersionNavDisabled,
    currentVersionIndex,
    canGoPrevious,
    canGoNext,
    suppressNextOnChangeRef,
    lastSavedMarkdownRef,
    handlePreviousVersion,
    handleNextVersion,
    handleBackToLatest,
    handleRestoreVersion,
    refetchVersions,
    updateVersionAfterStreaming,
    resetVersionNavigation,
    markWasOnCurrentVersionBeforeSave,
    silentlyGoToLatest,
    setActiveVersionId,
    setActiveVersionIsCurrent,
    setCurrentVersion,
  } = versionNav;

  const isEditingDisabled = !isViewingCurrentVersion || isContentUpdating;

  /* istanbul ignore next -- @preserve streaming content callback triggered by window events */
  const applyStreamingContent = useCallback(
    (rawContent: string) => {
      if (!rawContent) return;
      if (editorRef.current?.isFocused && hasUserEditedRef.current) {
        return;
      }

      const buffer = streamingContentBufferRef.current;
      const now = Date.now();
      const contentLength = rawContent.length;
      const updateInterval = getStreamingUpdateInterval(contentLength);
      const timeSinceLastUpdate = now - buffer.lastUpdateTime;

      if (timeSinceLastUpdate < updateInterval) {
        return;
      }

      const paragraphCount = countStreamingParagraphs(rawContent);
      const charDelta = Math.abs(contentLength - buffer.lastAppliedLength);
      const paragraphDelta = paragraphCount - buffer.lastAppliedParagraphs;
      const minCharDelta = getStreamingCharThreshold(contentLength);

      if (
        paragraphDelta <= 0 &&
        charDelta < minCharDelta &&
        timeSinceLastUpdate < CANVAS_CONTENT_FORCE_UPDATE_INTERVAL
      ) {
        return;
      }

      const normalized = normalizeContentToMarkdown(rawContent);
      const currentContent = editorContentValueRef.current ?? '';
      if (normalized === currentContent) {
        buffer.lastAppliedContent = normalized;
        buffer.lastAppliedLength = contentLength;
        buffer.lastAppliedParagraphs = paragraphCount;
        buffer.lastUpdateTime = now;
        return;
      }

      applyProgrammaticContent(normalized);
      lastSavedMarkdownRef.current = normalized;
      buffer.lastAppliedContent = normalized;
      buffer.lastAppliedLength = contentLength;
      buffer.lastAppliedParagraphs = paragraphCount;
      buffer.lastUpdateTime = now;
    },
    [applyProgrammaticContent, lastSavedMarkdownRef],
  );

  // Chat integration
  useCanvasChatIntegration({
    currentArtifact,
    sendMessage,
    isCanvasOpen: true,
  });

  // Canvas message handler
  /* istanbul ignore next -- @preserve onMessageSent callback triggered by external hook */
  const { sendFullArtifactUpdate } = useCanvasSendMessageHandler({
    currentArtifact,
    sendMessage,
    onMessageSent: /* istanbul ignore next -- @preserve */ () => {
      hasUserEditedRef.current = false;
    },
  });

  // Detect external artifact updates
  /* istanbul ignore next -- @preserve external update detection callback */
  useCanvasUpdateDetector(currentArtifact, (newContent) => {
    if (!hasUserEditedRef.current) {
      setShowUpdateAnimation(true);
      setTimeout(() => setShowUpdateAnimation(false), 2000);

      const normalizedContent = normalizeContentToMarkdown(newContent);
      setEditorContent(normalizedContent);
      lastSavedMarkdownRef.current = normalizedContent;
      setCurrentArtifact((prev) =>
        prev ? { ...prev, content: normalizedContent } : prev,
      );
      // Reset editor's user edit tracking since this is a programmatic update
      if (editorRef.current) {
        (editorRef.current as any).__hasUserEdited = false;
      }

      refetchVersions();
      if (currentArtifact) {
        loadArtifacts();
      }
    }
  });

  /* istanbul ignore next -- @preserve highlight position callback */
  const refreshHighlightPosition = useCallback(() => {
    if (!showHighlightPopup || !savedSelectionRef.current) return;
    const range = savedSelectionRef.current.cloneRange();
    const rect = range.getBoundingClientRect();
    const rects = Array.from(range.getClientRects());
    setSelectedText((prev) =>
      prev ? { ...prev, rect } : { text: range.toString(), rect },
    );
    setHighlightRects(rects);
  }, [showHighlightPopup]);

  // Streaming event handlers
  /* istanbul ignore next -- @preserve streaming event handlers effect */
  useEffect(() => {
    // On mount, check if there's any global streaming content we missed
    // This handles the case where canvas opens during streaming but misses initial content events
    const globalStreamingState = (window as any).__artifactStreamingState;
    if (
      globalStreamingState &&
      resolvedArtifactId &&
      Number(globalStreamingState.artifactId) === Number(resolvedArtifactId)
    ) {
      console.log('[Canvas] Catching up with missed streaming content:', {
        artifactId: globalStreamingState.artifactId,
        contentLength: globalStreamingState.accumulatedContent?.length || 0,
      });
      if (globalStreamingState.accumulatedContent) {
        const normalized = normalizeContentToMarkdown(
          globalStreamingState.accumulatedContent,
        );
        if (normalized && normalized.trim()) {
          applyProgrammaticContent(normalized);
        }
      }
      if (!isStreamingArtifact) {
        setIsStreamingArtifact(true);
        setIsInitialLoading(false);
      }
    }

    const handleArtifactStreamStart = (event: CustomEvent) => {
      const { artifactId: eventArtifactId, isUpdate } = event.detail;
      // Match artifact: check current artifact, resolved artifact ID, or the artifact ID prop
      // For new artifacts during streaming, resolvedArtifactId should be set from props
      const matchesArtifact =
        !!eventArtifactId &&
        ((currentArtifact &&
          Number(eventArtifactId) === Number(currentArtifact.id)) ||
          (resolvedArtifactId &&
            Number(eventArtifactId) === Number(resolvedArtifactId)) ||
          (artifactId && Number(eventArtifactId) === Number(artifactId)));

      if (matchesArtifact) {
        if (streamingContentBufferRef.current.updateTimer) {
          clearTimeout(streamingContentBufferRef.current.updateTimer);
        }
        const initialContent = isUpdate
          ? (editorContentValueRef.current ?? '')
          : '';
        streamingContentBufferRef.current = {
          content: '',
          lastUpdateTime: Date.now(),
          updateTimer: null,
          lastAppliedContent: initialContent,
          lastAppliedLength: initialContent.length,
          lastAppliedParagraphs: countStreamingParagraphs(initialContent),
        };

        setIsStreamingArtifact(true);
        setIsInitialLoading(false); // Canvas is now streaming, not loading
        if (isUpdate) {
          setPreviousContent(editorContentValueRef.current ?? '');
          setIsContentUpdating(true);
        }
      }
    };

    const handleArtifactStreamContent = (event: CustomEvent) => {
      const {
        artifactId: eventArtifactId,
        accumulatedContent,
        isPartial,
      } = event.detail;
      // Match artifact: check current artifact, resolved artifact ID, or the artifact ID prop
      const matchesArtifact =
        !!eventArtifactId &&
        ((currentArtifact &&
          Number(eventArtifactId) === Number(currentArtifact.id)) ||
          (resolvedArtifactId &&
            Number(eventArtifactId) === Number(resolvedArtifactId)) ||
          (artifactId && Number(eventArtifactId) === Number(artifactId)));

      // Accept streaming content if artifact matches and we're streaming or updating
      // Also accept if isStreamingArtifact is true (set at stream start)
      if (matchesArtifact && (isContentUpdating || isStreamingArtifact)) {
        if (editorRef.current?.isFocused && hasUserEditedRef.current) {
          return;
        }
        if (!isPartial) {
          const nextContent = accumulatedContent ?? '';
          streamingContentBufferRef.current.content = nextContent;
          const now = Date.now();
          const updateInterval = getStreamingUpdateInterval(nextContent.length);
          const timeSinceLastUpdate =
            now - streamingContentBufferRef.current.lastUpdateTime;

          if (streamingContentBufferRef.current.updateTimer) {
            clearTimeout(streamingContentBufferRef.current.updateTimer);
            streamingContentBufferRef.current.updateTimer = null;
          }

          if (timeSinceLastUpdate >= updateInterval) {
            applyStreamingContent(nextContent);
          } else {
            streamingContentBufferRef.current.updateTimer = setTimeout(() => {
              const bufferedContent = streamingContentBufferRef.current.content;
              if (bufferedContent) {
                applyStreamingContent(bufferedContent);
              }
              streamingContentBufferRef.current.updateTimer = null;
            }, updateInterval);
          }
        }
      }
    };

    const handleArtifactStreamEnd = (event: CustomEvent) => {
      const {
        artifactId: eventArtifactId,
        content: streamContent,
        isUpdate,
        isPartial,
        startIndex,
        endIndex,
        versionNumber,
        title: streamTitle,
        fileExtension,
      } = event.detail;
      // Match artifact: check current artifact, resolved artifact ID, or the artifact ID prop
      const matchesArtifact =
        !!eventArtifactId &&
        ((currentArtifact &&
          Number(eventArtifactId) === Number(currentArtifact.id)) ||
          (resolvedArtifactId &&
            Number(eventArtifactId) === Number(resolvedArtifactId)) ||
          (artifactId && Number(eventArtifactId) === Number(artifactId)));

      if (matchesArtifact) {
        if (streamingContentBufferRef.current.updateTimer) {
          clearTimeout(streamingContentBufferRef.current.updateTimer);
          streamingContentBufferRef.current.updateTimer = null;
        }
        streamingContentBufferRef.current.content = '';

        if (isUpdate) {
          setShowUpdateAnimation(true);

          if (
            isPartial &&
            startIndex !== undefined &&
            endIndex !== undefined &&
            previousContent
          ) {
            const newContent =
              previousContent.slice(0, startIndex) +
              streamContent +
              previousContent.slice(endIndex);
            const normalizedContent = normalizeContentToMarkdown(newContent);
            if (!(editorRef.current?.isFocused && hasUserEditedRef.current)) {
              applyProgrammaticContent(normalizedContent);
            }
            lastSavedMarkdownRef.current = normalizedContent;
            setCurrentArtifact((prev) =>
              prev
                ? {
                    ...prev,
                    content: normalizedContent,
                    title: streamTitle || prev.title,
                    file_extension: fileExtension || prev.file_extension,
                    current_version_number:
                      versionNumber ?? prev.current_version_number,
                    version_count: versionNumber
                      ? Math.max(prev.version_count ?? 0, versionNumber)
                      : prev.version_count,
                  }
                : prev,
            );
          } else {
            const normalizedContent = normalizeContentToMarkdown(streamContent);
            if (!(editorRef.current?.isFocused && hasUserEditedRef.current)) {
              applyProgrammaticContent(normalizedContent);
            }
            lastSavedMarkdownRef.current = normalizedContent;
            setCurrentArtifact((prev) =>
              prev
                ? {
                    ...prev,
                    content: normalizedContent,
                    title: streamTitle || prev.title,
                    file_extension: fileExtension || prev.file_extension,
                    current_version_number:
                      versionNumber ?? prev.current_version_number,
                    version_count: versionNumber
                      ? Math.max(prev.version_count ?? 0, versionNumber)
                      : prev.version_count,
                  }
                : prev,
            );
          }

          if (versionNumber) {
            updateVersionAfterStreaming(
              versionNumber,
              streamContent,
              startIndex,
              endIndex,
              previousContent ?? undefined,
            );
          }

          refetchVersions();

          setTimeout(() => {
            setShowUpdateAnimation(false);
            setIsContentUpdating(false);
            setPreviousContent(null);
          }, 2000);
        } else {
          const normalizedContent = normalizeContentToMarkdown(streamContent);
          applyProgrammaticContent(normalizedContent);
          lastSavedMarkdownRef.current = normalizedContent;
          setCurrentArtifact((prev) =>
            prev
              ? {
                  ...prev,
                  content: normalizedContent,
                  title: streamTitle || prev.title,
                  file_extension: fileExtension || prev.file_extension,
                  current_version_number:
                    versionNumber ?? prev.current_version_number,
                  version_count: versionNumber
                    ? Math.max(prev.version_count ?? 0, versionNumber)
                    : prev.version_count,
                }
              : prev,
          );

          if (versionNumber) {
            setActiveVersionId(`v${versionNumber}`);
            setActiveVersionIsCurrent(true);
            setCurrentVersion(`v${versionNumber}`);
          }
        }

        if (streamTitle && currentArtifact?.title !== streamTitle) {
          setCurrentArtifact((prev) =>
            prev ? { ...prev, title: streamTitle } : prev,
          );
        }
      }
      console.log('artifact-stream-end new version ', {
        isStreamingArtifact,
        isContentUpdating,
        activeVersionIsCurrent,
        activeVersionId,
      });
      // Always reset streaming state when any artifact stream ends
      // This ensures toolbar is re-enabled even if artifact matching has timing issues
      setIsStreamingArtifact(false);
      setIsContentUpdating(false);
      // Ensure we're viewing the current version so toolbar is enabled
      setActiveVersionIsCurrent(true);
    };

    window.addEventListener(
      'artifact-stream-start' as any,
      handleArtifactStreamStart as any,
    );
    window.addEventListener(
      'artifact-stream-content' as any,
      handleArtifactStreamContent as any,
    );
    window.addEventListener(
      'artifact-stream-end' as any,
      handleArtifactStreamEnd as any,
    );

    return () => {
      if (streamingContentBufferRef.current.updateTimer) {
        clearTimeout(streamingContentBufferRef.current.updateTimer);
        streamingContentBufferRef.current.updateTimer = null;
      }
      window.removeEventListener(
        'artifact-stream-start' as any,
        handleArtifactStreamStart as any,
      );
      window.removeEventListener(
        'artifact-stream-content' as any,
        handleArtifactStreamContent as any,
      );
      window.removeEventListener(
        'artifact-stream-end' as any,
        handleArtifactStreamEnd as any,
      );
    };
  }, [
    currentArtifact,
    isContentUpdating,
    previousContent,
    resolvedArtifactId,
    artifactId,
    applyProgrammaticContent,
    applyStreamingContent,
    isStreamingArtifact,
    refetchVersions,
    updateVersionAfterStreaming,
    setActiveVersionId,
    setActiveVersionIsCurrent,
    setCurrentVersion,
    lastSavedMarkdownRef,
  ]);

  // Chat message listener
  /* istanbul ignore next -- @preserve chat message event listener */
  useEffect(() => {
    if (!currentArtifact || !sendMessage) return;

    const handleChatMessage = (
      event: CustomEvent<{ message: string; shouldIncludeArtifact?: boolean }>,
    ) => {
      if (event.detail.shouldIncludeArtifact !== false) {
        const artifactPayload = {
          title: currentArtifact.title || 'Untitled Artifact',
          file_extension: currentArtifact.file_extension || 'txt',
          id: String(currentArtifact.id),
          is_partial: false,
        };

        sendMessage(event.detail.message, {
          visible: true,
          artifact: artifactPayload,
        });
      }
    };

    window.addEventListener(
      'send-message-with-canvas' as any,
      handleChatMessage as any,
    );
    return () => {
      window.removeEventListener(
        'send-message-with-canvas' as any,
        handleChatMessage as any,
      );
    };
  }, [currentArtifact, sendMessage]);

  // Component lifecycle
  /* istanbul ignore next -- @preserve component lifecycle cleanup */
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (savedStatusTimeoutRef.current) {
        clearTimeout(savedStatusTimeoutRef.current);
      }
    };
  }, []);

  /* istanbul ignore next -- @preserve streaming state sync effect */
  useEffect(() => {
    if (isStreamingArtifact && isInitialLoading) {
      setIsInitialLoading(false);
    }
  }, [isStreamingArtifact, isInitialLoading]);

  // Track if we've initialized streaming from metadata (only do it once)
  const hasInitializedStreamingFromMetadataRef = useRef(false);

  // Initialize streaming state from metadata (when canvas opens during streaming)
  // Only run once on mount - don't keep re-setting after streaming ends
  useEffect(() => {
    if (
      metadataIsStreaming &&
      !hasInitializedStreamingFromMetadataRef.current
    ) {
      console.log('[Canvas] Initializing streaming state from metadata');
      hasInitializedStreamingFromMetadataRef.current = true;
      setIsStreamingArtifact(true);
      setIsInitialLoading(false);
    }
  }, [metadataIsStreaming]);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const nextTitle = currentArtifact?.title || title || 'Untitled Artifact';
    setDisplayTitle(nextTitle);
  }, [currentArtifact?.title, title]);

  // Load artifacts
  /* istanbul ignore next -- @preserve async artifact loading callback */
  const loadArtifacts = useCallback(async () => {
    if (!resolvedOrg || !resolvedUserId) {
      setIsInitialLoading(false);
      return;
    }

    setIsInitialLoading(true);

    try {
      const params: any = {};
      if (resolvedSessionId) {
        params.session_id = resolvedSessionId;
      }

      const artifactsResponse = await fetchArtifacts({
        org: resolvedOrg,
        userId: resolvedUserId,
        params,
      }).unwrap();

      if (!isMountedRef.current) return;

      let artifactToLoad: Artifact | null = null;

      if (resolvedArtifactId && artifactsResponse.results.length > 0) {
        artifactToLoad =
          artifactsResponse.results.find((a) => a.id === resolvedArtifactId) ||
          null;
      } else if (artifactsResponse.results.length > 0) {
        artifactToLoad = artifactsResponse.results[0];
      }

      if (artifactToLoad) {
        const fullArtifact = await fetchArtifact({
          id: artifactToLoad.id,
          org: resolvedOrg,
          userId: resolvedUserId,
        }).unwrap();

        if (!isMountedRef.current) return;

        setCurrentArtifact(fullArtifact);
        lastSavedMarkdownRef.current = normalizeContentToMarkdown(
          fullArtifact.content,
        );
        lastKnownVersionRef.current =
          (fullArtifact as any).current_version_number || 1;

        resetVersionNavigation();

        if (fullArtifact.content) {
          applyProgrammaticContent(fullArtifact.content);
        }
      } else {
        setCurrentArtifact(null);
        lastSavedMarkdownRef.current = null;
      }
    } catch (error) {
      if (isMountedRef.current) {
        console.error('[Canvas] Unable to load artifacts', error);
        toast.error('Unable to load artifacts');
      }
    } finally {
      if (isMountedRef.current) {
        setIsInitialLoading(false);
      }
    }
  }, [
    fetchArtifacts,
    fetchArtifact,
    resolvedArtifactId,
    resolvedOrg,
    resolvedUserId,
    resolvedSessionId,
    applyProgrammaticContent,
    resetVersionNavigation,
    lastSavedMarkdownRef,
  ]);

  // Initialize canvas
  /* istanbul ignore next -- @preserve canvas initialization effect */
  useEffect(() => {
    const initializeCanvas = async () => {
      if (resolvedSessionId && resolvedOrg && resolvedUserId) {
        try {
          await editSession({
            org: resolvedOrg,
            sessionId: resolvedSessionId,
            // @ts-expect-error - userId is not typed correctly
            userId: resolvedUserId,
            requestBody: { enable_artifacts: true } as any,
          }).unwrap();
        } catch (error) {
          console.error(
            '[Canvas] Failed to enable artifacts for session',
            error,
          );
        }
      }
      await loadArtifacts();
    };
    initializeCanvas();
  }, [
    loadArtifacts,
    resolvedSessionId,
    resolvedOrg,
    resolvedUserId,
    editSession,
  ]);

  // Notify chat system when canvas is active
  /* istanbul ignore next -- @preserve canvas active/inactive event dispatch */
  useEffect(() => {
    if (currentArtifact) {
      const event = new CustomEvent('canvas-active', {
        detail: {
          artifactId: currentArtifact.id,
          title: currentArtifact.title,
          file_extension: currentArtifact.file_extension,
        },
      });
      window.dispatchEvent(event);

      return () => {
        const inactiveEvent = new CustomEvent('canvas-inactive');
        window.dispatchEvent(inactiveEvent);
      };
    }
  }, [currentArtifact]);

  // Derived content
  const derivedMarkdownContent = useMemo(() => {
    if (currentArtifact) return currentArtifact.content ?? '';
    if (content && content.trim() !== '') {
      const trimmed = content.trim();
      if (trimmed.startsWith('<')) return htmlToMarkdown(trimmed);
      return trimmed;
    }
    return '';
  }, [content, currentArtifact]);

  /* istanbul ignore next -- @preserve content sync effect */
  useEffect(() => {
    if (isContentUpdating || isStreamingArtifact) return;
    const markdown = derivedMarkdownContent ?? '';
    if (!activeVersionIsCurrent && activeVersionId) return;
    if (editorRef.current?.isFocused && hasUserEditedRef.current) return;
    if (markdown !== editorContent && !hasUserEditedRef.current) {
      applyProgrammaticContent(markdown);
    }
  }, [
    derivedMarkdownContent,
    editorContent,
    activeVersionIsCurrent,
    activeVersionId,
    applyProgrammaticContent,
    isContentUpdating,
    isStreamingArtifact,
  ]);

  // Update version tracking when content is saved
  /* istanbul ignore next -- @preserve version tracking effect after save */
  useEffect(() => {
    /* istanbul ignore next -- @preserve */
    if (saveState === 'saved' && currentArtifact) {
      markWasOnCurrentVersionBeforeSave();
      if (lastKnownVersionRef.current !== null) {
        lastKnownVersionRef.current += 1;
      }
      refetchVersions();
      // Silently go to latest version after save to ensure user is viewing current content
      silentlyGoToLatest();
    }
  }, [
    saveState,
    currentArtifact,
    refetchVersions,
    markWasOnCurrentVersionBeforeSave,
    silentlyGoToLatest,
  ]);

  // Save logic
  /* istanbul ignore next -- @preserve async save callback */
  const performMarkdownSave = useCallback(
    async (markdown: string) => {
      if (!hasUserEditedRef.current) return;
      if (!effectiveArtifactId || !resolvedOrg || !resolvedUserId) return;
      if (markdown.trim() === (lastSavedMarkdownRef.current ?? '').trim())
        return;

      const currentEditor = editorRef.current;
      if (currentEditor?.state?.selection && !currentEditor.isDestroyed) {
        const { from, to } = currentEditor.state.selection;
        cursorPositionBeforeSaveRef.current = {
          from,
          to,
          wasFocused: currentEditor.isFocused,
        };
      }

      setSaveState('saving');
      setSaveError(null);

      try {
        const nextTitle =
          metadataTitle ??
          currentArtifact?.title ??
          title ??
          'Untitled Artifact';
        const requestBody: { content: string; title?: string } = {
          content: markdown,
        };
        if (nextTitle) requestBody.title = nextTitle;

        const savedArtifact = await updateArtifactMutation({
          id: effectiveArtifactId,
          org: resolvedOrg,
          userId: resolvedUserId,
          requestBody,
        }).unwrap();

        if (!isMountedRef.current) return;

        if (savedArtifact) {
          setCurrentArtifact(savedArtifact);
          lastSavedMarkdownRef.current = normalizeContentToMarkdown(
            savedArtifact.content,
          );
        } else {
          lastSavedMarkdownRef.current = normalizeContentToMarkdown(markdown);
        }
        setSaveState('saved');

        // Restore cursor position after save completes
        const currentEditor = editorRef.current;
        const savedCursor = cursorPositionBeforeSaveRef.current;
        if (currentEditor && savedCursor && !currentEditor.isDestroyed) {
          requestAnimationFrame(() => {
            try {
              if (!currentEditor || currentEditor.isDestroyed) return;
              const docSize = currentEditor.state.doc.content.size;
              // Ensure cursor position is within document bounds
              const from = Math.min(savedCursor.from, docSize);
              const to = Math.min(savedCursor.to, docSize);
              const shouldRestoreFocus =
                savedCursor.wasFocused && !currentEditor.isFocused;
              if (shouldRestoreFocus) {
                // Restore focus and cursor position smoothly
                currentEditor
                  .chain()
                  .focus()
                  .setTextSelection({ from, to })
                  .run();
              }
            } catch (e) {
              // Silently ignore if restoration fails
            }
          });
        }
        cursorPositionBeforeSaveRef.current = null;

        if (savedStatusTimeoutRef.current) {
          clearTimeout(savedStatusTimeoutRef.current);
        }
        savedStatusTimeoutRef.current = window.setTimeout(() => {
          if (isMountedRef.current) setSaveState('idle');
        }, 2000) as unknown as ReturnType<typeof setTimeout>;
      } catch (error) {
        console.error('[Canvas] Failed to save artifact', error);
        if (isMountedRef.current) {
          setSaveState('error');
          setSaveError('Unable to save changes');
          toast.error('Failed to save canvas changes');
        }
        throw error;
      }
    },
    [
      currentArtifact,
      metadataTitle,
      effectiveArtifactId,
      resolvedOrg,
      resolvedUserId,
      title,
      updateArtifactMutation,
      lastSavedMarkdownRef,
    ],
  );

  /* istanbul ignore next -- @preserve debounced save callback */
  const debouncedSave = useDebouncedCallback(async (markdown: string) => {
    pendingMarkdownRef.current = null;
    try {
      await performMarkdownSave(markdown);
    } catch (error) {
      console.error('[Canvas] Debounced save failed', error);
    }
  }, 2000);

  /* istanbul ignore next -- @preserve schedule save callback */
  const scheduleMarkdownSave = useCallback(
    (markdown: string) => {
      if (!hasUserEditedRef.current) return;
      if (!effectiveArtifactId || !resolvedOrg || !resolvedUserId) return;
      pendingMarkdownRef.current = markdown;
      // Save cursor position before triggering save
      const currentEditor = editorRef.current;
      if (currentEditor?.state?.selection && !currentEditor.isDestroyed) {
        const { from, to } = currentEditor.state.selection;
        cursorPositionBeforeSaveRef.current = {
          from,
          to,
          wasFocused: currentEditor.isFocused,
        };
      }
      debouncedSave(markdown);
    },
    [debouncedSave, effectiveArtifactId, resolvedOrg, resolvedUserId],
  );

  // Editor
  const editor = useCanvasRichTextEditor({
    value: editorContent,
    /* istanbul ignore next -- @preserve editor onChange callback invoked by external hook */
    onChange: /* istanbul ignore next -- @preserve */ (markdown) => {
      /* istanbul ignore next -- @preserve */
      setEditorContent(markdown);

      // Check if this is an actual user edit using the editor's built-in tracking
      // The editor sets __hasUserEdited = true only for non-programmatic transactions
      // This is the authoritative way to detect user edits vs programmatic updates
      /* istanbul ignore next -- @preserve */
      const isActualUserEdit =
        (editorRef.current as any)?.__hasUserEdited === true;
      if (!isActualUserEdit) {
        // Not a user edit - skip save logic entirely
        return;
      }

      /* istanbul ignore next -- @preserve */
      const decision = shouldProcessEditorChange(
        suppressNextOnChangeRef.current,
        hasInitializedEditorRef.current,
        isViewingCurrentVersion,
        markdown.trim(),
        (lastSavedMarkdownRef.current ?? '').trim(),
      );

      // Handle first initialization
      /* istanbul ignore next -- @preserve */
      if (decision.reason === 'not_initialized') {
        hasInitializedEditorRef.current = true;
      }

      /* istanbul ignore next -- @preserve */
      hasUserEditedRef.current = decision.shouldMarkEdited;

      /* istanbul ignore next -- @preserve */
      if (decision.shouldProcess) {
        scheduleMarkdownSave(markdown);
      }
    },
    enableAutoSave: false,
    disabled: isEditingDisabled,
    artifactId: undefined,
    org: undefined,
    userId: undefined,
    title: undefined,
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  /* istanbul ignore next -- @preserve async flush save callback */
  const flushSave = useCallback(async () => {
    debouncedSave.cancel();
    const pendingContent = pendingMarkdownRef.current ?? editorContent ?? null;
    pendingMarkdownRef.current = null;
    if (!pendingContent) return;
    await performMarkdownSave(pendingContent);
  }, [debouncedSave, editorContent, performMarkdownSave]);

  useEffect(() => {
    return () => {
      debouncedSave.cancel();
    };
  }, [debouncedSave]);

  useEffect(() => {
    hasUserEditedRef.current = false;
    pendingMarkdownRef.current = null;
    debouncedSave.cancel();
    setSaveState('idle');
    setSaveError(null);
  }, [debouncedSave, resolvedArtifactId]);

  // Export handlers
  // Export the currently displayed content (editorContent), not the latest from API
  // This ensures users can export the version they're currently viewing
  /* istanbul ignore next -- @preserve export data callback */
  const getExportData = useCallback(async () => {
    // Flush any pending saves first
    await flushSave();
    // Use the currently displayed editor content - this respects the viewed version
    const markdownSource =
      editorContent ?? currentArtifact?.content ?? content ?? '';
    const exportTitle =
      metadataTitle ?? currentArtifact?.title ?? title ?? 'Untitled Artifact';
    return { markdownSource, exportTitle };
  }, [
    flushSave,
    currentArtifact,
    editorContent,
    content,
    metadataTitle,
    title,
  ]);

  /* istanbul ignore next -- @preserve PDF export callback */
  const handleExportPDF = useCallback(async () => {
    try {
      setIsExporting(true);
      const { markdownSource, exportTitle } = await getExportData();
      await exportAsPDF(markdownSource, exportTitle);
    } catch (error) {
      console.error('[Canvas] Failed to export as PDF', error);
      toast.error('Failed to export as PDF. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }, [getExportData]);

  /* istanbul ignore next -- @preserve DOCX export callback */
  const handleExportDOCX = useCallback(async () => {
    try {
      setIsExporting(true);
      const { markdownSource, exportTitle } = await getExportData();
      exportAsDOCX(markdownSource, exportTitle);
    } catch (error) {
      console.error('[Canvas] Failed to export as DOCX', error);
      toast.error('Failed to export as DOCX');
    } finally {
      setIsExporting(false);
    }
  }, [getExportData]);

  /* istanbul ignore next -- @preserve Markdown export callback */
  const handleExportMarkdown = useCallback(async () => {
    try {
      setIsExporting(true);
      const { markdownSource, exportTitle } = await getExportData();
      exportAsMarkdown(markdownSource, exportTitle);
    } catch (error) {
      console.error('[Canvas] Failed to export as Markdown', error);
      toast.error('Failed to export as Markdown');
    } finally {
      setIsExporting(false);
    }
  }, [getExportData]);

  /* istanbul ignore next -- @preserve close handler callback */
  const handleClose = useCallback(async () => {
    try {
      await flushSave();
    } catch (error) {
      console.error('[Canvas] Error flushing changes before close', error);
    }
    onClose?.();
  }, [flushSave, onClose]);

  /* istanbul ignore next -- @preserve rename title callback */
  const handleRenameTitle = useCallback(async () => {
    if (
      !effectiveArtifactId ||
      !resolvedOrg ||
      !resolvedUserId ||
      !renameTitle.trim()
    )
      return;

    const trimmedTitle = renameTitle.trim();
    if (trimmedTitle === (currentArtifact?.title ?? title)) {
      setIsRenameModalOpen(false);
      return;
    }

    setIsRenaming(true);
    try {
      const currentContent = editorContent ?? currentArtifact?.content ?? '';
      const savedArtifact = await updateArtifactMutation({
        id: effectiveArtifactId,
        org: resolvedOrg,
        userId: resolvedUserId,
        requestBody: { title: trimmedTitle, content: currentContent },
      }).unwrap();

      if (savedArtifact) {
        setCurrentArtifact(savedArtifact);
        setDisplayTitle(savedArtifact.title || trimmedTitle);
        window.dispatchEvent(
          new CustomEvent('artifact-title-updated', {
            detail: {
              artifactId: savedArtifact.id,
              title: savedArtifact.title || trimmedTitle,
            },
          }),
        );
        toast.success('Canvas title updated');
        setIsRenameModalOpen(false);
      }
    } catch (error) {
      console.error('[Canvas] Failed to rename canvas', error);
      toast.error('Failed to rename canvas');
    } finally {
      setIsRenaming(false);
    }
  }, [
    effectiveArtifactId,
    currentArtifact?.content,
    currentArtifact?.title,
    editorContent,
    resolvedOrg,
    resolvedUserId,
    renameTitle,
    title,
    updateArtifactMutation,
  ]);

  // Save status - using extracted utility functions
  const saveStatusLabel = useMemo(
    () => getSaveStatusLabel(saveState, saveError),
    [saveError, saveState],
  );

  const saveStatusClass = getSaveStatusClass(saveState);

  // Show overlay during loading states OR when streaming with no content yet
  const isStreamingWithNoContent = isStreamingWithNoContentCheck(
    isStreamingArtifact,
    editorContent,
  );
  const shouldShowOverlay = getShouldShowOverlay(
    showAnimation,
    isExporting,
    isInitialLoading,
    isVersionLoading,
    showUpdateAnimation,
    isStreamingWithNoContent,
  );
  const overlayMessage = getOverlayMessage(
    isExporting,
    isInitialLoading,
    isVersionLoading,
    showUpdateAnimation,
    isContentUpdating,
    isStreamingWithNoContent,
  );

  // Animation trigger
  useEffect(() => {
    if (isAnimating && !showAnimation) {
      setShowAnimation(true);
      const timer = setTimeout(() => setShowAnimation(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isAnimating, showAnimation]);

  // Text selection handler
  /* istanbul ignore next -- @preserve text selection DOM interaction */
  const handleTextSelection = useCallback(() => {
    if (!activeVersionIsCurrent) return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      if (showHighlightPopup) {
        setShowHighlightPopup(false);
        setSelectedText(null);
        savedSelectionRef.current = null;
        setHighlightRects([]);
      }
      return;
    }

    const range = selection.getRangeAt(0);
    const selectedTextStr = selection.toString().trim();

    if (!editorContentRef.current) return;

    const commonAncestor = range.commonAncestorContainer;
    let ancestorElement: Element | null = null;

    if (commonAncestor.nodeType === Node.TEXT_NODE) {
      ancestorElement = commonAncestor.parentElement;
    } else if (commonAncestor.nodeType === Node.ELEMENT_NODE) {
      ancestorElement = commonAncestor as Element;
    }

    const isWithinEditor =
      ancestorElement && editorContentRef.current
        ? editorContentRef.current.contains(ancestorElement)
        : false;

    if (!isWithinEditor) {
      if (showHighlightPopup) {
        setShowHighlightPopup(false);
        setSelectedText(null);
        savedSelectionRef.current = null;
        setHighlightRects([]);
      }
      return;
    }

    if (selectedTextStr.length > 0) {
      const rect = range.getBoundingClientRect();
      savedSelectionRef.current = range.cloneRange();
      const rects = Array.from(range.getClientRects());

      setSelectedText({ text: selectedTextStr, rect });
      setShowHighlightPopup(true);
      setHighlightRects(rects);
    } else if (showHighlightPopup) {
      setShowHighlightPopup(false);
      setSelectedText(null);
      savedSelectionRef.current = null;
      setHighlightRects([]);
    }
  }, [activeVersionIsCurrent, showHighlightPopup]);

  // Highlight query handler
  /* istanbul ignore next -- @preserve highlight query DOM interaction */
  const handleSendHighlightQuery = useCallback(() => {
    const inputText = highlightInput.trim();
    if (!inputText || !selectedText) return;

    if (!currentArtifact || !sendMessage) {
      setHighlightInput('');
      setShowHighlightPopup(false);
      setSelectedText(null);
      savedSelectionRef.current = null;
      const selection = window.getSelection();
      if (selection) selection.removeAllRanges();
      return;
    }

    try {
      const markdownText = editorContent ?? '';
      const selectedTextStr = selectedText.text;
      const indices = calculateMarkdownIndices(selectedTextStr, markdownText);

      let snippetStart = 0;
      let snippetEnd = selectedTextStr.length;

      if (indices) {
        snippetStart = indices.start;
        snippetEnd = indices.end;
      } else {
        const directIndex = markdownText.indexOf(selectedTextStr);
        if (directIndex >= 0) {
          snippetStart = directIndex;
          snippetEnd = directIndex + selectedTextStr.length;
        }
      }

      const fileExt = metadataRecord?.fileExtension as string | undefined;

      const artifactPayload = {
        title:
          currentArtifact.title ||
          metadataTitle ||
          title ||
          'Untitled Artifact',
        file_extension: currentArtifact.file_extension || fileExt || 'txt',
        id: String(currentArtifact.id),
        is_partial: true,
        snippet_start: snippetStart,
        snippet_end: snippetEnd,
      };

      sendMessage(inputText, { visible: true, artifact: artifactPayload });

      setHighlightInput('');
      setShowHighlightPopup(false);
      setSelectedText(null);
      savedSelectionRef.current = null;
      setHighlightRects([]);

      const selection = window.getSelection();
      if (selection) selection.removeAllRanges();
    } catch (error) {
      console.error('[Canvas] Error sending highlight query:', error);
      toast.error('Failed to send message. Please try again.');
    }
  }, [
    highlightInput,
    selectedText,
    currentArtifact,
    sendMessage,
    editorContent,
    metadataRecord,
    metadataTitle,
    title,
  ]);

  // Selection listeners
  useEffect(() => {
    /* istanbul ignore next -- @preserve selection restoration */
    if (showHighlightPopup && savedSelectionRef.current) {
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(savedSelectionRef.current);
      }
    }
  }, [showHighlightPopup]);

  /* istanbul ignore next -- @preserve mouse event listeners effect */
  useEffect(() => {
    const handleMouseUp = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('.highlight-popup')) return;
      setTimeout(handleTextSelection, 10);
    };

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (showHighlightPopup && !target.closest('.highlight-popup')) {
        setShowHighlightPopup(false);
        setSelectedText(null);
        savedSelectionRef.current = null;
        setHighlightRects([]);
      }
    };

    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showHighlightPopup, handleTextSelection]);

  /* istanbul ignore next -- @preserve scroll/resize event listeners effect */
  useEffect(() => {
    if (!showHighlightPopup || !savedSelectionRef.current) return;
    const handler = () => refreshHighlightPosition();
    window.addEventListener('scroll', handler, true);
    window.addEventListener('resize', handler);
    const editorEl = editorContentRef.current;
    editorEl?.addEventListener('scroll', handler, true);
    return () => {
      window.removeEventListener('scroll', handler, true);
      window.removeEventListener('resize', handler);
      editorEl?.removeEventListener('scroll', handler, true);
    };
  }, [showHighlightPopup, refreshHighlightPosition]);

  return (
    <div
      ref={containerRef}
      className={`relative flex h-full flex-col overflow-hidden bg-white ${showAnimation ? 'animate-pulse' : ''}`}
      data-testid="canvas-container"
    >
      {/* Animation Overlay */}
      {shouldShowOverlay && (
        <div className="pointer-events-none absolute inset-0 z-10">
          {showUpdateAnimation ? (
            <>
              <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10" />
              <div className="absolute inset-0">
                <div className="animate-slide-down h-full w-full bg-gradient-to-t from-transparent via-blue-500/5 to-transparent" />
              </div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transform">
                <div className="relative">
                  <div className="h-20 w-20 animate-ping rounded-full border-4 border-blue-500/30" />
                  <div className="absolute inset-0 h-20 w-20 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
                </div>
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="animate-fade-in-bounce text-lg font-medium text-blue-600">
                  {overlayMessage}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transform">
                <div
                  className={`h-16 w-16 border-4 ${isExporting ? 'border-purple-500' : isInitialLoading ? 'border-indigo-500' : 'border-blue-500'} animate-spin rounded-full border-t-transparent`}
                />
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="animate-bounce font-medium text-blue-600">
                  {overlayMessage}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Header */}
      <div className="flex min-h-[50px] flex-shrink-0 items-center gap-1 border-b border-gray-200 bg-white px-2 py-2 sm:min-h-[60px] sm:px-3 sm:py-3 md:px-4">
        <div className="mr-2 flex min-w-0 flex-1 items-center gap-1 overflow-hidden sm:gap-2">
          <FileText className="h-4 w-4 flex-shrink-0 text-blue-600 sm:h-5 sm:w-5" />
          <button
            onClick={() => {
              setRenameTitle(
                currentArtifact?.title ?? title ?? 'Untitled Artifact',
              );
              setIsRenameModalOpen(true);
            }}
            disabled={isEditingDisabled}
            className={cn(
              'block cursor-pointer truncate text-left text-xs font-medium text-gray-900 transition-colors hover:text-blue-600 sm:text-sm md:text-base',
              isEditingDisabled &&
                'cursor-not-allowed text-gray-500 hover:text-gray-500',
            )}
            title="Click to rename"
          >
            {displayTitle || 'Untitled Artifact'}
          </button>

          {versionsData && versionsData.length > 1 && currentVersion && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-gray-500 hover:text-gray-700"
                  disabled={isVersionNavDisabled}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem
                  onClick={handlePreviousVersion}
                  disabled={!canGoPrevious || isVersionNavDisabled}
                  className={
                    !canGoPrevious || isVersionNavDisabled
                      ? 'cursor-not-allowed opacity-50'
                      : 'cursor-pointer'
                  }
                >
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Previous Version
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleNextVersion}
                  disabled={!canGoNext || isVersionNavDisabled}
                  className={
                    !canGoNext || isVersionNavDisabled
                      ? 'cursor-not-allowed opacity-50'
                      : 'cursor-pointer'
                  }
                >
                  <ChevronRight className="mr-2 h-4 w-4" />
                  Next Version
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5 text-xs text-gray-500">
                  Version {currentVersionIndex + 1} of {versionHistory.length}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div
          className={cn(
            'flex flex-shrink-0 flex-wrap items-center gap-0.5',
            (!isViewingCurrentVersion ||
              isStreamingArtifact ||
              isContentUpdating) &&
              'pointer-events-none opacity-60',
          )}
        >
          <CanvasRichTextEditorToolbar editor={editor} />
        </div>

        <div className="ml-1 flex flex-shrink-0 items-center gap-1 sm:gap-2">
          {saveStatusLabel && (
            <span className={`${saveStatusClass} hidden sm:inline`}>
              {saveStatusLabel}
            </span>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-1 border-blue-200 bg-transparent px-1 text-xs whitespace-nowrap text-blue-600 sm:px-2 md:px-3"
                disabled={isExporting || saveState === 'saving'}
              >
                {isExporting ? (
                  <>
                    <span className="h-3 w-3 animate-spin rounded-full border-[2px] border-blue-400 border-t-transparent" />
                    <span className="hidden sm:inline">Exporting…</span>
                    <span className="sm:hidden">Export</span>
                  </>
                ) : (
                  <>
                    <Download className="h-3.5 w-3.5 sm:mr-1" />
                    <span className="hidden sm:inline">Export</span>
                  </>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem
                onClick={
                  /* istanbul ignore next -- @preserve */ () =>
                    void handleExportPDF()
                }
                className="cursor-pointer"
              >
                <FileIcon className="mr-2 h-4 w-4 text-red-500" />
                <div className="flex flex-col">
                  <span>PDF Document</span>
                  <span className="text-xs text-gray-500">.pdf</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={
                  /* istanbul ignore next -- @preserve */ () =>
                    void handleExportDOCX()
                }
                className="cursor-pointer"
              >
                <FileText className="mr-2 h-4 w-4 text-blue-500" />
                <div className="flex flex-col">
                  <span>Microsoft Word</span>
                  <span className="text-xs text-gray-500">.docx</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={
                  /* istanbul ignore next -- @preserve */ () =>
                    void handleExportMarkdown()
                }
                className="cursor-pointer"
              >
                <FileCode className="mr-2 h-4 w-4 text-gray-600" />
                <div className="flex flex-col">
                  <span>Markdown Document</span>
                  <span className="text-xs text-gray-500">.md</span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => {
                void handleClose();
              }}
            >
              <X className="h-4 w-4 text-gray-600" />
            </Button>
          )}
        </div>
      </div>

      {!isViewingCurrentVersion && (
        <div className="flex flex-col gap-2 border-b border-gray-200 bg-gray-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-4 sm:py-3">
          <div className="min-w-0">
            <div className="text-xs font-semibold text-gray-900 sm:text-sm">
              You are viewing a previous version
            </div>
            <div className="hidden text-xs text-gray-600 sm:block">
              Restore this version to make edits
            </div>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <Button
              onClick={handleRestoreVersion}
              className="rounded-md bg-gradient-to-r from-[#2563EB] to-[#93C5FD] px-2 text-xs text-white hover:opacity-90 sm:px-4 sm:text-sm"
              size="sm"
            >
              Restore this version
            </Button>
            <Button
              variant="outline"
              onClick={handleBackToLatest}
              className="rounded-md px-2 text-xs sm:px-4 sm:text-sm"
              size="sm"
            >
              <span className="sm:hidden">Latest</span>
              <span className="hidden sm:inline">Back to latest version</span>
            </Button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div
        className="relative flex-1 overflow-x-hidden overflow-y-auto"
        style={{ minHeight: 0 }}
      >
        {isInitialLoading && (
          <div className="absolute inset-0 z-50 bg-white">
            <div className="w-full max-w-full px-6 py-4 sm:px-10 sm:py-6 md:px-16 md:py-8 lg:px-24">
              <div className="animate-pulse space-y-4">
                <div className="h-8 w-3/4 rounded bg-gray-200"></div>
                <div className="h-4 w-full rounded bg-gray-200"></div>
                <div className="h-4 w-5/6 rounded bg-gray-200"></div>
                <div className="h-4 w-full rounded bg-gray-200"></div>
                <div className="h-4 w-4/5 rounded bg-gray-200"></div>
                <div className="mt-6 space-y-2">
                  <div className="h-4 w-full rounded bg-gray-200"></div>
                  <div className="h-4 w-full rounded bg-gray-200"></div>
                  <div className="h-4 w-3/4 rounded bg-gray-200"></div>
                </div>
                <div className="mt-6 h-6 w-1/2 rounded bg-gray-200"></div>
                <div className="h-4 w-full rounded bg-gray-200"></div>
                <div className="h-4 w-5/6 rounded bg-gray-200"></div>
                <div className="h-4 w-full rounded bg-gray-200"></div>
              </div>
            </div>
          </div>
        )}
        <div
          ref={editorContentRef}
          className="w-full max-w-full px-6 py-4 sm:px-10 sm:py-6 md:px-16 md:py-8 lg:px-24"
        >
          <CanvasRichTextEditorContent editor={editor} />
        </div>

        {!isMobile &&
          isViewingCurrentVersion &&
          !isStreamingArtifact &&
          !isContentUpdating && (
            <CanvasControls sendFullArtifactUpdate={sendFullArtifactUpdate} />
          )}
      </div>

      {/* Highlight Popup */}
      {/* istanbul ignore next -- @preserve highlight popup JSX event handlers */}
      {showHighlightPopup && selectedText && (
        <div
          className="highlight-popup fixed z-[9999]"
          data-testid="canvas-highlight-popup"
          style={{
            left: `${selectedText.rect.left}px`,
            top: `${selectedText.rect.bottom + 8}px`,
          }}
          onMouseDown={
            /* istanbul ignore next -- @preserve */ (e) => e.stopPropagation()
          }
          onMouseUp={
            /* istanbul ignore next -- @preserve */ (e) => e.stopPropagation()
          }
        >
          <div className="flex w-[min(90vw,420px)] max-w-[420px] items-center gap-2.5 rounded-xl border border-gray-200/70 bg-white px-3.5 py-2.5 shadow-md">
            <Image
              src="/icons/my-mentors.svg"
              alt="Ask Anything"
              width={20}
              height={20}
            />
            <input
              id="partial-update-input"
              ref={highlightInputRef}
              type="text"
              value={highlightInput}
              onChange={
                /* istanbul ignore next -- @preserve DOM event */ (e) =>
                  setHighlightInput(e.target.value)
              }
              onKeyDown={
                /* istanbul ignore next -- @preserve DOM event */ (e) => {
                  const keyAction = getHighlightInputKeyAction(e.key);
                  if (keyAction.action === 'submit') {
                    handleSendHighlightQuery();
                  } else if (keyAction.action === 'dismiss') {
                    setShowHighlightPopup(false);
                    setSelectedText(null);
                    savedSelectionRef.current = null;
                    setHighlightRects([]);
                    const selection = window.getSelection();
                    if (selection) selection.removeAllRanges();
                  }
                }
              }
              placeholder="Ask Anything..."
              className="flex-1 rounded-lg border-none px-2 py-1 text-base text-gray-700 placeholder:text-gray-400 focus:ring-0 focus:outline-none"
              autoFocus
            />
          </div>
        </div>
      )}

      {/* istanbul ignore next -- @preserve dynamic highlight rects rendering */}
      {highlightRects.length > 0 && (
        /* istanbul ignore next -- @preserve */ <div className="pointer-events-none fixed inset-0 z-[9997]">
          {highlightRects.map(
            /* istanbul ignore next -- @preserve */ (rect, idx) => (
              <div
                key={idx}
                style={{
                  position: 'fixed',
                  left: rect.left,
                  top: rect.top,
                  width: rect.width,
                  height: rect.height,
                  background: 'rgba(59,130,246,0.16)',
                  border: '1px solid rgba(37,99,235,0.45)',
                  borderRadius: 4,
                }}
              />
            ),
          )}
        </div>
      )}

      {/* Rename Modal */}
      <Dialog open={isRenameModalOpen} onOpenChange={setIsRenameModalOpen}>
        <DialogContent
          className="w-[95vw] max-w-2xl gap-0 overflow-hidden p-0"
          style={{
            height: 'auto',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <DialogHeader className="flex-shrink-0 border-b border-gray-200 bg-white px-6 py-4">
            <DialogTitle className="text-xl font-semibold text-gray-900">
              Rename Canvas
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 px-6 py-6">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Canvas Title
              </label>
              <Input
                placeholder="Enter new canvas title"
                value={renameTitle}
                onChange={(e) => setRenameTitle(e.target.value)}
                className="h-12 rounded-lg border-2 border-gray-200 px-4 text-base focus:border-blue-500 focus:ring-0"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleRenameTitle();
                  } else if (e.key === 'Escape') {
                    setIsRenameModalOpen(false);
                  }
                }}
                autoFocus
              />
            </div>
          </div>

          <DialogFooter className="flex flex-shrink-0 justify-end gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4">
            <Button
              variant="outline"
              onClick={() => setIsRenameModalOpen(false)}
              disabled={isRenaming}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRenameTitle}
              disabled={
                !renameTitle.trim() ||
                isRenaming ||
                renameTitle.trim() === (currentArtifact?.title ?? title)
              }
              className="ibl-button-primary"
            >
              {isRenaming ? 'Renaming...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Custom CSS - must be global to apply to TipTap editor content */}
      <style jsx global>{`
        @keyframes slide-down {
          from {
            transform: translateY(-100%);
          }
          to {
            transform: translateY(100%);
          }
        }

        @keyframes fade-in-bounce {
          0% {
            opacity: 0;
            transform: scale(0.9);
          }
          50% {
            transform: scale(1.05);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }

        .animate-slide-down {
          animation: slide-down 1.5s ease-in-out infinite;
        }

        .animate-fade-in-bounce {
          animation: fade-in-bounce 0.6s ease-out;
        }

        /* Headings */
        [contenteditable] h1 {
          font-size: 2rem;
          font-weight: 700;
          margin: 1.5rem 0 1rem 0;
          color: #1f2937;
        }
        [contenteditable] h2 {
          font-size: 1.5rem;
          font-weight: 600;
          margin: 1.5rem 0 1rem 0;
          color: #1f2937;
        }
        [contenteditable] h3 {
          font-size: 1.25rem;
          font-weight: 600;
          margin: 1rem 0 0.5rem 0;
          color: #1f2937;
        }
        [contenteditable] h4 {
          font-size: 1.125rem;
          font-weight: 600;
          margin: 1rem 0 0.5rem 0;
          color: #1f2937;
        }
        [contenteditable] h5,
        [contenteditable] h6 {
          font-size: 1rem;
          font-weight: 600;
          margin: 0.75rem 0 0.5rem 0;
          color: #1f2937;
        }

        /* Paragraphs */
        [contenteditable] p {
          margin: 1rem 0;
          line-height: 1.6;
          color: #374151;
        }

        /* Text formatting */
        [contenteditable] strong {
          font-weight: 600;
          color: #1f2937;
        }
        [contenteditable] em {
          font-style: italic;
        }

        /* Tables - complete styling for ProseMirror/TipTap */
        .ProseMirror table,
        [contenteditable] table {
          border-collapse: collapse !important;
          margin: 1rem 0 !important;
          width: 100% !important;
          display: table !important;
          table-layout: auto !important;
          min-width: 100% !important;
        }
        /* Responsive table wrapper for horizontal scroll when needed */
        .ProseMirror .tableWrapper,
        [contenteditable] .tableWrapper {
          overflow-x: auto !important;
          margin: 1rem 0 !important;
        }
        .ProseMirror thead,
        [contenteditable] thead {
          background-color: #f3f4f6 !important;
        }
        .ProseMirror th,
        [contenteditable] th {
          border: 1px solid #d1d5db !important;
          padding: 12px !important;
          font-weight: 600 !important;
          text-align: left !important;
          background-color: #f3f4f6 !important;
        }
        .ProseMirror td,
        [contenteditable] td {
          border: 1px solid #d1d5db !important;
          padding: 8px 12px !important;
        }
        .ProseMirror tr:nth-child(even),
        [contenteditable] tr:nth-child(even) {
          background-color: #f9fafb !important;
        }

        /* Unordered lists with nested markers - override prose defaults */
        .ProseMirror ul,
        [contenteditable] ul {
          list-style-type: disc !important;
          list-style-position: outside !important;
          margin: 1rem 0 !important;
          padding-left: 1.5rem !important;
        }
        .ProseMirror ul ul,
        [contenteditable] ul ul {
          list-style-type: circle !important;
          margin: 0.25rem 0 !important;
          padding-left: 1.25rem !important;
        }
        .ProseMirror ul ul ul,
        [contenteditable] ul ul ul {
          list-style-type: square !important;
        }

        /* Ordered lists with nested markers */
        .ProseMirror ol,
        [contenteditable] ol {
          list-style-type: decimal !important;
          list-style-position: outside !important;
          margin: 1rem 0 !important;
          padding-left: 2.5rem !important; /* Increased for double-digit numbers */
        }
        .ProseMirror ol ol,
        [contenteditable] ol ol {
          list-style-type: lower-alpha !important;
          margin: 0.25rem 0 !important;
          padding-left: 1.25rem !important;
        }
        .ProseMirror ol ol ol,
        [contenteditable] ol ol ol {
          list-style-type: lower-roman !important;
        }

        /* List items */
        .ProseMirror li,
        [contenteditable] li {
          margin: 0.35rem 0 !important;
          line-height: 1.6 !important;
          display: list-item !important;
        }
        .ProseMirror li > p,
        [contenteditable] li > p {
          margin: 0 !important;
          display: inline;
        }
        .ProseMirror li::marker,
        [contenteditable] li::marker {
          color: #374151;
        }

        /* Math (KaTeX) styles */
        .ProseMirror .katex-display,
        [contenteditable] .katex-display {
          margin: 1rem 0 !important;
          overflow-x: auto !important;
          padding: 0.5rem 0 !important;
        }
        .ProseMirror .katex,
        [contenteditable] .katex {
          font-size: 1.1em !important;
        }

        /* Code blocks with syntax highlighting */
        .ProseMirror pre,
        [contenteditable] pre {
          background: #1e1e1e !important;
          color: #d4d4d4 !important;
          padding: 1rem !important;
          border-radius: 0.5rem !important;
          overflow-x: auto !important;
          margin: 1rem 0 !important;
          font-family: 'Fira Code', 'Consolas', 'Monaco', monospace !important;
          font-size: 0.9em !important;
          line-height: 1.5 !important;
        }
        .ProseMirror code,
        [contenteditable] code {
          font-family: 'Fira Code', 'Consolas', 'Monaco', monospace !important;
        }
        .ProseMirror :not(pre) > code,
        [contenteditable] :not(pre) > code {
          background: #e5e7eb !important;
          padding: 0.125rem 0.375rem !important;
          border-radius: 0.25rem !important;
          color: #1f2937 !important;
          font-size: 0.9em !important;
        }

        /* Blockquotes */
        .ProseMirror blockquote,
        [contenteditable] blockquote {
          border-left: 4px solid #3b82f6 !important;
          padding-left: 1rem !important;
          margin: 1rem 0 !important;
          color: #6b7280 !important;
          font-style: italic !important;
        }

        /* Subscript and Superscript */
        .ProseMirror sub,
        [contenteditable] sub {
          vertical-align: sub !important;
          font-size: 0.75em !important;
        }
        .ProseMirror sup,
        [contenteditable] sup {
          vertical-align: super !important;
          font-size: 0.75em !important;
        }

        /* Strikethrough */
        .ProseMirror del,
        .ProseMirror s,
        [contenteditable] del,
        [contenteditable] s {
          text-decoration: line-through !important;
          color: #9ca3af !important;
        }

        /* Links - clickable and styled */
        .ProseMirror a,
        [contenteditable] a {
          color: #2563eb !important;
          text-decoration: underline !important;
          cursor: pointer !important;
          transition: color 0.15s ease !important;
        }
        .ProseMirror a:hover,
        [contenteditable] a:hover {
          color: #1d4ed8 !important;
        }
        .ProseMirror a:visited,
        [contenteditable] a:visited {
          color: #7c3aed !important;
        }

        /* Horizontal rules */
        .ProseMirror hr,
        [contenteditable] hr {
          border: none !important;
          border-top: 1px solid #d1d5db !important;
          margin: 1.5rem 0 !important;
        }

        /* Task lists (GFM) */
        .ProseMirror input[type='checkbox'],
        [contenteditable] input[type='checkbox'] {
          margin-right: 0.5rem !important;
        }

        /* Ensure list markers are visible */
        .ProseMirror ul > li,
        .ProseMirror ol > li {
          display: list-item !important;
        }
      `}</style>
    </div>
  );
}
