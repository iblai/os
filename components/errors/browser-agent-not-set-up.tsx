'use client';

import { Ban } from 'lucide-react';
import { openTenantSwitcher } from '@iblai/iblai-js/web-utils';

import { Button } from '@/components/ui/button';
import { useCurrentTenant } from '@/hooks/use-user';
import { useTenantObjectMetadata } from '@/hooks/use-tenant-object-metadata';
import { config } from '@/lib/config';

/**
 * Shown in the side panel to someone whose organization has no browsing agent
 * and who may not create one.
 *
 * Naming the organization is the point: people belong to several, and the one
 * that is not set up is often not the one they meant to be in — so the way out
 * is to change organization, not only to ask someone.
 */
export function BrowserAgentNotSetUp() {
  const { currentTenant } = useCurrentTenant();
  const metadata = useTenantObjectMetadata();
  const organization =
    currentTenant?.name || currentTenant?.key || 'this organization';
  const supportEmail = metadata?.support_email || config.supportEmail();

  return (
    <div
      data-testid="browser-agent-not-set-up"
      className="flex h-dvh flex-col items-center justify-center gap-5 px-6 text-center"
    >
      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gray-100">
        <Ban className="h-12 w-12 text-gray-400" aria-hidden="true" />
      </div>
      <h1 className="text-xl font-medium text-gray-900">Not Set Up Yet</h1>
      <p className="max-w-md text-sm text-gray-600">
        The browser assistant has not been set up for{' '}
        <strong className="font-semibold text-gray-900">{organization}</strong>,
        so it cannot be used here. Someone who manages that organization can set
        it up by opening this panel once.
      </p>
      <div className="flex flex-col items-center gap-2">
        <Button
          onClick={() =>
            openTenantSwitcher({
              authUrl: config.authUrl(),
              tenant: currentTenant?.key,
              popup: true,
            })
          }
        >
          Change Organization
        </Button>
        <a
          href={`mailto:${supportEmail}`}
          className="text-xs text-gray-500 underline hover:text-gray-700"
        >
          Ask someone to set it up
        </a>
      </div>
    </div>
  );
}
