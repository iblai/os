import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';

import {
  useLazyGetCredentialsQuery,
  useAddTrainingDocumentMutation,
} from '@iblai/iblai-js/data-layer';
import GoogleDrivePicker from 'google-drive-picker';

import { TenantKeyMentorIdParams } from '@/lib/types';
import { useUsername } from './use-user';
import { extractErrorMessage } from '@/components/modals/edit-mentor-modal/tabs/datasets-tab/resource-modal/utils';

const useGoogleDrivePicker = () => {
  const [authToken, setAuthToken] = useState<any>(null);
  const [driveFiles, setDriveFiles] = useState<any[]>([]);
  const [openPicker, authRes] = GoogleDrivePicker();
  const [getCredentials] = useLazyGetCredentialsQuery();
  const [addTrainingDocument] = useAddTrainingDocumentMutation();
  const [credentialLoaded, setCredentialsLoaded] = useState(false);
  const [isPickerLoaded, setIsPickerLoaded] = useState(false);
  const { mentorId, tenantKey } = useParams<TenantKeyMentorIdParams>();
  const username = useUsername();

  const [credentials, setCredentials] = useState({
    client_id: '',
    developer_key: '',
    client_secret: '',
  });
  // Fetch credentials on mount
  useEffect(() => {
    const fetchCredentials = async () => {
      const creds = await getCredentials({
        org: tenantKey,
        name: 'drive',
        learner_id: username,
      }).unwrap();
      if (creds?.length > 0) {
        setCredentials(creds[0].value);
      }
      setCredentialsLoaded(true);
    };

    if (!credentialLoaded) {
      fetchCredentials();
    }
  }, [
    credentialLoaded,
    credentials.client_id,
    credentials.developer_key,
    getCredentials,
  ]);

  // Load Google API script if not already loaded
  useEffect(() => {
    const loadGoogleApiScript = () => {
      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = () => {
        window.gapi.load('auth', () => {
          setIsPickerLoaded(true);
        });
      };
      document.body.appendChild(script);
    };

    if (!isPickerLoaded) {
      loadGoogleApiScript();
    }
  }, [isPickerLoaded]);

  const handlePickerFileSelected = useCallback((files) => {
    setDriveFiles(files);
  }, []);

  useEffect(() => {
    const handlePickerFileSelection = async () => {
      const trainPayload = {
        pathway: mentorId,
        url: driveFiles.map((file) => file.url).join(','),
        type: 'drive',
        access: 'private',
        google_drive_auth_data: {
          auth: {
            client_secret: credentials.client_secret,
            refresh_token: 'test-refresh token',
            client_id: credentials.client_id,
            token: authToken?.access_token,
            scopes: ['https://www.googleapis.com/auth/drive.file'],
            token_type: authToken?.token_type,
            expiry_date: new Date(
              Date.now() + (authToken?.expires_in || 0) * 1000,
            ).toISOString(),
          },
          data: driveFiles.map((file) => ({
            path: file.url,
            type: file.type,
          })),
        },
      };

      try {
        await addTrainingDocument({
          org: tenantKey,
          // @ts-expect-error - userId parameter may not exist in API but is passed from legacy code
          userId: username ?? '',
          formData: trainPayload,
        }).unwrap();
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
  }, [authToken, driveFiles]);

  // Open picker
  const handlePickerOpen = useCallback(async () => {
    const openPickerInternal = () => {
      openPicker({
        clientId: credentials.client_id,
        developerKey: credentials.developer_key,
        customScopes: ['https://www.googleapis.com/auth/drive.file'],
        token: authToken,
        showUploadView: true,
        showUploadFolders: true,
        supportDrives: true,
        setSelectFolderEnabled: true,
        setIncludeFolders: true,
        multiselect: true,
        callbackFunction: async (data) => {
          if (data.action === 'picked' && data.docs) {
            handlePickerFileSelected(data.docs);
          }
        },
      });
    };

    if (!credentials.client_id || !credentials.developer_key) {
      console.error('Google drive Credentials are not loaded yet');
      return;
    }

    if (!isPickerLoaded) {
      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = () => {
        window.gapi.load('auth', () => {
          setIsPickerLoaded(true);
          openPickerInternal();
        });
      };
      document.body.appendChild(script);
    } else {
      openPickerInternal();
    }
  }, [
    authToken,
    credentials,
    handlePickerFileSelected,
    openPicker,
    isPickerLoaded,
  ]);

  // Handle auth response
  useEffect(() => {
    if (authRes) {
      setAuthToken(authRes);
    }
  }, [authRes]);

  return { handlePickerOpen, credentials };
};

export default useGoogleDrivePicker;
