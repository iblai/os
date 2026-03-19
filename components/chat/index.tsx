'use client';

import React, { useLayoutEffect } from 'react';
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';

import { addMessage, selectEnableChatActionsPopup } from '@/features/chat/chatSlice';
import { clearFiles } from '@iblai/iblai-js/web-utils';
import ErrorBoundary from '@/components/error-boundary';
import { useAppDispatch, useAppSelector } from '@/lib/hooks';
import { RootState } from '@/store';
import { ChatInputForm } from '@/components/chat-input-form';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ChevronDown, ChevronLeft, ChevronRight, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoadingMessage } from '@/components/chat/loading-message';
import {
  ANONYMOUS_USERNAME,
  Message as BaseMessage,
  chatActions,
  MessageAction,
  selectToken,
  selectTokenEnabled,
  selectShowingSharedChat,
  useMentorTools,
  useTenantContext,
  useTenantMetadata as useTenantMetadataHook,
  CHAT_AREA_SIZE,
  FileReference,
  TOOLS,
} from '@iblai/iblai-js/web-utils';
import {
  cn,
  getAuthSpaJoinUrl,
  isInIframe,
  isLoggedIn,
  redirectToAuthSpa,
  sendMessageToParentWebsite,
} from '@/lib/utils';
import { toast } from 'sonner';
import { config } from '@/lib/config';
import { AdvancedChatHeader } from '@/components/advanced-chat/advanced-chat-header';
import { advancedTabs } from '@iblai/iblai-js/web-utils';
import { LiveKitChat } from '../live-kit-voice-chat';
import { GuidedSuggestedPrompts } from '../guided-suggested-prompts';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAdvancedChat } from '@iblai/iblai-js/web-utils';
import { useUsername, useUserTenants, useVisitingTenant } from '@/hooks/use-user';
import { useAxdToken } from '@/hooks/use-tokens';
import { useParams, useSearchParams } from 'next/navigation';
import { TenantKeyMentorIdParams } from '@/lib/types';
import { ChatMessages } from './chat-messages';
import type { CanvasOpenPayload } from './chat-messages/types';
import { useNavigate } from '@/hooks/user-navigate';
import { AdvancedStaticChatBuilder } from '../advanced-chat/advanced-chat-builder';
import eventBus, { RemoteEvents } from '@/lib/eventBus';
import { useDebouncedCallback } from 'use-debounce';
import { useShowFreeTrialDialog } from '@/hooks/user-user-actions';
import { useUserAgreement } from '@/hooks/use-user-agreement';
import { CSS_CLASS_NAMES, LOCAL_STORAGE_KEYS } from '@/lib/constants';
import { LiveKitScreenSharing } from '../live-kit-screen-sharing';
import { WelcomeChatNew } from '../welcome-chat-new';
import { useEmbedMode } from '@/hooks/use-embed-mode';
import { ChatActionBlockingOverlay } from '../modals/chat-action-blocking-overlay';
import { use402ErrorCheck } from '@/hooks/subscription/use-402-error-check';
import { ToastErrorMessage } from './toast-error-message';
import { useMentorSettings } from '@/hooks/use-mentors/use-mentor-settings';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { useServiceWorker } from '@/components/service-worker-provider';
import { FileText } from 'lucide-react';
import { useFileDragDrop } from '@/hooks/use-file-drag-drop';
import { useAccessingPublicRoute } from '@/hooks/use-anonymous-mentor';

/* istanbul ignore next -- @preserve dynamic import */
const CanvasView = dynamic(
  () => import('@/components/canvas/canvas-view').then((mod) => mod.CanvasView),
  {
    ssr: false,
  },
);

/* istanbul ignore next -- @preserve dynamic import */
const DisclaimerModal = dynamic(
  () => import('@/components/modals/disclaimer-modal').then((mod) => mod.DisclaimerModal),
  {
    ssr: false,
  },
);

interface Message extends BaseMessage {
  replyTo?: Message | null;
  actions?: MessageAction[] | undefined;
}

/**
 * Check if running in Tauri desktop app
 */
