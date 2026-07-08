'use client';

import { useParams } from 'next/navigation';
import { AgentLtiTab } from '@iblai/iblai-js/web-containers/next';

import { useNavigate } from '@/hooks/user-navigate';
import { useUsername } from '@/hooks/use-user';
import { config } from '@/lib/config';
import { TenantKeyMentorIdParams } from '@/lib/types';

export function LtiTab() {
  const { tenantKey, mentorId } = useParams<TenantKeyMentorIdParams>();
  const { getMentorId } = useNavigate();
  const username = useUsername();
  const activeMentorId = getMentorId() ?? mentorId;

  if (!tenantKey || !activeMentorId || !username) return null;

  // AgentLtiTab takes identity + the RBAC flag + the deployment-specific LMS
  // domain directly (no AgentSettingsProvider required). `lmsDomain` is what
  // the SDK uses to build the fixed LTI platform endpoints (launch / login /
  // deep-linking / JWKS), which are served by the LMS itself.
  //
  // Use `legacyLmsUrl()` (the dedicated LMS domain, e.g. https://learn.iblai.org)
  // — NOT `lmsUrl()`. When `NEXT_PUBLIC_API_BASE_URL` is set, `lmsUrl()` returns
  // `<apiBase>/lms` (e.g. https://api.iblai.org/lms), which would render the LTI
  // endpoints on the API host instead of the LMS host. The LTI platform must be
  // pointed at the LMS, so `legacyLmsUrl()` is the correct source here.
  //
  // `orgShortName` defaults to the tenant key inside the SDK, which matches
  // this platform's convention, so we leave it unset.
  return (
    <AgentLtiTab
      tenantKey={tenantKey}
      mentorId={activeMentorId}
      username={username}
      enableRBAC={config.enableRBAC()}
      lmsDomain={config.legacyLmsUrl()}
    />
  );
}
