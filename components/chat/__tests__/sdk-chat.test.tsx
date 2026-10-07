import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const chatSpy = vi.fn();
const setChatMarkdownTelemetry = vi.hoisted(() => vi.fn());
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }));
vi.mock('@iblai/iblai-js/web-containers/next', () => ({
  setChatMarkdownTelemetry,
  Chat: (props: Record<string, unknown>) => {
    chatSpy(props);
    return (
      <div data-testid="sdk-chat">
        {
          (props.slots as { composerExtraControls?: React.ReactNode })
            ?.composerExtraControls
        }
      </div>
    );
  },
}));

vi.mock('@iblai/iblai-js/web-utils', () => ({
  selectSessionId: (state: { sessionId: string }) => state.sessionId,
}));

vi.mock('next-intl', () => ({
  useMessages: () => ({
    chatIndex: { dropFilesHere: 'Suelta aquí' },
    uiDialog: { close: 'Cerrar' },
    unrelatedNamespace: { x: 'y' },
  }),
}));

const routerPush = vi.fn();
let searchQuery = 'a=1';
vi.mock('next/navigation', () => ({
  useParams: () => ({ tenantKey: 'acme', mentorId: 'param-mentor' }),
  useRouter: () => ({ push: routerPush }),
  usePathname: () => '/platform/acme/m1',
  useSearchParams: () => new URLSearchParams(searchQuery),
}));

vi.mock('@/components/chat-input-form/coding-mode-button', () => ({
  CodingModeButton: ({ sessionId }: { sessionId?: string }) => (
    <button data-testid="code-pill">{sessionId}</button>
  ),
}));
vi.mock('@/components/service-worker-provider', () => ({
  useServiceWorker: () => ({ status: { isOnline: false } }),
}));
vi.mock('@/hooks/use-anonymous-mentor', () => ({
  useAccessingPublicRoute: () => true,
}));
const browse = { run: vi.fn(), stop: vi.fn(), isRunning: true };
vi.mock('@/hooks/use-browse-run', () => ({ useBrowseRun: () => browse }));
vi.mock('@/hooks/use-embed-mode', () => ({ useEmbedMode: () => true }));
vi.mock('@/hooks/use-in-extension-panel', () => ({
  useInExtensionPanel: () => true,
}));
vi.mock('@/hooks/use-mentors/use-mentor-settings', () => ({
  useMentorSettings: () => ({ data: { mentorUniqueId: 'uuid-1' } }),
}));
const wasRecent402 = vi.fn(() => true);
vi.mock('@/hooks/use-opencode-402', () => ({ wasRecent402 }));
const skillSync = { state: 'synced' };
const useOpencodeSkillSync = vi.fn(() => skillSync);
vi.mock('@/hooks/use-opencode-skill-sync', () => ({ useOpencodeSkillSync }));
const handle402Error = vi.fn();
vi.mock('@/hooks/subscription/use-402-error-check', () => ({
  use402ErrorCheck: () => ({ handle402Error }),
}));
vi.mock('@/hooks/use-tokens', () => ({ useAxdToken: () => 'axd-token' }));
vi.mock('@/hooks/use-user', () => ({
  useUsername: () => 'jane',
  useUserIsStudent: () => true,
  useUserTenants: () => ({ userTenants: [{ key: 'acme' }] }),
  useVisitingTenant: () => ({ visitingTenant: null }),
}));
const navigateToExplore = vi.fn();
const navigateToMentor = vi.fn();
const navigateToProject = vi.fn();
let mentorIdFromNav: string | null = 'nav-mentor';
vi.mock('@/hooks/user-navigate', () => ({
  useNavigate: () => ({
    getMentorId: () => mentorIdFromNav,
    navigateToExplore,
    navigateToMentor,
    navigateToProject,
  }),
}));
const executeWithTrialCheck = vi.fn((fn: () => unknown) => fn());
vi.mock('@/hooks/user-user-actions', () => ({
  useShowFreeTrialDialog: () => ({ executeWithTrialCheck }),
}));
let showAppBanner = 'true';
vi.mock('@/lib/config', () => ({
  config: {
    baseWsUrl: () => 'wss://ws',
    supportEmail: () => 'help@x.com',
    authUrl: () => 'https://auth',
    dmUrl: () => 'https://dm',
    mainTenantKey: () => 'main',
    enableSupportPhone: () => false,
    defaultSupportPhoneNumber: () => '123',
    maximumCharacterSizeToCopy: () => '2000',
    showAppBanner: () => showAppBanner,
    appBannerBadge: () => 'New',
    appBannerText: () => 'Text',
    appBannerLink: () => 'https://l',
    appBannerLinkText: () => 'Go',
  },
}));
vi.mock('@/lib/eventBus', () => ({ default: { on: vi.fn(), off: vi.fn() } }));
vi.mock('@/lib/hooks', () => ({
  useAppSelector: (sel: (s: { sessionId: string }) => unknown) =>
    sel({ sessionId: 'session-9' }),
}));
const redirectToAuthSpa = vi.fn();
const redirectToAuthSpaJoinTenant = vi.fn();
const markdownToHtml = vi.fn();
const htmlToMarkdown = vi.fn();
let inIframe = false;
vi.mock('@/lib/utils', () => ({
  isInIframe: () => inIframe,
  redirectToAuthSpa,
  redirectToAuthSpaJoinTenant,
  markdownToHtml,
  htmlToMarkdown,
}));
let tauri = false;
vi.mock('@/types/tauri', () => ({ isTauriApp: () => tauri }));

