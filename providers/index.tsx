'use client';

import {
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
} from 'next/navigation';

import { config } from '@/lib/config';
import {
  useIsAdmin,
  useUsername,
  useCurrentTenant,
  useUserTenants,
  useVisitingTenant,
  useDmToken,
  useAxdToken,
  useDmTokenExpires,
  useAxdTokenExpires,
} from '@/hooks/use-user';
import {
  isInIframe,
  LocalStorageService,
  saveUserObjectToLocalStorage,
  sendMessageToParentWebsite,
  deleteCookieOnAllDomains,
} from '@/lib/utils';
import {
  initializeDataLayer,
  TokenResponse,
  useLazyGetMentorPublicSettingsQuery,
} from '@iblai/iblai-js/data-layer';
import { redirectToAuthSpa } from '@/lib/utils';
import AppProvider from './app-provider';
import { useEffect, useMemo, useState } from 'react';
import Script from 'next/script';
import { useTenantKey } from '@/hooks/use-tenants';
import { TenantKeyMentorIdParams } from '@/lib/types';
import { handleTenantSwitch } from '@/lib/utils';
import {
  AuthProvider,
  TenantProvider,
  MentorProvider,
  TenantContextProvider,
  AuthContextProvider,
  selectShowingSharedChat,
  isJSON,
} from '@iblai/iblai-js/web-utils';
import { Spinner } from '@/components/spinner';
import { useIsPreviewMode } from '@/hooks/use-is-preview-mode';
import { ANONYMOUS_USERNAME, MENTOR_VISIBILITY_VALUES } from '@/lib/constants';
import { useEmbedMode } from '@/hooks/use-embed-mode';
import { use402ErrorCheck } from '@/hooks/subscription/use-402-error-check';
import { SUBSCRIPTION_CREDIT_LIMIT_ERROR_MESSAGE } from '@/hooks/subscription/constants';
import { customErrorMessages } from '@/lib/error';
import { useIframeHandlers } from '@/lib/handlers';
import { useIframeMessageHandler } from '@iblai/iblai-js/web-containers';
import { SentryInit } from '@/components/sentry-init';
import { MentorTimeTrackingProvider } from '@/hooks/use-mentor-time-tracking';
import { useSelector } from 'react-redux';
import { updateRbacPermissions } from '@/features/rbac/rbac-slice';
import { useAppDispatch } from '@/lib/hooks';
import { toast } from 'sonner';
//import { useLazyGetTenantMetadataQuery } from '@iblai/iblai-js/data-layer';
import { useTenantMetadata } from '@iblai/iblai-js/web-utils';
import { sanitizeCss } from '@iblai/iblai-js/web-containers';
import {
  isTauriOfflineMode,
  isOfflineServerOrigin,
} from '@/hooks/use-tauri-offline';
import { isTauriApp } from '@/types/tauri';
import { hideInitialLoader } from '@/lib/initial-loader';

