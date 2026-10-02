'use client';

import React, { useMemo } from 'react';
import { AgentSettingsLauncherProvider } from '@iblai/iblai-js/web-containers';
import { useTenantContext } from '@iblai/iblai-js/web-utils';

import { useNavigate } from '@/hooks/user-navigate';
import { useIsAdmin, useUserIsStudent } from '@/hooks/use-user';

/**
 * Tells the SDK how an agent's settings open here: the same Edit Agent
 * dialog the nav-bar dropdown opens, pushed onto the URL modal stack with the
 * agent's unique id (`EditMentorModal` then edits that agent and shows only
 * the tabs this user may see). Agent names on Analytics → Transcripts and on
 * a profile's History tab become links to it.
 *
 * Gated on the nav-bar's live admin signal — admin AND in admin mode — so the
 * User/Admin toggle hides these links along with the rest of the admin
 * chrome. The agent-settings History tab is unaffected: it lists one agent's
 * conversations and never links its own name.
 *
 * Mounted from `AppProvider`, so it renders on EVERY route — including the
 * ones where the SDK `TenantProvider` runs with `skip` (`/sso-login*`,
 * `/version`) and hands its children no tenant context at all. `useNavigate`
 * destructures that context, so calling it there throws and takes the whole
 * app down (the SSO hop is how every sign-in lands, so this broke login).
 * Those routes have no agent to open settings for; pass the children through
 * and only wire the launcher where a tenant exists.
 */
export function AgentSettingsLauncher({
  children,
}: {
  children: React.ReactNode;
}) {
  const tenantContext = useTenantContext();
  if (!tenantContext) return <>{children}</>;
  return <TenantAgentSettingsLauncher>{children}</TenantAgentSettingsLauncher>;
}

function TenantAgentSettingsLauncher({
  children,
}: {
  children: React.ReactNode;
}) {
  const { openEditMentorModal } = useNavigate();
  const isAdmin = useIsAdmin();
  const userIsStudent = useUserIsStudent();
  const isLiveAdmin = isAdmin && !userIsStudent;

  const value = useMemo(
    () => ({
      openAgentSettings: (agent: { uniqueId: string }) =>
        openEditMentorModal(undefined, agent.uniqueId),
      canOpenAgentSettings: () => isLiveAdmin,
    }),
    [openEditMentorModal, isLiveAdmin],
  );

  return (
    <AgentSettingsLauncherProvider value={value}>
      {children}
    </AgentSettingsLauncherProvider>
  );
}
