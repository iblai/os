import React from 'react';
import { useParams } from 'next/navigation';

import { toast } from 'sonner';
import { useLazyGetCredentialsQuery } from '@iblai/iblai-js/data-layer';

import { TenantKeyMentorIdParams } from '@/lib/types';
import { useUsername } from './use-user';

export default function useGoogleDrivePicker() {
  const { tenantKey } = useParams<TenantKeyMentorIdParams>();
  const username = useUsername();

  const [isPickerLoaded, setIsPickerLoaded] = React.useState(false);
  const [credentialLoaded, setCredentialLoaded] = React.useState(false);
  const [credentials, setCredentials] = React.useState({
    clientId: '',
    developerKey: '',
    clientSecret: '',
  });

  const [getCredentials] = useLazyGetCredentialsQuery();

  async function fetchCredentials() {
    try {
      const credentials = await getCredentials({
        org: tenantKey,
        name: 'drive',
        learner_id: username,
      }).unwrap();
      if (credentials?.length > 0) {
        setCredentials({
          clientId: credentials[0]?.value?.client_id,
          developerKey: credentials[0]?.value?.developer_key,
          clientSecret: credentials[0]?.value?.client_secret,
        });
        setCredentialLoaded(true);
      }
    } catch (error) {
      toast.error('Failed to fetch Google Drive credentials');
      console.error(JSON.stringify({ tenant: tenantKey, error }));
    }
  }

  function loadGoogleApiScript() {
    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.onload = () => {
      window.gapi.load('auth', () => {
        setIsPickerLoaded(true);
      });
    };
    document.body.appendChild(script);
  }

  React.useEffect(() => {
    if (!credentialLoaded) {
      fetchCredentials();
    }

    if (!isPickerLoaded) {
      loadGoogleApiScript();
    }
  }, []);

  function handlePickerOpen() {
    toast.error('Not implemented');
  }

  return { handlePickerOpen, credentials };
}
