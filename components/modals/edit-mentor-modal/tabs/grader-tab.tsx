'use client';

import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

import {
  AgentGraderTab,
  AgentSettingsProvider,
  type GraderTabLabels,
} from '@iblai/iblai-js/web-containers/next';

import { useGetMentorSettingsQuery } from '@iblai/iblai-js/data-layer';
import { selectRbacPermissions } from '@/features/rbac/rbac-slice';
import { useAppSelector } from '@/lib/hooks';
import { useNavigate } from '@/hooks/user-navigate';
import { useUsername } from '@/hooks/use-user';
import { useShowFreeTrialDialog } from '@/hooks/user-user-actions';
import { config } from '@/lib/config';
import { TenantKeyMentorIdParams } from '@/lib/types';

export function GraderTab() {
  const t = useTranslations('tabsGraderTab');
  const { tenantKey, mentorId } = useParams<TenantKeyMentorIdParams>();
  const { getMentorId } = useNavigate();
  const username = useUsername();
  const rbacPermissions = useAppSelector(selectRbacPermissions);
  const { executeWithTrialCheck } = useShowFreeTrialDialog();
  const activeMentorId = getMentorId() ?? mentorId;

  const { data: mentorSettings } = useGetMentorSettingsQuery(
    {
      mentor: activeMentorId,
      org: tenantKey,
      // @ts-expect-error userId is not part of the typed args but the API accepts it
      userId: username ?? '',
    },
    { skip: !activeMentorId || !tenantKey || !username },
  );

  // The grader endpoints (`/mentors/{id}/grader-config/…`) are keyed by the
  // mentor's UUID, so the provider's mentorId must be the mentor's unique_id
  // (not the slug). The URL param already is the unique_id in the standard
  // navigation flow — the settings lookup covers mentors reached otherwise.
  const mentorUniqueId =
    mentorSettings?.mentor_unique_id ?? activeMentorId ?? '';

  if (!tenantKey || !activeMentorId || !username) return null;

  // Map the SDK's grader label contract onto the app's next-intl bundles so
  // all four locales stay in the monolith's messages files (mirrors the
  // SettingsTab wrapper). `t.raw` is used for the strings the SDK
  // interpolates itself ({total}) — plain `t()` would treat the braces as
  // ICU arguments and fail without values.
  const labels: GraderTabLabels = {
    header: {
      title: t('headerTitle'),
      description: t('headerDescription'),
    },
    capability: {
      title: t('capabilityTitle'),
      description: t('capabilityDescription'),
      offHint: t('capabilityOffHint'),
    },
    subTabs: {
      setup: t('subTabSetup'),
      rubric: t('subTabRubric'),
    },
    denied: {
      title: t('deniedTitle'),
      description: t('deniedDescription'),
    },
    warnings: {
      noConfig: t('warningNoConfig'),
      noCriteria: t('warningNoCriteria'),
    },
    config: {
      sectionTitle: t('configSectionTitle'),
      gradingMode: {
        label: t('gradingModeLabel'),
        options: {
          submission: t('gradingModeOptionSubmission'),
          conversation: t('gradingModeOptionConversation'),
        },
        help: {
          submission: t('gradingModeHelpSubmission'),
          conversation: t('gradingModeHelpConversation'),
        },
      },
      feedbackMode: {
        label: t('feedbackModeLabel'),
        options: {
          overall: t('feedbackModeOptionOverall'),
          perCriteria: t('feedbackModeOptionPerCriteria'),
          both: t('feedbackModeOptionBoth'),
        },
        help: t('feedbackModeHelp'),
      },
      instructions: {
        label: t('instructionsLabel'),
        placeholder: t('instructionsPlaceholder'),
        help: t('instructionsHelp'),
      },
      saveButton: t('configSaveButton'),
      savingButton: t('configSavingButton'),
    },
    criteria: {
      sectionTitle: t('criteriaSectionTitle'),
      description: t('criteriaDescription'),
      needsConfigHint: t('criteriaNeedsConfigHint'),
      emptyState: t('criteriaEmptyState'),
      addButton: t('criteriaAddButton'),
      columns: {
        name: t('criteriaColumnName'),
        criteria: t('criteriaColumnCriteria'),
        points: t('criteriaColumnPoints'),
      },
      actionsAria: (name: string) => t('criteriaActionsAria', { name }),
      edit: t('criteriaEdit'),
      delete: t('criteriaDelete'),
      totalPoints: t.raw('criteriaTotalPoints'),
      scoreHint: t.raw('criteriaScoreHint'),
      lastCriterionHint: t('criteriaLastCriterionHint'),
      modal: {
        addTitle: t('criterionModalAddTitle'),
        editTitle: t('criterionModalEditTitle'),
        name: {
          label: t('criterionModalNameLabel'),
          placeholder: t('criterionModalNamePlaceholder'),
          required: t('criterionModalNameRequired'),
        },
        criteria: {
          label: t('criterionModalCriteriaLabel'),
          placeholder: t('criterionModalCriteriaPlaceholder'),
          required: t('criterionModalCriteriaRequired'),
        },
        points: {
          label: t('criterionModalPointsLabel'),
          placeholder: t('criterionModalPointsPlaceholder'),
          positive: t('criterionModalPointsPositive'),
        },
        save: t('criterionModalSave'),
        saving: t('criterionModalSaving'),
        cancel: t('criterionModalCancel'),
      },
      deleteModal: {
        title: t('deleteModalTitle'),
        confirmationPrefix: t('deleteModalConfirmationPrefix'),
        confirmationSuffix: t('deleteModalConfirmationSuffix'),
        cancel: t('deleteModalCancel'),
        delete: t('deleteModalDelete'),
        deleting: t('deleteModalDeleting'),
      },
    },
    toasts: {
      toggleOn: t('toastToggleOn'),
      toggleOff: t('toastToggleOff'),
      toggleError: t('toastToggleError'),
      configSaved: t('toastConfigSaved'),
      configError: t('toastConfigError'),
      criterionAdded: t('toastCriterionAdded'),
      criterionUpdated: t('toastCriterionUpdated'),
      criterionDeleted: t('toastCriterionDeleted'),
      criterionError: t('toastCriterionError'),
    },
  };

  return (
    <AgentSettingsProvider
      tenantKey={tenantKey}
      mentorId={mentorUniqueId}
      username={username}
      enableRBAC={config.enableRBAC()}
      rbacPermissions={rbacPermissions}
      executeGatedAction={executeWithTrialCheck}
    >
      <AgentGraderTab labels={labels} />
    </AgentSettingsProvider>
  );
}
