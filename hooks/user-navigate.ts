'use client';

import { useEffect, useCallback } from 'react';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';

import {
  ModalInfo,
  setModalStack, // Updated action name
  selectModalStack, // Import selector for current stack
  selectModalMentorId,
} from '@/features/navigation/slice';
import { chatActions } from '@iblai/iblai-js/web-utils';
import { ANONYMOUS_USERNAME, LOCAL_STORAGE_KEYS, MODALS, UserType } from '@/lib/constants';
import { AppDispatch } from '@/store';
import {
  ChartLine,
  Globe2,
  Mail,
  PenSquare,
  CirclePlus,
  Settings,
  LucideMail,
  Workflow,
} from 'lucide-react';
import eventBus, { RemoteEvents } from '@/lib/eventBus';
import { TenantKeyMentorIdParams } from '@/lib/types';
import { config } from '@/lib/config';
import { useUsername } from './use-user';
import { useGetMentorPublicSettingsQuery, useGetMentorSettingsQuery } from '@iblai/iblai-js/data-layer';
import { MentorVisibilityEnum } from '@iblai/iblai-api';
import { useShowFreeTrialDialog } from './user-user-actions';
import { clearFiles } from '@iblai/iblai-js/web-utils';
import { useTenantContext } from '@iblai/iblai-js/web-utils';
import { useLocalStorage } from './use-local-storage';