function isTauriApp(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

/**
 * Check if we're being served from the offline server (localhost:3456)
 */
/* istanbul ignore next -- @preserve Tauri-specific function */
function isOfflineServerOrigin(): boolean {
  if (typeof window === 'undefined') return false;
  const origin = window.location.origin;
  return origin === 'http://127.0.0.1:3456' || origin === 'http://localhost:3456';
}

/**
 * Check if we're in Tauri offline mode
 */
/* istanbul ignore next -- @preserve Tauri-specific function */
function isTauriOfflineMode(): boolean {
  if (typeof window === 'undefined') return false;
  // Check offline server origin first (works before Tauri scripts run)
  if (isOfflineServerOrigin()) return true;
  if (!isTauriApp()) return false;
  // Check global variable (set by Tauri initialization script)
  if ((window as unknown as Record<string, unknown>).__TAURI_OFFLINE_MODE__ === true) return true;
  // Fallback to localStorage
  if (typeof localStorage?.getItem !== 'function') return false;
  return localStorage.getItem('tauri_offline_mode') === 'true';
}

/**
 * Quick offline check - uses multiple indicators for faster detection
 * This is useful when React state might not be updated yet
 */
/* istanbul ignore next -- @preserve Tauri/offline detection function */
function isLikelyOffline(): boolean {
  // Check navigator.onLine (browser API)
  if (!navigator.onLine) return true;
  // Check if local LLM is enabled AND we're in Tauri (indicates user expects offline capability)
  // Also check if offline server origin or offline mode flag
  if (isTauriApp()) {
    if (isTauriOfflineMode()) return true;
  }
  return false;
}

type Props = {
  mode?: 'advanced' | 'default';
  isPreviewMode: boolean;
  hasBorder?: boolean;
  isInCanvasView?: boolean;
};

type CanvasState = {
  title: string;
  content: string;
  type: 'document' | 'code';
  artifactId?: number;
  org?: string;
  userId?: string;
  fileExtension?: string;
  metadata?: Record<string, unknown>;
};

const createEmptyCanvasState = (): CanvasState => ({
  title: '',
  content: '',
  type: 'document',
});

const CODE_FILE_EXTENSIONS = new Set([
  'py',
  'js',
  'ts',
  'tsx',
  'jsx',
  'c',
  'cpp',
  'cs',
  'java',
  'rb',
  'go',
  'rs',
  'php',
  'swift',
  'kt',
  'scala',
  'sql',
  'json',
  'yml',
  'yaml',
  'xml',
  'html',
  'css',
  'sh',
]);

export function Chat({
  mode = 'default',
  isPreviewMode = false,
  hasBorder = true,
  isInCanvasView = false,
}: Props) {
  const username = useUsername();
  const axdToken = useAxdToken();
  const { userTenants } = useUserTenants();
  const { getMentorId } = useNavigate();
  const { metadata } = useTenantContext();
  const isAccessingPublicRoute = useAccessingPublicRoute();
  const { mentorId: mentorIdParam, tenantKey } = useParams<TenantKeyMentorIdParams>();

  // Skip tenant metadata API call in Tauri offline mode
  // isTauriOfflineMode() already checks isOfflineServerOrigin() internally
  const isTauriOffline = isTauriOfflineMode();
  const { platformName: tenantPlatformName, metadata: tenantMetadata } = useTenantMetadataHook({
    org: tenantKey,
    skip: isTauriOffline,
  });

  // Determine chat area max width based on metadata (in pixels)
  const chatAreaMaxWidth = (() => {
    const sizeValue = tenantMetadata?.chat_area_size as number | undefined;
    if (
      typeof sizeValue === 'number' &&
      sizeValue >= CHAT_AREA_SIZE.MIN &&
      sizeValue <= CHAT_AREA_SIZE.MAX
    ) {
      return sizeValue;
    }
    return CHAT_AREA_SIZE.DEFAULT;
  })();
  const mentorId = getMentorId() ?? mentorIdParam;
  const searchParams = useSearchParams();
  const isCompactMode = searchParams.get('compact') === 'true';
  const isEmbeddedMode = useEmbedMode();
  const { visitingTenant } = useVisitingTenant();
  const dispatch = useAppDispatch();
  const {
    FreeTrialDialog,
    closeModal: closeFreeTrialModal,
    isModalOpen: isFreeTrialModalOpen,
    executeWithTrialCheck,
  } = useShowFreeTrialDialog();

  const { data: mentorSettings } = useMentorSettings();
  const [cachedSessionId, saveCachedSessionId] = useLocalStorage<Record<string, string>>(
    LOCAL_STORAGE_KEYS.SESSION_ID,
    {},
    /* istanbul ignore next -- @preserve localStorage deserializer */
    { deserializer: (value) => JSON.parse(value) },
  );
  const isNewSession = useRef<boolean>(cachedSessionId?.[mentorId] ? false : true);

  const { handle402Error } = use402ErrorCheck();
  const tokenEnabled = useAppSelector(selectTokenEnabled);
  const token = useAppSelector(selectToken);
  const showingSharedChat = useAppSelector(selectShowingSharedChat);
  const attachedFiles = useAppSelector((state: RootState) => state.files.attachedFiles || []);
  const TOAST_DURATION = 1000 * 60 * 2; // 2 minutes

  // Offline mode detection (for Tauri desktop app)
  const { status: swStatus } = useServiceWorker();
  const isOfflineInTauri = isTauriApp() && !swStatus.isOnline;

  // Handler for when user is offline without local LLM enabled
  const handleOfflineWithoutLocalLLM = useCallback(() => {
    toast.error('You are offline', {
      description:
        'Chat is unavailable in offline mode. Enable "Download Local LLMs" in Settings to use chat offline.',
      duration: 10000,
      closeButton: true,
    });
  }, []);

  const {
    showDisclaimerModal,
    isAgreeing,
    userAgreement,
    hasUserAgreement,
    handleDisclaimerAgree,
    checkAgreementAndExecute,
    executePendingSubmit,
  } = useUserAgreement();
  const {
    changeTab,
    activeTab,
    currentStreamingMessage,
    enabledGuidedPrompts,
    isStreaming,
    mentorName,
    messages,
    profileImage,
    sendMessage,
    setMessage,
    stopGenerating,
    uniqueMentorId,
    sessionId,
    startNewChat,
    enableSafetyDisclaimer,
    isPending,
    isLoadingChats,
    isConnected,
    refetchChats,
  } = useAdvancedChat({
    mentorId,
    mode,
    stopGenerationWsUrl: `${config.baseWsUrl()}/ws/langflow-stop-generation/`,
    tenantKey,
    token: axdToken,
    username: username ?? ANONYMOUS_USERNAME,
    wsUrl: `${config.baseWsUrl()}/ws/langflow/`,
    /* istanbul ignore next -- @preserve Tauri offline error handler */
    errorHandler: async (message, error) => {
      // Suppress errors when offline in Tauri - these are expected
      // Use multiple checks for faster detection:
      // 1. React state (isOfflineInTauri) - updated via service worker polling
      // 2. navigator.onLine - browser API (fast but not always reliable)
      // 3. isLikelyOffline() - combines multiple indicators
      const shouldSuppressError =
        isTauriApp() && (isOfflineInTauri || !navigator.onLine || isLikelyOffline());
      if (shouldSuppressError) {
        console.log('[offline] Error suppressed in Tauri offline mode:', message, {
          isOfflineInTauri,
          navigatorOnLine: navigator.onLine,
          isLikelyOffline: isLikelyOffline(),
        });
        return;
      }
      if (error) {
        console.error(JSON.stringify({ tenant: tenantKey, error }));
      }
      toast.error(
        <ToastErrorMessage
          message={message}
          supportEmail={metadata?.support_email || config.supportEmail()}
        />,
        { closeButton: true, duration: TOAST_DURATION },
      );
    },
    redirectToAuthSpa,
    sendMessageToParentWebsite,
    isPreviewMode:
      isPreviewMode ||
      (!!visitingTenant &&
        isLoggedIn() &&
        !mentorSettings.allowAnonymous &&
        !searchParams.get('token')),
    mentorShareableToken: searchParams.get('token'),
    on402Error: handle402Error,
    cachedSessionId,
    onStartNewChat: (sessionId: string) => {
      dispatch(chatActions.updateSessionIds(sessionId));
      if (mentorId) {
        saveCachedSessionId({ ...cachedSessionId, [mentorId]: sessionId });
      }
    },
    // OAuth callbacks for per_user MCP servers
    onOAuthRequired: (data) => {
      window.open(data.authUrl, '_blank');
      toast.info(
        `Authentication required for ${data.serverName}. Please complete the login in the opened window.`,
        {
          duration: 300000,
          id: `oauth-${data.serverId}`,
          closeButton: true,
        },
      );
    },
    onOAuthResolved: (data) => {
      toast.dismiss(`oauth-${data.serverId}`);
      toast.success(`Connected to ${data.serverName}`);
    },
    // Offline mode for Tauri desktop app
    isOffline: isOfflineInTauri,
    onOfflineWithoutLocalLLM: handleOfflineWithoutLocalLLM,
    isPublicRoute: isAccessingPublicRoute,
  });

  const {
    enableWebBrowsing,
    updateSessionTools,
    setSessionTools,
    activeTools,
    screenSharing,
    deepResearch,
    studyMode,
    imageGeneration,
    codeInterpreter,
    promptsIsEnabled,
    googleSlidesIsEnabled,
    googleDocumentIsEnabled,
    artifactsEnabled,
  } = useMentorTools({
    mentorId,
    tenantKey,
    username: username ?? ANONYMOUS_USERNAME,
    isPublicRoute: isAccessingPublicRoute,
    errorHandler: async (message, error) => {
      if (error) {
        console.error(JSON.stringify({ tenant: tenantKey, error }));
      }
      toast.error(
        <ToastErrorMessage
          message={message}
          supportEmail={metadata?.support_email || config.supportEmail()}
        />,
        { closeButton: true, duration: TOAST_DURATION },
      );
    },
  });
  const [mentorAccessibilityMessage, setMentorAccessibilityMessage] = useState<string>('');

  // File drag-and-drop for the entire chat area
  const {
    isDraggingFile,
    handleDragOver: handleChatDragOver,
    handleDragLeave: handleChatDragLeave,
    handleDrop: handleChatDrop,
  } = useFileDragDrop({ org: tenantKey, userId: username ?? '' });

  useEffect(() => {
    if (isStreaming) {
      setMentorAccessibilityMessage(`${mentorName} is generating a response...`);
    }
    if (
      !isStreaming &&
      messages.length > 0 &&
      messages[messages.length - 1]?.role === 'assistant'
    ) {
      setMentorAccessibilityMessage(
        `${mentorName} says: ${messages[messages.length - 1]?.content}`,
      );
    }
  }, [isStreaming, messages.length]);

  // Handler to close canvas
  const handleCloseCanvas = useCallback(() => {
    setIsCanvasOpen(false);
    setCanvasState(createEmptyCanvasState());
    setChatWidth(40); // Reset to default
    setCurrentCanvasArtifact(null); // Clear artifact tracking
    // Reset the first open flag when closing (optional - depends on desired behavior)
    // isFirstCanvasOpenRef.current = true;
  }, []);

  useEffect(() => {
    /* istanbul ignore next -- @preserve eventBus handlers */
    const newChatEventHandler = () => {
      // Reset showingSharedChat when user starts a new chat
      if (showingSharedChat) {
        dispatch(chatActions.setShowingSharedChat(false));
      }
      startNewChat();
    };
    /* istanbul ignore next -- @preserve eventBus handlers */
    const stopGeneratingChatHandler = () => {
      stopGenerating();
    };
    eventBus.on(RemoteEvents.newChat, newChatEventHandler);
    eventBus.on(RemoteEvents.stopChatGenerating, stopGeneratingChatHandler);
  }, [showingSharedChat]);

  const isAdvancedMode = mode === 'advanced';
  const [isPhoneCallModalOpen, setIsPhoneCallModalOpen] = useState(false);
  const [isScreenSharingModalOpen, setIsScreenSharingModalOpen] = useState(false);
  const [, setInputValue] = useState('');
  const [showVoiceCallConfirmation, setShowVoiceCallConfirmation] = useState(false);
  const [showScreenShareConfirmation, setShowScreenShareConfirmation] = useState(false);
  const [replyingToMessage, setReplyingToMessage] = useState<Message | null>(null);

  // Track if we're in a popup window for chat action (voice call or screen share)
  const [chatActionType, setChatActionType] = useState<'voice-call' | 'screen-share' | null>(null);
  const [showBlockingOverlay, setShowBlockingOverlay] = useState(false);

  // Listen for MENTOR:SCREENSHARING_STOPPED messages from popup/parent to refetch chats
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'MENTOR:SCREENSHARING_STOPPED') {
        refetchChats();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [refetchChats]);

  const [highlightedMessageId, setHighlightedMessageId] = useState<number | null>(null);

  // Canvas state management
  const [isCanvasOpen, setIsCanvasOpen] = useState(false);
  const [canvasState, setCanvasState] = useState<CanvasState>(() => createEmptyCanvasState());
  const promptTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const lastAIMessageCopyButtonRef = useRef<HTMLButtonElement>(null);
  const stopStreamingButtonRef = useRef<HTMLButtonElement>(null);
  const wasIsStreamingRef = useRef(false);
  const wasStreamingActiveRef = useRef(false);

  const [isMdUp, setIsMdUp] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return window.innerWidth >= 768;
  });
  useEffect(() => {
    const handleResize = () => setIsMdUp(window.innerWidth >= 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Track current artifact from canvas-active events (for when artifact is loaded from API)
  const [currentCanvasArtifact, setCurrentCanvasArtifact] = useState<{
    artifactId: number;
    title: string;
    file_extension: string;
  } | null>(null);

  // Track currently streaming artifact ID
  const [streamingArtifactId, setStreamingArtifactId] = useState<number | undefined>(undefined);

  // Clear streaming artifact ID when streaming stops
  useEffect(() => {
    if (!isStreaming && !isPending) {
      setStreamingArtifactId(undefined);
    }
  }, [isStreaming, isPending]);

  useEffect(() => {
    /* istanbul ignore next -- @preserve eventBus handler tested via mock */
    const newChatEventHandler = () => {
      // Close canvas when starting a new chat
      if (isCanvasOpen) {
        handleCloseCanvas();
      }
      startNewChat();
    };
    /* istanbul ignore next -- @preserve eventBus handler tested via mock */
    const stopGeneratingChatHandler = () => {
      stopGenerating();
    };
    eventBus.on(RemoteEvents.newChat, newChatEventHandler);
    eventBus.on(RemoteEvents.stopChatGenerating, stopGeneratingChatHandler);

    return () => {
      eventBus.off(RemoteEvents.newChat, newChatEventHandler);
      eventBus.off(RemoteEvents.stopChatGenerating, stopGeneratingChatHandler);
    };
  }, [isCanvasOpen, startNewChat, stopGenerating, handleCloseCanvas]);

  // Resize state for canvas/chat split view
  const [chatWidth, setChatWidth] = useState<number>(40); // Percentage of width for chat (default 40%)
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef<HTMLDivElement>(null);

  // Refresh trigger for canvas updates
  const [canvasRefreshTrigger, setCanvasRefreshTrigger] = useState(0);
  const MIN_CHAT_WIDTH_PX = 360;
  const MIN_CANVAS_WIDTH_PX = 520;
  const MIN_CHAT_PERCENT = 25;
  const MAX_CHAT_PERCENT = 75;

  const clampChatWidth = useCallback(
    (desiredWidthPercent: number, containerWidth?: number) => {
      const container = resizeRef.current?.parentElement;
      const width = containerWidth ?? container?.getBoundingClientRect().width ?? 0;

      if (!width) {
        return Math.min(Math.max(desiredWidthPercent, MIN_CHAT_PERCENT), MAX_CHAT_PERCENT);
      }

      // Responsive calculation requires real viewport - covered via integration tests
      const minChatPercent /* istanbul ignore next */ = Math.min(
        MAX_CHAT_PERCENT,
        Math.max(MIN_CHAT_PERCENT, (MIN_CHAT_WIDTH_PX / width) * 100),
      );
      const minCanvasPercent /* istanbul ignore next */ = Math.max(
        MIN_CHAT_PERCENT,
        (MIN_CANVAS_WIDTH_PX / width) * 100,
      );
      const maxChatPercent /* istanbul ignore next */ = Math.min(
        MAX_CHAT_PERCENT,
        100 - minCanvasPercent,
      );

      /* istanbul ignore if */
      if (minChatPercent > maxChatPercent) {
        return 50;
      }

      /* istanbul ignore next */
      return Math.min(Math.max(desiredWidthPercent, minChatPercent), maxChatPercent);
    },
    [MIN_CANVAS_WIDTH_PX, MIN_CHAT_PERCENT, MAX_CHAT_PERCENT, MIN_CHAT_WIDTH_PX],
  );

  // Track previous sessionId to detect when it changes
  const prevSessionIdRef = useRef<string | undefined>(sessionId);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const lastChatScrollRef = useRef<number>(0);
  const lastWindowScrollRef = useRef<number>(0);
  const enableChatPopupActions = useAppSelector(selectEnableChatActionsPopup);
  const isFirstCanvasOpenRef = useRef(true);

  // Check for voice-call query parameter
  useEffect(() => {
    const chatAction = searchParams.get('chat-action');
    const sessionId = searchParams.get('session-id');
    if (chatAction) {
      if (chatAction === 'voice-call') {
        setShowVoiceCallConfirmation(true);
        setChatActionType('voice-call');
        if (sessionId) {
          saveCachedSessionId({ [mentorId]: sessionId });
        } else {
          saveCachedSessionId({});
        }
      } else if (chatAction === 'screen-share') {
        setShowScreenShareConfirmation(true);
        setChatActionType('screen-share');
        if (sessionId) {
          saveCachedSessionId({ [mentorId]: sessionId });
        } else {
          saveCachedSessionId({});
        }
      }
    }
  }, [searchParams]);

  // Scroll to bottom with debounce to avoid scrolling lags
  const SCROLLING_DEBOUNCE_TIME = 25;
  const scrollToBottom = useDebouncedCallback(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, SCROLLING_DEBOUNCE_TIME);

  const handleScroll = () => {
    if (chatContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
      // Consider the user scrolled up if they're more than 100px from the bottom
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
      setIsScrolledUp(!isAtBottom);
    }
  };

  const resolveCanvasType = (payload: CanvasOpenPayload): 'document' | 'code' => {
    if (payload.toolType === 'code') {
      return 'code';
    }
    if (payload.fileExtension && CODE_FILE_EXTENSIONS.has(payload.fileExtension.toLowerCase())) {
      return 'code';
    }
    return 'document';
  };

  // Handler to open canvas with content
  const handleOpenCanvas = (payload: CanvasOpenPayload) => {
    const isFirstOpen = isFirstCanvasOpenRef.current;

    // Save scroll position BEFORE layout changes
    if (chatContainerRef.current) {
      lastChatScrollRef.current = chatContainerRef.current.scrollTop;
    }
    lastWindowScrollRef.current = window.scrollY || window.pageYOffset || 0;

    // CRITICAL: For first canvas open, prevent layout shift by fixing body position
    if (isFirstOpen && lastWindowScrollRef.current > 0) {
      // Save current scroll position
      const scrollY = window.scrollY;

      // Temporarily fix body to prevent scroll jump
      const originalBodyStyle = document.body.style.cssText;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';

      // Reset scroll immediately
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;

      // Restore body style after a brief moment to allow layout to settle
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          document.body.style.cssText = originalBodyStyle;
          // Ensure scroll is still at top
          window.scrollTo(0, 0);
        });
      });
    } else {
      // For subsequent opens, just reset scroll normally
      window.scrollTo({ top: 0, behavior: 'auto' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }

    /* istanbul ignore next -- @preserve nullish coalescing branches */
    const resolvedTitle = payload.title?.trim() ? payload.title.trim() : 'Untitled Artifact';
    /* istanbul ignore next */
    const resolvedOrg = payload.org ?? tenantKey ?? undefined;
    /* istanbul ignore next */
    const resolvedUserId = payload.userId ?? username ?? undefined;

    const newCanvasState = {
      title: resolvedTitle,
      content: payload.content ?? '',
      type: resolveCanvasType(payload),
      artifactId: payload.artifactId,
      org: resolvedOrg,
      userId: resolvedUserId,
      fileExtension: payload.fileExtension,
      metadata: payload.metadata,
    };

    // Always update canvas state, even if one is already open
    setCanvasState(newCanvasState);
    setIsCanvasOpen(true);
    setChatWidth((current) => clampChatWidth(current));

    // Mark that canvas has been opened at least once
    if (isFirstOpen) {
      isFirstCanvasOpenRef.current = false;
    }

    // If we have an artifactId in the payload, also update currentCanvasArtifact
    // This ensures executeSubmit can use it even if canvas-active event hasn't fired yet
    if (payload.artifactId) {
      setCurrentCanvasArtifact({
        artifactId: payload.artifactId,
        title: resolvedTitle,
        file_extension: payload.fileExtension || 'txt',
      });
    }

    // Always force refresh when opening a canvas to ensure it loads correctly
    // This fixes issues with multiple canvases loading on half page or blank screen
    setCanvasRefreshTrigger((prev) => prev + 1);
  };

  // Resize handlers for canvas/chat split view
  useEffect(() => {
    if (!isResizing) return;

    /* istanbul ignore next -- @preserve mouse event handler */
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const container = resizeRef.current?.parentElement;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
      const constrainedWidth = clampChatWidth(newWidth, containerRect.width);
      setChatWidth(constrainedWidth);
    };

    /* istanbul ignore next -- @preserve mouse event handler */
    const handleMouseUp = () => {
      setIsResizing(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [clampChatWidth, isResizing]);

  // Prevent accidental text selection during drag
  useEffect(() => {
    if (isResizing) {
      const previousUserSelect = document.body.style.userSelect;
      document.body.style.userSelect = 'none';
      return () => {
        document.body.style.userSelect = previousUserSelect;
      };
    }
  }, [isResizing]);

  const handleResizeStart = (event: React.MouseEvent) => {
    event.preventDefault();
    setIsResizing(true);
  };

  // Ensure split panes stay usable whenever canvas toggles on
  useEffect(() => {
    if (!isCanvasOpen) return;
    setChatWidth((current) => clampChatWidth(current));
  }, [clampChatWidth, isCanvasOpen]);

  // Keep split widths within safe bounds when viewport or surrounding layout changes
  useEffect(() => {
    const enforceResponsiveBounds = () => {
      setChatWidth((current) => clampChatWidth(current));
    };

    enforceResponsiveBounds();
    window.addEventListener('resize', enforceResponsiveBounds);

    return () => {
      window.removeEventListener('resize', enforceResponsiveBounds);
    };
  }, [clampChatWidth]);

  // Prevent blank space when opening canvas - reset scroll BEFORE layout change
  useLayoutEffect(() => {
    if (!isCanvasOpen) return;

    // CRITICAL: Reset ALL scroll positions immediately when canvas opens
    // This must happen BEFORE React applies the layout change to prevent blank space
    const resetScroll = () => {
      // Reset window scroll
      window.scrollTo({ top: 0, behavior: 'auto' });
      window.scrollTo(0, 0); // Force immediate scroll

      // Reset document scroll
      if (document.documentElement) {
        document.documentElement.scrollTop = 0;
        document.documentElement.scrollLeft = 0;
      }
      if (document.body) {
        document.body.scrollTop = 0;
        document.body.scrollLeft = 0;
      }

      // Reset any scrollable parent containers
      let element: HTMLElement | null = document.body;
      while (element && element !== document.documentElement) {
        /* istanbul ignore next -- @preserve JSDOM doesn't simulate scroll state */
        if (element.scrollTop !== 0 || element.scrollLeft !== 0) {
          element.scrollTop = 0;
          element.scrollLeft = 0;
        }
        element = element.parentElement;
      }

      // Also check the main chat container's parent
      const chatContainer = chatContainerRef.current;
      if (chatContainer) {
        let parent: HTMLElement | null = chatContainer.parentElement;
        while (parent) {
          if (parent.scrollTop !== 0) {
            parent.scrollTop = 0;
          }
          parent = parent.parentElement;
        }
      }
    };

    // Reset immediately - this runs synchronously before paint
    resetScroll();

    // Reset again after a microtask
    queueMicrotask(resetScroll);

    // Reset after layout paints (multiple times to catch all cases)
    requestAnimationFrame(() => {
      resetScroll();
      requestAnimationFrame(() => {
        resetScroll();
        // One more time after a short delay
        setTimeout(resetScroll, 0);
      });
    });
  }, [isCanvasOpen]);

  // Restore chat container scroll position after canvas opens and layout settles
  useLayoutEffect(() => {
    if (!isCanvasOpen || !chatContainerRef.current) return;

    const targetChat = lastChatScrollRef.current;

    const restore = () => {
      const container = chatContainerRef.current;
      if (!container) return;

      // Ensure window scroll is still at top
      if (window.scrollY !== 0 || window.pageYOffset !== 0) {
        window.scrollTo({ top: 0, behavior: 'auto' });
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      }

      // Restore chat container scroll position after layout settles
      requestAnimationFrame(() => {
        const scrollHeight = container.scrollHeight;
        const clientHeight = container.clientHeight;
        const maxScroll = Math.max(0, scrollHeight - clientHeight);

        // Only restore if the saved position is valid and within bounds
        /* istanbul ignore next -- @preserve RAF callbacks not executed in JSDOM */
        if (maxScroll > 0) {
          if (targetChat >= 0 && targetChat <= maxScroll) {
            container.scrollTo({ top: targetChat, behavior: 'auto' });
          } else if (targetChat > maxScroll) {
            // If saved position exceeds bounds, scroll to bottom
            container.scrollTo({ top: maxScroll, behavior: 'auto' });
          }
        }
        // If maxScroll <= 0, content fits in container, no scroll needed
      });
    };

    // Wait for layout to settle (CanvasView render + split sizing)
    // Use multiple RAFs to ensure DOM is fully laid out
    /* istanbul ignore next -- @preserve RAF callbacks not executed in JSDOM */
    const raf1 = requestAnimationFrame(() => {
      const raf2 = requestAnimationFrame(() => {
        const raf3 = requestAnimationFrame(restore);
        // Also use a small timeout as fallback
        setTimeout(restore, 150);
        return () => cancelAnimationFrame(raf3);
      });
      return () => cancelAnimationFrame(raf2);
    });

    /* istanbul ignore next -- @preserve RAF cleanup */
    return () => {
      cancelAnimationFrame(raf1);
    };
  }, [isCanvasOpen, canvasRefreshTrigger]);

  // Scroll to bottom when messages change or loading state changes
  useEffect(() => {
    scrollToBottom();
  }, [messages, isStreaming]);

  // Focus management for streaming state transitions (WCAG 2.4.3)
  // - When isStreaming becomes true: focus the stop streaming button
  //   (StopStreamingButton renders based on isStreaming, not isPending,
  //    so we must track isStreaming specifically)
  // - When both isStreaming and isPending become false: focus the copy button
  useEffect(() => {
    // Stop button: track isStreaming directly since it controls rendering
    if (isStreaming && !wasIsStreamingRef.current) {
      setTimeout(() => {
        stopStreamingButtonRef.current?.focus();
      }, 100);
    }
    wasIsStreamingRef.current = isStreaming;

    // Copy button: track combined state so we wait for everything to settle
    const currentlyActive = isStreaming || isPending;
    if (wasStreamingActiveRef.current && !currentlyActive) {
      setTimeout(() => {
        lastAIMessageCopyButtonRef.current?.focus();
      }, 100);
    }
    wasStreamingActiveRef.current = currentlyActive;
  }, [isStreaming, isPending]);

  // Add scroll event listener
  useEffect(() => {
    const chatContainer = chatContainerRef.current;
    if (chatContainer) {
      chatContainer.addEventListener('scroll', handleScroll);
    }

    return () => {
      if (chatContainer) {
        chatContainer.removeEventListener('scroll', handleScroll);
      }
    };
  }, []);

  // Reset isScrolledUp state when messages are cleared
  useEffect(() => {
    if (messages.length === 0) {
      setIsScrolledUp(false);
    }
  }, [messages.length]);

  // Listen for canvas-active events to track current artifact
  useEffect(() => {
    /* istanbul ignore next -- @preserve CustomEvent handler */
    const handleCanvasActive = (event: CustomEvent) => {
      const { artifactId, title, file_extension } = event.detail || {};
      if (artifactId) {
        setCurrentCanvasArtifact({
          artifactId:
            typeof artifactId === 'number' ? artifactId : parseInt(String(artifactId), 10),
          title: title || 'Untitled Artifact',
          file_extension: file_extension || 'txt',
        });
        console.log('[Chat] Received canvas-active event with artifact:', artifactId);
      }
    };

    /* istanbul ignore next -- @preserve CustomEvent handler */
    const handleCanvasInactive = () => {
      setCurrentCanvasArtifact(null);
      console.log('[Chat] Received canvas-inactive event');
    };

    window.addEventListener('canvas-active' as any, handleCanvasActive as any);
    window.addEventListener('canvas-inactive' as any, handleCanvasInactive as any);

    return () => {
      window.removeEventListener('canvas-active' as any, handleCanvasActive as any);
      window.removeEventListener('canvas-inactive' as any, handleCanvasInactive as any);
    };
  }, []);

  // Close canvas and disable canvas tool when session changes (e.g., when switching chats from sidebar)
  useEffect(() => {
    // Only close canvas if sessionId actually changed (not on initial mount)
    if (sessionId && prevSessionIdRef.current && prevSessionIdRef.current !== sessionId) {
      // If canvas is open and sessionId changes, close the canvas
      // This ensures canvas doesn't persist when switching between chats
      if (isCanvasOpen) {
        console.log('[Chat] Session changed, closing canvas', {
          previousSessionId: prevSessionIdRef.current,
          newSessionId: sessionId,
        });
        handleCloseCanvas();
      }

      // Disable canvas tool if it's enabled when session changes
      // This ensures canvas status is reset when switching chats or starting new chat
      if (artifactsEnabled) {
        console.log('[Chat] Session changed, disabling canvas tool', {
          previousSessionId: prevSessionIdRef.current,
          newSessionId: sessionId,
        });
        updateSessionTools(TOOLS.CANVAS).catch((error) => {
          console.error('[Chat] Failed to disable canvas on session change:', error);
        });
      }
    }
    // Update the ref to track the current sessionId
    prevSessionIdRef.current = sessionId;
  }, [sessionId, isCanvasOpen, artifactsEnabled, handleCloseCanvas, updateSessionTools]);

  // Listen for artifact update events from websocket (legacy format)
  useEffect(() => {
    const handleArtifactUpdate = (event: CustomEvent) => {
      const {
        artifactId: updatedArtifactId,
        title,
        content,
        fileExtension,
        org,
        userId,
        metadata,
      } = event.detail;

      // If canvas is open and this is the same artifact, update it
      if (
        isCanvasOpen &&
        canvasState.artifactId &&
        Number(updatedArtifactId) === canvasState.artifactId
      ) {
        console.log(
          '[Chat] Artifact update received (legacy), refreshing canvas:',
          updatedArtifactId,
        );
        setCanvasRefreshTrigger((prev) => prev + 1);
        setCanvasState((prev) => ({
          ...prev,
          title: title || prev.title,
          content: content || prev.content,
          fileExtension: fileExtension || prev.fileExtension,
          org: org || prev.org,
          userId: userId || prev.userId,
          metadata: metadata || prev.metadata,
        }));
      }
    };

    window.addEventListener('artifact-update', handleArtifactUpdate as EventListener);
    return () => {
      window.removeEventListener('artifact-update', handleArtifactUpdate as EventListener);
    };
  }, [isCanvasOpen, canvasState.artifactId]);

  // Listen for title updates to reflect immediately in chat/canvas state
  useEffect(() => {
    const handleTitleUpdate = (event: CustomEvent<{ artifactId: number; title: string }>) => {
      const { artifactId, title } = event.detail || {};
      if (!artifactId || !title) return;

      if (canvasState.artifactId && Number(artifactId) === canvasState.artifactId) {
        setCanvasState((prev) => ({ ...prev, title }));
      }
      if (currentCanvasArtifact && Number(artifactId) === currentCanvasArtifact.artifactId) {
        setCurrentCanvasArtifact((prev) => (prev ? { ...prev, title } : prev));
      }
    };

    window.addEventListener('artifact-title-updated' as any, handleTitleUpdate as any);
    return () => {
      window.removeEventListener('artifact-title-updated' as any, handleTitleUpdate as any);
    };
  }, [canvasState.artifactId, currentCanvasArtifact]);

  // Listen for new artifact streaming events (JSON streaming format)
  // Open canvas at artifact-stream-start for real-time streaming support
  useEffect(() => {
    const handleArtifactStreamStart = (event: CustomEvent) => {
      const {
        artifactId,
        title,
        fileExtension,
        sessionId: artifactSessionId,
        isUpdate,
      } = event.detail;

      console.log('[Chat] Artifact stream start received:', {
        artifactId,
        title,
        isUpdate,
        isCanvasOpen,
        canvasStateArtifactId: canvasState.artifactId,
      });

      // For new artifacts (not updates), open canvas immediately to show real-time streaming
      if (!isUpdate && artifactId) {
        const artifactIdNum = Number(artifactId);
        setStreamingArtifactId(artifactIdNum); // Track streaming artifact

        const newArtifactPayload: CanvasOpenPayload = {
          title: title || 'Untitled Artifact',
          content: '', // Start with empty content, will be streamed
          toolType: CODE_FILE_EXTENSIONS.has(fileExtension?.toLowerCase() || '')
            ? 'code'
            : 'canvas',
          artifactId: artifactIdNum,
          org: tenantKey,
          userId: username ?? undefined,
          fileExtension: fileExtension,
          metadata: {
            sessionId: artifactSessionId || sessionId,
            isStreaming: true, // Mark as streaming for canvas to handle appropriately
          },
        };

        // Open canvas immediately to show real-time streaming
        handleOpenCanvas(newArtifactPayload);
      }
    };

    const handleArtifactStreamEnd = (event: CustomEvent) => {
      const {
        artifactId,
        title,
        content,
        fileExtension,
        sessionId: artifactSessionId,
        isUpdate,
        isPartial,
        versionNumber,
      } = event.detail;

      console.log('[Chat] Artifact stream end received:', {
        artifactId,
        isUpdate,
        isPartial,
        versionNumber,
        isCanvasOpen,
        canvasStateArtifactId: canvasState.artifactId,
      });

      // Clear streaming state when stream ends
      if (artifactId && Number(artifactId) === streamingArtifactId) {
        setStreamingArtifactId(undefined);
      }

      // If canvas is not open yet (fallback case), open it now with the final content
      if (!isUpdate && artifactId && !isCanvasOpen) {
        const newArtifactPayload: CanvasOpenPayload = {
          title: title || 'Untitled Artifact',
          content: content || '',
          toolType: CODE_FILE_EXTENSIONS.has(fileExtension?.toLowerCase() || '')
            ? 'code'
            : 'canvas',
          artifactId: Number(artifactId),
          org: tenantKey,
          userId: username ?? undefined,
          fileExtension: fileExtension,
          metadata: {
            sessionId: artifactSessionId || sessionId,
            versionNumber,
          },
        };

        handleOpenCanvas(newArtifactPayload);
      }
      // If this is an update to the currently open artifact, the canvas component handles it
    };

    window.addEventListener('artifact-stream-start' as any, handleArtifactStreamStart as any);
    window.addEventListener('artifact-stream-end' as any, handleArtifactStreamEnd as any);
    return () => {
      window.removeEventListener('artifact-stream-start' as any, handleArtifactStreamStart as any);
      window.removeEventListener('artifact-stream-end' as any, handleArtifactStreamEnd as any);
    };
  }, [
    isCanvasOpen,
    canvasState.artifactId,
    sessionId,
    tenantKey,
    username,
    handleOpenCanvas,
    streamingArtifactId,
  ]);

  // Legacy iblai-artifact parsing removed (handled by artifact events/versions)

  const executeSubmit = (content: string) => {
    // Allow submission if there's text OR files attached
    if (isPreviewMode) return;
    if (!content.trim() && attachedFiles.length === 0) return;

    executeWithTrialCheck(() => {
      // Add user message with file attachments if present
      dispatch(
        addMessage({
          role: 'user',
          content,
          replyTo: replyingToMessage,
        }),
      );

      // Transform attached files to file references for WebSocket
      const uploadedFiles = attachedFiles.filter(
        (f) => f.uploadStatus === 'success' && f.fileKey && f.fileId,
      );

      const fileReferences: FileReference[] = uploadedFiles.map((f) => ({
        file_id: f.fileId!,
        file_key: f.fileKey!,
        file_name: f.fileName,
        content_type: f.fileType,
        file_size: f.fileSize,
        upload_url: f.fileUrl || f.uploadUrl, // Use fileUrl from WebSocket, fallback to uploadUrl
      }));

      // Include full artifact reference if canvas is open
      // Use currentCanvasArtifact (from canvas-active event) as primary source,
      // fallback to canvasState.artifactId if available
      const effectiveArtifactId = currentCanvasArtifact?.artifactId ?? canvasState.artifactId;
      const effectiveTitle = currentCanvasArtifact?.title ?? canvasState.title;
      const effectiveFileExtension =
        currentCanvasArtifact?.file_extension ?? canvasState.fileExtension;

      let artifactPayload:
        | { title: string; file_extension: string; id: string; is_partial: boolean }
        | undefined;
      if (isCanvasOpen && effectiveArtifactId) {
        artifactPayload = {
          title: effectiveTitle || 'Untitled Artifact',
          file_extension: effectiveFileExtension || 'txt',
          id: String(effectiveArtifactId),
          is_partial: false, // Full artifact reference when canvas is open
        };
        console.log('[Chat] Sending message with artifact reference:', artifactPayload, {
          source: currentCanvasArtifact ? 'canvas-active-event' : 'canvasState',
          isCanvasOpen,
          effectiveArtifactId,
        });
      } else {
        console.log('[Chat] Canvas state:', {
          isCanvasOpen,
          canvasStateArtifactId: canvasState.artifactId,
          currentCanvasArtifactId: currentCanvasArtifact?.artifactId,
          effectiveArtifactId,
        });
      }

      // Send message with file references and/or artifact reference
      sendMessage(activeTab, content, {
        visible: true,
        fileReferences: fileReferences.length > 0 ? fileReferences : undefined,
        artifact: artifactPayload,
      });

      // Clear files after sending
      if (fileReferences.length > 0) {
        dispatch(clearFiles(undefined));
      }

      // Reset replying to message
      setReplyingToMessage(null);

      // Reset input value
      setInputValue('');
    }, false);
  };

  const requireUserToJoinTenantOnChat = (content: string) => {
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
      visible: true,
    };
    const email = metadata?.support_email || config.supportEmail();
    const aiMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'assistant',
      content: `Whoops! Looks like access to me is restricted to users of <b>${tenantPlatformName ?? tenantKey.toUpperCase()}</b>. If you’d like to join then please reach out to our <a target="_self" href="mailto:${email}">support team</a>`,
      timestamp: new Date().toISOString(),
      visible: true,
    };

    dispatch(
      chatActions.addUserMessage({
        tab: activeTab,
        message: userMessage,
      }),
    );
    dispatch(
      chatActions.addUserMessage({
        tab: activeTab,
        message: aiMessage,
      }),
    );
  };

  const handleSubmit = (content: string) => {
    if (!isLoggedIn()) {
      if (!mentorSettings.allowAnonymous && (!token || !tokenEnabled)) {
        const userMessage: Message = {
          id: `user-${Date.now()}`,
          role: 'user',
          content: content,
          timestamp: new Date().toISOString(),
          visible: true,
        };

        const aiMessage: Message = {
          id: `user-${Date.now()}`,
          role: 'assistant',
          content: `It looks like you need to be logged in to chat with me. Please <a target="_self" href="${getAuthSpaJoinUrl(tenantKey)}">log in or sign up for free</a> to get started!`,
          timestamp: new Date().toISOString(),
          visible: true,
        };

        // Notify parent to add user message
        // onAddUserMessage?.(tab, userMessage);

        dispatch(
          chatActions.addUserMessage({
            tab: activeTab,
            message: userMessage,
          }),
        );
        dispatch(
          chatActions.addUserMessage({
            tab: activeTab,
            message: aiMessage,
          }),
        );
        return;
      } else {
        // requireUserToJoinTenantOnChat(content);
      }
    } else {
      const userIsInTenant = userTenants.find((t) => t.key === tenantKey);
      if (!userIsInTenant && !mentorSettings.allowAnonymous) {
        requireUserToJoinTenantOnChat(content);
        return;
      }
    }
    checkAgreementAndExecute(content, executeSubmit);
  };

  const handleDisclaimerAgreeWithPendingSubmit = async () => {
    await handleDisclaimerAgree();
    executePendingSubmit(executeSubmit);
  };

  const handleHighlightMessage = (messageIndex: number) => {
    setHighlightedMessageId(messageIndex);
    // Remove highlight after 2 seconds
    setTimeout(() => {
      setHighlightedMessageId(null);
    }, 2000);
  };

  // Memoize guided prompts to prevent reinitialization
  const guidedPrompts = useMemo(
    () => (
      <GuidedSuggestedPrompts
        enabledGuidedPrompts={enabledGuidedPrompts}
        tenantKey={tenantKey}
        sessionId={sessionId}
        username={username ?? ''}
        isStreaming={isStreaming}
        isPending={isPending}
        onPromptSelect={handleSubmit}
      />
    ),
    [enabledGuidedPrompts, tenantKey, sessionId, username, handleSubmit],
  );

  return (
    <div
      className={cn(
        'relative flex h-full flex-col bg-white rounded-t-lg w-full px-2',
        hasBorder && 'border border-gray-200',
        CSS_CLASS_NAMES.APP_LAYOUT.MAIN_CONTENT_AREA,
        // In compact mode, prevent external scrolling - only internal chat should scroll
        isCompactMode && 'overflow-hidden',
      )}
      onDragOver={handleChatDragOver}
      onDragLeave={handleChatDragLeave}
      onDrop={handleChatDrop}
    >
      {/* Full-chat file drop overlay */}
      {isDraggingFile && (
        <div className="animate-in fade-in absolute inset-0 z-50 flex items-center justify-center rounded-lg border-2 border-dashed border-blue-400 bg-blue-50/70 backdrop-blur-sm transition-all duration-300">
          <div className="flex flex-col items-center gap-2 text-blue-600">
            <FileText className="h-10 w-10 animate-bounce" />
            <p className="text-lg font-medium">Drop your files here</p>
          </div>
        </div>
      )}
      <div
        className={cn({
          'flex-1 h-full': messages.length === 0 && !isCanvasOpen,
          // In compact mode, don't add overflow-y-auto here - only the messages container should scroll
          'overflow-y-auto scrollbar-none': !isAdvancedMode && !isCanvasOpen && !isCompactMode,
          'min-h-0': isCompactMode, // Allow flex shrinking in compact mode
        })}
        style={isCanvasOpen ? { display: 'none' } : undefined}
      >
        {isAdvancedMode && (
          <div
            className="w-full mx-auto bg-white rounded-lg overflow-hidden flex flex-col h-full"
            style={{ maxWidth: `${chatAreaMaxWidth}px` }}
          >
            {/* Advanced mode chat header */}
            <AdvancedChatHeader
              mentorName={mentorName}
              profileImage={profileImage}
              tabs={advancedTabs}
              activeTab={activeTab}
              setActiveTab={changeTab}
              isTyping={isStreaming}
            />

            {/* Advanced mode tabs */}
            {messages.length === 0 && (
              <AdvancedStaticChatBuilder
                mentorName={mentorName}
                profileImage={profileImage}
                sendMessage={sendMessage}
                activeTab={activeTab}
                tenantKey={tenantKey}
                username={username ?? ''}
                sessionId={cachedSessionId?.[mentorId] ?? sessionId}
                mentorUniqueId={uniqueMentorId}
                // messages={messages}
                // isPreviewMode={isPreviewMode}
              />
            )}
          </div>
        )}

        {/* Welcome page for default mode */}
        {/*
         * (!isNewSession.current && messages.length === 1) here is to ensure that the welcome message is still shown if the user is not in a new session and there is only one message in the chat of type ai.
         * We'll pass this message as a prop to the WelcomeChatNew component as aiWelcomeMessage prop to show it as the welcome message if it exists.
         */}
        {(messages.length === 0 ||
          (!isNewSession.current && messages.length === 1 && messages[0]?.role === 'assistant')) &&
          !isAdvancedMode && (
            <WelcomeChatNew
              mentorName={mentorName}
              sessionId={cachedSessionId?.[mentorId] ?? sessionId}
              isNewSession={isNewSession.current || (messages.length === 0 && !isLoadingChats)}
              aiWelcomeMessage={
                messages.length === 1 && messages[0]?.role === 'assistant'
                  ? messages[0]?.content
                  : ''
              }
              enabledGuidedPrompts={enabledGuidedPrompts}
              onSubmit={handleSubmit}
              onScreenSharingClick={() => {
                if (enableChatPopupActions && isInIframe()) {
                  sendMessageToParentWebsite({
                    type: 'MENTOR:CHAT_ACTION_SCREENSHARE',
                    sessionId: cachedSessionId?.[mentorId] ?? sessionId,
                  });
                  return;
                }
                if (isScreenSharingModalOpen) {
                  setIsScreenSharingModalOpen(false);
                } else {
                  setIsScreenSharingModalOpen(true);
                }
              }}
              isScreenSharingModalOpen={isScreenSharingModalOpen}
              onPhoneCallClick={() => {
                if (enableChatPopupActions && isInIframe()) {
                  sendMessageToParentWebsite({
                    type: 'MENTOR:CHAT_ACTION_VOICECALL',
                    sessionId: cachedSessionId?.[mentorId] ?? sessionId,
                  });
                  return;
                }
                setIsPhoneCallModalOpen(true);
              }}
              stopGenerating={stopGenerating}
              tenantKey={tenantKey}
              username={username ?? ''}
              enableWebBrowsing={enableWebBrowsing}
              setMessage={setMessage}
              isStreaming={isStreaming}
              enableSafetyDisclaimer={enableSafetyDisclaimer}
              isPreviewMode={isPreviewMode}
              updateSessionTools={updateSessionTools}
              setSessionTools={setSessionTools}
              activeTools={activeTools}
              screenSharing={screenSharing}
              deepResearch={deepResearch}
              studyMode={studyMode}
              imageGeneration={imageGeneration}
              codeInterpreter={codeInterpreter}
              mentorUniqueId={mentorId}
              profileImage={profileImage}
              promptsIsEnabled={promptsIsEnabled}
              googleSlidesIsEnabled={googleSlidesIsEnabled}
              googleDocumentIsEnabled={googleDocumentIsEnabled}
              artifactsEnabled={artifactsEnabled}
              chatAreaMaxWidth={chatAreaMaxWidth}
              isConnecting={!isConnected}
              compactMode={isCompactMode}
            />
          )}
      </div>

      {/* Messages and Canvas - handle layout based on canvas state */}
      {isCanvasOpen && !isInCanvasView ? (
        /* Split layout when canvas is open */
        <div
          className="flex-1 flex overflow-hidden relative"
          ref={resizeRef}
          style={{ minHeight: 0, maxHeight: '100%', height: '100%' }}
        >
          {/* Chat section on left - hidden on mobile */}
          <div
            className="border-r border-gray-200 flex-col overflow-hidden hidden md:flex flex-shrink-0"
            style={{ width: `${chatWidth}%`, minHeight: 0, maxHeight: '100%' }}
          >
            {/* Chat messages */}
            <div
              ref={chatContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto [scrollbar-gutter:stable]"
            >
              <div className="py-4 px-3">
                <ErrorBoundary>
                  {messages.length > 0 ? (
                    <ChatMessages
                      ref={lastAIMessageCopyButtonRef}
                      messages={messages}
                      highlightedMessageId={highlightedMessageId}
                      profileImage={profileImage}
                      mentorName={mentorName}
                      sessionId={sessionId}
                      mentorId={mentorId}
                      tenantKey={tenantKey}
                      handleHighlightMessage={handleHighlightMessage}
                      handleSubmit={handleSubmit}
                      onReply={(message) => {
                        setReplyingToMessage(message);
                        /* istanbul ignore next -- @preserve ref not attached in JSDOM tests */
                        if (promptTextareaRef.current) {
                          promptTextareaRef.current.focus();
                        }
                      }}
                      onOpenCanvas={handleOpenCanvas}
                      streamingArtifactId={streamingArtifactId}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                      <div className="text-center">
                        <div className="w-12 h-12 mx-auto mb-3 bg-gray-200 rounded-full flex items-center justify-center">
                          <span className="text-gray-600 font-medium">
                            {mentorName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <p>Continue your conversation with {mentorName}</p>
                      </div>
                    </div>
                  )}

                  <div aria-live="polite" role="status" className="sr-only">
                    {mentorAccessibilityMessage}
                  </div>

                  {/* Loading indicator - hide if last message has canvas preview */}
                  {(isPending || isStreaming) &&
                    !currentStreamingMessage?.content &&
                    !(
                      messages.length > 0 &&
                      messages[messages.length - 1]?.role === 'assistant' &&
                      messages[messages.length - 1]?.artifactVersions &&
                      (messages[messages.length - 1]?.artifactVersions?.length ?? 0) > 0
                    ) && <LoadingMessage mentorName={mentorName} profileImage={profileImage} />}

                  {/* Guided prompts in canvas view */}
                  {!showingSharedChat && guidedPrompts}
                </ErrorBoundary>
              </div>
            </div>

            {/* Chat input form */}
            <div className="border-t border-gray-200 bg-white p-3 flex-shrink-0 overflow-y-auto [scrollbar-gutter:stable]">
              <ChatInputForm
                sessionId={sessionId}
                onSubmit={handleSubmit}
                stopGenerating={stopGenerating}
                onScreenSharingClick={/* istanbul ignore next */ () => {}} // Disabled in canvas view
                isScreenSharingModalOpen={false}
                onPhoneCallClick={/* istanbul ignore next */ () => {}} // Disabled in canvas view
                tenantKey={tenantKey}
                username={username ?? ''}
                setMessage={setMessage}
                enableSafetyDisclaimer={enableSafetyDisclaimer}
                isPreviewMode={isPreviewMode}
                enableWebBrowsing={enableWebBrowsing}
                isStreaming={isStreaming}
                updateSessionTools={updateSessionTools}
                setSessionTools={setSessionTools}
                activeTools={activeTools}
                screenSharing={screenSharing}
                deepResearch={deepResearch}
                studyMode={studyMode}
                imageGeneration={imageGeneration}
                codeInterpreter={codeInterpreter}
                promptsIsEnabled={promptsIsEnabled}
                googleSlidesIsEnabled={googleSlidesIsEnabled}
                googleDocumentIsEnabled={googleDocumentIsEnabled}
                artifactsEnabled={artifactsEnabled}
                compactMode={isCompactMode}
                chatAreaMaxWidth={chatAreaMaxWidth}
                stopStreamingButtonRef={stopStreamingButtonRef}
              />
            </div>
          </div>

          {/* Resize handle */}
          <div
            className="hidden md:flex w-1 bg-gray-300 hover:bg-blue-500 cursor-col-resize transition-colors duration-200 relative group flex-shrink-0 z-10"
            onMouseDown={handleResizeStart}
          >
            <div className="absolute inset-y-0 left-1/2 transform -translate-x-1/2 w-8 flex items-center justify-center">
              <div className="flex flex-col items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                <ChevronLeft className="h-3 w-3 text-blue-600" />
                <GripVertical className="h-4 w-4 text-blue-600" />
                <ChevronRight className="h-3 w-3 text-blue-600" />
              </div>
            </div>
          </div>

          {/* Canvas section on right - full width on mobile */}
          <div
            className="flex-1 bg-white overflow-hidden flex flex-col"
            style={{
              width: isMdUp ? `${100 - chatWidth}%` : '100%',
              minHeight: 0,
              maxHeight: '100%',
              height: '100%',
            }}
          >
            <CanvasView
              key={`${canvasState.artifactId ?? 'canvas'}-${canvasRefreshTrigger}`}
              canvasTitle={canvasState.title}
              canvasContent={canvasState.content}
              canvasType={canvasState.type}
              artifactId={canvasState.artifactId}
              org={canvasState.org}
              userId={canvasState.userId}
              fileExtension={canvasState.fileExtension}
              metadata={canvasState.metadata}
              sessionId={sessionId}
              tenantKey={tenantKey}
              refreshTrigger={canvasRefreshTrigger}
              sendMessage={(text, options) => {
                sendMessage(activeTab, text, options);
              }}
              onClose={handleCloseCanvas}
            />

            {/* Mobile prompt box - only show on mobile */}
            <div className="md:hidden border-t border-gray-200 bg-white p-3 flex-shrink-0">
              <ChatInputForm
                sessionId={sessionId}
                onSubmit={handleSubmit}
                stopGenerating={stopGenerating}
                onScreenSharingClick={/* istanbul ignore next */ () => {}} // Disabled in canvas mobile view
                isScreenSharingModalOpen={false}
                onPhoneCallClick={/* istanbul ignore next */ () => {}} // Disabled in canvas mobile view
                tenantKey={tenantKey}
                username={username ?? ''}
                setMessage={setMessage}
                enableSafetyDisclaimer={enableSafetyDisclaimer}
                isPreviewMode={isPreviewMode}
                enableWebBrowsing={enableWebBrowsing}
                isStreaming={isStreaming}
                updateSessionTools={updateSessionTools}
                setSessionTools={setSessionTools}
                activeTools={activeTools}
                screenSharing={screenSharing}
                deepResearch={deepResearch}
                studyMode={studyMode}
                imageGeneration={imageGeneration}
                codeInterpreter={codeInterpreter}
                promptsIsEnabled={promptsIsEnabled}
                googleSlidesIsEnabled={googleSlidesIsEnabled}
                googleDocumentIsEnabled={googleDocumentIsEnabled}
                artifactsEnabled={artifactsEnabled}
                compactMode={isCompactMode}
                isConnecting={!isConnected}
                stopStreamingButtonRef={stopStreamingButtonRef}
              />
            </div>
          </div>
        </div>
      ) : (
        /* Normal chat layout when canvas is closed */
        messages.length > 0 &&
        (messages[0].role === 'assistant' ? messages.slice(1) : messages).length > 0 && (
          <div
            ref={chatContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto min-h-0"
          >
            <div className="py-6 w-full mx-auto" style={{ maxWidth: `${chatAreaMaxWidth}px` }}>
              <ErrorBoundary>
                {/* Messages with file attachments */}
                <ChatMessages
                  ref={lastAIMessageCopyButtonRef}
                  messages={messages[0].role === 'assistant' ? messages.slice(1) : messages}
                  highlightedMessageId={highlightedMessageId}
                  profileImage={profileImage}
                  mentorName={mentorName}
                  sessionId={cachedSessionId?.[mentorId] ?? sessionId}
                  mentorId={mentorId}
                  tenantKey={tenantKey}
                  handleHighlightMessage={handleHighlightMessage}
                  handleSubmit={handleSubmit}
                  onReply={(message) => {
                    setReplyingToMessage(message);
                    /* istanbul ignore next -- @preserve ref not attached in JSDOM tests */
                    if (promptTextareaRef.current) {
                      promptTextareaRef.current.focus();
                    }
                  }}
                  onOpenCanvas={handleOpenCanvas}
                  streamingArtifactId={streamingArtifactId}
                />
                <div aria-live="polite" role="status" className="sr-only">
                  {mentorAccessibilityMessage}
                </div>

                {/* Loading indicator - hide if last message has canvas preview */}
                {(isPending || isStreaming) &&
                  !currentStreamingMessage?.content &&
                  !(
                    messages.length > 0 &&
                    messages[messages.length - 1]?.role === 'assistant' &&
                    messages[messages.length - 1]?.artifactVersions &&
                    (messages[messages.length - 1]?.artifactVersions?.length ?? 0) > 0
                  ) && <LoadingMessage mentorName={mentorName} profileImage={profileImage} />}

                {/* Guided prompts in normal view */}
                {!showingSharedChat && guidedPrompts}
              </ErrorBoundary>
            </div>
          </div>
        )
      )}

      {/* Scroll to bottom button - hide when canvas is open */}
      {isScrolledUp && !isPreviewMode && messages.length > 0 && !isCanvasOpen && (
        <div className="sticky bottom-4 w-full flex justify-center z-10 pointer-events-none bg-transparent h-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={(event) => {
                  event.stopPropagation();
                  scrollToBottom();
                }}
                className="rounded-md h-10 w-10 bg-white shadow-md border border-gray-200 hover:bg-gray-100 pointer-events-auto absolute bottom-4"
              >
                <ChevronDown className="h-5 w-5 text-gray-600" />
                <span className="sr-only">Scroll to bottom</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent className="ibl-tooltip-content">Scroll to Bottom</TooltipContent>
          </Tooltip>
        </div>
      )}

      {/* Show chat input only when canvas is not open */}
      {!isCanvasOpen &&
        !showingSharedChat &&
        (isAdvancedMode ||
          isEmbeddedMode ||
          (messages.length > 0 &&
            (messages[0].role === 'assistant' ? messages.slice(1) : messages).length > 0)) && (
          <div className="flex-shrink-0 pb-3.5 overflow-y-auto [scrollbar-gutter:stable]">
            <ChatInputForm
              sessionId={cachedSessionId?.[mentorId] ?? sessionId}
              onSubmit={handleSubmit}
              stopGenerating={stopGenerating}
              onScreenSharingClick={() => {
                if (enableChatPopupActions && isInIframe()) {
                  sendMessageToParentWebsite({
                    type: 'MENTOR:CHAT_ACTION_SCREENSHARE',
                    sessionId: cachedSessionId?.[mentorId] ?? sessionId,
                  });
                  return;
                }
                if (isScreenSharingModalOpen) {
                  setIsScreenSharingModalOpen(false);
                } else {
                  setIsScreenSharingModalOpen(true);
                }
              }}
              isScreenSharingModalOpen={isScreenSharingModalOpen}
              onPhoneCallClick={() => {
                if (enableChatPopupActions && isInIframe()) {
                  sendMessageToParentWebsite({
                    type: 'MENTOR:CHAT_ACTION_VOICECALL',
                    sessionId: cachedSessionId?.[mentorId] ?? sessionId,
                  });
                  return;
                }
                setIsPhoneCallModalOpen(true);
              }}
              tenantKey={tenantKey}
              username={username ?? ''}
              setMessage={setMessage}
              enableSafetyDisclaimer={enableSafetyDisclaimer}
              isPreviewMode={isPreviewMode}
              enableWebBrowsing={enableWebBrowsing}
              isStreaming={isStreaming}
              updateSessionTools={updateSessionTools}
              setSessionTools={setSessionTools}
              activeTools={activeTools}
              screenSharing={screenSharing}
              deepResearch={deepResearch}
              studyMode={studyMode}
              imageGeneration={imageGeneration}
              codeInterpreter={codeInterpreter}
              promptsIsEnabled={promptsIsEnabled}
              googleSlidesIsEnabled={googleSlidesIsEnabled}
              googleDocumentIsEnabled={googleDocumentIsEnabled}
              artifactsEnabled={artifactsEnabled}
              compactMode={isCompactMode}
              chatAreaMaxWidth={chatAreaMaxWidth}
              stopStreamingButtonRef={stopStreamingButtonRef}
            />
          </div>
        )}

      {isPhoneCallModalOpen && (
        <LiveKitChat
          tenantKey={tenantKey}
          mentorUniqueId={uniqueMentorId}
          sessionId={cachedSessionId?.[mentorId] ?? sessionId}
          username={username ?? ''}
          isOpen={isPhoneCallModalOpen}
          onClose={() => {
            if (window.opener) {
              window.close();
            } else {
              setIsPhoneCallModalOpen(false);
            }
          }}
        />
      )}

      {isScreenSharingModalOpen && (
        <LiveKitScreenSharing
          tenantKey={tenantKey}
          mentorUniqueId={uniqueMentorId}
          sessionId={cachedSessionId?.[mentorId] ?? sessionId}
          username={username ?? ''}
          isOpen={isScreenSharingModalOpen}
          mentorName={mentorName}
          onClose={() => {
            if (window.opener) {
              window.close();
            } else {
              setIsScreenSharingModalOpen(false);
              refetchChats();
            }
          }}
        />
      )}

      {isFreeTrialModalOpen && FreeTrialDialog && (
        <FreeTrialDialog isOpen={isFreeTrialModalOpen} onClose={closeFreeTrialModal} />
      )}

      {showDisclaimerModal && hasUserAgreement && (
        <DisclaimerModal
          isOpen={showDisclaimerModal}
          onAgree={handleDisclaimerAgreeWithPendingSubmit}
          isAgreeing={isAgreeing}
          content={userAgreement?.content}
        />
      )}

      <Dialog
        open={showVoiceCallConfirmation}
        onOpenChange={(open) => {
          if (!open) {
            // When dialog closes for any reason, perform the same action as Cancel
            if (window.opener) {
              window.close();
            } else {
              setShowVoiceCallConfirmation(false);
            }
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Voice Call</DialogTitle>
            <DialogDescription>
              Would you like to start a voice call with your mentor?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (window.opener) {
                  window.close();
                } else {
                  setShowVoiceCallConfirmation(false);
                }
              }}
            >
              Cancel
            </Button>
            <Button
              className="ibl-button-primary"
              onClick={() => {
                setIsPhoneCallModalOpen(true);
                setShowVoiceCallConfirmation(false);
                // Show blocking overlay if opened from another window
                if (window.opener && chatActionType === 'voice-call') {
                  setShowBlockingOverlay(true);
                }
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showScreenShareConfirmation}
        onOpenChange={(open) => {
          if (!open) {
            // When dialog closes for any reason, perform the same action as Cancel
            if (window.opener) {
              window.close();
            } else {
              setShowScreenShareConfirmation(false);
            }
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Screen Sharing</DialogTitle>
            <DialogDescription>
              Would you like to start a screen sharing with your mentor?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowScreenShareConfirmation(false);
                if (window.opener) {
                  window.close();
                }
              }}
            >
              Cancel
            </Button>
            <Button
              className="ibl-button-primary text-white"
              onClick={() => {
                setIsScreenSharingModalOpen(true);
                setShowScreenShareConfirmation(false);
                // Show blocking overlay if opened from another window
                if (window.opener && chatActionType === 'screen-share') {
                  setShowBlockingOverlay(true);
                }
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Blocking overlay for chat action mode (voice call or screen share from popup) */}
      {chatActionType && (isScreenSharingModalOpen || isPhoneCallModalOpen) && (
        <ChatActionBlockingOverlay
          isOpen={showBlockingOverlay}
          actionType={chatActionType}
          onStopScreenShare={() => {
            // Notify the opener that screen sharing was stopped
            if (window.opener && !window.opener.closed) {
              try {
                window.opener.postMessage({ type: 'MENTOR:SCREENSHARING_STOPPED' }, '*');
              } catch (error) {
                console.error('Failed to post screen sharing stopped to opener:', error);
              }
            }
            // Close the screen sharing modal
            setIsScreenSharingModalOpen(false);
            setShowBlockingOverlay(false);
            // Close the popup window if opened from another window
            if (window.opener) {
              window.close();
            }
          }}
        />
      )}
    </div>
  );
}
