import { useCallback, useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';

import { toast } from 'sonner';

import {
  useAddTrainingDocumentMutation,
  useLazyGetCredentialsQuery,
} from '@iblai/iblai-js/data-layer';
import { useUsername } from './use-user';
import { TenantKeyMentorIdParams } from '@/lib/types';
import { extractErrorMessage } from '@/components/modals/edit-mentor-modal/tabs/datasets-tab/resource-modal/utils';

// OneDrive SDK URL
const ONEDRIVE_SDK_URL = 'https://js.live.net/v7.2/OneDrive.js';

const useOneDrivePicker = () => {
  const [onedriveAppId, setOnedriveAppId] = useState(null);
  const [fullDomain, setFullDomain] = useState<null | string>(null);
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);

  // Use RTK Query hooks
  const [getCredentials] = useLazyGetCredentialsQuery();
  const [addTrainingDocument] = useAddTrainingDocumentMutation();

  const username = useUsername();
  const { tenantKey, mentorId } = useParams<TenantKeyMentorIdParams>();

  const hasFetchedCredentials = useRef(false);
  const sdkLoadingStarted = useRef(false);

  // Load OneDrive SDK
  useEffect(() => {
    const loadOneDriveSDK = () => {
      if (!sdkLoadingStarted.current && !isSDKLoaded && !window.OneDrive) {
        sdkLoadingStarted.current = true;

        const script = document.createElement('script');
        script.src = ONEDRIVE_SDK_URL;
        script.async = true;
        script.onload = () => {
          setIsSDKLoaded(true);
        };
        script.onerror = () => {
          toast.error('Failed to load OneDrive SDK');
          sdkLoadingStarted.current = false;
        };

        document.body.appendChild(script);
      } else if (window.OneDrive) {
        setIsSDKLoaded(true);
      }
    };

    loadOneDriveSDK();
  }, [isSDKLoaded]);

  // Handle OAuth callback and postMessage events
  useEffect(() => {
    // Handle OAuth callback when page loads with oauth parameters
    const handleOAuthCallback = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const oauthParam = urlParams.get('oauth');

      if (oauthParam) {
        try {
          // Parse the OAuth data
          const oauthData = JSON.parse(decodeURIComponent(oauthParam));
          console.log('OAuth callback data:', oauthData);

          // Send message to parent window if opened in popup
          if (window.opener) {
            window.opener.postMessage(
              {
                type: 'onedrive-oauth-callback',
                data: oauthData,
              },
              oauthData.origin,
            );
            window.close();
          } else {
            // If not in popup, clean up URL
            window.history.replaceState(
              {},
              document.title,
              window.location.pathname,
            );
          }
        } catch (error) {
          console.error('Error parsing OAuth data:', error);
          console.error(JSON.stringify({ tenant: tenantKey, error }));
          toast.error('Error processing OneDrive authentication');
        }
      }
    };

    // Handle postMessage events from OneDrive picker
    const handleMessage = (event) => {
      if (!event.data) return;

      let messageData = event.data;

      // Handle string messages
      if (typeof messageData === 'string') {
        // Check if it contains indexOf before calling it
        if (messageData.indexOf && messageData.indexOf('onedrive') !== -1) {
          try {
            messageData = JSON.parse(messageData);
          } catch (e) {
            console.log('Non-JSON string message:', messageData);
            console.error(JSON.stringify({ tenant: tenantKey, error: e }));
            return;
          }
        } else {
          return;
        }
      }

      // Handle OneDrive picker messages
      if (messageData.type === 'onedrive-oauth-callback') {
        console.log('Received OAuth callback message:', messageData);
        // The OAuth flow is complete, picker should work now
      }
    };

    // Run OAuth callback handler on mount
    handleOAuthCallback();

    // Listen for postMessage events
    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  // Fetch OneDrive credentials
  useEffect(() => {
    const handleFetchAppId = async () => {
      if (!hasFetchedCredentials.current) {
        hasFetchedCredentials.current = true;
        try {
          const data = await getCredentials({
            org: tenantKey,
            name: 'onedrive',
            learner_id: username,
          }).unwrap();
          if (data?.length > 0) {
            setOnedriveAppId(data[0].value.appId);
          }
        } catch (error) {
          console.error(JSON.stringify({ tenant: tenantKey, error }));
        }
      }
    };

    handleFetchAppId();
  }, [getCredentials, tenantKey]);

  const getFullDomain = () => {
    if (fullDomain !== null) {
      return fullDomain;
    }

    const currentUrl = window.location.origin;
    const uploadUrl = `${currentUrl}/uploads`;
    setFullDomain(uploadUrl);

    return uploadUrl;
  };

  const handleSuccessOnedrive = async (files) => {
    if (!mentorId) {
      toast.error('Agent not found');
      return;
    }

    const trainPayload = {
      pathway: mentorId,
      url: files.value.map((e) => e['@microsoft.graph.downloadUrl']).join(','),
      type: 'onedrive',
      access: 'private',
    };

    try {
      await addTrainingDocument({
        org: tenantKey,
        // @ts-expect-error - userId parameter may not exist in API but is passed from legacy code
        userId: username ?? '',
        formData: trainPayload,
      }).unwrap();

      toast.success('Document has been queued for training');
    } catch (error: unknown) {
      console.error(JSON.stringify(error));
      const errorMessage = extractErrorMessage(
        error,
        'Error adding training document',
      );

      toast.error(errorMessage);
      console.error(JSON.stringify({ tenant: tenantKey, error }));
    }
  };

  const pickOneDriveFile = useCallback(() => {
    if (!onedriveAppId) {
      toast.error('OneDrive credentials are not loaded yet');
      return;
    }

    if (!isSDKLoaded || !window.OneDrive) {
      toast.error('OneDrive SDK not loaded yet');
      return;
    }

    try {
      const odOptions = {
        clientId: onedriveAppId,
        action: 'download', // Changed from 'download' to 'query' for file picking
        multiSelect: true,
        openInNewWindow: true,
        // Remove openInNewWindow to use iframe instead of popup
        advanced: {
          redirectUri: getFullDomain(),
          // only show folders, images, word files, powerpoint files, excel files, txt, PDF, csv, HTML, XML
          filter:
            'folder,photo,.docx,.doc,.txt,.pdf,.csv,.ppt,.pptx,.xls,.xlsx,.html,.htm,.xml',
        },
        success: handleSuccessOnedrive,
        cancel: function () {
          console.log('OneDrive picker cancelled');
        },
        error: function (e) {
          console.error('OneDrive picker error:', e);
          toast.error('Error selecting files from OneDrive');
        },
      };

      window.OneDrive.open(odOptions);
    } catch (error) {
      console.error('Failed to open OneDrive picker:', error);
      toast.error('Failed to open OneDrive picker');
      console.error(JSON.stringify({ tenant: tenantKey, error }));
    }
  }, [
    onedriveAppId,
    isSDKLoaded,
    tenantKey,
    username,
    addTrainingDocument,
    mentorId,
    handleSuccessOnedrive,
    getFullDomain,
  ]);

  return {
    pickOneDriveFile,
    onedriveAppId,
    isSDKLoaded,
  };
};

export default useOneDrivePicker;
