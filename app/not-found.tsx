'use client';

import { config } from '@/lib/config';
import { ErrorPage } from '@/components/error-page';

export default function NotFound() {
  return (
    <ErrorPage
      errorCode="404"
      customTitle="Page Not Found"
      customDescription="The page you are looking for does not exist."
      supportEmail={config.supportEmail()}
    />
  );
}
