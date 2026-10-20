import React from 'react';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';

const chatSpy = vi.fn();
const setChatMarkdownTelemetry = vi.hoisted(() => vi.fn());
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }));
vi.mock('@iblai/iblai-js/web-containers/next', async (importOriginal) => {
  const {
    ApprovalsModeButton,
    createApprovalModeStore,
    PERMISSION_MODES,
    PERMISSION_MODE_ICONS,
  } =
    await importOriginal<
      typeof import('@iblai/iblai-js/web-containers/next')
    >();
  return {
    // Real, not stubbed: the OS's Code approvals button and store are built on
    // them.
    ApprovalsModeButton,
    createApprovalModeStore,
    PERMISSION_MODES,
    PERMISSION_MODE_ICONS,
    setChatMarkdownTelemetry,
    // The two host slots where the SDK composer puts them: the extra controls in
    // the tool row, the action controls first in the right-hand action group.
    Chat: (props: Record<string, unknown>) => {
      chatSpy(props);
      const slots = props.slots as {
        composerExtraControls?: React.ReactNode;
        composerActionControls?: React.ReactNode;
      };
      return (
        <div data-testid="sdk-chat">
          <div data-testid="composer-extra-controls">
            {slots?.composerExtraControls}
          </div>
          <div data-testid="composer-actions">
            {slots?.composerActionControls && (
              <div data-testid="composer-action-controls">
                {slots.composerActionControls}
              </div>
            )}
            <button data-testid="voice-chat-button">Microphone</button>
            <button data-testid="voice-call-button">Voice call</button>
            <button data-testid="submit-message-button">Send</button>
          </div>
        </div>
      );
    },
  };
});

vi.mock('@iblai/iblai-js/web-utils', () => ({
  selectSessionId: (state: { sessionId: string }) => state.sessionId,
}));

vi.mock('next-intl', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next-intl')>();
  const enMessages = (await import('../../../messages/en.json')).default;
  return {
    useMessages: () => ({
      chatIndex: { dropFilesHere: 'Suelta aquí' },
      uiDialog: { close: 'Cerrar' },
      unrelatedNamespace: { x: 'y' },
    }),
    useTranslations: (namespace: string) =>
      actual.createTranslator({
        locale: 'en',
        messages: enMessages as Record<string, unknown>,
        namespace: namespace as any,
      }),
  };
});

const routerPush = vi.fn();
let searchQuery = 'a=1';
vi.mock('next/navigation', () => ({
  useParams: () => ({ tenantKey: 'acme', mentorId: 'param-mentor' }),
  useRouter: () => ({ push: routerPush }),
  usePathname: () => '/platform/acme/m1',
  useSearchParams: () => new URLSearchParams(searchQuery),
}));

const pillProps = vi.fn();
/** Whether the Code pill is on and so offers the approvals button. */
let codeOn = false;
vi.mock('@/components/chat-input-form/coding-mode-button', async () => {
  const { useOfferApprovals } = await import(
    '@/components/chat-input-form/code-approvals-button'
  );
  return {
    CodingModeButton: (props: {
      sessionId?: string;
      approvalsSlot: HTMLElement | null;
    }) => {
      pillProps(props);
      useOfferApprovals(codeOn);
      return <button data-testid="code-pill">{props.sessionId}</button>;
    },
  };
});
const invoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invoke(...args),
}));
const metadataQuery = vi.fn();
const saveMetadata = vi.fn();
vi.mock('@iblai/iblai-js/data-layer', () => ({
  useGetUserPlatformMetadataQuery: (...args: unknown[]) => {
    metadataQuery(...args);
    return { data: { metadata: { code_mode: { permission_mode: 'manual' } } } };
  },
  useUpdateUserPlatformMetadataMutation: () => [saveMetadata],
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
  cn: (...classes: unknown[]) => classes.filter(Boolean).join(' '),
  isInIframe: () => inIframe,
  redirectToAuthSpa,
  redirectToAuthSpaJoinTenant,
}));
vi.mock('@/lib/markdown-engine', () => ({
  markdownToHtml,
  htmlToMarkdown,
}));
let tauri = false;
vi.mock('@/types/tauri', () => ({ isTauriApp: () => tauri }));