// Helper to deeply compare modal stacks
const areModalStacksEqual = (stackA: ModalInfo[], stackB: ModalInfo[]): boolean => {
  if (stackA.length !== stackB.length) return false;
  // Simple stringify comparison. For more complex scenarios, a more robust deep equal function might be needed.
  return JSON.stringify(stackA) === JSON.stringify(stackB);
};
export function useNavigate() {
  const router = useRouter();
  const pathname = usePathname();
  const { setDetermineUserPath } = useTenantContext();
  const [cachedSessionId, saveCachedSessionId] = useLocalStorage<Record<string, string>>(
    LOCAL_STORAGE_KEYS.SESSION_ID,
    {},
    { deserializer: (value) => JSON.parse(value) },
  );

  const username = useUsername();
  const searchParams = useSearchParams();
  const isAccessingPublicRoute = !!searchParams.get('token');
  const params = useParams<{ tenantKey?: string; mentorId?: string; projectId?: string }>(); // Make params potentially undefined
  const tenantKey = params?.tenantKey;
  const projectId = params?.projectId;
  const mentorIdFromParams = params?.mentorId;

  const { data: mentorSettings } = useGetMentorSettingsQuery(
    {
      mentor: mentorIdFromParams ?? '',
      org: tenantKey ?? '',
      // @ts-ignore
      userId: username ?? '',
    },
    {
      skip: !mentorIdFromParams || !tenantKey || !username || isAccessingPublicRoute,
    },
  );
  const dispatch = useDispatch<AppDispatch>();

  const modalParam = searchParams.get('modal');
  const currentModalStackFromRedux = useSelector(selectModalStack);

  // Parse the modal stack from the URL
  const parseModalStack = useCallback((): ModalInfo[] => {
    if (!modalParam) return [];
    try {
      const parsed = JSON.parse(modalParam);
      // Ensure it's an array of objects with at least a 'name' property
      if (
        Array.isArray(parsed) &&
        parsed.every((item) => typeof item === 'object' && item !== null && 'name' in item)
      ) {
        return parsed;
      }
      // For backward compatibility or malformed - if it's just a string, treat as single modal
      if (
        typeof modalParam === 'string' &&
        !Array.isArray(parsed) &&
        MODALS[modalParam.toUpperCase() as keyof typeof MODALS]
      ) {
        return [{ name: modalParam }];
      }
      if (typeof parsed === 'object' && parsed !== null && 'name' in parsed) {
        // Single object not in array
        return [parsed as ModalInfo];
      }
      console.warn('Invalid modal stack format in URL, defaulting to empty.', modalParam);
      return [];
    } catch (error) {
      console.error('Error parsing modal stack from URL:', error);
      console.error(JSON.stringify({ tenant: tenantKey, error }));
      // For backward compatibility - if it's just a string, treat as single modal
      if (
        typeof modalParam === 'string' &&
        MODALS[modalParam.toUpperCase() as keyof typeof MODALS]
      ) {
        return [{ name: modalParam }];
      }
      return [];
    }
  }, [modalParam]);

  // Synchronize Redux state from URL when modalParam changes
  useEffect(() => {
    const stackFromURL = parseModalStack();
    // Only dispatch if the stack from URL is different from the one in Redux
    if (!areModalStacksEqual(stackFromURL, currentModalStackFromRedux)) {
      dispatch(setModalStack(stackFromURL));
    }
  }, [modalParam, dispatch, parseModalStack, currentModalStackFromRedux]);

  // Create a new URLSearchParams instance for building URLs
  const createSearchParams = useCallback(
    (paramsToUpdate: Record<string, string | null>): URLSearchParams => {
      const newSearchParams = new URLSearchParams(searchParams.toString());
      Object.entries(paramsToUpdate).forEach(([key, value]) => {
        if (value === null) {
          newSearchParams.delete(key);
        } else {
          newSearchParams.set(key, value);
        }
      });
      return newSearchParams;
    },
    [searchParams],
  );

  // Check if switching to different mentor
  const shouldAddSwitchingParam = useCallback(
    (newMentorId: string): boolean => {
      return newMentorId !== mentorIdFromParams;
    },
    [mentorIdFromParams],
  );

  // Navigate with updated search params
  const navigateWithSearchParams = useCallback(
    (paramsToUpdate: Record<string, string | null>) => {
      const newSearchParams = createSearchParams(paramsToUpdate);
      const searchString = newSearchParams.toString();
      const targetPath = searchString ? `${pathname}?${searchString}` : pathname;
      router.push(targetPath);
    },
    [pathname, router, createSearchParams],
  );

  const getUpdatedModalStack = useCallback(
    (modalName: string, tab?: string, mentorId?: string) => {
      const newStack: ModalInfo[] = [
        ...currentModalStackFromRedux, // Base new stack on current Redux state
        {
          name: modalName,
          ...(tab && { tab }),
          ...(mentorId && { mentorId }),
        },
      ];
      return newStack;
    },
    [currentModalStackFromRedux],
  );

  // Push a new modal to the stack and update URL
  const openModal = useCallback(
    (modalName: string, tab?: string, mentorId?: string) => {
      const newStack = getUpdatedModalStack(modalName, tab, mentorId);
      navigateWithSearchParams({ modal: JSON.stringify(newStack) });
    },
    [currentModalStackFromRedux, navigateWithSearchParams],
  );

  // Close the top-most modal
  const closeModal = useCallback(() => {
    if (currentModalStackFromRedux.length === 0) return;

    if (currentModalStackFromRedux.length <= 1) {
      navigateWithSearchParams({ modal: null }); // Remove modal param entirely
    } else {
      const newStack = currentModalStackFromRedux.slice(0, -1);
      navigateWithSearchParams({ modal: JSON.stringify(newStack) });
    }
  }, [currentModalStackFromRedux, navigateWithSearchParams]);

  // Change the tab of the current modal
  const changeModalTab = useCallback(
    (tab: string) => {
      if (currentModalStackFromRedux.length === 0) return;

      const newStack = [...currentModalStackFromRedux];
      newStack[newStack.length - 1] = {
        ...newStack[newStack.length - 1],
        tab,
      };
      navigateWithSearchParams({ modal: JSON.stringify(newStack) });
    },
    [currentModalStackFromRedux, navigateWithSearchParams],
  );

  // Helper functions using Redux selectors directly
  // These are part of the public interface and call useSelector internally.
  const isModalOpen = useCallback(
    (modalName: string): boolean => {
      // This function is called by the boolean flags below.
      // It subscribes to Redux state.
      return currentModalStackFromRedux.some((modal) => modal.name === modalName);
    },
    [currentModalStackFromRedux], // Depends on the current stack from Redux
  );

  const getModalTab = useCallback(
    (modalName: string): string | undefined => {
      const modal = currentModalStackFromRedux.find((m) => m.name === modalName);
      return modal?.tab;
    },
    [currentModalStackFromRedux], // Depends on the current stack from Redux
  );

  // This selector is fine as it's already specific.
  const getMentorIdFromModal = useSelector(selectModalMentorId);

  // --- The interface below MUST NOT CHANGE ---
  // For the `show...Modal` flags, they will re-evaluate if `currentModalStackFromRedux` changes.
  // This is a consequence of keeping the interface stable.
  // The optimization is that `currentModalStackFromRedux` itself updates less often
  // due to the conditional dispatch in the useEffect.

  return {
    // Original navigation functions
    navigateToHome: () => {
      if (tenantKey && mentorIdFromParams) {
        router.push(`/platform/${tenantKey}/${mentorIdFromParams}`);
      } else if (tenantKey) {
        router.push(`/platform/${tenantKey}`);
      } else {
        console.warn('Cannot navigate to home: tenantKey or mentorId missing from URL params.');
        // router.push('/'); // Fallback to a generic home if needed
      }
    },
    navigateToExplore: (withoutMentorId?: boolean) => {
      if (withoutMentorId) {
        router.push(`/platform/${tenantKey}/explore`);
      } else if (tenantKey && mentorIdFromParams) {
        router.push(`/platform/${tenantKey}/${mentorIdFromParams}/explore`);
      } else if (tenantKey) {
        router.push(`/platform/${tenantKey}/explore`);
      } else {
        console.warn('Cannot navigate to explore: tenantKey or mentorId missing from URL params.');
      }
    },
    navigateToAnalytics: () => {
      if (tenantKey && mentorIdFromParams) {
        router.push(`/platform/${tenantKey}/${mentorIdFromParams}/analytics`);
      } else if (tenantKey) {
        router.push(`/platform/${tenantKey}/analytics`);
      } else {
        console.warn(
          'Cannot navigate to analytics: tenantKey or mentorId missing from URL params.',
        );
      }
    },
    navigateToMentor: (newMentorId: string, prependStackParam?: string, newTenantKey?: string) => {
      const tenantKeyToUse = newTenantKey || tenantKey;
      if (tenantKeyToUse) {
        const newCachedSessionId = { ...cachedSessionId };
        delete newCachedSessionId[newMentorId];
        saveCachedSessionId(newCachedSessionId);
        setDetermineUserPath(false);
        const needsSwitching = shouldAddSwitchingParam(newMentorId);
        const queryString = prependStackParam
          ? `?${prependStackParam}${needsSwitching ? '&switching-mentor=true' : ''}`
          : needsSwitching
            ? '?switching-mentor=true'
            : '';
        router.push(`/platform/${tenantKeyToUse}/${newMentorId}${queryString}`);
      } else {
        console.warn('Cannot navigate to mentor: tenantKey missing from URL params.');
      }
    },
    navigateToMentorInProject: (newMentorId: string, providedProjectId?: string) => {
      if (tenantKey) {
        const newCachedSessionId = { ...cachedSessionId };
        delete newCachedSessionId[newMentorId];
        saveCachedSessionId(newCachedSessionId);
        setDetermineUserPath(false);
        const queryString = shouldAddSwitchingParam(newMentorId) ? '?switching-mentor=true' : '';
        const projectIdToUse = providedProjectId ?? projectId;
        router.push(
          `/platform/${tenantKey}/projects/${projectIdToUse}/${newMentorId}${queryString}`,
        );
      } else {
        console.warn('Cannot navigate to mentor: tenantKey missing from URL params.');
      }
    },
    navigateToProject: (newProjectId: string, newMentorId: string) => {
      if (tenantKey) {
        const newCachedSessionId = { ...cachedSessionId };
        delete newCachedSessionId[newMentorId];
        saveCachedSessionId(newCachedSessionId);
        setDetermineUserPath(false);
        const queryString = shouldAddSwitchingParam(newMentorId) ? '?switching-mentor=true' : '';
        router.push(`/platform/${tenantKey}/projects/${newProjectId}/${newMentorId}${queryString}`);
      } else {
        console.warn('Cannot navigate to mentor: tenantKey missing from URL params.');
      }
    },
    navigateToNotifications: (notificationId?: string) => {
      if (tenantKey && mentorIdFromParams) {
        router.push(
          `/platform/${tenantKey}/${mentorIdFromParams}/notifications/${notificationId ?? ''}`,
        );
      } else if (tenantKey) {
        router.push(`/platform/${tenantKey}/notifications/${notificationId ?? ''}`);
      } else {
        console.warn(
          'Cannot navigate to notifications: tenantKey or mentorId missing from URL params.',
        );
      }
    },
    navigateToWorkflows: () => {
      if (tenantKey && mentorIdFromParams) {
        router.push(`/platform/${tenantKey}/workflows/${mentorIdFromParams}`);
      } else if (tenantKey) {
        router.push(`/platform/${tenantKey}/workflows`);
      } else {
        console.warn('Cannot navigate to workflows: tenantKey missing from URL params.');
      }
    },

    // Enhanced modal functions
    openCreateMentorModal: (tab?: string) => openModal(MODALS.CREATE_MENTOR.name, tab),
    closeCreateMentorModal: closeModal,

    openInviteUserModal: (tab?: string) => openModal(MODALS.INVITE_USER.name, tab),
    closeInviteUserModal: closeModal,

    openSettingsModal: (tab?: string) => openModal(MODALS.SETTINGS.name, tab),
    closeSettingsModal: closeModal,

    openMyMentorsModal: (tab?: string) => openModal(MODALS.MY_MENTORS.name, tab),
    closeMyMentorsModal: closeModal,

    openLLMProvidersModal: (tab?: string) => openModal(MODALS.LLM_PROVIDERS.name, tab),
    closeLLMProvidersModal: closeModal,

    openEditMentorModal: (tab?: string, mentorId?: string) => {
      const tabToUse = tab || MODALS.EDIT_MENTOR.tabs.settings;
      openModal(MODALS.EDIT_MENTOR.name, tabToUse, mentorId);
    },
    closeEditMentorModal: closeModal,

    openAddPromptModal: (tab?: string) => openModal(MODALS.ADD_PROMPT.name, tab),
    closeAddPromptModal: closeModal,

    openAddResourceModal: (tab?: string) => openModal(MODALS.ADD_RESOURCE.name, tab),
    closeAddResourceModal: closeModal,

    openNoMentorSelectedModal: (tab?: string) => openModal(MODALS.NO_MENTOR_SELECTED.name, tab),
    closeNoMentorSelectedModal: closeModal,

    // General modal management functions
    openModal,
    closeModal,
    changeModalTab,
    getUpdatedModalStack,
    navigateWithSearchParams,
    modalStack: currentModalStackFromRedux, // Expose the Redux stack

    // Modal state checks (derived from currentModalStackFromRedux via isModalOpen)
    showCreateMentorModal: isModalOpen(MODALS.CREATE_MENTOR.name),
    showInviteUserModal: isModalOpen(MODALS.INVITE_USER.name),
    showSettingsModal: isModalOpen(MODALS.SETTINGS.name),
    showMyMentorsModal: isModalOpen(MODALS.MY_MENTORS.name),
    showLLMProvidersModal: isModalOpen(MODALS.LLM_PROVIDERS.name),
    showEditMentorModal:
      isModalOpen(MODALS.EDIT_MENTOR.name) &&
      !(
        mentorSettings?.mentor_visibility === MentorVisibilityEnum.VIEWABLE_BY_ANYONE &&
        // @ts-ignore
        mentorSettings?.platform_key === config.mainTenantKey() &&
        tenantKey !== config.mainTenantKey()
      ),
    showAddPromptModal: isModalOpen(MODALS.ADD_PROMPT.name),
    showAddResourceModal: isModalOpen(MODALS.ADD_RESOURCE.name),
    showNoMentorSelectedModal: isModalOpen(MODALS.NO_MENTOR_SELECTED.name),

    // Get active tab for each modal (derived from currentModalStackFromRedux via getModalTab)
    getCreateMentorTab: () => getModalTab(MODALS.CREATE_MENTOR.name),
    getInviteUserTab: () => getModalTab(MODALS.INVITE_USER.name),
    getSettingsTab: () => getModalTab(MODALS.SETTINGS.name),
    getMyMentorsTab: () => getModalTab(MODALS.MY_MENTORS.name),
    getLLMProvidersTab: () => getModalTab(MODALS.LLM_PROVIDERS.name),
    getEditMentorTab: () =>
      getModalTab(MODALS.EDIT_MENTOR.name) || MODALS.EDIT_MENTOR.tabs.settings,
    getAddResourceTab: () => getModalTab(MODALS.ADD_RESOURCE.name),

    // Get the mentor ID for the current modal
    getMentorId: () => getMentorIdFromModal, // Uses the direct selector
  };
}

