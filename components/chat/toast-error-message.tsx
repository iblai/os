import { useEffect } from 'react';

import { TenantKeyMentorIdParams } from '@/lib/types';
import { useParams } from 'next/navigation';
import { markdownToPlainText } from '@iblai/iblai-js/web-utils';
import { useTranslations } from 'next-intl';

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
  const t = useTranslations('chatToastErrorMessage');
  const params = useParams<TenantKeyMentorIdParams>();
  const tenantKey = params?.tenantKey;
  useEffect(() => {
    console.error(JSON.stringify({ tenant: tenantKey, error: message }));
  }, [message]);

  const plainMessage = markdownToPlainText(message);
  const formattedMessage = String(plainMessage).match(/[.!?]$/)
    ? plainMessage
    : `${plainMessage}.`;

  return (
    <div>
      <span>
        {t.rich('errorBody', {
          message: formattedMessage,
          contactLink: (chunks) => (
            <a
              className="toast-wrapped-contact-tag text-blue-600 hover:text-blue-800"
              href={`mailto:${supportEmail}`}
            >
              {chunks}
            </a>
          ),
        })}
        {useSupportPhone && supportPhone ? (
          <>
            {' '}
            {t.rich('textUsAt', {
              phoneLink: (chunks) => (
                <a
                  className="toast-wrapped-contact-tag text-blue-600 hover:text-blue-800"
                  href={`tel:${supportPhone}`}
                >
                  {chunks}
                </a>
              ),
              phone: supportPhone,
            })}
          </>
        ) : null}
      </span>
    </div>
  );
};
