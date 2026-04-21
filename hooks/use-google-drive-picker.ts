import React from 'react';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import GoogleDrivePicker from 'google-drive-picker';
import {
  useAddTrainingDocumentMutation,
  useLazyGetCredentialsQuery,
} from '@iblai/iblai-js/data-layer';
import { useUsername } from './use-user';
import { TenantKeyMentorIdParams } from '@/lib/types';
import { extractErrorMessage } from '@/components/modals/edit-mentor-modal/tabs/datasets-tab/resource-modal/utils';

declare global {
  interface Window {
    gapi: any;
  }
}

const useGoogleDrivePicker = () => {
  const [authToken, setAuthToken] = React.useState<any>(null);
  const [driveFiles, setDriveFiles] = React.useState<any[]>([]);
  const [openPicker, authRes] = GoogleDrivePicker();

  const [getCredentials] = useLazyGetCredentialsQuery();
  const [addTrainingDocument] = useAddTrainingDocumentMutation();

  const [credentialLoaded, setCredentialsLoaded] = React.useState(false);
  const [isPickerLoaded, setIsPickerLoaded] = React.useState(false);

  const username = useUsername();
  const { tenantKey, mentorId } = useParams<TenantKeyMentorIdParams>();

  const [credentials, setCredentials] = React.useState({
    client_id: '',
    developer_key: '',
    client_secret: '',
  });

  const [pickerError, setPickerError] = React.useState<string | null>(null);

  // Fetch credentials on mount
  React.useEffect(() => {
    const fetchCredentials = async () => {
      try {
        const credentials = await getCredentials({
          org: tenantKey,
          name: 'drive',
          learner_id: username,
        }).unwrap();
        if (
          credentials &&
          Array.isArray(credentials) &&
          credentials.length > 0
        ) {
          setCredentials(credentials[0].value);
        }
      } catch (error) {
        console.error(JSON.stringify({ tenant: tenantKey, error }));
      }
      setCredentialsLoaded(true);
    };

    if (!credentialLoaded) {
      fetchCredentials();
    }
  }, [credentialLoaded, getCredentials, tenantKey]);

  // Check if Google API is already loaded
  React.useEffect(() => {
    const checkGoogleApiLoaded = () => {
      if (window.gapi) {
        window.gapi.load('auth2:picker', () => {
          setIsPickerLoaded(true);
        });
      } else {
        // Retry after a short delay if gapi is not available yet
        setTimeout(checkGoogleApiLoaded, 100);
      }
    };

    if (!isPickerLoaded) {
      checkGoogleApiLoaded();
    }
  }, [isPickerLoaded]);

  const handlePickerFileSelected = React.useCallback((files: any[]) => {
    setDriveFiles(files);
  }, []);

  React.useEffect(() => {
    const handlePickerFileSelection = async () => {
      if (!mentorId) {
        toast.error('Mentor not found');
        return;
      }

      const trainPayload = {
        pathway: mentorId,
        url: driveFiles.map((file: any) => file.url).join(','),
        type: 'drive',
        access: 'private',
        google_drive_auth_data: {
          auth: {
            client_secret: credentials.client_secret,
            refresh_token: 'test-refresh token',
            client_id: credentials.client_id,
            token: authToken?.access_token,
            scopes: [
              'https://www.googleapis.com/auth/drive.metadata.readonly',
              'https://www.googleapis.com/auth/drive.readonly',
            ],
            token_type: authToken?.token_type,
            expiry_date: new Date(
              Date.now() + (authToken?.expires_in || 0) * 1000,
            ).toISOString(),
          },
          data: driveFiles.map((file: any) => ({
            path: file.url,
            type: file.type,
          })),
        },
      };

      try {
        await addTrainingDocument({
          org: tenantKey,
          // @ts-ignore
          userId: username ?? '',
          formData: trainPayload,
        }).unwrap();

        toast.success('Document has been queued for training');
        setDriveFiles([]); // Clear selected files after successful upload
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

    if (authToken && driveFiles.length > 0) {
      handlePickerFileSelection();
    }
  }, [
    authToken,
    driveFiles,
    credentials,
    addTrainingDocument,
    tenantKey,
    username,
  ]);

  // Force close picker modal
  const forceClosePickerModal = React.useCallback(() => {
    try {
      // Try to close any open Google picker modals
      const pickerIframes = document.querySelectorAll(
        'iframe[src*="docs.google.com/picker"]',
      );
      pickerIframes.forEach((iframe) => {
        const parent = iframe.parentElement;
        if (parent) {
          parent.style.display = 'none';
          // Try to remove the entire picker container
          setTimeout(() => {
            if (parent.parentElement) {
              parent.parentElement.removeChild(parent);
            }
          }, 100);
        }
      });

      // Also try to close picker overlay divs
      const pickerOverlays = document.querySelectorAll(
        'div[role="dialog"][aria-label*="picker"]',
      );
      pickerOverlays.forEach((overlay) => {
        (overlay as HTMLElement).style.display = 'none';
      });

      setPickerError(null);
      toast.success('Google Drive picker closed');
    } catch (error) {
      console.error('Error closing picker modal:', error);
      toast.error('Unable to close picker modal. Please refresh the page.');
      console.error(JSON.stringify({ tenant: tenantKey, error }));
    }
  }, []);

  // Reset and clean up before opening picker
  const resetPickerState = React.useCallback(() => {
    // Clear any existing picker modals/iframes
    const pickerIframes = document.querySelectorAll(
      'iframe[src*="docs.google.com/picker"]',
    );
    pickerIframes.forEach((iframe) => {
      const parent = iframe.parentElement;
      if (parent && parent.parentElement) {
        parent.parentElement.removeChild(parent);
      }
    });

    // Clear picker overlay divs
    const pickerOverlays = document.querySelectorAll(
      'div[role="dialog"][aria-label*="picker"]',
    );
    pickerOverlays.forEach((overlay) => {
      if (overlay.parentElement) {
        overlay.parentElement.removeChild(overlay);
      }
    });

    // Reset states
    setPickerError(null);
    setDriveFiles([]);
    setAuthToken(null);
  }, []);

  // Open picker
  const handlePickerOpen = React.useCallback(async () => {
    // Always reset everything first
    // resetPickerState();

    const openPickerInternal = () => {
      try {
        setPickerError(null);
        openPicker({
          clientId: credentials.client_id,
          developerKey: credentials.developer_key,
          customScopes: [
            'https://www.googleapis.com/auth/drive.metadata.readonly',
            'https://www.googleapis.com/auth/drive.readonly',
          ],
          // @ts-expect-error - token accepts null to force fresh auth per google-drive-picker API
          token: null, // Always start with null token to force fresh auth
          showUploadView: true,
          showUploadFolders: true,
          supportDrives: true,
          setSelectFolderEnabled: true,
          setIncludeFolders: true,
          multiselect: false,
          callbackFunction: async (data) => {
            try {
              if (data.action === 'picked' && data.docs) {
                handlePickerFileSelected(data.docs);
              } else if (data.action === 'cancel') {
                // User cancelled the picker
                console.log('Google Drive picker was cancelled');
                resetPickerState();
              } else if (data.action === 'loaded') {
                // Picker loaded successfully
                console.log('Google Drive picker loaded');
                setPickerError(null);

                // Set pointer-events to auto for picker elements
                setTimeout(() => {
                  const pickerIframes = document.querySelectorAll(
                    'iframe[src*="docs.google.com/picker"]',
                  );
                  pickerIframes.forEach((iframe) => {
                    const parent = iframe.parentElement;
                    if (parent) {
                      (parent as HTMLElement).style.pointerEvents = 'auto';
                    }
                  });

                  const pickerOverlays = document.querySelectorAll(
                    'div[role="dialog"][aria-label*="picker"]',
                  );
                  pickerOverlays.forEach((overlay) => {
                    (overlay as HTMLElement).style.pointerEvents = 'auto';
                  });
                }, 100);
              }
            } catch (error) {
              console.error('Error in picker callback:', error);
              setPickerError('Error processing picker selection');
              toast.error(
                'Error with Google Drive picker. Try refreshing the page if it gets stuck.',
              );
              console.error(JSON.stringify({ tenant: tenantKey, error }));
            }
          },
        });
      } catch (error) {
        console.error('Error opening picker:', error);
        setPickerError('Failed to open Google Drive picker');
        toast.error(
          'Failed to open Google Drive picker. This might be due to permission issues (403 error).',
        );
        console.error(JSON.stringify({ tenant: tenantKey, error }));
      }
    };

    if (!credentials.client_id || !credentials.developer_key) {
      toast.error('Google Drive credentials are not loaded yet');
      return;
    }

    if (isPickerLoaded) {
      openPickerInternal();
    } else {
      toast.error('Google Picker is not loaded yet. Please try again.');
    }
  }, [
    credentials,
    handlePickerFileSelected,
    openPicker,
    isPickerLoaded,
    resetPickerState,
  ]);

  // Handle auth response
  React.useEffect(() => {
    if (authRes) {
      setAuthToken(authRes);
    }
  }, [authRes]);

  const loadGoogleApiScript = React.useCallback(() => {
    // This function can be called when the Next.js Script component loads
    if (window.gapi && !isPickerLoaded) {
      window.gapi.load('auth2:picker', () => {
        setIsPickerLoaded(true);
      });
    }
  }, [isPickerLoaded]);

  return {
    handlePickerOpen,
    credentials,
    loadGoogleApiScript,
    isPickerLoaded,
    forceClosePickerModal,
    pickerError,
    resetPickerState,
  };
};

export default useGoogleDrivePicker;
