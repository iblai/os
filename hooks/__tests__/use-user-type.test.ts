import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useUserType } from '../use-user-type';
import { UserType } from '@/lib/constants';
import { config } from '@/lib/config';

// Mock user hooks
const mockUseIsAdmin = vi.fn();
const mockUseIsVisiting = vi.fn();
const mockUseUserIsStudent = vi.fn();
const mockUseUserIsOnTrial = vi.fn();
const mockUseLearnerMode = vi.fn();

vi.mock('@/hooks/use-user', () => ({
  useIsAdmin: () => mockUseIsAdmin(),
  useIsVisiting: () => mockUseIsVisiting(),
  useUserIsStudent: () => mockUseUserIsStudent(),
  useUserIsOnTrial: () => mockUseUserIsOnTrial(),
  useLearnerMode: () => mockUseLearnerMode(),
}));

// Mock RBAC slice
const mockRbacPermissions = vi.fn();
vi.mock('@/features/rbac/rbac-slice', () => ({
  selectRbacPermissions: vi.fn(),
}));

// Mock useAppSelector
vi.mock('@/lib/hooks', () => ({
  useAppSelector: () => mockRbacPermissions(),
}));

// Mock withPermissions
const mockCheckRbacPermission = vi.fn();
vi.mock('@/hoc/withPermissions', () => ({
  checkRbacPermission: (...args: unknown[]) => mockCheckRbacPermission(...args),
}));

// Mock utils
const mockRbacPermissionToDisplay = vi.fn();
vi.mock('@/hoc/utils', () => ({
  rbacPermissionToDisplay: (...args: unknown[]) =>
    mockRbacPermissionToDisplay(...args),
}));

// Mock config
vi.mock('@/lib/config', () => ({
  config: {
    enableRBAC: vi.fn(() => false),
    iblTemplateMentor: vi.fn(() => 'test-mentor'),
  },
}));