const unlisten = vi.fn();
const listen = vi.fn();
/** Handlers the chat registered, by Tauri event name. */
const tauriHandlers: Record<string, (() => void) | undefined> = {};
/** Set to hold `listen` open until the test settles it. */
let listenGate: Promise<void> | undefined;
vi.mock('@tauri-apps/api/event', () => ({
  listen: async (event: string, handler: () => void) => {
    listen(event);
    tauriHandlers[event] = handler;
    await listenGate;
    return unlisten;
  },
}));
let inBackground = false;
const playAttentionChime = vi.fn();
vi.mock('@/lib/attention-chime', () => ({
  isAppInBackground: () => inBackground,
  playAttentionChime,
}));

const { SdkChat, CHAT_LABEL_NAMESPACES, resolveChatMessageOrigins } =
  await import('../sdk-chat');
const { resetApprovalModeForTests, useOfferApprovals } = await import(
  '@/components/chat-input-form/code-approvals-button'
);

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
    codeOn = false;
    pillProps.mockClear();
    invoke.mockReset();
    metadataQuery.mockClear();
    saveMetadata.mockReset();
    saveMetadata.mockReturnValue({ unwrap: async () => ({}) });
    localStorage.setItem('tenant', 'acme');
    resetApprovalModeForTests();
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

  describe('Code approvals', () => {
    it('puts the approvals button first in the action group, before the microphone, and not beside the Code pill', async () => {
      tauri = true;
      codeOn = true;
      render(<SdkChat isPreviewMode={false} />);

      const actions = await screen.findByTestId('composer-actions');
      await waitFor(() =>
        expect(
          within(actions).getByTestId('code-approvals-button'),
        ).toBeInTheDocument(),
      );
      expect(
        Array.from(actions.children).map((el) =>
          el.getAttribute('data-testid'),
        ),
      ).toEqual([
        'composer-action-controls',
        'voice-chat-button',
        'voice-call-button',
        'submit-message-button',
      ]);
      expect(
        within(screen.getByTestId('composer-action-controls')).getByTestId(
          'code-approvals-button',
        ),
      ).toBeInTheDocument();
      expect(
        within(screen.getByTestId('composer-extra-controls')).queryByTestId(
          'code-approvals-button',
        ),
      ).not.toBeInTheDocument();
      expect(pillProps).toHaveBeenLastCalledWith(
        expect.objectContaining({ approvalsSlot: null }),
      );
    });

    it('saves a pick from the approvals button on this machine and the profile', async () => {
      tauri = true;
      codeOn = true;
      render(<SdkChat isPreviewMode={false} />);

      await userEvent.click(await screen.findByTestId('code-approvals-button'));
      await userEvent.click(
        await screen.findByTestId('code-approvals-option-auto'),
      );

      await waitFor(() =>
        expect(saveMetadata).toHaveBeenCalledWith({
          tenantKey: 'acme',
          metadata: { code_mode: { permission_mode: 'auto' } },
        }),
      );
      expect(invoke).toHaveBeenCalledWith('set_opencode_permission_mode', {
        mode: 'auto',
      });
    });

    it('adds nothing to the action group while Code is off', () => {
      tauri = true;
      render(<SdkChat isPreviewMode={false} />);

      expect(screen.getByTestId('code-pill')).toBeInTheDocument();
      expect(lastProps().slots.composerActionControls).toBeUndefined();
      expect(
        screen.queryByTestId('composer-action-controls'),
      ).not.toBeInTheDocument();
    });

    it('switches to Automatic from a permission card the way the approvals button does', async () => {
      tauri = true;
      codeOn = true;
      render(<SdkChat isPreviewMode={false} />);

      await act(() => lastProps().config.onSwitchToAutomatic());

      expect(invoke).toHaveBeenCalledWith('set_opencode_permission_mode', {
        mode: 'auto',
      });
      expect(saveMetadata).toHaveBeenCalledWith({
        tenantKey: 'acme',
        metadata: { code_mode: { permission_mode: 'auto' } },
      });
      expect(
        await screen.findByRole('button', { name: 'Approvals: Automatic' }),
      ).toBeInTheDocument();
    });

    // The SDK card tells the user itself, so a toast here would be a second one.
    it('tells a permission card when Automatic was not saved, and shows no notice of its own', async () => {
      tauri = true;
      const err = vi.spyOn(console, 'error').mockImplementation(() => {});
      const toastError = vi.spyOn(toast, 'error');
      invoke.mockImplementation(async (cmd: string) => {
        if (cmd === 'set_opencode_permission_mode')
          throw new Error('settings unreadable');
        return cmd === 'get_opencode_permission_mode' ? 'manual' : undefined;
      });
      render(<SdkChat isPreviewMode={false} />);

      let saved: unknown;
      await act(async () => {
        saved = await lastProps().config.onSwitchToAutomatic();
      });

      expect(saved).toBe(false);
      expect(toastError).not.toHaveBeenCalled();
      expect(saveMetadata).not.toHaveBeenCalled();
      toastError.mockRestore();
      err.mockRestore();
    });

    it('holds a permission card’s Switch to Automatic until this machine has saved it', async () => {
      // The SDK card awaits this before allowing its own action, so the save
      // lands first and answers every other card still waiting.
      tauri = true;
      let finishSave!: () => void;
      invoke.mockImplementation((cmd: string) =>
        cmd === 'set_opencode_permission_mode'
          ? new Promise<void>((resolve) => {
              finishSave = resolve;
            })
          : Promise.resolve(undefined),
      );
      render(<SdkChat isPreviewMode={false} />);

      let switching: unknown;
      act(() => {
        switching = lastProps().config.onSwitchToAutomatic();
      });
      expect(switching).toBeInstanceOf(Promise);
      let settled = false;
      void (switching as Promise<unknown>).then(() => {
        settled = true;
      });
      await waitFor(() =>
        expect(invoke).toHaveBeenCalledWith('set_opencode_permission_mode', {
          mode: 'auto',
        }),
      );
      await act(async () => {});
      expect(settled).toBe(false);

      await act(async () => {
        finishSave();
        await switching;
      });
      expect(settled).toBe(true);
    });

    it('offers neither the approvals slot nor Switch to Automatic outside Tauri', async () => {
      vi.useFakeTimers();
      codeOn = true;
      // A pill offering it anywhere on screen still adds nothing outside Tauri.
      const OfferingPill = () => {
        useOfferApprovals(true);
        return null;
      };
      render(
        <>
          <SdkChat isPreviewMode={false} />
          <OfferingPill />
        </>,
      );
      act(() => {
        vi.advanceTimersByTime(6000);
      });

      expect(lastProps().slots.composerActionControls).toBeUndefined();
      expect(
        screen.queryByTestId('code-approvals-button'),
      ).not.toBeInTheDocument();
      expect(lastProps().config.onSwitchToAutomatic).toBeUndefined();
      expect(metadataQuery).toHaveBeenLastCalledWith(
        { tenantKey: 'acme' },
        { skip: true },
      );
    });
  });

  describe('chime for a Code permission card', () => {
    const PERMISSION_EVENT = 'opencode:permission_request';
    const requestArrives = () => act(() => tauriHandlers[PERMISSION_EVENT]?.());

    beforeEach(() => {
      listen.mockClear();
      unlisten.mockClear();
      playAttentionChime.mockClear();
      delete tauriHandlers[PERMISSION_EVENT];
      listenGate = undefined;
      inBackground = false;
    });

    it('chimes once when a card arrives while the app is in the background', async () => {
      tauri = true;
      render(<SdkChat isPreviewMode={false} />);
      await waitFor(() =>
        expect(listen).toHaveBeenCalledWith(PERMISSION_EVENT),
      );

      inBackground = true;
      requestArrives();

      expect(playAttentionChime).toHaveBeenCalledTimes(1);
    });

    it('stays quiet while the user is in the app', async () => {
      tauri = true;
      render(<SdkChat isPreviewMode={false} />);
      await waitFor(() =>
        expect(listen).toHaveBeenCalledWith(PERMISSION_EVENT),
      );

      requestArrives();

      expect(playAttentionChime).not.toHaveBeenCalled();
    });

    it('never listens outside Tauri', async () => {
      vi.useFakeTimers();
      render(<SdkChat isPreviewMode={false} />);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(6000);
      });

      expect(listen).not.toHaveBeenCalled();
    });

    it('stops listening once the chat unmounts', async () => {
      tauri = true;
      const { unmount } = render(<SdkChat isPreviewMode={false} />);
      await waitFor(() =>
        expect(listen).toHaveBeenCalledWith(PERMISSION_EVENT),
      );
      await act(async () => {});

      unmount();

      expect(unlisten).toHaveBeenCalledTimes(1);
    });

    it('stops listening even when the chat unmounts before the listener is in place', async () => {
      tauri = true;
      let openGate: () => void = () => {};
      listenGate = new Promise((resolve) => {
        openGate = resolve;
      });
      const { unmount } = render(<SdkChat isPreviewMode={false} />);
      await waitFor(() =>
        expect(listen).toHaveBeenCalledWith(PERMISSION_EVENT),
      );

      unmount();
      expect(unlisten).not.toHaveBeenCalled();
      await act(async () => openGate());

      expect(unlisten).toHaveBeenCalledTimes(1);
    });
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
