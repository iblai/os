'use client';

import { getUserId, getUserName } from '@/features/utils';
import { updateSessionId } from '@/lib/features/app/app-slice';
import { useIframeHandlers } from '@/lib/handlers';
import { useAppDispatch } from '@/lib/hooks';
import { saveUserObjectToLocalStorage, sendMessageToParentWebsite } from '@/lib/utils';
import {
  useLazyGetPinnedMessagesQuery,
  useLazyGetRecentMessageQuery,
  useLazyGetVectorDocumentsQuery,
} from '@iblai/iblai-js/data-layer';
import { useIframeMessageHandler } from '@iblai/iblai-js/web-containers';
import { useParams } from 'next/navigation';
import { useEffect } from 'react';
import { MessageBridgeProvider } from './message-bridge-provider';

export default function AppProvider({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const [getVectorDocuments] = useLazyGetVectorDocumentsQuery();
  const [getRecentMessages] = useLazyGetRecentMessageQuery();
  const [getPinnedMessages] = useLazyGetPinnedMessagesQuery();
  const params = useParams<{ tenantKey: string }>();

  useEffect(() => {
    sendMessageToParentWebsite({ ready: true });
  }, []);

  const handlers = useIframeHandlers();

  useIframeMessageHandler({
    handlers: {
      'MENTOR:RESPONDED': async (event: MessageEvent) => {
        const { value } = event.data;
        dispatch(updateSessionId(value.sessionId));
        const tenantKey = params.tenantKey;
        await getVectorDocuments({
          org: tenantKey,
          sessionId: value.sessionId,
          // @ts-expect-error userId is part of the useLazyGetVectorDocumentsQuery Query definition
          userId: getUserId(),
        });
        await getRecentMessages({
          org: tenantKey,
          // @ts-expect-error userId is part of the useLazyGetRecentMessageQuery Query definition
          userId: getUserName(),
        });
        await getPinnedMessages({
          org: tenantKey,
          sessionId: value.sessionId,
          // @ts-expect-error userId is part of the useLazyGetPinnedMessagesQuery Query definition
          userId: getUserName(),
        });
      },
      ...handlers,
    },
    defaultHandler: (data) => {
      if (data.axd_token) {
        saveUserObjectToLocalStorage(data);
        window.location.reload();
      }
    },
  });

  return <MessageBridgeProvider>{children}</MessageBridgeProvider>;
}
