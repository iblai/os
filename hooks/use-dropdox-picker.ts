import { useCallback, useEffect, useState, useRef } from 'react';
import loadScript from 'load-script';
import { toast } from 'sonner';
import { useParams } from 'next/navigation';
import {
  useAddTrainingDocumentMutation,
  useLazyGetCredentialsQuery,
} from '@iblai/iblai-js/data-layer';
import { useUsername } from './use-user';
import { TenantKeyMentorIdParams } from '@/lib/types';
import { DROPBOX_EXTENSIONS } from '@/lib/constants';
import { extractErrorMessage } from '@/components/modals/edit-mentor-modal/tabs/datasets-tab/resource-modal/utils';

const DROPBOX_SDK_URL = 'https://www.dropbox.com/static/api/2/dropins.js';
const SCRIPT_ID = 'dropboxjs';

let scriptLoadingStarted = false;

const useDropboxPicker = ({
  cancel = () => {},
  linkType = 'preview',
  multiselect = true,
  extensions = DROPBOX_EXTENSIONS,
  disabled = false,
  autoShow = false,
  folderselect = true,
}) => {
  const [dropboxReady, setDropboxReady] = useState(false);
  const [openChooser, setOpenChooser] = useState(false);
  const [appKey, setAppKey] = useState(null);

  // Use RTK Query hooks
  const [getCredentials] = useLazyGetCredentialsQuery();
  const [addTrainingDocument] = useAddTrainingDocumentMutation();

  const username = useUsername();
  const { tenantKey, mentorId } = useParams<TenantKeyMentorIdParams>();

  const hasFetchedCredentials = useRef(false);

  useEffect(() => {
    const handleFetchAppKey = async () => {
      if (!hasFetchedCredentials.current) {
        hasFetchedCredentials.current = true;
        try {
          const data = await getCredentials({
            org: tenantKey,
            name: 'dropbox',
            learner_id: username,
          }).unwrap();

          if (data?.length > 0) {
            setAppKey(data[0].value.appKey);
          }
        } catch (error) {
          console.error(JSON.stringify({ tenant: tenantKey, error }));
        }
      }
    };

    handleFetchAppKey();
  }, [getCredentials, tenantKey]);

  const isDropboxReady = useCallback(() => !!window.Dropbox, []);

  // Handle successful file selection from Dropbox
  const handleSuccess = async (files) => {
    if (!mentorId) {
      toast.error('Agent not found');
      return;
    }

    // Ensure files is an array
    const filesArray = Array.isArray(files) ? files : [files];

    const trainPayload = {
      pathway: mentorId,
      url: filesArray.map((file) => file.link).join(','),
      type: 'dropbox',
      access: 'private',
      dropbox_auth_data: filesArray,
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

  const onChoose = useCallback(() => {
    if (!isDropboxReady() || disabled) {
      return null;
    }

    window.Dropbox.choose({
      success: (files) => {
        handleSuccess(files);
      },
      cancel: () => {
        cancel();
      },
      linkType: linkType,
      multiselect: multiselect,
      extensions: extensions,
      folderselect: folderselect,
    });
  }, [
    isDropboxReady,
    cancel,
    linkType,
    multiselect,
    extensions,
    folderselect,
    disabled,
    mentorId,
    addTrainingDocument,
    tenantKey,
    username,
  ]);

  useEffect(() => {
    if (!isDropboxReady() && !scriptLoadingStarted && appKey) {
      scriptLoadingStarted = true;
      loadScript(
        DROPBOX_SDK_URL,
        {
          attrs: {
            id: SCRIPT_ID,
            'data-app-key': appKey,
          },
        },
        () => {
          setDropboxReady(true);
        },
      );
    } else if (isDropboxReady()) {
      setDropboxReady(true);
    }
  }, [appKey, isDropboxReady]);

  useEffect(() => {
    if (autoShow && dropboxReady && !disabled) {
      setOpenChooser(true);
    }
  }, [autoShow, dropboxReady, disabled]);

  useEffect(() => {
    if (openChooser) {
      onChoose();
      setOpenChooser(false);
    }
  }, [openChooser, onChoose]);

  return {
    openChooser: onChoose,
    dropboxReady,
    appKey,
  };
};

export default useDropboxPicker;
