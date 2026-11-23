'use client';

import { useParams } from 'next/navigation';

import { MasterAgentProvider } from '@iblai/iblai-js/web-containers';

import { useEmbedMode } from '@/hooks/use-embed-mode';
import { useUsername } from '@/hooks/use-user';
import { config } from '@/lib/config';
import { isLoggedIn } from '@/lib/utils';

// Above the per-section layouts, so the Assistant stays open, at its width,
// while the user moves between agents and sections.
export default function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { tenantKey } = useParams<{ tenantKey: string }>();
  const username = useUsername();
  const embedMode = useEmbedMode();

  return (
    <MasterAgentProvider
      tenant={tenantKey ?? ''}
      username={username ?? ''}
      authUrl={config.authUrl()}
      lmsUrl={config.legacyLmsUrl()}
      enabled={!embedMode && isLoggedIn()}
    >
      {children}
    </MasterAgentProvider>
  );
}
