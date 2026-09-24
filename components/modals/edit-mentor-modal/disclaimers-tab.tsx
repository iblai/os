'use client';

import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  AgentDisclaimersTab,
  AgentSettingsProvider,
  type DisclaimersTabLabels,
} from '@iblai/iblai-js/web-containers/next';

import Markdown from '@/components/markdown';
import { DEFAULT_DISCLAIMER_CONTENT } from '@/constants/disclaimer';
import { selectRbacPermissions } from '@/features/rbac/rbac-slice';
import { useUsername } from '@/hooks/use-user';
import { useNavigate } from '@/hooks/user-navigate';
import { config } from '@/lib/config';
import { useAppSelector } from '@/lib/hooks';
import { TenantKeyMentorIdParams } from '@/lib/types';
import { parsePrompt } from '@/lib/utils';

/**
 * OS/MentorAI wiring for the SDK's `AgentDisclaimersTab`.
 *
 * Replaces the OS-local monolithic Disclaimers tab (cards, edit modals,
 * agreements list) at the EditMentorModal's disclaimer slot. The SDK owns the
 * UI + save/toggle flows; the host only supplies identity/RBAC through
 * `AgentSettingsProvider`, the OS default agreement text, Markdown rendering
 * for the card bodies, and the OS next-intl wording.
 */
export function DisclaimersTab() {
  const t = useTranslations('disclaimersTabIndex');
  const tAgreements = useTranslations('disclaimersTabAgreements');
  const tAdvisory = useTranslations('disclaimersTabEditDisclaimerModal');
  const tAgreement = useTranslations('disclaimersTabEditUserAgreementModal');

  const { tenantKey, mentorId } = useParams<TenantKeyMentorIdParams>();
  const { getMentorId } = useNavigate();
  const username = useUsername();
  const rbacPermissions = useAppSelector(selectRbacPermissions);

  const activeMentorId = getMentorId() || mentorId;

  // AgentSettingsProvider requires all three identity values; render nothing
  // until they resolve (mirrors the Settings wrapper guard).
  if (!tenantKey || !activeMentorId || !username) return null;

  const labels: DisclaimersTabLabels = {
    header: {
      title: t('heading'),
      description: t('subheading'),
    },
    infoBox: t('infoBox'),
    userAgreement: {
      title: t('userAgreementTitle'),
      tooltip: t('userAgreementTooltip'),
      active: t('active'),
      inactive: t('inactive'),
      editTitle: tAgreement('title'),
      editLabel: tAgreement('contentLabel'),
      editPlaceholder: tAgreement('contentPlaceholder'),
    },
    advisory: {
      title: t('advisoryTitle'),
      tooltip: t('advisoryTooltip'),
      editTitle: tAdvisory('editAdvisory'),
      editLabel: tAdvisory('advisoryContent'),
      editPlaceholder: tAdvisory('advisoryContentPlaceholder'),
    },
    actions: {
      edit: t('editButton'),
      save: tAgreement('saveButton'),
      saving: tAgreement('savingButton'),
      cancel: tAgreement('cancelButton'),
      viewAgreements: t('viewAgreements'),
    },
    toasts: {
      advisorySuccess: t('agentUpdatedSuccess'),
      advisoryError: t('agentUpdatedError'),
      userAgreementSuccess: t('userAgreementUpdatedSuccess'),
      userAgreementError: t('userAgreementUpdatedError'),
      userAgreementEnabled: t('userAgreementToggledSuccess', {
        status: 'enabled',
      }),
      userAgreementDisabled: t('userAgreementToggledSuccess', {
        status: 'disabled',
      }),
      toggleError: t('userAgreementUpdatedError'),
    },
    agreements: {
      title: tAgreements('title'),
      dialogDescription: tAgreements('dialogDescription'),
      totalAgreements: (count) => tAgreements('totalAgreements', { count }),
      summaryDescription: tAgreements('summaryDescription'),
      searchPlaceholder: tAgreements('searchPlaceholder'),
      searchAriaLabel: tAgreements('searchAriaLabel'),
      columnUser: tAgreements('columnUser'),
      columnAgreedAt: tAgreements('columnAgreedAt'),
      empty: tAgreements('empty'),
      emptyDescription: tAgreements('emptyDescription'),
      noMatches: tAgreements('noMatches'),
      noMatchesDescription: tAgreements('noMatchesDescription'),
    },
  };

  return (
    <AgentSettingsProvider
      tenantKey={tenantKey}
      mentorId={activeMentorId}
      username={username}
      enableRBAC={config.enableRBAC()}
      rbacPermissions={rbacPermissions}
    >
      <AgentDisclaimersTab
        defaultDisclaimerContent={DEFAULT_DISCLAIMER_CONTENT}
        renderContent={(content) => (
          <Markdown className="text-sm text-gray-700">
            {parsePrompt(content)}
          </Markdown>
        )}
        labels={labels}
      />
    </AgentSettingsProvider>
  );
}
