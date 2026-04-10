import { selectRbacPermissions } from '@/features/rbac/rbac-slice';
import { rbacPermissionToDisplay } from '@/hoc/utils';
import { checkRbacPermission } from '@/hoc/withPermissions';
import {
  useIsAdmin,
  useIsVisiting,
  useLearnerMode,
  useUserIsOnTrial,
  useUserIsStudent,
} from '@/hooks/use-user';
import { config } from '@/lib/config';
import { UserType } from '@/lib/constants';
import { useAppSelector } from '@/lib/hooks';

export const useUserType = (mentorSettings?: any) => {
  const userIsAdmin = useIsAdmin();
  const userIsVisiting = useIsVisiting();
  const userIsStudent = useUserIsStudent();
  const userIsOnFreeTrial = useUserIsOnTrial();
  const { isInstructorMode } = useLearnerMode();
  const rbacPermissions = useAppSelector(selectRbacPermissions);

  const determineUserType = () => {
    if (userIsVisiting) {
      return UserType.VISITING;
    }
    if (userIsStudent) {
      return UserType.STUDENT;
    }
    if (userIsOnFreeTrial) {
      return UserType.FREE_TRIAL;
    }
    if (userIsAdmin) {
      if (isInstructorMode) {
        return UserType.ADMIN;
      }
      return UserType.STUDENT;
    }
    return UserType.ANONYMOUS;
  };

  function isUserTypeAllowed<
    T extends {
      userTypes: UserType[];
      permissionFieldsCheck: string[];
      rbacResource?: (arg0: number) => string;
    },
  >(resource: T): boolean {
    return (
      resource.userTypes.includes(determineUserType()) ||
      (config.enableRBAC() &&
        ((!!resource.rbacResource &&
          checkRbacPermission(
            rbacPermissions,
            resource.rbacResource(mentorSettings?.mentor_id),
          )) ||
          (!!mentorSettings &&
            resource.permissionFieldsCheck?.length > 0 &&
            rbacPermissionToDisplay(
              resource.permissionFieldsCheck,
              mentorSettings?.permissions?.field,
            ))))
    );
  }

  return { isUserTypeAllowed };
};
