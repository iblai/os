'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { config } from '@/lib/config';
import { customErrorMessages } from '@/lib/error';
import { hideInitialLoader } from '@/lib/initial-loader';
import { useTenantObjectMetadata } from '@/hooks/use-tenant-object-metadata';

import { ClientErrorPage } from '@iblai/iblai-js/web-containers/next';

export default function ErrorPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const [errorData, setErrorData] = useState<any>(null);
  // Contact Support should reach whoever can act: for a tenant that set its own
  // address, that is them, not ibl.ai.
  const metadata = useTenantObjectMetadata();

  const code = params.code as string;
  const errorType = searchParams.get('errorType');
  const embed = searchParams.get('embed');
  const isEmbedMode = embed === 'true';

  const handleError = (error: any) => {
    console.error(JSON.stringify({ tenant: 'client-error-page', error }));
  };

  useEffect(() => {
    hideInitialLoader();
  }, []);

  useEffect(() => {
    if (errorType) {
      setErrorData(
        customErrorMessages[errorType as keyof typeof customErrorMessages],
      );
    }
  }, [errorType]);

  return (
    <ClientErrorPage
      errorCode={code}
      header={errorData?.header}
      message={errorData?.message}
      showHomeButton={!isEmbedMode}
      supportEmail={metadata?.support_email || config.supportEmail()}
      handleError={handleError}
    />
  );
}
