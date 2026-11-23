'use client';

import { Ban } from 'lucide-react';
import { openTenantSwitcher } from '@iblai/iblai-js/web-utils';

import { Button } from '@/components/ui/button';
import { useCurrentTenant } from '@/hooks/use-user';
import { config } from '@/lib/config';

/**
 * Shown in the side panel when the organization cannot run a browsing agent at
 * all — the model it is pinned to has no credential there.
 *
 * An administrator meets it first — they are the only one who reaches the
 * create that reveals it — and everyone else meets it afterwards, from the
 * recorded verdict. So it never says to ask whoever manages the organization:
 * for the first reader that is themselves, and for the rest it is someone who
 * cannot help either. Nothing anyone can do in the panel will fix it, which is
 * why the way out is us, and not their own support desk.
 */
export function BrowserAgentUnsupported() {
  const { currentTenant } = useCurrentTenant();
  const organization =
    currentTenant?.name || currentTenant?.key || 'this organization';
  // Deliberately NOT the organization's own support address: only we can turn
  // this on, and "ask us" reaching their IT desk would send them in a circle.
  const supportEmail = config.supportEmail();

  return (
    <div
      data-testid="browser-agent-unsupported"
      className="flex h-dvh flex-col items-center justify-center gap-5 px-6 text-center"
    >
      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gray-100">
        <Ban className="h-12 w-12 text-gray-400" aria-hidden="true" />
      </div>
      <h1 className="text-xl font-medium text-gray-900">Not Available Here</h1>
      <p className="max-w-md text-sm text-gray-600">
        The browsing assistant isn&rsquo;t available for{' '}
        <strong className="font-semibold text-gray-900">{organization}</strong>{' '}
        yet. The organization needs access to the AI model it runs on, and we
        can switch that on for you.
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
          Ask us to turn it on
        </a>
      </div>
    </div>
  );
}
