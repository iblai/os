'use client';

import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  AgentSettingsProvider,
  AgentSettingsTab,
  type CopyMentorTenant,
  type SettingsTabLabels,
} from '@iblai/iblai-js/web-containers/next';
import { chatPrivacyApiSlice } from '@iblai/iblai-js/data-layer';

import { useNavigate } from '@/hooks/user-navigate';
import { useUsername } from '@/hooks/use-user';
import { useShowFreeTrialDialog } from '@/hooks/user-user-actions';
import { config } from '@/lib/config';
import { MENTOR_VISIBILITY, MODALS } from '@/lib/constants';
import { selectRbacPermissions } from '@/features/rbac/rbac-slice';
import { useAppDispatch, useAppSelector } from '@/lib/hooks';
import { useGetUserTenantsQuery } from '@/features/tenants/api-slice';
import { TenantKeyMentorIdParams } from '@/lib/types';
import { handleTenantSwitch } from '@/lib/utils';
import { urlRoutes } from '@/url-routes';

/**
 * OS/MentorAI wiring for the SDK's full-parity `AgentSettingsTab`.
 *
 * This wrapper replaces the OS-local monolithic `<SettingsTab />` at the
 * EditMentorModal's settings slot. All the settings/copy/delete UI + save
 * flow now lives inside the SDK component; the host's only job is to:
 *   - supply the shared identity/config via `AgentSettingsProvider`
 *     (tenantKey / mentorId / username / enableRBAC / rbacPermissions /
 *     the paywall gate / the "Who can view" options), and
 *   - forward the tenant list + wire the post-save / post-delete / post-copy
 *     callbacks to the OS-specific navigation & cache-invalidation behavior
 *     the monolith used to perform inline.
 *
 * The `labels` override re-maps every user-visible string from the SDK's
 * default "agent" vocabulary onto the exact wording the OS monolith rendered
 * via next-intl, so the tab reads identically to before.
 */
