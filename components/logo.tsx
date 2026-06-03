'use client';

import React from 'react';
import Image from 'next/image';
import { useParams } from 'next/navigation';

import { config } from '@/lib/config';
import { useHeader } from '@/hooks/use-header';
import { TenantKeyMentorIdParams } from '@/lib/types';
import { useNavigate } from '@/hooks/user-navigate';
import { useMentorSettings } from '@/hooks/use-mentors/use-mentor-settings';
import { useEmbedMode } from '@/hooks/use-embed-mode';
import { cn } from '@/lib/utils';

type Props = {
  className?: string;
  tenantKey?: string;
};

export default function Logo({
  className,
  tenantKey: tenantKeyFromProps,
}: Props) {
  const { tenantKey: tenantKeyFromParams } =
    useParams<TenantKeyMentorIdParams>();
  const { navigateToHome } = useNavigate();
  const tenantKey = tenantKeyFromProps || tenantKeyFromParams;

  const { useSpecialIframeLogo } = useHeader();
  const { data: mentorSettings } = useMentorSettings();
  const embedMode = useEmbedMode();
  const [logoUrl, setLogoUrl] = React.useState('');

  // Outside embed mode the logo always navigates home. Inside embed mode it
  // only navigates when the mentor's catalogue is shown — when `show_catalogue`
  // is disabled the logo stays visible but is not clickable.
  const isLogoClickable = !embedMode || (mentorSettings?.showCatalogue ?? true);

  const loadLogo = async () => {
    setLogoUrl(`${config.dmUrl()}/api/core/orgs/${tenantKey}/logo/`);
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

  const logoContent = (
    <>
      {logoUrl && (
        <Image
          src={logoUrl}
          loading="lazy"
          width={100}
          height={100}
          alt="logo"
          className={cn('max-h-[50px] w-auto', className)}
          onError={handleLogoError}
        />
      )}

      {useSpecialIframeLogo && <div>{mentorSettings?.mentorName}</div>}
    </>
  );

  if (!isLogoClickable) {
    return <div className="flex items-center">{logoContent}</div>;
  }

  return (
    <button
      onClick={navigateToHome}
      className="flex cursor-pointer items-center"
    >
      {logoContent}
    </button>
  );
}
