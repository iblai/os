import { useCallback, useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';

import {
  useAddTrainingDocumentMutation,
  useLazyGetCredentialsQuery,
} from '@iblai/iblai-js/data-layer';

import { TenantKeyMentorIdParams } from '@/lib/types';
import { useUsername } from './use-user';
import { toast } from 'sonner';
import { extractErrorMessage } from '@/components/modals/edit-mentor-modal/tabs/datasets-tab/resource-modal/utils';

const useOneDrivePicker = () => {
  const [onedriveAppId, setOnedriveAppId] = useState<string | null>(null);
  const [fullDomain, setFullDomain] = useState<string | null>(null);
  const { tenantKey, mentorId } = useParams<TenantKeyMentorIdParams>();
  const [getCredentials] = useLazyGetCredentialsQuery();
  const [addTrainingDocument] = useAddTrainingDocumentMutation();
  const username = useUsername();

  const hasFetchedCredentials = useRef(false);
  useEffect(() => {
    const handleFetchAppId = async () => {
      if (!hasFetchedCredentials.current) {
        // Check if credentials have been fetched
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
        } catch (e) {
          console.error(JSON.stringify({ tenant: tenantKey, error: e }));
        }
      }
    };

    handleFetchAppId();
  }, [getCredentials]);

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

  const handleSuccess = async (files) => {
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
      success: handleSuccess,
      cancel: function () {
        toast.info('No file selected');
      },
      error: function () {
        toast.error('Error selecting file');
      },
    };
    window.OneDrive.open(odOptions);
  }, []);

  return { pickOneDriveFile, onedriveAppId };
};

export default useOneDrivePicker;
