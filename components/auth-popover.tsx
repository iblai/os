'use client';

import { MouseEvent, useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { config } from '@/lib/config';
import {
  isLoggedIn,
  redirectToAuthSpa,
  redirectToAuthSpaJoinTenant,
} from '@/lib/utils';
import { useCurrentTenant, useVisitingTenant } from '@/hooks/use-user';

type AuthPopoverProps = {
  children: React.ReactNode;
  tenantKey?: string;
};

export function AuthPopover({ children, tenantKey }: AuthPopoverProps) {
  const [open, setOpen] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  const isMainTenant = tenantKey === config.mainTenantKey();
  const { currentTenant } = useCurrentTenant();
  const { visitingTenant } = useVisitingTenant();
  const loggedIn = isLoggedIn();
  const advertisingEnabled = config.advertisingEnabled();
  const shouldShowAd =
    advertisingEnabled &&
    (isMainTenant ||
      currentTenant?.is_advertising ||
      visitingTenant?.is_advertising) &&
    (!loggedIn || isHovering);

  useEffect(() => {
    if (!shouldShowAd) {
      setOpen(false);
    }
  }, [shouldShowAd]);

  const handleLogin = useCallback(() => {
    if (!tenantKey) {
      console.log('[auth-redirect] Auth popover login without tenant key');
      redirectToAuthSpa('/', tenantKey);
      return;
    }

    redirectToAuthSpaJoinTenant(tenantKey);
  }, [tenantKey]);

  const handleTriggerClick = useCallback(
    (event: MouseEvent) => {
      if (loggedIn) {
        return;
      }

      if (
        advertisingEnabled &&
        (isMainTenant ||
          currentTenant?.is_advertising ||
          visitingTenant?.is_advertising)
      ) {
        event.preventDefault();
        setOpen(true);
        return;
      }

      event.preventDefault();
      handleLogin();
    },
    [advertisingEnabled, handleLogin, isMainTenant, loggedIn, currentTenant],
  );

  const handleMouseEnter = useCallback(() => {
    if (
      !advertisingEnabled ||
      (!isMainTenant &&
        !currentTenant?.is_advertising &&
        !visitingTenant?.is_advertising)
    )
      return;
    setIsHovering(true);
    setOpen(true);
  }, [advertisingEnabled, isMainTenant]);

  const handleMouseLeave = useCallback(() => {
    setIsHovering(false);
    if (loggedIn) {
      setOpen(false);
    }
  }, [loggedIn]);

  return (
    <Popover
      open={open && shouldShowAd}
      onOpenChange={(nextOpen) => setOpen(nextOpen)}
    >
      <PopoverTrigger
        asChild
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleTriggerClick}
      >
        {children}
      </PopoverTrigger>
      {shouldShowAd && (
        <PopoverContent className="w-80 p-4">
          <div className="space-y-1.5">
            <h3 className="font-medium text-gray-900">
              Try advanced features for free
            </h3>
            <p className="text-sm text-gray-600">
              Get better responses, create agents with your data, and more by
              logging in.
            </p>
            <div className="mt-4 flex space-x-2">
              <Button onClick={handleLogin} className="ibl-button-primary">
                Log in
              </Button>
              <Button onClick={handleLogin} variant="outline">
                Sign up for free
              </Button>
            </div>
          </div>
        </PopoverContent>
      )}
    </Popover>
  );
}
