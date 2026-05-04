import { useCallback } from 'react';

import { useAppDispatch } from './hooks';
import {
  darkModeUpdated,
  // iframeCloseButtonEnabled,
} from '@/features/navigation/slice';
import { chatActions } from '@iblai/iblai-js/web-utils';
import { enableChatActionsPopup } from '@/features/chat/chatSlice';
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
      localStorage.setItem(key, value as string);
    });

    if (!localStorage.getItem('current_tenant')) {
      const tenants = JSON.parse(localStorage.getItem('tenants') || '[]');
      const tenant = localStorage.getItem('tenant');
      const selectedTenant = tenants.find((t: any) => t.key === tenant);
      localStorage.setItem('current_tenant', JSON.stringify(selectedTenant));
      localStorage.setItem('tenants', JSON.stringify(tenants));
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
    // Document filter hanlder
    'MENTOR:DOCUMENTFILTER': (_payload: unknown, event: MessageEvent) => {
      try {
        const documentFilter = JSON.parse(event.data);
        dispatch(chatActions.setDocumentFilter(documentFilter));
      } catch (e) {
        console.error('MENTOR:DOCUMENTFILTER ', e);
        console.error(JSON.stringify({ tenant: tenantKey, error: e }));
      }
    },
    // EDX integration handlers
    'MENTOR:EDX_USAGE_ID': (payload: { edxUsageId: string }) => {
      console.log('EDX Usage ID updated:', payload.edxUsageId);
      dispatch(
        chatActions.setIframeContext({
          metadata: { edxUsageId: payload.edxUsageId },
        }),
      );
    },

    'MENTOR:EDX_COURSE_ID': (payload: { edxCourseId: string }) => {
      console.log('EDX Course ID updated:', payload.edxCourseId);
      dispatch(
        chatActions.setIframeContext({
          metadata: { edxCourseId: payload.edxCourseId },
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
  };

  return handlers;
}
