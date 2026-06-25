'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { config } from '@/lib/config';
import { customErrorMessages } from '@/lib/error';
import { hideInitialLoader } from '@/lib/initial-loader';

import { ClientErrorPage } from '@iblai/iblai-js/web-containers/next';

export default function ErrorPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const [errorData, setErrorData] = useState<any>(null);

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
      supportEmail={config.supportEmail()}
      handleError={handleError}
    />
  );
}
