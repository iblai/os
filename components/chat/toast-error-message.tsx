import { useEffect } from 'react';

import { TenantKeyMentorIdParams } from '@/lib/types';
import { useParams } from 'next/navigation';
import { markdownToPlainText } from '@iblai/iblai-js/web-utils';

export const ToastErrorMessage = ({
  message,
  supportEmail,
}: {
  message: string;
  supportEmail: string;
}) => {
  const params = useParams<TenantKeyMentorIdParams>();
  const tenantKey = params?.tenantKey;
  useEffect(() => {
    console.error(JSON.stringify({ tenant: tenantKey, error: message }));
  }, [message]);

  const plainMessage = markdownToPlainText(message);

  return (
    <div>
      <span>
        Sorry about that! {String(plainMessage).match(/[.!?]$/) ? plainMessage : `${plainMessage}.`}{' '}
        Please try again or{' '}
        <a
          className="text-blue-600 hover:text-blue-800 toast-wrapped-contact-tag"
          href={`mailto:${supportEmail}`}
        >
          contact us
        </a>
        .
      </span>
    </div>
  );
};
