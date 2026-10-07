'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMessages } from 'next-intl';
import {
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
} from 'next/navigation';
import * as Sentry from '@sentry/nextjs';
import {
  Chat,
  setChatMarkdownTelemetry,
  type ChatConfig,
  type ChatLabels,
} from '@iblai/iblai-js/web-containers/next';
import { selectSessionId } from '@iblai/iblai-js/web-utils';

import { CodingModeButton } from '@/components/chat-input-form/coding-mode-button';
import { useServiceWorker } from '@/components/service-worker-provider';
import { useAccessingPublicRoute } from '@/hooks/use-anonymous-mentor';
import { useBrowseRun } from '@/hooks/use-browse-run';
import { useEmbedMode } from '@/hooks/use-embed-mode';
import { useInExtensionPanel } from '@/hooks/use-in-extension-panel';
import { useMentorSettings } from '@/hooks/use-mentors/use-mentor-settings';
import { wasRecent402 } from '@/hooks/use-opencode-402';
import { useOpencodeSkillSync } from '@/hooks/use-opencode-skill-sync';
import { use402ErrorCheck } from '@/hooks/subscription/use-402-error-check';
import { useAxdToken } from '@/hooks/use-tokens';
import {
  useUsername,
  useUserIsStudent,
  useUserTenants,
  useVisitingTenant,
} from '@/hooks/use-user';
import { useNavigate } from '@/hooks/user-navigate';
import { useShowFreeTrialDialog } from '@/hooks/user-user-actions';
import { config as appConfig } from '@/lib/config';
import eventBus from '@/lib/eventBus';
import { useAppSelector } from '@/lib/hooks';
import { TenantKeyMentorIdParams } from '@/lib/types';
import {
  htmlToMarkdown,
  isInIframe,
  markdownToHtml,
  redirectToAuthSpa,
  redirectToAuthSpaJoinTenant,
} from '@/lib/utils';
import { isTauriApp } from '@/types/tauri';

// The SDK chat renders messages with its own port of the OS markdown renderer;
// its KaTeX / unconverted-LaTeX telemetry keeps reporting to the OS Sentry.
setChatMarkdownTelemetry(Sentry);

/**
 * The next-intl namespaces the chat surface renders. Their messages are handed
 * to the SDK `Chat` as `labels`, so every locale reads exactly as before.
 */
export const CHAT_LABEL_NAMESPACES = [
  'chatAiMessageBubble',
  'chatAiMessageCopy',
  'chatAiMessageDownload',
  'chatAiMessageRating',
  'chatAiMessageReportInappropriateContent',
  'chatAiMessageShare',
  'chatCodePermissionCard',
  'chatComposer',
  'chatIndex',
  'chatInputFormCameraCaptureDialog',
  'chatInputFormFileAttachmentsList',
  'chatInputFormInsideButtons',
  'chatInputFormMemoryMenu',
  'chatInputFormScreenSharingButton',
  'chatInputFormUploadMenu',
  'chatInputFormVoiceCallButton',
  'chatInputFormVoiceChatButton',
  'chatStopStreamingButton',
  'chatWorkingIndicator',
  'componentsGuidedSuggestedPrompts',
  'welcomeChatExploreMentors',
  'uiDialog',
] as const;

/**
 * The desktop Code pill only exists inside Tauri. Detected after mount (Tauri
 * injects its globals some time after load), polling briefly like the OS
 * composer did.
 */
function useInTauri(): boolean {
  const [inTauri, setInTauri] = useState(false);
  useEffect(() => {
    if (isTauriApp()) {
      setInTauri(true);
      return;
    }
    let tries = 0;
    const timer = setInterval(() => {
      if (isTauriApp()) {
        setInTauri(true);
        clearInterval(timer);
      } else if (++tries > 10) {
        clearInterval(timer);
      }
    }, 500);
    return () => clearInterval(timer);
  }, []);
  return inTauri;
}

function toOrigin(value: string | null | undefined): string | null {
  try {
    const origin = value ? new URL(value).origin : '';
    return origin && origin !== 'null' ? origin : null;
  } catch {
    return null;
  }
}

/**
 * Who may talk to the chat over `postMessage`, and where its parent-bound
 * messages go. The only legitimate cross-origin peer is the page hosting us:
 * - iframed (the `agent-ai` web component / embed snippet): the frame parent —
 *   `location.ancestorOrigins[0]` where the browser has it (can't be spoofed
 *   and survives in-frame navigations), else the referrer of the iframe load;
 * - a `?chat-action=` voice/screen-share popup: the page that opened it
 *   (`window.opener`), i.e. the popup's referrer.
 * Anything else is same-origin only. Our own origin is always allowed.
 */
export function resolveChatMessageOrigins(chatAction: string | null): {
  allowedParentOrigins?: string[];
  postMessageTargetOrigin?: string;
} {
  if (typeof window === 'undefined') return {};
  const ownOrigin = window.location.origin;
  let parentOrigin: string | null = null;
  if (isInIframe()) {
    parentOrigin =
      toOrigin(window.location.ancestorOrigins?.[0]) ??
      toOrigin(document.referrer);
  } else if (chatAction && window.opener) {
    parentOrigin = toOrigin(document.referrer);
  }
  return {
    allowedParentOrigins: parentOrigin
      ? [parentOrigin, ownOrigin]
      : [ownOrigin],
    postMessageTargetOrigin: parentOrigin ?? ownOrigin,
  };
}

type Props = {
  mode?: 'advanced' | 'default';
  isPreviewMode: boolean;
  hasBorder?: boolean;
  isInCanvasView?: boolean;
  /** Set on the project chat route; a new chat then shows the project landing page. */
  projectId?: string;
};

