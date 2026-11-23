'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { config } from '@/lib/config';
import { customErrorMessages } from '@/lib/error';
import { hideInitialLoader } from '@/lib/initial-loader';
import { useTenantObjectMetadata } from '@/hooks/use-tenant-object-metadata';

import { ClientErrorPage } from '@iblai/iblai-js/web-containers/next';
import { BrowserAgentNotSetUp } from '@/components/errors/browser-agent-not-set-up';
import { BrowserAgentUnsupported } from '@/components/errors/browser-agent-unsupported';

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

  // This one is not a generic error: it names the organization and offers the
  // way out, which the shared page has no room for.
  if (errorType === customErrorMessages.browserAgentNotSetUp.key)
    return <BrowserAgentNotSetUp />;
  if (errorType === customErrorMessages.browserAgentUnsupported.key)
    return <BrowserAgentUnsupported />;

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
