'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Spinner } from '@/components/spinner';
import { useLazyConnectedServicesCallbackQuery } from '@iblai/iblai-js/data-layer';
import { toast } from 'sonner';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { hideInitialLoader } from '@/lib/initial-loader';

// Type for OAuth completion data stored in localStorage
interface OAuthCompletionData {
  timestamp: number;
  service: string;
  provider?: string;
  serviceName?: string;
  connectedServiceId?: number;
  connectedServiceData?: unknown;
  serverId?: number;
}

// Type for pending OAuth server data
interface PendingOAuthServer {
  serverId: number;
  provider: string;
  service: string;
  timestamp: number;
}

export default function OAuthCallbackPage() {
  const searchParams = useSearchParams();
  const [callbackTriggered, setCallbackTriggered] = useState(false);

  useEffect(() => {
    hideInitialLoader();
  }, []);
  const [connectedServicesCallback] = useLazyConnectedServicesCallbackQuery();

  // Use the common localStorage hook for managing OAuth completion state
  const [, setOAuthComplete] = useLocalStorage<OAuthCompletionData | null>(
    'oauth_connection_complete',
    null,
  );

  // Use localStorage hook to read pending OAuth server (set by connector-management-content.tsx)
  const [pendingOAuthServer] = useLocalStorage<PendingOAuthServer | null>(
    'oauth_pending_server',
    null,
  );

  useEffect(() => {
    if (callbackTriggered) return;

    const handleCallback = async () => {
      // Get all search params from the URL
      const params: Record<string, string> = {};
      searchParams.forEach((value, key) => {
        params[key] = value;
      });

      params.redirect_uri = `${window.location.origin}/google-oauth-callback/`;

      try {
        setCallbackTriggered(true);

        // Call the connected services callback endpoint with all params
        const result = await connectedServicesCallback(params).unwrap();

        toast.success('Successfully connected service');

        // Extract service info from response
        const serviceName =
          result?.service_info?.display_name || result?.service || 'service';
        const connectedServiceId = result?.id;
        const toolName = params.tool_name;

        // Check if this is an MCP OAuth flow by looking for pending server in localStorage
        // If oauth_pending_server exists, connector-management-content.tsx initiated this flow
        const isMCPFlow = !!pendingOAuthServer;
        const serverId = pendingOAuthServer?.serverId;

        if (window.opener) {
          window.opener.postMessage(
            {
              type: 'GOOGLE_AUTH_SUCCESS',
              // For outside-buttons.tsx (Google Docs/Slides)
              service: toolName || serviceName,
              // For connector-management-content.tsx (MCP OAuth)
              data: result,
              connectedServiceId,
              serverId,
              provider: result?.provider,
              serviceName: result?.service,
            },
            window.location.origin,
          );
        }

        // If this is an MCP flow, also notify via localStorage for cross-tab communication
        if (isMCPFlow) {
          setOAuthComplete({
            timestamp: Date.now(),
            service: serviceName,
            provider: result?.provider,
            serviceName: result?.service,
            connectedServiceId,
            connectedServiceData: result,
            serverId,
          });
        }

        // Close the window
        setTimeout(() => {
          window.close();
        }, 1000);
      } catch (error: unknown) {
        console.error('Failed to complete OAuth callback:', error);
        const err = error as {
          data?: { detail?: string; error?: string };
          message?: string;
        };
        const errorMessage =
          err?.data?.detail ||
          err?.data?.error ||
          err?.message ||
          'Failed to connect service';
        toast.error(errorMessage);
        setTimeout(() => {
          window.close();
        }, 3000);
      }
    };

    handleCallback();
  }, [
    searchParams,
    callbackTriggered,
    connectedServicesCallback,
    setOAuthComplete,
    pendingOAuthServer,
  ]);

  return (
    <div className="flex h-dvh w-screen items-center justify-center">
      <div className="space-y-3">
        <Spinner />
      </div>
    </div>
  );
}
