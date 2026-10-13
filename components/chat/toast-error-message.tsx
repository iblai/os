import { useEffect } from 'react';

import { TenantKeyMentorIdParams } from '@/lib/types';
import { useParams } from 'next/navigation';
import { markdownToPlainText } from '@iblai/iblai-js/web-utils';

export const ToastErrorMessage = ({
  message,
  supportEmail,
  supportPhone,
  useSupportPhone = false,
}: {
  message: string;
  supportEmail: string;
  supportPhone?: string;
  useSupportPhone?: boolean;
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
        Sorry about that!{' '}
        {String(plainMessage).match(/[.!?]$/)
          ? plainMessage
          : `${plainMessage}.`}{' '}
        Please try again or{' '}
        <a
          className="toast-wrapped-contact-tag text-blue-600 hover:text-blue-800"
          href={`mailto:${supportEmail}`}
        >
          contact us
        </a>
        .
        {useSupportPhone && supportPhone ? (
          <>
            {' '}
            If you prefer, text us at{' '}
            <a
              className="toast-wrapped-contact-tag text-blue-600 hover:text-blue-800"
              href={`tel:${supportPhone}`}
            >
              {supportPhone}
            </a>
            .
          </>
        ) : null}
      </span>
    </div>
  );
};
