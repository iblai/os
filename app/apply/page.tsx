'use client';

import { ApplyWizard } from '@iblai/iblai-js/web-containers';

import { ApplyNavbar } from '@/components/apply-navbar';
import { useCurrentTenant } from '@/hooks/use-user';

export default function ApplyPage() {
  const { currentTenant } = useCurrentTenant();
  const orgName =
    currentTenant?.platform_name ||
    currentTenant?.name ||
    'American Faith Academy';

  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <ApplyNavbar />
      <main className="flex-1">
        {/* The navbar provides the top chrome, so the wizard hides its own. */}
        <ApplyWizard brandName={orgName} showTopBar={false} />
      </main>
    </div>
  );
}