export default function Providers({ children }: { children: React.ReactNode }) {
  const { handle402Error } = use402ErrorCheck();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    deleteCookieOnAllDomains('ibl_tenant_switching', window.location.hostname);
    sendMessageToParentWebsite({
      loaded: true,
      auth: { ...localStorage },
    });
  }, []);

  // Listen for tenant switch events from other tabs/windows via BroadcastChannel
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel('ibl-tenant-switch');

    channel.onmessage = (event) => {
      const { type, tenant } = event.data ?? {};
      if (type === 'TENANT_SWITCHING') {
        console.log(
          '[Providers] Received TENANT_SWITCHING from another tab, target:',
          tenant,
        );
        handleTenantSwitch(tenant, false, undefined, false);
      }
    };

    return () => channel.close();
  }, []);

  const handlers = useIframeHandlers();

  useIframeMessageHandler({
    handlers,
    defaultHandler: (data) => {
      if (data.axd_token) {
        saveUserObjectToLocalStorage(data);
        window.location.reload();
      }
    },
  });

  const loadDataLayer = () => {
    initializeDataLayer(
      config.dmUrl(),
      config.lmsUrl(),
      config.legacyLmsUrl(),
      LocalStorageService.getInstance(),
      {
        401: () => {
          // Don't redirect to auth when in Tauri offline mode
          if (isTauriApp() && isTauriOfflineMode()) {
            console.log(
              '[auth-redirect] Skipping 401 redirect - Tauri offline mode',
            );
            return;
          }
          // Don't redirect on shareable links — the user may be visiting a
          // different tenant and some tenant-scoped API calls will 401.  The
          // public-settings endpoint still provides all the data we need.
          const urlParams = new URLSearchParams(window.location.search);
          if (urlParams.get('token')) {
            console.log(
              '[auth-redirect] Skipping 401 redirect - shareable link',
            );
            return;
          }
          console.log('[auth-redirect] API returned 401 Unauthorized');
          redirectToAuthSpa(undefined, undefined, true);
        },
        402: () =>
          handle402Error({ error: SUBSCRIPTION_CREDIT_LIMIT_ERROR_MESSAGE }),
      },
    );
    setReady(true);
  };

  const embed = useEmbedMode();

  useEffect(() => {
    if (typeof window.__ENV__ !== 'undefined') {
      loadDataLayer();
    } else {
      const script = document.createElement('script');
      script.src = '/env.js';
      script.async = false;
      script.onload = () => loadDataLayer();
      script.onerror = () => loadDataLayer();
      document.head.appendChild(script);
    }
  }, []);

  const username = useUsername();
  const { tenant: tenantKey, saveTenant } = useTenantKey();

  const isAdmin = useIsAdmin();
  const { tenantKey: tenantKeyParams, mentorId } =
    useParams<TenantKeyMentorIdParams>();
  const [getMentorPublicSettings] = useLazyGetMentorPublicSettingsQuery();

  // Check if we're in Tauri offline mode early - needed to skip API calls
  // Use isOfflineServerOrigin() as primary check since it works before Tauri scripts run
  const isTauriOfflineEarly =
    isOfflineServerOrigin() || (isTauriApp() && isTauriOfflineMode());

  // Debug logging - always log in potential offline scenarios
  if (
    typeof window !== 'undefined' &&
    typeof localStorage?.getItem === 'function'
  ) {
    const isOfflineOrigin = isOfflineServerOrigin();
    if (isOfflineOrigin || isTauriApp()) {
      console.log('[Providers] Tauri offline mode check:', {
        isOfflineServerOrigin: isOfflineOrigin,
        origin: window.location.origin,
        pathname: window.location.pathname,
        isTauriApp: isTauriApp(),
        isTauriOfflineMode: isTauriOfflineMode(),
        globalFlag: (window as any).__TAURI_OFFLINE_MODE__,
        localStorageFlag: localStorage.getItem('tauri_offline_mode'),
        isTauriOfflineEarly,
      });
      console.log('[Providers] useParams result:', {
        tenantKeyParams,
        mentorId,
      });
    }
  }

  // Skip tenant metadata API call in Tauri offline mode
  const { metadata } = useTenantMetadata({
    org: tenantKeyParams,
    skip: isTauriOfflineEarly,
  });
  const tenantAdvancedCSS = isJSON(metadata?.mentor_advanced_css)
    ? sanitizeCss(JSON.parse(metadata?.mentor_advanced_css) as string)
    : '';
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const showingSharedChat = useSelector(selectShowingSharedChat);

  const email = searchParams.get('email');
  const stripeCheckoutID = searchParams.get('stripe_checkout_id');

  //don't logout user when coming back stripe. explain the presence of !stripeCheckoutID
  if (email && typeof window !== 'undefined' && !stripeCheckoutID) {
    window.location.href = `${config.authUrl()}/login?enforce_logout=1&logout=1&email=${encodeURIComponent(email)}&app=mentor&redirect-to=${window.location.origin}`;
    return;
  }
  const [externalCSS, setExternalCSS] = useState('');
  const [externalJS, setExternalJS] = useState('');
  const [defaultEmbedCSS, setDefaultEmbedCSS] = useState('');
  const router = useRouter();

  const fullPathname =
    pathname + (searchParams.toString() ? `?${searchParams.toString()}` : '');
  const switchingMentor = searchParams.get('switching-mentor');
  const isSsoLoginRoute = /^\/sso-login/.test(pathname);
  const isVersionRoute = /^\/version/.test(pathname);
  // Workflow pages manage their own mentor context; skip MentorProvider's mentor check
  // to prevent it from redirecting when the URL's mentorId changes during navigation.
  const isWorkflowPage = /\/workflows\//.test(pathname);
  // The onboarding route is self-contained; keep MentorProvider from redirecting a
  // brand-new admin (who has no mentors yet) off it to /create-mentor.
  const isOnboardingPage = /^\/onboarding(\/|$)/.test(pathname);

  // Use the same offline check (already computed above)
  const isTauriOffline = isTauriOfflineEarly;

  const { saveCurrentTenant } = useCurrentTenant();
  const { saveDmToken } = useDmToken();
  const { saveAxdToken } = useAxdToken();
  const { saveDmTokenExpires } = useDmTokenExpires();
  const { saveAxdTokenExpires } = useAxdTokenExpires();
  const { saveVisitingTenant, removeVisitingTenant } = useVisitingTenant();
  const { saveUserTenants } = useUserTenants();
  const isPreviewMode = useIsPreviewMode();
  const dispatch = useAppDispatch();
  const [useMentorProvider, setUseMentorProvider] = useState(true);

  function saveUserTokens(tokenResponse: TokenResponse) {
    saveAxdToken(tokenResponse.axd_token.token);
    saveAxdTokenExpires(tokenResponse.axd_token.expires);
    saveDmToken(tokenResponse.dm_token.token);
    saveDmTokenExpires(tokenResponse.dm_token.expires);
  }

  function redirectToNoMentorsPage() {
    if (isOnboardingPage) return;
    router.push(`/platform/${tenantKey}/explore`);
  }

  function redirectToCreateMentor() {
    if (isOnboardingPage) return;
    router.push('/create-mentor');
  }

  function redirectToMentor(tenantKey: string, mentorId: string) {
    if (isOnboardingPage) return;
    router.push(`/platform/${tenantKey}/${mentorId}`);
  }

  function onLoadMentorsPermissions(
    rbacPermissions: Record<string, unknown> | undefined,
  ) {
    dispatch(updateRbacPermissions(rbacPermissions ?? {}));
  }

  async function handleMentorNotFound() {
    const existingParams = searchParams.toString();
    const errorUrl = `/error/404?errorType=${customErrorMessages.mentorNotFound.key}`;
    const finalUrl = existingParams
      ? `${errorUrl}&${existingParams}`
      : errorUrl;
    router.push(finalUrl);
  }

  function onLoadPlatformpermissions(
    rbacPermissions: Record<string, unknown> | undefined,
  ) {
    dispatch(updateRbacPermissions(rbacPermissions ?? {}));
  }

  const middleware = useMemo(() => {
    const map = new Map();

    // allow user to go to version page without auth
    map.set(new RegExp('^\/version'), async () => false);

    map.set(
      new RegExp('^\/provider-association\/stripe\/callback\/([a-zA-Z0-9_-]+)'),
      () => {
        return false;
      },
    );

    // allow user to view an anonymous mentor
    map.set(
      new RegExp('^\/platform\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)'),
      async () => {
        // Re-check Tauri offline mode at middleware execution time
        // This is important because the script may have set the flag after React rendered
        const isOfflineNow = isTauriApp() && isTauriOfflineMode();

        // In Tauri offline mode, skip the API call and allow access
        // The cached data will be used by the page components
        if (isOfflineNow) {
          console.log(
            '[Providers] Tauri offline mode - skipping getMentorPublicSettings middleware',
          );
          return false;
        }

        // Don't make API call if params aren't ready yet
        if (!mentorId || !tenantKeyParams) {
          console.log(
            '[Providers] Params not ready, skipping getMentorPublicSettings',
            {
              mentorId,
              tenantKeyParams,
              isOfflineNow,
            },
          );
          return false;
        }

        console.log(
          'calling getMentorPublicSettings',
          JSON.stringify({
            mentorId,
            tenantKeyParams,
            username,
            isOfflineNow,
          }),
        );

        try {
          const response = await getMentorPublicSettings(
            {
              mentor: mentorId,
              org: tenantKeyParams,
              // @ts-ignore
              userId: username ?? ANONYMOUS_USERNAME,
            },
            true, // preferCacheValue - use cached data if available
          ).unwrap();
          if (isInIframe()) {
            setExternalCSS(response.custom_css ?? '');
            setDefaultEmbedCSS(config.defaultEmbedCssUrl() ?? '');
            setExternalJS(response?.custom_javascript ?? '');
            console.log('getMentorPublicSettings response', {
              allow_anonymous: response?.allow_anonymous,
            });
          }

          if (
            response?.allow_anonymous ||
            response?.mentor_visibility === MENTOR_VISIBILITY_VALUES.ANYONE
          ) {
            return false;
          } else {
            return true;
          }
        } catch (error) {
          console.error('getMentorPublicSettings failed', error);
          return false;
        }
      },
    );

    // allow user to go to sso-login page without auth
    map.set(new RegExp('^\/sso-login'), async () => {
      return false;
    });

    // allow user to go to error page without auth
    map.set(new RegExp('^\/error\/([0-9]+)'), async () => false);

    // allow user to share a chat link without auth
    map.set(new RegExp('^\/share\/chat\/([a-zA-Z0-9_-]+)'), async () => {
      return false;
    });

    // allow user to go to oauth page without auth
    map.set(new RegExp('^\/uploads\/?'), async () => false);

    // allow user to go to oauth page without auth
    map.set(new RegExp('^/\\?oauth=.*'), async () => false);

    // allow user to go to google oauth callback page without auth
    map.set(new RegExp('^\/google-oauth-callback\/?'), async () => false);

    return map;
  }, [mentorId, tenantKeyParams, username]);

  if (!ready) return null;

  // In Tauri offline mode, bypass all provider chains and render directly
  // This prevents any provider from blocking rendering while waiting for API responses
  // But we still need to provide stub contexts so hooks don't crash
  if (isTauriOfflineEarly) {
    console.log(
      '[Providers] Tauri offline mode - bypassing provider chain, rendering directly',
    );
    // Hide initial loader since we're rendering directly
    hideInitialLoader();

    // Create stub context values with no-op functions for offline mode
    // Must match exact types from @iblai/web-utils
    const stubTenantContext = {
      determineUserPath: false,
      setDetermineUserPath: () => {},
      tenantKey: tenantKeyParams || '',
      setTenantKey: () => {},
      metadata: metadata || {},
      setMetadata: () => {},
    };

    const stubAuthContext = {
      userIsAccessingPublicRoute: false,
      setUserIsAccessingPublicRoute: () => {},
      isLoggedIn: false,
    };

    return (
      <>
        <SentryInit />
        <MentorTimeTrackingProvider intervalSeconds={30} enabled={false} />
        <AuthContextProvider value={stubAuthContext}>
          <TenantContextProvider value={stubTenantContext}>
            <AppProvider>
              {tenantAdvancedCSS && <style>{tenantAdvancedCSS}</style>}
              {children}
            </AppProvider>
          </TenantContextProvider>
        </AuthContextProvider>
      </>
    );
  }

  return (
    <>
      <SentryInit />
      <MentorTimeTrackingProvider intervalSeconds={30} enabled={true} />

      <AuthProvider
        skip={isSsoLoginRoute || isVersionRoute || isTauriOffline}
        redirectToAuthSpa={(
          redirectTo = undefined,
          platformKey = undefined,
          logout = false,
          saveRedirect = true,
        ) => {
          // Don't redirect to auth when in Tauri offline mode
          /* istanbul ignore next -- @preserve Tauri offline guard unreachable: component returns early at L223 */
          if (isTauriOffline) {
            console.log(
              '[Providers] Skipping auth redirect - Tauri offline mode',
            );
            return;
          }
          redirectToAuthSpa(redirectTo, platformKey, logout, saveRedirect);
        }}
        username={username || ''}
        middleware={middleware}
        pathname={fullPathname}
        token={searchParams.get('token') ?? undefined}
        storageService={LocalStorageService.getInstance()}
        enableStorageSync={
          !showingSharedChat && !isTauriOffline && !searchParams.get('token')
        }
        fallback={
          isPreviewMode ? null : (
            <div className="flex h-dvh w-screen items-center justify-center">
              <div className="space-y-3">
                <Spinner />
              </div>
            </div>
          )
        }
      >
        <TenantProvider
          skip={isSsoLoginRoute || isVersionRoute || isTauriOffline}
          isIframed={isInIframe()}
          currentTenant={tenantKey || ''}
          requestedTenant={tenantKeyParams || ''}
          saveCurrentTenant={saveCurrentTenant}
          saveUserTenants={saveUserTenants}
          handleTenantSwitch={async (
            tenant: string,
            saveRedirect: boolean,
            useCurrentDomain = true,
          ) => {
            console.log('[TenantProvider] handling tenant switching');
            if (!showingSharedChat)
              await handleTenantSwitch(
                tenant,
                saveRedirect,
                !useCurrentDomain ? config.mentorUrl() : undefined,
              );
          }}
          saveVisitingTenant={saveVisitingTenant}
          removeVisitingTenant={removeVisitingTenant}
          saveUserTokens={saveUserTokens}
          saveTenant={saveTenant}
          username={username}
          fallback={
            isPreviewMode || isTauriOffline ? null : (
              <div className="flex h-dvh w-screen items-center justify-center">
                <div className="space-y-3">
                  <Spinner />
                </div>
              </div>
            )
          }
          redirectToAuthSpa={(
            redirectTo,
            platformKey,
            logout,
            saveRedirect,
          ) => {
            // Don't redirect to auth when in Tauri offline mode
            /* istanbul ignore next -- @preserve Tauri offline guard unreachable: component returns early at L223 */
            if (isTauriOffline) {
              console.log(
                '[Providers] Skipping TenantProvider auth redirect - Tauri offline mode',
              );
              return;
            }
            redirectToAuthSpa(redirectTo, platformKey, logout, saveRedirect);
          }}
          onAuthFailure={(reason) => {
            console.error('[TenantProvider] Auth failure:', reason);
            router.push('/error/403');
          }}
          setUseMentorProvider={setUseMentorProvider}
          onLoadPlatformPermissions={onLoadPlatformpermissions}
          skipCustomDomainCheck={window.location.origin === config.mentorUrl()}
          onTenantMismatch={() => {
            console.log(
              '[TenantProvider] Tenant mismatch - redirecting to home',
            );
            window.location.href = '/';
          }}
        >
          {useMentorProvider ? (
            <MentorProvider
              skip={isSsoLoginRoute || isVersionRoute || isTauriOffline}
              redirectToAuthSpa={() => {
                // Don't redirect to auth when in Tauri offline mode
                /* istanbul ignore next -- @preserve Tauri offline guard unreachable: component returns early at L223 */
                if (isTauriOffline) {
                  console.log(
                    '[Providers] Skipping MentorProvider auth redirect - Tauri offline mode',
                  );
                  return;
                }
                redirectToAuthSpa();
              }}
              username={username || ANONYMOUS_USERNAME}
              isAdmin={isAdmin}
              mainTenantKey={config.mainTenantKey()}
              redirectToNoMentorsPage={() => {
                // Don't redirect when in Tauri offline mode
                /* istanbul ignore next -- @preserve Tauri offline guard unreachable: component returns early at L223 */
                if (isTauriOffline) return;
                if (isWorkflowPage) return;
                if (!embed) redirectToNoMentorsPage();
              }}
              redirectToCreateMentor={() => {
                // Don't redirect when in Tauri offline mode
                /* istanbul ignore next -- @preserve Tauri offline guard unreachable: component returns early at L223 */
                if (isTauriOffline) return;
                if (isWorkflowPage) return;
                redirectToCreateMentor();
              }}
              redirectToMentor={(tKey: string, mId: string) => {
                // Don't redirect when in Tauri offline mode
                /* istanbul ignore next -- @preserve Tauri offline guard unreachable: component returns early at L223 */
                if (isTauriOffline) return;
                if (isWorkflowPage) return;
                redirectToMentor(tKey, mId);
              }}
              onLoadMentorsPermissions={onLoadMentorsPermissions}
              requestedMentorId={isWorkflowPage ? undefined : mentorId}
              onAuthSuccess={() =>
                sendMessageToParentWebsite({
                  loaded: true,
                  auth: { ...localStorage },
                })
              }
              fallback={
                isPreviewMode || isTauriOffline ? null : (
                  <div className="flex h-dvh w-screen items-center justify-center">
                    <div className="space-y-3">
                      <Spinner />
                    </div>
                  </div>
                )
              }
              handleMentorNotFound={async () => {
                // Don't show mentor not found when in Tauri offline mode
                /* istanbul ignore next -- @preserve Tauri offline guard unreachable: component returns early at L223 */
                if (isTauriOffline) {
                  console.log(
                    '[Providers] Skipping mentor not found - Tauri offline mode',
                  );
                  return;
                }
                if (isWorkflowPage) return;
                await handleMentorNotFound();
              }}
              onComplete={() => {
                // Hide initial loader when mentor provider is ready
                hideInitialLoader();

                if (switchingMentor === 'true') {
                  const params = new URLSearchParams(searchParams);
                  params.delete('switching-mentor');

                  router.replace(`?${params.toString()}`);

                  setTimeout(() => {
                    toast.success('Agent switched successfully');
                  }, 1000);
                }
              }}
            >
              <AppProvider>
                {tenantAdvancedCSS && <style>{tenantAdvancedCSS}</style>}
                {defaultEmbedCSS && (
                  <style
                    dangerouslySetInnerHTML={{
                      __html: `@import url(${defaultEmbedCSS});`,
                    }}
                  ></style>
                )}
                {externalCSS && <style>{externalCSS}</style>}
                {externalJS && (
                  <Script id="mentor-custom-js" strategy="afterInteractive">
                    {externalJS}
                  </Script>
                )}
                {children}
              </AppProvider>
            </MentorProvider>
          ) : (
            <>{children}</>
          )}
        </TenantProvider>
      </AuthProvider>
    </>
  );
}
