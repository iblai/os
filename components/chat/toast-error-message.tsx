import { useEffect } from 'react';

import { TenantKeyMentorIdParams } from '@/lib/types';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { markdownToPlainText } from '@iblai/iblai-js/web-utils';
import { plainCodeError } from './code-error-text';

const CONTACT_CLASS =
  'toast-wrapped-contact-tag text-blue-600 hover:text-blue-800';

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
  const tCode = useTranslations('chatCodeErrors');
  const params = useParams<TenantKeyMentorIdParams>();
  const tenantKey = params?.tenantKey;
  useEffect(() => {
    console.error(JSON.stringify({ tenant: tenantKey, error: message }));
  }, [message]);

  // A developer-shaped Code error reads as a plain sentence; the raw text stays in the log above.
  const codeKey = plainCodeError(message);
  const plainMessage = String(markdownToPlainText(message));
  const sentence = codeKey
    ? tCode(codeKey)
    : plainMessage.match(/[.!?]$/)
      ? plainMessage
      : `${plainMessage}.`;

  return (
    <div>
      <span>
        {t('sorry')} {sentence}{' '}
        {t.rich('tryAgain', {
          contact: (chunks) => (
            <a className={CONTACT_CLASS} href={`mailto:${supportEmail}`}>
              {chunks}
            </a>
          ),
        })}
        {useSupportPhone && supportPhone ? (
          <>
            {' '}
            {t.rich('textUs', {
              number: supportPhone,
              phone: (chunks) => (
                <a className={CONTACT_CLASS} href={`tel:${supportPhone}`}>
                  {chunks}
                </a>
              ),
            })}
          </>
        ) : null}
      </span>
    </div>
  );
};
