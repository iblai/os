import { useCallback, useEffect } from 'react';

import { useAppDispatch, useAppSelector } from './hooks';
import { getAuthItem, setAuthItem } from '@/lib/auth-storage';
import {
  darkModeUpdated,
  // iframeCloseButtonEnabled,
} from '@/features/navigation/slice';
import {
  chatActions,
  selectLessonCompletion,
  AUTH_TOKENS_UPDATED_EVENT,
} from '@iblai/iblai-js/web-utils';
import {
  sendMessageToParentWebsite,
  saveUserObjectToLocalStorage,
} from './utils';
import { clearAuthRecovery } from './auth-recovery-lock';
import {
  enableChatActionsPopup,
  setAutoplayLastAiMessage,
} from '@/features/chat/chatSlice';
import eventBus, { RemoteEvents } from './eventBus';

export function useIframeHandlers() {
  const dispatch = useAppDispatch();
  const tenantKey = 'use-iframe-handlers';

  // Outbound counterpart to the handlers below. `useChat` parks each
  // `lesson.completed` frame on the chat slice rather than reaching for the
  // window itself; this relays it to the host page (the LMS courseware, which
  // refreshes its outline and offers the next unit) and clears it so a repeat
  // completion of the same lesson still reads as a new event.
  const lessonCompletion = useAppSelector(selectLessonCompletion);
  useEffect(() => {
    if (!lessonCompletion) return;
    sendMessageToParentWebsite(lessonCompletion);
    dispatch(chatActions.setLessonCompletion(null));
  }, [lessonCompletion, dispatch]);

  const handleThemePostMessage = (theme: string) => {
    const bodyEl = document.body;
    if (theme === 'dark') {
      bodyEl.classList.add('dark-mode');
      dispatch(darkModeUpdated(true));
    } else {
      bodyEl.classList.remove('dark-mode');
      dispatch(darkModeUpdated(false));
    }
  };

  // Host stylesheets arrive more than once by design: a `MENTOR:CSS_INJECT`
  // that lands before this handler is live is lost, there is no ack, and so
  // every embedder pushes its sheet on a burst — and again whenever this app
  // re-announces itself. Appending a fresh <style> per message meant a themed
  // embed accumulated dozens of copies of the same sheet. When that sheet
  // opens with universal selectors (`*,::before,::after{...!important}`),
  // every style recalculation in the frame pays for all of them, and the
  // composer forces a synchronous recalc + layout on each keystroke
  // (height:auto, then read scrollHeight) — so typing lagged in the embed
  // while the same chat on os.ibl.ai, which is handed no host CSS, stayed
  // instant.
  //
  // Keyed by the CSS itself rather than by one fixed element: a host may send
  // several genuinely different sheets (base theme, chromeless chrome, focus
  // mode), each of which still gets its own <style>. A repeat is a no-op.
  const cssKey = (css: string): string => {
    let hash = 5381;
    for (let i = 0; i < css.length; i++) {
      hash = ((hash * 33) ^ css.charCodeAt(i)) >>> 0;
    }
    return `${css.length}-${hash.toString(36)}`;
  };

  const handleCssInjection = (css: string) => {
    // `css` comes straight off an untrusted postMessage payload, so it can be
    // absent. Assigning `undefined` to innerText used to be a harmless no-op;
    // hashing it is not, so the guard has to be here rather than implied.
    // An empty string is NOT excluded — it hashes fine and callers rely on it
    // still producing a stylesheet.
    if (typeof css !== 'string') return;
    const key = cssKey(css);
    if (document.head.querySelector(`style[data-host-css="${key}"]`)) return;
    const style = document.createElement('style');
    style.setAttribute('data-host-css', key);
    style.innerText = css;
    document.head.appendChild(style);
  };

  const handleFocusPrompt = useCallback(() => {
    document.getElementById('user-prompt')?.focus();
  }, []);

  const handleTokenMessage = (tokenData: string) => {
    console.log('[useIframeHandlers] tokenData', tokenData);
    let payload: Record<string, any>;
    try {
      payload = JSON.parse(tokenData);
    } catch (error) {
      console.error('Error parsing token data:', error);
      console.error(JSON.stringify({ tenant: tenantKey, error }));
      return;
    }

    // The host re-sends its auth every time we announce ourselves
    // (`ready`/`loaded`). Acting on an identical payload re-runs the auth check
    // for nothing (and used to re-trigger the reload loop). Only act on a real
    // change.
    const unchanged =
      getAuthItem('axd_token') === payload.axd_token &&
      getAuthItem('dm_token') === payload.dm_token &&
      getAuthItem('tenant') === payload.tenant;
    if (unchanged) return;

    // New tokens installed — release the recovery lock so a later 401 can recover.
    clearAuthRecovery();

    // Save reactively: saveUserObjectToLocalStorage dispatches `local-storage`
    // events per key, which the reactive auth hooks (useUsername, useUserData,
    // useCurrentTenant) listen for — so the UI flips to the new auth in place.
    saveUserObjectToLocalStorage(payload);

    // saveUserObjectToLocalStorage clears storage first, so re-derive the
    // current tenant when the payload didn't carry one.
    if (!getAuthItem('current_tenant')) {
      const tenants = JSON.parse(getAuthItem('tenants') || '[]');
      const tenant = getAuthItem('tenant');
      const selectedTenant = tenants.find((t: any) => t.key === tenant);
      setAuthItem('current_tenant', JSON.stringify(selectedTenant));
      window.dispatchEvent(
        new StorageEvent('local-storage', { key: 'current_tenant' }),
      );
    }

    // Re-run the auth check IN PLACE instead of a full page reload (which
    // re-downloaded every asset — the embed-widget startup delay). Mirrors the
    // agent-ai default handler in providers/index.tsx: the browser's `storage`
    // event only fires in OTHER windows, and a token refresh often leaves
    // `username` unchanged, so the AuthProvider's username-keyed check would
    // not otherwise re-run. The data layer reads tokens per-request, so new
    // requests pick up the new tokens with no reload.
    window.dispatchEvent(new Event(AUTH_TOKENS_UPDATED_EVENT));
  };

  const handlers = {
    // Theme change handler
    'MENTOR:THEME_CHANGE': (payload: { theme: string }) => {
      handleThemePostMessage(payload.theme);
    },

    // CSS injection handler
    'MENTOR:CSS_INJECT': (_payload: unknown, event: MessageEvent) => {
      const { css } = event.data;
      handleCssInjection(css);
    },

    // Focus prompt handler
    'MENTOR:PROMPT_FOCUS': () => {
      handleFocusPrompt();
    },

    // Token authentication handler
    'MENTOR:AUTH_UPDATE': (_payload: unknown, event: MessageEvent) => {
      const { authData } = event.data;
      handleTokenMessage(authData);
    },

    // Context/page content handler
    'MENTOR:CONTEXT_UPDATE': (_payload: unknown, event: MessageEvent) => {
      const { hostInfo, pageContent, metadata } = event.data;

      dispatch(
        chatActions.setIframeContext({
          hostInfo,
          pageContent,
          metadata,
        }),
      );
    },
    'MENTOR:ENABLE_GRADING': (_payload: unknown, event: MessageEvent) => {
      const payload = event.data.data;
      dispatch(chatActions.setEnableGrading(payload));
    },
    'MENTOR:ENABLE_LESSON_COMPLETION': (
      _payload: unknown,
      event: MessageEvent,
    ) => {
      const payload = event.data.data;
      dispatch(chatActions.setEnableLessonCompletion(payload));
    },
    // Document filter hanlder
    'MENTOR:DOCUMENTFILTER': (_payload: unknown, event: MessageEvent) => {
      try {
        const documentFilter = JSON.parse(event.data.data);
        dispatch(chatActions.setDocumentFilter(documentFilter));
      } catch (e) {
        console.error('MENTOR:DOCUMENTFILTER ', e);
        console.error(JSON.stringify({ tenant: tenantKey, error: e }));
      }
    },
    // EDX integration handlers
    'MENTOR:EDX_USAGE_ID': (_payload: unknown, event: MessageEvent) => {
      const { edxUsageId } = event.data.data;
      console.log('EDX Usage ID updated:', edxUsageId);
      dispatch(chatActions.setMetadata({ edxUsageId }));
    },
    'MENTOR:EDX_COURSE_ID': (_payload: unknown, event: MessageEvent) => {
      const { edxCourseId } = event.data.data;
      console.log('EDX Course ID updated:', edxCourseId);
      dispatch(
        chatActions.setMetadata({
          edxCourseId,
        }),
      );
    },
    // Names the lesson block for the lesson-completion payload.
    'MENTOR:EDX_DISPLAY_NAME': (_payload: unknown, event: MessageEvent) => {
      const { edxDisplayName } = event.data.data;
      console.log('EDX Display Name updated:', edxDisplayName);
      dispatch(chatActions.setMetadata({ displayName: edxDisplayName }));
    },

    // Safety disclaimer handler
    'MENTOR:METADATA_SAFETY': (payload: { safety_disclaimer: boolean }) => {
      console.log('Safety disclaimer updated:', payload.safety_disclaimer);
    },

    // Enable close button handler
    'MENTOR:IFRAME_CLOSE_BUTTON': (payload: { enableCloseButton: boolean }) => {
      console.log('Close button enabled:', payload.enableCloseButton);
    },

    // Internal preview handler for mentor settings
    'MENTOR:MENTOR_PREVIEW': (payload: {
      defaultPrompt?: string;
      welcomeMessage?: string;
    }) => {
      const previewMentor = localStorage.getItem('previewMentorData');
      if (previewMentor) {
        try {
          const mentorData = JSON.parse(previewMentor);
          const updatedMentor = {
            ...mentorData,
            settings: {
              ...mentorData?.settings,
              suggested_message: payload.defaultPrompt,
              initial_message: payload.welcomeMessage,
            },
          };
          localStorage.setItem(
            'previewMentorData',
            JSON.stringify(updatedMentor),
          );
        } catch (error) {
          console.error(JSON.stringify({ tenant: tenantKey, error }));
        }
      }
    },
    'MENTOR:ENABLE_CHAT_ACTION_POPUPS': (payload: { enable: boolean }) => {
      dispatch(enableChatActionsPopup(payload.enable));
    },
    'MENTOR:CHAT_ACTION_ADD_MESSAGE': (
      _payload: unknown,
      event: MessageEvent,
    ) => {
      const { message } = event.data;
      eventBus.emit(RemoteEvents.sendChatMessage, {
        content: message,
        visible: false,
      });
    },
    'MENTOR:NEW_CHAT': () => {
      eventBus.emit(RemoteEvents.newChat);
    },
    'MENTOR:ENABLE_AUTOPLAY_LAST_AI_MESSAGE': () => {
      dispatch(setAutoplayLastAiMessage(true));
      //eventBus.emit(RemoteEvents.enableAutoplayLastAiMessage);
    },
    'MENTOR:DISABLE_AUTOPLAY_LAST_AI_MESSAGE': () => {
      dispatch(setAutoplayLastAiMessage(false));
      //eventBus.emit(RemoteEvents.disableAutoplayLastAiMessage);
    },
  };

  return handlers;
}
