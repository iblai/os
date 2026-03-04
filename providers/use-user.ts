import { z } from 'zod';
import { useDispatch } from 'react-redux';

import { config } from '@/lib/config';
import { useAppSelector } from '@/lib/hooks';
import { AppDispatch, RootState } from '@/store';
import { ADMIN_PAGES_SUBPATHS, LOCAL_STORAGE_KEYS } from '@/lib/constants';
import { tenantSchema, userDataSchema } from '@/lib/types';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { userSliceActions } from '@/features/users/slice';
import { usePathname } from 'next/navigation';
import { initCustomAlertDialog } from '@/features/navigation/slice';
import { Tenant } from '@iblai/iblai-js/web-utils';

export function useUserData() {
  const [data] = useLocalStorage<z.infer<typeof userDataSchema> | null>(
    LOCAL_STORAGE_KEYS.USER_DATA,
    null,
  );

  const validationResult = userDataSchema.safeParse(data);
  if (!validationResult.success) {
    return null;
  }

  return validationResult.data;
}

export function useUsername() {
  const userData = useUserData();

  if (!userData) {
    return null;
  }

  return userData.user_nicename;
}

export function useCurrentTenant() {
  const [data, setValue] = useLocalStorage<Tenant | null>(LOCAL_STORAGE_KEYS.CURRENT_TENANT, null);

  return { currentTenant: data, saveCurrentTenant: setValue };
}

export function useUserTenants() {
  const [data, setValue] = useLocalStorage<z.infer<typeof tenantSchema>[]>(
    LOCAL_STORAGE_KEYS.USER_TENANTS,
    [],
  );

  return { userTenants: data, saveUserTenants: setValue };
}

export function useIsAdmin() {
  const { currentTenant } = useCurrentTenant();

  if (!currentTenant) {
    return false;
  }

  return currentTenant.is_admin;
}

export function useUserIsOnTrial() {
  const { currentTenant } = useCurrentTenant();
  const { userTenants } = useUserTenants();

  if (
    currentTenant &&
    // @ts-expect-error - Double function call pattern that TypeScript can't infer properly
    config.mentorIframeUrl()() === 'true' &&
    userTenants.length === 1
  ) {
    return currentTenant?.key === 'main' && currentTenant?.is_admin === false;
  }

  return false;
}

export function useUserIsStudent() {
  const userIsOnTrial = useUserIsOnTrial();
  const userIsAdmin = useIsAdmin();
  const { isInstructorMode } = useLearnerMode();

  if (userIsAdmin) {
    if (isInstructorMode) return false;
    return true;
  }

  if (userIsOnTrial) return false;

  return true;
}

export function useLearnerMode() {
  const pathname = usePathname();
  const dispatch = useDispatch<AppDispatch>();
  const userIsAdmin = useIsAdmin();
  const isInstructorMode = useAppSelector((state: RootState) => state.user.isInstructorMode);

  const isAdminPage = () => {
    return Object.values(ADMIN_PAGES_SUBPATHS).some((subpath) => pathname.includes(subpath));
  };

  function toggleLearnerMode() {
    if (userIsAdmin) {
      if (isInstructorMode && isAdminPage()) {
        dispatch(
          initCustomAlertDialog({
            message: 'Switching to learner mode will redirect you to the chat page.',
            validateTrigger: 'SWITCH_TO_LEARNER',
            cancelTrigger: '',
            title: 'Are you sure?',
            isOpen: true,
          }),
        );
      } else {
        dispatch(userSliceActions.setIsInstructorMode(!isInstructorMode));
      }
    }
  }

  return {
    isInstructorMode,
    toggleLearnerMode,
  };
}
