'use client';

import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { isTauriApp } from '@/types/tauri';

export interface OAuthResult {
  url: string;
  code?: string;
  token?: string;
  error?: string;
}

/**
 * Hook to handle OAuth authentication in Tauri mobile apps
 * Opens OAuth URLs in native browser modal (ASWebAuthenticationSession on iOS,
 * Chrome Custom Tabs on Android) instead of navigating the entire app
 */
export function useOAuth() {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Start OAuth flow by opening URL in system browser
   * Polls for callback result and returns parsed OAuth data
   */
  const authenticate = useCallback(
    async (
      oauthUrl: string,
      timeoutMs = 60000,
    ): Promise<OAuthResult | null> => {
      if (!isTauriApp()) {
        throw new Error('OAuth is only supported in Tauri mobile apps');
      }

      setIsAuthenticating(true);
      setError(null);

      try {
        // Start OAuth flow - opens URL in native browser modal
        await invoke('oauth_start', { url: oauthUrl });

        // Poll for result
        const startTime = Date.now();
        const pollInterval = 500; // Poll every 500ms

        while (Date.now() - startTime < timeoutMs) {
          await new Promise((resolve) => setTimeout(resolve, pollInterval));

          const callbackUrl = await invoke<string | null>('oauth_get_result');

          if (callbackUrl) {
            // Parse the callback URL
            const result = parseOAuthCallback(callbackUrl);
            setIsAuthenticating(false);
            return result;
          }
        }

        // Timeout reached
        setError('Authentication timeout');
        setIsAuthenticating(false);
        return null;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        setIsAuthenticating(false);
        throw err;
      }
    },
    [],
  );

  return {
    authenticate,
    isAuthenticating,
    error,
  };
}

/**
 * Parse OAuth callback URL to extract code, token, or error
 */
function parseOAuthCallback(url: string): OAuthResult {
  const urlObj = new URL(url);
  const params = new URLSearchParams(urlObj.search);
  const hashParams = new URLSearchParams(urlObj.hash.replace(/^#/, ''));

  const result: OAuthResult = { url };

  // Check for authorization code (query param)
  const code = params.get('code');
  if (code) {
    result.code = code;
  }

  // Check for access token (usually in hash fragment)
  const token = hashParams.get('access_token') || params.get('token');
  if (token) {
    result.token = token;
  }

  // Check for error
  const error = params.get('error') || hashParams.get('error');
  if (error) {
    result.error = error;
  }

  return result;
}
