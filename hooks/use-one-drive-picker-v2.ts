import { useCallback, useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';

import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { useLazyGetCredentialsQuery } from '@iblai/iblai-js/data-layer';
import { TenantKeyMentorIdParams } from '@/lib/types';
import { useUsername } from './use-user';

// OneDrive SDK URL
const ONEDRIVE_SDK_URL = 'https://js.live.net/v7.2/OneDrive.js';

const useOneDrivePicker = () => {
  const t = useTranslations('useOneDrivePickerV2');
  const { tenantKey } = useParams<TenantKeyMentorIdParams>();
  const [onedriveAppId, setOnedriveAppId] = useState(null);
  const [fullDomain, setFullDomain] = useState<string | null>(null);
  const [getCredentials] = useLazyGetCredentialsQuery();
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const username = useUsername();

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
          toast.error(t('failedToLoadSdk'));
          sdkLoadingStarted.current = false;
        };

        document.body.appendChild(script);
      } else if (window.OneDrive) {
        setIsSDKLoaded(true);
      }
    };

    loadOneDriveSDK();
  }, [isSDKLoaded]);

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
          console.log('getCredentials', data);
          if (data?.length > 0) {
            console.log('data[0].value.appId', data[0].value.appId);
            setOnedriveAppId(data[0].value.appId);
          } else {
            toast.error(t('credentialsNotFound'));
          }
        } catch (error) {
          toast.error(t('failedToLoadCredentials'));
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
    const url = new URL(window.location.href);
    const protocol = url.protocol;
    const hostname = url.hostname;
    const port = url.port ? `:${url.port}` : '';
    const finalFullDomain = `${protocol}//${hostname}${port}`;
    setFullDomain(finalFullDomain);
    return finalFullDomain;
  };

  const pickOneDriveFile = useCallback(
    (handleSuccess?: (files: any) => void) => {
      console.log('onedriveAppId', onedriveAppId);
      if (!onedriveAppId) {
        toast.error(t('credentialsNotLoadedYet'));
        return;
      }

      console.log('isSDKLoaded', isSDKLoaded);
      console.log('window.OneDrive', window.OneDrive);
      if (!isSDKLoaded || !window.OneDrive) {
        toast.error(t('sdkNotLoadedYet'));
        return;
      }

      const odOptions = {
        clientId: onedriveAppId,
        action: 'download',
        multiSelect: true,
        openInNewWindow: true,
        advanced: {
          redirectUri: getFullDomain(),
          // only show folders, images, word files, powerpoint files, excel files, txt, PDF, csv, HTML, XML
          filter:
            'folder,photo,.docx,.doc,.txt,.pdf,.csv,.ppt,.pptx,.xls,.xlsx,.html,.htm,.xml',
        },
        success:
          handleSuccess ??
          (() => {
            toast.success(t('filePicked'));
          }),
        cancel: function () {
          toast.info(t('filePickCancelled'));
        },
        error: function () {
          toast.error(t('failedToPickFile'));
        },
      };
      window.OneDrive.open(odOptions);
    },
    [],
  );

  return { pickOneDriveFile, onedriveAppId };
};

export default useOneDrivePicker;