/**
 * OS wiring for the SDK `Chat`. The chat UI and behaviour live in the SDK;
 * this wrapper only supplies identity, environment, the host-owned hooks
 * (paywall, 402 credits UX, Browse in the Chrome extension, service-worker
 * connectivity, the shared event bus) and the Tauri-only Code pill.
 */
export function SdkChat({
  mode = 'default',
  isPreviewMode,
  hasBorder,
  isInCanvasView,
  projectId,
}: Props) {
  const { mentorId: mentorIdParam, tenantKey } =
    useParams<TenantKeyMentorIdParams>();
  const {
    getMentorId,
    navigateToExplore,
    navigateToMentor,
    navigateToProject,
  } = useNavigate();
  const mentorId = getMentorId() ?? mentorIdParam;
  const username = useUsername();
  const axdToken = useAxdToken();
  const { userTenants } = useUserTenants();
  const { visitingTenant } = useVisitingTenant();
  const userIsStudent = useUserIsStudent();
  const isPublicRoute = useAccessingPublicRoute();
  const embed = useEmbedMode();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { executeWithTrialCheck } = useShowFreeTrialDialog();
  const { handle402Error } = use402ErrorCheck();
  const { status: swStatus } = useServiceWorker();
  const inExtensionPanel = useInExtensionPanel();
  const browse = useBrowseRun();

  // Code mode (Tauri only): the pill and the skill sync it reports on.
  const inTauri = useInTauri();
  const sessionId = useAppSelector(selectSessionId);
  const { data: mentorSettings } = useMentorSettings();
  const skillSync = useOpencodeSkillSync({
    org: tenantKey,
    mentorUniqueId: mentorSettings?.mentorUniqueId,
  });

  const messages = useMessages() as Record<string, unknown>;
  const labels = useMemo(
    () =>
      Object.fromEntries(
        CHAT_LABEL_NAMESPACES.filter((ns) => messages[ns]).map((ns) => [
          ns,
          messages[ns],
        ]),
      ) as ChatLabels,
    [messages],
  );

  const chatAction = searchParams.get('chat-action');
  const messageOrigins = useMemo(
    () => resolveChatMessageOrigins(chatAction),
    [chatAction],
  );

  const config: ChatConfig = {
    baseWsUrl: appConfig.baseWsUrl,
    supportEmail: appConfig.supportEmail,
    authUrl: appConfig.authUrl,
    dmUrl: appConfig.dmUrl,
    mainTenantKey: appConfig.mainTenantKey(),
    enableSupportPhone: appConfig.enableSupportPhone,
    defaultSupportPhoneNumber: appConfig.defaultSupportPhoneNumber,
    maximumCharacterSizeToCopy: appConfig.maximumCharacterSizeToCopy,
    appSyncBanner:
      appConfig.showAppBanner() === 'true'
        ? {
            badge: appConfig.appBannerBadge(),
            text: appConfig.appBannerText(),
            link: appConfig.appBannerLink(),
            linkText: appConfig.appBannerLinkText(),
          }
        : null,
    navigateToAdminBilling: () => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('profileTab', 'billing');
      router.push(`${pathname}?${params.toString()}`);
    },
    navigateToExplore: () => navigateToExplore(),
    navigateToMentor: (uniqueId) => navigateToMentor(uniqueId),
    navigateToProject,
    onUpgradeRequired: (proceed, isAdminAction) =>
      executeWithTrialCheck(proceed, isAdminAction),
    on402Error: handle402Error,
    eventBus,
    browse: {
      inExtensionPanel,
      isRunning: browse.isRunning,
      run: browse.run,
      stop: browse.stop,
    },
    suppressChatErrorToast: wasRecent402,
    isOnline: swStatus.isOnline,
    // Canvas (group: canvas): the OS GFM + KaTeX pipeline, so the canvas
    // editor/export/preview render tables and math like the OS canvas did.
    markdownToHtml,
    htmlToMarkdown,
    // Welcome screen (restore-welcome): the OS reads ai-search for anonymous
    // visitors too, matching the explore page (e929083c).
    exploreMentorsPublicFallback: false,
    // Messages & composer (restore-core): the OS gates upgrades through
    // onUpgradeRequired with no dialog, shows Share/Download to logged-out
    // visitors, and keeps focus in the composer while a reply streams.
    freeTrialDialog: null,
    showMessageActionsWhenLoggedOut: true,
    streamingFocusManagement: false,
    // Cross-window messaging (security): the SDK never posts to '*'; only the
    // embedding page / chat-action opener may message the chat.
    ...messageOrigins,
  };

  return (
    <Chat
      mode={mode}
      isPreviewMode={isPreviewMode}
      hasBorder={hasBorder}
      isInCanvasView={isInCanvasView}
      projectId={projectId}
      config={config}
      redirectToAuthSpa={redirectToAuthSpa}
      redirectToAuthSpaJoinTenant={() => redirectToAuthSpaJoinTenant()}
      username={username}
      userTenants={userTenants}
      visitingTenant={visitingTenant ?? undefined}
      axdToken={axdToken}
      mentorId={mentorId}
      tenantKey={tenantKey}
      userIsStudent={userIsStudent}
      isPublicRoute={isPublicRoute}
      embed={embed}
      labels={labels}
      showConversationStarters
      showExploreMentors
      slots={{
        composerExtraControls: inTauri ? (
          <CodingModeButton sessionId={sessionId} skillSync={skillSync} />
        ) : undefined,
      }}
    />
  );
}