export function SettingsTab() {
  const t = useTranslations('tabsSettingsTab');
  const tCopy = useTranslations('settingsTabCopyMentorModal');
  const tDelete = useTranslations('settingsTabDeleteMentorModal');

  const { tenantKey, mentorId } = useParams<TenantKeyMentorIdParams>();
  const { getMentorId, closeEditMentorModal, navigateToMentor } = useNavigate();
  const username = useUsername();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const rbacPermissions = useAppSelector(selectRbacPermissions);
  const { executeWithTrialCheck } = useShowFreeTrialDialog();
  const { data: tenants, isLoading: isLoadingTenants } =
    useGetUserTenantsQuery();

  const activeMentorId = getMentorId() ?? mentorId;

  // AgentSettingsProvider requires all three identity values; render nothing
  // until they resolve (mirrors the guard used by the other SDK-wired tabs).
  if (!tenantKey || !activeMentorId || !username) return null;

  // The SDK only needs { key, name, is_admin } for the Copy-mentor modal.
  const copyTenants: CopyMentorTenant[] = (tenants ?? []).map((tenant) => ({
    key: tenant.key,
    name: tenant.name,
    is_admin: tenant.is_admin,
  }));

  // Map the SDK's "agent" label contract onto the OS monolith's exact strings.
  // Most come straight from the existing next-intl bundles so all four locales
  // stay in parity; the three the monolith hard-coded in English (verbose
  // reasoning, PII filter, private mode) are reproduced verbatim.
  const labels: SettingsTabLabels = {
    header: {
      title: t('settingsHeading'),
      description: t('settingsDescription'),
    },
    subTabs: {
      basic: t('tabBasic'),
      discovery: t('tabDiscovery'),
      capabilities: t('tabCapabilities'),
    },
    sections: {
      chatExperience: t('chatExperienceHeading'),
      voiceCalls: t('voiceCallsHeading'),
      advanced: t('advancedHeading'),
    },
    fields: {
      name: {
        label: t('nameLabel'),
        placeholder: t('agentNamePlaceholder'),
        requiredError: t('agentNameRequired'),
      },
      uniqueId: {
        label: t('uniqueIdLabel'),
        copyButtonIdleAriaLabel: t('copyUniqueId'),
        copyButtonSuccessAriaLabel: t('uniqueIdCopied'),
      },
      description: {
        label: t('descriptionLabel'),
        placeholder: t('agentDescriptionPlaceholder'),
        requiredError: t('agentDescriptionRequired'),
      },
      category: {
        label: t('categoryLabel'),
        triggerPlaceholder: t('selectCategoryPlaceholder'),
        searchPlaceholder: t('searchCategoryPlaceholder'),
        emptyState: t('noCategoryFound'),
      },
      whoCanView: {
        label: t('whoCanViewLabel'),
        tooltip: t('whoCanViewTooltip'),
        triggerPlaceholder: t('selectWhoCanView'),
        options: {
          administrators: 'Administrators',
          students: 'Users',
          anyone: 'Anyone',
        },
      },
      whoCanChat: {
        label: t('whoCanChatLabel'),
        tooltip: t('whoCanChatTooltip'),
        triggerPlaceholder: t('selectWhoCanChat'),
        optionAnyone: t('anyoneOption'),
        optionAuthenticated: t('authenticatedUsersOption'),
      },
      featured: {
        label: t('highlightFeaturedLabel'),
        tooltip: t('highlightFeaturedTooltip'),
      },
      showAttachment: {
        label: t('enableFileAttachmentsLabel'),
        tooltip: t('enableFileAttachmentsTooltip'),
      },
      showVoiceRecord: {
        label: t('enableVoiceRecordingsLabel'),
        tooltip: t('enableVoiceRecordingsTooltip'),
      },
      allowCopies: {
        label: t('enableCopiesLabel'),
        tooltip: t('enableCopiesTooltip'),
      },
      showReasoning: {
        label: 'Enable verbose reasoning',
        tooltip: 'Show the agent’s reasoning steps while it responds.',
      },
      enhancedDocRetrieval: {
        label: t('enhancedDocRetrievalLabel'),
        tooltip: t('enhancedDocRetrievalTooltip'),
      },
      promptCaching: {
        label: t('enablePromptCachingLabel'),
        tooltip: t('enablePromptCachingTooltip'),
      },
      privateMode: {
        label: 'Enable private mode',
        tooltip:
          'When on, every conversation with this agent runs in private mode — no chat history or memory is stored for any user. Use this for sensitive or compliance-bound deployments.',
      },
      smartDocRetrieval: {
        label: t('smartDocRetrievalLabel'),
        tooltip: t('smartDocRetrievalTooltip'),
      },
      image: {
        label: t('imageLabel'),
        altText: t('agentImageAlt'),
        uploadHint: t('uploadLabel'),
        removeAriaLabel: t('removeImageAriaLabel'),
      },
    },
    actions: {
      save: t('saveButton'),
      saving: t('savingButton'),
      copy: t('copyButton'),
      delete: t('deleteButton'),
    },
    toasts: {
      saveSuccess: t('agentUpdatedSuccess'),
      saveError: t('agentUpdateError'),
      voiceCallError: t('voiceCallSettingsError'),
    },
    deleteModal: {
      title: tDelete('title'),
      description: tDelete('description'),
      cancel: tDelete('cancel'),
      confirm: tDelete('delete'),
      confirming: tDelete('deleting'),
      successToast: tDelete('deleteSuccess'),
      errorToast: tDelete('deleteError'),
    },
    copyModal: {
      title: tCopy('dialogTitle'),
      description: tCopy('dialogDescription'),
      nameLabel: tCopy('nameLabel'),
      namePlaceholder: tCopy('namePlaceholder'),
      // OS renders "Copy of {name}"; the SDK concatenates prefix + source name.
      defaultNamePrefix: tCopy('defaultCopyName', { name: '' }),
      fallbackName: tCopy('defaultAgentName'),
      destinationLabel: tCopy('destinationLabel'),
      destinationPlaceholder: tCopy('selectTenantPlaceholder'),
      destinationLoadingPlaceholder: tCopy('loadingTenants'),
      includeTrainingDataLabel: tCopy('includeTrainingDataLabel'),
      cancel: tCopy('cancelButton'),
      confirm: tCopy('copyButton'),
      confirming: tCopy('copyingButton'),
      successToast: tCopy('successCopied'),
      errorToast: tCopy('errorCopyFailed'),
      missingContextToast: tCopy('errorMissingContext'),
    },
  };

  // Post-save: the SDK owns the mutation + success toast, but the OS nav-bar's
  // chat-privacy toggle reads a separate cache tag the settings mutation
  // doesn't invalidate. Mirror the monolith's unconditional invalidation so
  // the toggle refreshes after a save.
  const handleSuccessfulSave = () => {
    dispatch(chatPrivacyApiSlice.util.invalidateTags(['ChatPrivacyEffective']));
  };

  // Post-delete: mirror the monolith's DeleteMentorModal flow — close the
  // Edit-Mentor modal, and if the deleted mentor is the one the page booted
  // with, send the user back to Explore. Deleting a different (nav-selected)
  // mentor leaves the current page in place.
  const handleSuccessfulDelete = (deletedMentorId: string) => {
    closeEditMentorModal();
    if (deletedMentorId === mentorId) {
      router.replace(urlRoutes.platform.explore(tenantKey));
    }
  };

  // Post-copy: mirror the monolith's CopyMentorModal navigation. Same-tenant
  // copies push straight to the new mentor with the Edit-Mentor modal
  // pre-opened; cross-tenant copies switch tenants first, carrying the same
  // modal-stack param through the full-page redirect.
  const handleSuccessfulCopy = ({
    forkedMentorId,
    destinationTenantKey,
    isCrossTenantCopy,
  }: {
    forkedMentorId: string;
    destinationTenantKey: string;
    isCrossTenantCopy: boolean;
  }) => {
    const modalStack = [
      {
        name: MODALS.EDIT_MENTOR.name,
        tab: MODALS.EDIT_MENTOR.tabs.settings,
      },
    ];

    if (isCrossTenantCopy) {
      const mentorPath = `/platform/${destinationTenantKey}/${forkedMentorId}?modal=${encodeURIComponent(
        JSON.stringify(modalStack),
      )}`;
      void handleTenantSwitch(
        destinationTenantKey,
        false,
        `${window.location.origin}${mentorPath}`,
      );
    } else {
      navigateToMentor(forkedMentorId, `modal=${JSON.stringify(modalStack)}`);
    }
  };

  return (
    <AgentSettingsProvider
      tenantKey={tenantKey}
      mentorId={activeMentorId}
      username={username}
      enableRBAC={config.enableRBAC()}
      rbacPermissions={rbacPermissions}
      // Route every gated action (Save, etc.) through the OS paywall check.
      executeGatedAction={(fn) => executeWithTrialCheck(fn)}
      visibilityOptions={MENTOR_VISIBILITY}
    >
      <AgentSettingsTab
        tenants={copyTenants}
        isLoadingTenants={isLoadingTenants}
        onSuccessfulSave={handleSuccessfulSave}
        onSuccessfulDelete={handleSuccessfulDelete}
        onSuccessfulCopy={handleSuccessfulCopy}
        labels={labels}
      />
    </AgentSettingsProvider>
  );
}
