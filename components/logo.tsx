'use client';

import React from 'react';
import Image from 'next/image';
import { useParams } from 'next/navigation';

import { config } from '@/lib/config';
import { useHeader } from '@/hooks/use-header';
import { TenantKeyMentorIdParams } from '@/lib/types';
import { useNavigate } from '@/hooks/user-navigate';
import { useMentorSettings } from '@/hooks/use-mentors/use-mentor-settings';
import { cn } from '@/lib/utils';

type Props = {
  className?: string;
  tenantKey?: string;
};

export default function Logo({ className, tenantKey: tenantKeyFromProps }: Props) {
  const { tenantKey: tenantKeyFromParams } = useParams<TenantKeyMentorIdParams>();
  const { navigateToHome } = useNavigate();
  const tenantKey = tenantKeyFromProps || tenantKeyFromParams;

  const { useSpecialIframeLogo } = useHeader();
  const { data: mentorSettings } = useMentorSettings();
  const [logoUrl, setLogoUrl] = React.useState('');

  const loadLogo = async () => {
    setLogoUrl(`${config.axdUrl()}/api/core/orgs/${tenantKey}/logo/`);
  };

  function handleLogoError() {
    if (!useSpecialIframeLogo) {
      setLogoUrl('/logo.gif');
    } else {
      setLogoUrl('/logo-iframe.gif');
    }
  }

  React.useEffect(() => {
    if (!useSpecialIframeLogo) {
      loadLogo();
    } else {
      setLogoUrl(mentorSettings?.profileImage ?? '');
    }
  }, [tenantKey, useSpecialIframeLogo, mentorSettings?.profileImage]);

  return (
    <button onClick={navigateToHome} className="flex cursor-pointer items-center">
      {logoUrl && (
        <>
          <Image
            src={logoUrl}
            loading="lazy"
            width={100}
            height={100}
            alt="logo"
            className={cn('max-h-[50px] w-auto', className)}
            onError={handleLogoError}
          />
        </>
      )}

      {useSpecialIframeLogo && <div>{mentorSettings?.mentorName}</div>}
    </button>
  );
}
