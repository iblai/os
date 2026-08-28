import { useCallback } from 'react';

import { useAppDispatch } from './hooks';
import { getAuthItem, setAuthItem } from '@iblai/iblai-js/web-utils';
import {
  darkModeUpdated,
  // iframeCloseButtonEnabled,
} from '@/features/navigation/slice';
import { chatActions } from '@iblai/iblai-js/web-utils';
import {
  enableChatActionsPopup,
  setAutoplayLastAiMessage,
} from '@/features/chat/chatSlice';
import eventBus, { RemoteEvents } from './eventBus';

export function useIframeHandlers() {
  const dispatch = useAppDispatch();
  const tenantKey = 'use-iframe-handlers';

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

  const handleCssInjection = (css: string) => {
    const style = document.createElement('style');
    style.innerText = css;
    document.head.appendChild(style);
  };

  const handleFocusPrompt = useCallback(() => {
    document.getElementById('user-prompt')?.focus();
  }, []);

  const handleTokenMessage = (tokenData: string) => {
    console.log('[useIframeHandlers] tokenData', tokenData);
    try {
      tokenData = JSON.parse(tokenData);
    } catch (error) {
      console.error('Error parsing token data:', error);
      console.error(JSON.stringify({ tenant: tenantKey, error }));
    }
    Object.entries(tokenData).forEach(([key, value]) => {
      setAuthItem(key, value as string);
    });

    if (!getAuthItem('current_tenant')) {
      const tenants = JSON.parse(getAuthItem('tenants') || '[]');
      const tenant = getAuthItem('tenant');
      const selectedTenant = tenants.find((t: any) => t.key === tenant);
      setAuthItem('current_tenant', JSON.stringify(selectedTenant));
      setAuthItem('tenants', JSON.stringify(tenants));
    }
    window.location.reload();
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