describe('useUserType', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseIsAdmin.mockReturnValue(false);
    mockUseIsVisiting.mockReturnValue(false);
    mockUseUserIsStudent.mockReturnValue(false);
    mockUseUserIsOnTrial.mockReturnValue(false);
    mockUseLearnerMode.mockReturnValue({ isInstructorMode: false });
    mockRbacPermissions.mockReturnValue([]);
    mockCheckRbacPermission.mockReturnValue(false);
    mockRbacPermissionToDisplay.mockReturnValue(false);
    vi.mocked(config.enableRBAC).mockReturnValue(false);
  });

  describe('isUserTypeAllowed', () => {
    it('should return true when user type is in allowed list (VISITING)', () => {
      mockUseIsVisiting.mockReturnValue(true);

      const { result } = renderHook(() => useUserType());

      const isAllowed = result.current.isUserTypeAllowed({
        userTypes: [UserType.VISITING],
        permissionFieldsCheck: [],
      });

      expect(isAllowed).toBe(true);
    });

    it('should return true when user type is STUDENT', () => {
      mockUseUserIsStudent.mockReturnValue(true);

      const { result } = renderHook(() => useUserType());

      const isAllowed = result.current.isUserTypeAllowed({
        userTypes: [UserType.STUDENT],
        permissionFieldsCheck: [],
      });

      expect(isAllowed).toBe(true);
    });

    it('should return true when user type is FREE_TRIAL', () => {
      mockUseUserIsOnTrial.mockReturnValue(true);

      const { result } = renderHook(() => useUserType());

      const isAllowed = result.current.isUserTypeAllowed({
        userTypes: [UserType.FREE_TRIAL],
        permissionFieldsCheck: [],
      });

      expect(isAllowed).toBe(true);
    });

    it('should return ADMIN when user is admin in instructor mode', () => {
      mockUseIsAdmin.mockReturnValue(true);
      mockUseLearnerMode.mockReturnValue({ isInstructorMode: true });

      const { result } = renderHook(() => useUserType());

      const isAllowed = result.current.isUserTypeAllowed({
        userTypes: [UserType.ADMIN],
        permissionFieldsCheck: [],
      });

      expect(isAllowed).toBe(true);
    });

    it('should return STUDENT when user is admin but not in instructor mode', () => {
      mockUseIsAdmin.mockReturnValue(true);
      mockUseLearnerMode.mockReturnValue({ isInstructorMode: false });

      const { result } = renderHook(() => useUserType());

      const isAllowed = result.current.isUserTypeAllowed({
        userTypes: [UserType.STUDENT],
        permissionFieldsCheck: [],
      });

      expect(isAllowed).toBe(true);
    });

    it('should return ANONYMOUS when no conditions match', () => {
      const { result } = renderHook(() => useUserType());

      const isAllowed = result.current.isUserTypeAllowed({
        userTypes: [UserType.ANONYMOUS],
        permissionFieldsCheck: [],
      });

      expect(isAllowed).toBe(true);
    });

    it('should return false when user type is not in allowed list', () => {
      mockUseIsVisiting.mockReturnValue(true);

      const { result } = renderHook(() => useUserType());

      const isAllowed = result.current.isUserTypeAllowed({
        userTypes: [UserType.ADMIN],
        permissionFieldsCheck: [],
      });

      expect(isAllowed).toBe(false);
    });

    it('should hide admin-only resources in student mode even when RBAC field permissions would allow', () => {
      mockUseIsAdmin.mockReturnValue(true);
      mockUseLearnerMode.mockReturnValue({ isInstructorMode: false });
      vi.mocked(config.enableRBAC).mockReturnValue(true);
      mockRbacPermissionToDisplay.mockReturnValue(true);
      mockCheckRbacPermission.mockReturnValue(true);

      const { result } = renderHook(() => useUserType({ mentor_id: 123 }));

      const isAllowed = result.current.isUserTypeAllowed({
        userTypes: [UserType.ADMIN],
        permissionFieldsCheck: ['system_prompt'],
        rbacResource: (id: number) => `/mentors/${id}/#show_settings`,
      });

      expect(isAllowed).toBe(false);
    });

    it('should hide admin-only resources in student mode when RBAC is off', () => {
      mockUseIsAdmin.mockReturnValue(true);
      mockUseLearnerMode.mockReturnValue({ isInstructorMode: false });
      vi.mocked(config.enableRBAC).mockReturnValue(false);
      mockRbacPermissionToDisplay.mockReturnValue(true);

      const { result } = renderHook(() => useUserType({ mentor_id: 123 }));

      const isAllowed = result.current.isUserTypeAllowed({
        userTypes: [UserType.ADMIN],
        permissionFieldsCheck: ['system_prompt'],
      });

      expect(isAllowed).toBe(false);
    });

    it('should still allow admin-only resources for an admin in instructor mode with RBAC on', () => {
      mockUseIsAdmin.mockReturnValue(true);
      mockUseLearnerMode.mockReturnValue({ isInstructorMode: true });
      vi.mocked(config.enableRBAC).mockReturnValue(true);
      mockRbacPermissionToDisplay.mockReturnValue(true);
      mockCheckRbacPermission.mockReturnValue(true);

      const { result } = renderHook(() => useUserType({ mentor_id: 123 }));

      const isAllowed = result.current.isUserTypeAllowed({
        userTypes: [UserType.ADMIN],
        permissionFieldsCheck: ['system_prompt'],
        rbacResource: (id: number) => `/mentors/${id}/#show_settings`,
      });

      expect(isAllowed).toBe(true);
    });

    it('should still allow student-inclusive resources in student mode', () => {
      mockUseIsAdmin.mockReturnValue(true);
      mockUseLearnerMode.mockReturnValue({ isInstructorMode: false });

      const { result } = renderHook(() => useUserType());

      const isAllowed = result.current.isUserTypeAllowed({
        userTypes: [UserType.STUDENT, UserType.ADMIN],
        permissionFieldsCheck: [],
      });

      expect(isAllowed).toBe(true);
    });

    it('should allow via RBAC resource permission when user type is not listed', () => {
      mockUseIsAdmin.mockReturnValue(true);
      mockUseLearnerMode.mockReturnValue({ isInstructorMode: true });
      vi.mocked(config.enableRBAC).mockReturnValue(true);
      mockCheckRbacPermission.mockReturnValue(true);

      const { result } = renderHook(() => useUserType({ mentor_id: 123 }));

      const isAllowed = result.current.isUserTypeAllowed({
        userTypes: [UserType.FREE_TRIAL],
        permissionFieldsCheck: [],
        rbacResource: (id: number) => `/mentors/${id}/#show_settings`,
      });

      expect(isAllowed).toBe(true);
    });

    it('should allow via RBAC field permission when user type is not listed', () => {
      mockUseIsAdmin.mockReturnValue(true);
      mockUseLearnerMode.mockReturnValue({ isInstructorMode: true });
      vi.mocked(config.enableRBAC).mockReturnValue(true);
      mockCheckRbacPermission.mockReturnValue(false);
      mockRbacPermissionToDisplay.mockReturnValue(true);

      const { result } = renderHook(() =>
        useUserType({ mentor_id: 123, permissions: { field: {} } }),
      );

      const isAllowed = result.current.isUserTypeAllowed({
        userTypes: [UserType.FREE_TRIAL],
        permissionFieldsCheck: ['system_prompt'],
      });

      expect(isAllowed).toBe(true);
    });

    it('should deny when RBAC is on but neither resource nor field permission matches', () => {
      mockUseIsAdmin.mockReturnValue(true);
      mockUseLearnerMode.mockReturnValue({ isInstructorMode: true });
      vi.mocked(config.enableRBAC).mockReturnValue(true);
      mockCheckRbacPermission.mockReturnValue(false);
      mockRbacPermissionToDisplay.mockReturnValue(false);

      const { result } = renderHook(() =>
        useUserType({ mentor_id: 123, permissions: { field: {} } }),
      );

      const isAllowed = result.current.isUserTypeAllowed({
        userTypes: [UserType.FREE_TRIAL],
        permissionFieldsCheck: ['system_prompt'],
        rbacResource: (id: number) => `/mentors/${id}/#show_settings`,
      });

      expect(isAllowed).toBe(false);
    });

    it('should allow an admin-only resource for a NON-admin user via RBAC resource permission (RBAC enabled)', () => {
      mockUseIsAdmin.mockReturnValue(false);
      mockUseUserIsStudent.mockReturnValue(true);
      mockUseLearnerMode.mockReturnValue({ isInstructorMode: false });
      vi.mocked(config.enableRBAC).mockReturnValue(true);
      mockCheckRbacPermission.mockReturnValue(true);

      const { result } = renderHook(() => useUserType({ mentor_id: 123 }));

      const isAllowed = result.current.isUserTypeAllowed({
        userTypes: [UserType.ADMIN],
        permissionFieldsCheck: [],
        rbacResource: (id: number) => `/mentors/${id}/#show_settings`,
      });

      expect(result.current.userType).toBe(UserType.STUDENT);
      expect(isAllowed).toBe(true);
    });

    it('should allow an admin-only resource for a NON-admin user via RBAC field permission (RBAC enabled)', () => {
      mockUseIsAdmin.mockReturnValue(false);
      mockUseUserIsStudent.mockReturnValue(true);
      mockUseLearnerMode.mockReturnValue({ isInstructorMode: false });
      vi.mocked(config.enableRBAC).mockReturnValue(true);
      mockCheckRbacPermission.mockReturnValue(false);
      mockRbacPermissionToDisplay.mockReturnValue(true);

      const { result } = renderHook(() =>
        useUserType({ mentor_id: 123, permissions: { field: {} } }),
      );

      const isAllowed = result.current.isUserTypeAllowed({
        userTypes: [UserType.ADMIN],
        permissionFieldsCheck: ['system_prompt'],
      });

      expect(result.current.userType).toBe(UserType.STUDENT);
      expect(isAllowed).toBe(true);
    });

    it('should hide an admin-only resource for a NON-admin user when RBAC grants nothing', () => {
      mockUseIsAdmin.mockReturnValue(false);
      mockUseUserIsStudent.mockReturnValue(true);
      mockUseLearnerMode.mockReturnValue({ isInstructorMode: false });
      vi.mocked(config.enableRBAC).mockReturnValue(true);
      mockCheckRbacPermission.mockReturnValue(false);
      mockRbacPermissionToDisplay.mockReturnValue(false);

      const { result } = renderHook(() =>
        useUserType({ mentor_id: 123, permissions: { field: {} } }),
      );

      const isAllowed = result.current.isUserTypeAllowed({
        userTypes: [UserType.ADMIN],
        permissionFieldsCheck: ['system_prompt'],
        rbacResource: (id: number) => `/mentors/${id}/#show_settings`,
      });

      expect(isAllowed).toBe(false);
    });
  });

  describe('user type priority', () => {
    it('should prioritize VISITING over other types', () => {
      mockUseIsVisiting.mockReturnValue(true);
      mockUseUserIsStudent.mockReturnValue(true);
      mockUseIsAdmin.mockReturnValue(true);

      const { result } = renderHook(() => useUserType());

      const isVisiting = result.current.isUserTypeAllowed({
        userTypes: [UserType.VISITING],
        permissionFieldsCheck: [],
      });

      expect(isVisiting).toBe(true);
    });

    it('should prioritize STUDENT over FREE_TRIAL and ADMIN', () => {
      mockUseUserIsStudent.mockReturnValue(true);
      mockUseUserIsOnTrial.mockReturnValue(true);
      mockUseIsAdmin.mockReturnValue(true);

      const { result } = renderHook(() => useUserType());

      const isStudent = result.current.isUserTypeAllowed({
        userTypes: [UserType.STUDENT],
        permissionFieldsCheck: [],
      });

      expect(isStudent).toBe(true);
    });

    it('should prioritize FREE_TRIAL over ADMIN', () => {
      mockUseUserIsOnTrial.mockReturnValue(true);
      mockUseIsAdmin.mockReturnValue(true);

      const { result } = renderHook(() => useUserType());

      const isFreeTrial = result.current.isUserTypeAllowed({
        userTypes: [UserType.FREE_TRIAL],
        permissionFieldsCheck: [],
      });

      expect(isFreeTrial).toBe(true);
    });
  });

  describe('return structure', () => {
    it('should return object with isUserTypeAllowed function', () => {
      const { result } = renderHook(() => useUserType());

      expect(result.current).toHaveProperty('isUserTypeAllowed');
      expect(typeof result.current.isUserTypeAllowed).toBe('function');
    });

    it('should expose userType resolved from the current state', () => {
      const { result } = renderHook(() => useUserType());

      expect(result.current).toHaveProperty('userType');
      expect(result.current.userType).toBe(UserType.ANONYMOUS);
    });

    it('should return userType ADMIN for an admin in instructor mode', () => {
      mockUseIsAdmin.mockReturnValue(true);
      mockUseLearnerMode.mockReturnValue({ isInstructorMode: true });

      const { result } = renderHook(() => useUserType());

      expect(result.current.userType).toBe(UserType.ADMIN);
    });

    it('should return userType STUDENT for an admin in user (student) mode', () => {
      mockUseIsAdmin.mockReturnValue(true);
      mockUseLearnerMode.mockReturnValue({ isInstructorMode: false });

      const { result } = renderHook(() => useUserType());

      expect(result.current.userType).toBe(UserType.STUDENT);
    });

    it('should return userType VISITING when the user is visiting', () => {
      mockUseIsVisiting.mockReturnValue(true);

      const { result } = renderHook(() => useUserType());

      expect(result.current.userType).toBe(UserType.VISITING);
    });

    it('should return userType FREE_TRIAL when the user is on a free trial', () => {
      mockUseUserIsOnTrial.mockReturnValue(true);

      const { result } = renderHook(() => useUserType());

      expect(result.current.userType).toBe(UserType.FREE_TRIAL);
    });
  });
});