// useSidebarNavigation remains unchanged as its interface relies on useNavigate
export function useSidebarNavigation() {
  const dispatch = useDispatch<AppDispatch>();
  const {
    navigateToHome,
    navigateToExplore,
    openCreateMentorModal,
    openInviteUserModal,
    navigateToAnalytics,
    openSettingsModal,
    openNoMentorSelectedModal,
    navigateToNotifications,
    navigateToWorkflows,
  } = useNavigate();
  const pathname = usePathname();
  const isChatPage =
    (pathname && /\/platform\/[^/]+\/[^/]+$/.test(pathname)) || pathname.includes('/projects/');
  const { mentorId, tenantKey } = useParams<TenantKeyMentorIdParams>();
  const { executeWithTrialCheck, isNewlyUserOnPreFreeOrAdvertisingMode } = useShowFreeTrialDialog();
  const { data: mentorPublicSettings } = useGetMentorPublicSettingsQuery({
    mentor: mentorId,
    org: tenantKey,
    // @ts-ignore
    userId: ANONYMOUS_USERNAME,
  });

  const contentItems = [
    {
      label: 'New Chat',
      icon: PenSquare,
      onClick: () => {
        dispatch(clearFiles(undefined));
        if (!mentorId) {
          openNoMentorSelectedModal();
          dispatch(chatActions.setShouldStartNewChat(true));
        } else if (isChatPage) {
          eventBus.emit(RemoteEvents.newChat);
          dispatch(chatActions.setShouldStartNewChat(true));
        } else {
          navigateToHome();
          dispatch(chatActions.setShouldStartNewChat(true));
        }
      },
      userTypes: [UserType.STUDENT, UserType.FREE_TRIAL, UserType.ADMIN, UserType.ANONYMOUS],
      rbacResource: (_: number) => `/mentors/${mentorPublicSettings?.mentor_id}/#chat`,
      isAnAdminAction: false,
      hasBorder: true,
    },
    {
      label: 'Mentors',
      icon: Globe2,
      onClick: navigateToExplore,
      userTypes: [
        UserType.STUDENT,
        UserType.FREE_TRIAL,
        UserType.ADMIN,
        UserType.ANONYMOUS,
        UserType.VISITING,
      ],
      isAnAdminAction: false,
    },
    {
      label: 'New Mentor',
      icon: CirclePlus,
      onClick: () => {
        executeWithTrialCheck(openCreateMentorModal);
      },
      userTypes: [UserType.FREE_TRIAL, UserType.ADMIN, UserType.ANONYMOUS],
      rbacResource: isNewlyUserOnPreFreeOrAdvertisingMode(true)
        ? undefined
        : (_: number) => '/mentors/#create',
      isAnAdminAction: true,
    },
    {
      label: 'Invite Users',
      icon: Mail,
      onClick: () => {
        executeWithTrialCheck(openInviteUserModal);
      },
      userTypes: [UserType.FREE_TRIAL, UserType.ADMIN, UserType.ANONYMOUS],
      isAnAdminAction: true,
    },
    {
      label: 'Workflows',
      icon: Workflow,
      onClick: () => {
        executeWithTrialCheck(navigateToWorkflows);
      },
      userTypes: [UserType.FREE_TRIAL, UserType.ADMIN, UserType.ANONYMOUS],
      rbacResource: (_: number) => `/mentors/${mentorPublicSettings?.mentor_id}/#manage`,
      isAnAdminAction: true,
    },
  ];

  const footerItems = [
    {
      label: 'Notifications',
      icon: LucideMail,
      onClick: () => navigateToNotifications(),
      userTypes: [UserType.STUDENT, UserType.FREE_TRIAL, UserType.ADMIN],
      isAnAdminAction: false,
    },
    {
      label: 'Analytics',
      icon: ChartLine,
      onClick: () => {
        executeWithTrialCheck(navigateToAnalytics);
      },
      rbacResource: isNewlyUserOnPreFreeOrAdvertisingMode(true)
        ? undefined
        : (_: number) => `/mentors/${mentorPublicSettings?.mentor_id}/#view_analytics`,
      userTypes: [UserType.FREE_TRIAL, UserType.ADMIN, UserType.ANONYMOUS],
      isAnAdminAction: true,
    },
    {
      label: 'Settings',
      icon: Settings,
      onClick: () => {
        executeWithTrialCheck(openSettingsModal);
      },
      userTypes: [UserType.FREE_TRIAL, UserType.ADMIN, UserType.ANONYMOUS],
      isAnAdminAction: false,
    },
  ].filter((item) => !(config.hideAnalytics() === 'true' && item.label === 'Analytics'));

  return { contentItems, footerItems };
}