const { SdkChat, CHAT_LABEL_NAMESPACES, resolveChatMessageOrigins } =
  await import('../sdk-chat');

const lastProps = () =>
  chatSpy.mock.calls[chatSpy.mock.calls.length - 1][0] as Record<string, any>;

describe('SdkChat', () => {
  it("routes the SDK chat renderer's math telemetry to the OS Sentry", async () => {
    const Sentry = await import('@sentry/nextjs');
    expect(setChatMarkdownTelemetry).toHaveBeenCalledWith(Sentry);
  });

  beforeEach(() => {
    chatSpy.mockClear();
    tauri = false;
    showAppBanner = 'true';
    mentorIdFromNav = 'nav-mentor';
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    inIframe = false;
    searchQuery = 'a=1';
  });

  it('passes identity from the OS hooks to the SDK Chat', () => {
    render(<SdkChat isPreviewMode mode="advanced" hasBorder={false} />);
    const props = lastProps();
    expect(props).toMatchObject({
      mode: 'advanced',
      isPreviewMode: true,
      hasBorder: false,
      tenantKey: 'acme',
      mentorId: 'nav-mentor',
      username: 'jane',
      axdToken: 'axd-token',
      userTenants: [{ key: 'acme' }],
      visitingTenant: undefined,
      userIsStudent: true,
      isPublicRoute: true,
      embed: true,
    });
  });

  it('falls back to the route mentor id', () => {
    mentorIdFromNav = null;
    render(<SdkChat isPreviewMode={false} />);
    expect(lastProps().mentorId).toBe('param-mentor');
    expect(lastProps().mode).toBe('default');
  });

  it('scopes the chat to a project only when one is given', () => {
    render(<SdkChat isPreviewMode={false} />);
    expect(lastProps().projectId).toBeUndefined();

    render(<SdkChat isPreviewMode={false} projectId="42" />);
    expect(lastProps().projectId).toBe('42');
  });

  it('maps only the chat namespaces of the next-intl messages to labels', () => {
    render(<SdkChat isPreviewMode={false} />);
    expect(lastProps().labels).toEqual({
      chatIndex: { dropFilesHere: 'Suelta aquí' },
      uiDialog: { close: 'Cerrar' },
    });
    expect(CHAT_LABEL_NAMESPACES).toContain('chatInputFormInsideButtons');
    // #2586 redesigned composer ("+" menu, chips, file cards).
    expect(CHAT_LABEL_NAMESPACES).toContain('chatComposer');
  });

  it('builds the config from the OS environment and host hooks', () => {
    render(<SdkChat isPreviewMode={false} />);
    const { config } = lastProps();
    expect(config.baseWsUrl()).toBe('wss://ws');
    expect(config.supportEmail()).toBe('help@x.com');
    expect(config.authUrl()).toBe('https://auth');
    expect(config.dmUrl()).toBe('https://dm');
    expect(config.mainTenantKey).toBe('main');
    expect(config.enableSupportPhone()).toBe(false);
    expect(config.defaultSupportPhoneNumber()).toBe('123');
    expect(config.maximumCharacterSizeToCopy()).toBe('2000');
    expect(config.appSyncBanner).toEqual({
      badge: 'New',
      text: 'Text',
      link: 'https://l',
      linkText: 'Go',
    });
    expect(config.isOnline).toBe(false);
    expect(config.on402Error).toBe(handle402Error);
    expect(config.suppressChatErrorToast).toBe(wasRecent402);
    expect(config.browse.inExtensionPanel).toBe(true);
    expect(config.browse.isRunning).toBe(true);
    config.browse.run('goal');
    config.browse.stop();
    expect(browse.run).toHaveBeenCalledWith('goal');
    expect(browse.stop).toHaveBeenCalled();
    expect(config.eventBus).toBeDefined();
    // Messages render through the SDK's own chat renderer (a port of the OS
    // one), so the OS passes none.
    expect(config.markdownComponent).toBeUndefined();
    // Canvas renders through the OS GFM + KaTeX markdown pipeline.
    expect(config.markdownToHtml).toBe(markdownToHtml);
    expect(config.htmlToMarkdown).toBe(htmlToMarkdown);

    config.navigateToExplore();
    config.navigateToMentor('m2');
    config.navigateToProject('p1', 'm3');
    expect(navigateToExplore).toHaveBeenCalled();
    expect(navigateToMentor).toHaveBeenCalledWith('m2');
    expect(navigateToProject).toHaveBeenCalledWith('p1', 'm3');

    config.navigateToAdminBilling();
    expect(routerPush).toHaveBeenCalledWith(
      '/platform/acme/m1?a=1&profileTab=billing',
    );

    const proceed = vi.fn(() => 'ran');
    expect(config.onUpgradeRequired(proceed, false)).toBe('ran');
    expect(executeWithTrialCheck).toHaveBeenCalledWith(proceed, false);
  });

  it('keeps the OS welcome screen: starters + Explore opt-ins, no public fallback', () => {
    render(<SdkChat isPreviewMode={false} />);
    const props = lastProps();
    expect(props.showConversationStarters).toBe(true);
    expect(props.showExploreMentors).toBe(true);
    expect(props.config.exploreMentorsPublicFallback).toBe(false);
  });

  it('keeps the OS message/composer behaviour: no trial dialog, logged-out actions, composer focus', () => {
    render(<SdkChat isPreviewMode={false} />);
    const { config } = lastProps();
    expect(config.freeTrialDialog).toBeNull();
    expect(config.showMessageActionsWhenLoggedOut).toBe(true);
    expect(config.streamingFocusManagement).toBe(false);
  });

  it('hides the app banner when it is off', () => {
    showAppBanner = 'false';
    render(<SdkChat isPreviewMode={false} />);
    expect(lastProps().config.appSyncBanner).toBeNull();
  });

  it('wires the auth redirects', () => {
    render(<SdkChat isPreviewMode={false} />);
    expect(lastProps().redirectToAuthSpa).toBe(redirectToAuthSpa);
    lastProps().redirectToAuthSpaJoinTenant();
    expect(redirectToAuthSpaJoinTenant).toHaveBeenCalledWith();
  });

  it('keeps the Code pill out of the composer outside Tauri', () => {
    vi.useFakeTimers();
    render(<SdkChat isPreviewMode={false} />);
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(screen.queryByTestId('code-pill')).toBeNull();
    expect(useOpencodeSkillSync).toHaveBeenCalledWith({
      org: 'acme',
      mentorUniqueId: 'uuid-1',
    });
  });

  it('renders the Code pill in the composer slot inside Tauri', () => {
    tauri = true;
    render(<SdkChat isPreviewMode={false} />);
    expect(screen.getByTestId('code-pill')).toHaveTextContent('session-9');
  });

  it('shows the Code pill once Tauri globals appear after load', () => {
    vi.useFakeTimers();
    render(<SdkChat isPreviewMode={false} />);
    expect(screen.queryByTestId('code-pill')).toBeNull();
    tauri = true;
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByTestId('code-pill')).toBeInTheDocument();
  });
  describe('postMessage origins (security)', () => {
    const own = window.location.origin;
    const setAncestors = (origins: string[] | undefined) =>
      Object.defineProperty(window.location, 'ancestorOrigins', {
        value: origins,
        configurable: true,
      });
    const setOpener = (opener: unknown) =>
      Object.defineProperty(window, 'opener', {
        value: opener,
        configurable: true,
        writable: true,
      });
    afterEach(() => {
      setAncestors(undefined);
      setOpener(null);
    });

    it('is same-origin only on a top-level page, whatever the referrer', () => {
      vi.spyOn(document, 'referrer', 'get').mockReturnValue(
        'https://evil.example/x',
      );
      render(<SdkChat isPreviewMode={false} />);
      expect(lastProps().config).toMatchObject({
        allowedParentOrigins: [own],
        postMessageTargetOrigin: own,
      });
    });

    it('trusts the iframe parent from ancestorOrigins over the referrer', () => {
      inIframe = true;
      setAncestors(['https://customer.example']);
      vi.spyOn(document, 'referrer', 'get').mockReturnValue(
        'https://auth.example/login',
      );
      render(<SdkChat isPreviewMode={false} />);
      expect(lastProps().config).toMatchObject({
        allowedParentOrigins: ['https://customer.example', own],
        postMessageTargetOrigin: 'https://customer.example',
      });
    });

    it('falls back to the iframe load referrer without ancestorOrigins', () => {
      inIframe = true;
      vi.spyOn(document, 'referrer', 'get').mockReturnValue(
        'https://customer.example/page',
      );
      expect(resolveChatMessageOrigins(null)).toEqual({
        allowedParentOrigins: ['https://customer.example', own],
        postMessageTargetOrigin: 'https://customer.example',
      });
    });

    it('stays same-origin in an iframe with no usable parent origin', () => {
      inIframe = true;
      vi.spyOn(document, 'referrer', 'get').mockReturnValue('not a url');
      expect(resolveChatMessageOrigins(null)).toEqual({
        allowedParentOrigins: [own],
        postMessageTargetOrigin: own,
      });
    });

    it('trusts the opener of a chat-action popup via its referrer', () => {
      searchQuery = 'chat-action=screen-share';
      setOpener({ closed: false });
      vi.spyOn(document, 'referrer', 'get').mockReturnValue(
        'https://customer.example/page',
      );
      render(<SdkChat isPreviewMode={false} />);
      expect(lastProps().config).toMatchObject({
        allowedParentOrigins: ['https://customer.example', own],
        postMessageTargetOrigin: 'https://customer.example',
      });
    });

    it('ignores the referrer for a chat-action URL without an opener', () => {
      vi.spyOn(document, 'referrer', 'get').mockReturnValue(
        'https://customer.example/page',
      );
      expect(resolveChatMessageOrigins('screen-share')).toEqual({
        allowedParentOrigins: [own],
        postMessageTargetOrigin: own,
      });
    });

    it('never resolves an opaque origin', () => {
      inIframe = true;
      setAncestors(['null']);
      vi.spyOn(document, 'referrer', 'get').mockReturnValue('');
      expect(resolveChatMessageOrigins(null).postMessageTargetOrigin).toBe(own);
    });
  });
});
