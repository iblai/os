import { z } from 'zod';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '@/lib/hooks';
import { AppDispatch, RootState } from '@/store';
import { ADMIN_PAGES_SUBPATHS, LOCAL_STORAGE_KEYS } from '@/lib/constants';
import { tenantSchema, userDataSchema } from '@/lib/types';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { userSliceActions } from '@/features/users/slice';
import { usePathname } from 'next/navigation';
import { initCustomAlertDialog } from '@/features/navigation/slice';
import { Tenant } from '@iblai/iblai-js/web-utils';
import { isStripeActivated } from '@/lib/utils';

export function useUserData() {
  const [data] = useLocalStorage<z.infer<typeof userDataSchema> | null>(
    LOCAL_STORAGE_KEYS.USER_DATA,
    null,
  );

  const validationResult = userDataSchema.safeParse(data);
  if (!validationResult.success) {
    // SSR check: localStorage is not available on the server or edge runtime
    if (typeof window === 'undefined' || typeof localStorage?.getItem !== 'function') {
      return null;
    }
    try {
      return JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.USER_DATA) || '');
    } catch (error) {
      return null;
    }
  }

  return validationResult.data;
}

export function useDmToken() {
  const [dmToken, saveDmToken] = useLocalStorage<string | undefined>(
    LOCAL_STORAGE_KEYS.DM_TOKEN_KEY,
    undefined,
    {
      serializer: (value: string | undefined) => value as string,
    },
  );
  return { dmToken, saveDmToken };
}

export function useDmTokenExpires() {
  const [dmTokenExpires, saveDmTokenExpires] = useLocalStorage<string | undefined>(
    LOCAL_STORAGE_KEYS.DM_TOKEN_EXPIRY,
    undefined,
    {
      serializer: (value: string | undefined) => value as string,
    },
  );
  return { dmTokenExpires, saveDmTokenExpires };
}

export function useAxdToken() {
  const [axdToken, saveAxdToken] = useLocalStorage<string | undefined>(
    LOCAL_STORAGE_KEYS.AXD_TOKEN_KEY,
    undefined,
    {
      serializer: (value: string | undefined) => value as string,
    },
  );
  return { axdToken, saveAxdToken };
}

export function useAxdTokenExpires() {
  const [axdTokenExpires, saveAxdTokenExpires] = useLocalStorage<string | undefined>(
    LOCAL_STORAGE_KEYS.TOKEN_EXPIRY,
    undefined,
    {
      serializer: (value: string | undefined) => value as string,
    },
  );
  return { axdTokenExpires, saveAxdTokenExpires };
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

export function useVisitingTenant() {
  const [visitingTenant, saveVisitingTenant, removeVisitingTenant] = useLocalStorage<
    Tenant | undefined
  >(LOCAL_STORAGE_KEYS.VISITING_TENANT, undefined);
  return { visitingTenant, saveVisitingTenant, removeVisitingTenant };
}

export function useUserTenants() {
  const [data, setValue] = useLocalStorage<Tenant[]>(LOCAL_STORAGE_KEYS.USER_TENANTS, []);

  return { userTenants: data, saveUserTenants: setValue };
}

export function useIsAdmin() {
  const { currentTenant } = useCurrentTenant();

  if (!currentTenant) {
    return false;
  }

  return currentTenant.is_admin;
}

export function useIsVisiting() {
  const [visitingTenant] = useLocalStorage<Tenant | undefined>(
    LOCAL_STORAGE_KEYS.VISITING_TENANT,
    undefined,
  );

  return !!visitingTenant;
}

export function useGetAllTenants() {
  const [data] = useLocalStorage(LOCAL_STORAGE_KEYS.TENANTS, null);

  const validationResult = z.array(tenantSchema).safeParse(data);

  if (!validationResult.success) {
    return null;
  }

  return validationResult.data;
}

export function useUserIsOnTrial() {
  const { currentTenant } = useCurrentTenant();
  const { userTenants } = useUserTenants();

  if (currentTenant && isStripeActivated(currentTenant as Tenant) && userTenants.length === 1) {
    return currentTenant?.key === 'main' && currentTenant?.is_admin === false;
  }

  return false;
}

export function useUserIsStudent() {
  const userIsOnTrial = useUserIsOnTrial();
  const userIsAdmin = useIsAdmin();
  const { isInstructorMode } = useLearnerMode();
  const username = useUsername();

  // If no user is logged in, they're not a student
  if (!username) {
    return false;
  }

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
