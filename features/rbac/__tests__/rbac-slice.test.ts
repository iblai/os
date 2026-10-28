import { describe, it, expect } from 'vitest';
import rbacReducer, {
  updateRbacPermissions,
  markMentorPermissionsLoaded,
  resetMentorPermissionsLoaded,
  selectRbacPermissions,
  selectMentorPermissionsLoaded,
} from '../rbac-slice';

describe('rbac/rbac-slice', () => {
  const initialState = {
    rbacPermissions: {},
    mentorPermissionsLoaded: false,
  };

  const stateWith = (rbac: Record<string, unknown>) =>
    ({ rbac }) as unknown as Parameters<
      typeof selectMentorPermissionsLoaded
    >[0];

  describe('reducer', () => {
    it('should return the initial state', () => {
      expect(rbacReducer(undefined, { type: 'unknown' })).toEqual(initialState);
    });
  });

  describe('updateRbacPermissions', () => {
    it('should update RBAC permissions with mentors permissions', () => {
      const permissions = {
        mentors: {
          canCreate: true,
          canEdit: false,
        },
        mentor: {},
      };

      const state = rbacReducer(
        initialState,
        updateRbacPermissions(permissions),
      );

      expect(state.rbacPermissions).toEqual(permissions);
    });

    it('should update RBAC permissions with mentor permissions', () => {
      const permissions = {
        mentors: {},
        mentor: {
          canDelete: true,
          canView: true,
        },
      };

      const state = rbacReducer(
        initialState,
        updateRbacPermissions(permissions),
      );

      expect(state.rbacPermissions).toEqual(permissions);
    });

    it('should merge new permissions with existing permissions', () => {
      const existingState = {
        rbacPermissions: {
          mentors: {
            canCreate: true,
          },
          mentor: {},
        },
      };

      const newPermissions = {
        mentors: {
          canEdit: true,
        },
        mentor: {
          canDelete: true,
        },
      };

      const state = rbacReducer(
        existingState,
        updateRbacPermissions(newPermissions as any),
      );

      expect(state.rbacPermissions).toEqual({
        mentors: {
          canEdit: true,
        },
        mentor: {
          canDelete: true,
        },
      });
    });

    it('should handle empty permissions object', () => {
      const state = rbacReducer(initialState, updateRbacPermissions({}));

      expect(state.rbacPermissions).toEqual({});
    });

    it('should completely replace permissions when updated', () => {
      const existingState = {
        rbacPermissions: {
          mentors: {
            oldPermission: true,
          },
          mentor: {},
        },
      };

      const newPermissions = {
        mentors: {
          newPermission: false,
        },
        mentor: {},
      };

      const state = rbacReducer(
        existingState,
        updateRbacPermissions(newPermissions as any),
      );

      expect(state.rbacPermissions).toEqual(newPermissions);
    });
  });

  describe('selectRbacPermissions', () => {
    it('should select RBAC permissions from state', () => {
      const mockState = {
        rbac: {
          rbacPermissions: {
            mentors: {
              canCreate: true,
            },
            mentor: {},
          },
        },
      } as any;

      const permissions = selectRbacPermissions(mockState);

      expect(permissions).toEqual({
        mentors: {
          canCreate: true,
        },
        mentor: {},
      });
    });

    it('should return empty object when no permissions set', () => {
      const mockState = {
        rbac: {
          rbacPermissions: {},
        },
      } as any;

      const permissions = selectRbacPermissions(mockState);

      expect(permissions).toEqual({});
    });
  });

  describe('action creators', () => {
    it('should create updateRbacPermissions action', () => {
      const permissions = {
        mentors: { test: true },
        mentor: {},
      };

      const action = updateRbacPermissions(permissions);

      expect(action.type).toBe('rbac/updateRbacPermissions');
      expect(action.payload).toEqual(permissions);
    });
  });

  // An empty permissions object means both "denied" and "not asked yet". The
  // SDK's composer and conversation starters default to ALLOWED when a
  // mentor's key is absent — so anonymous and public routes keep working —
  // and therefore cannot tell those apart on their own. This flag is what
  // stops someone without `#chat` sending a message the server then 403s.
  describe('mentor permissions loading state', () => {
    it('starts out not loaded, so absence is not read as a verdict', () => {
      expect(selectMentorPermissionsLoaded(stateWith(initialState))).toBe(
        false,
      );
    });

    it('marks the answer as arrived, granted or denied alike', () => {
      const state = rbacReducer(initialState, markMentorPermissionsLoaded());
      expect(selectMentorPermissionsLoaded(stateWith(state))).toBe(true);
    });

    it('resets when a different mentor comes into view', () => {
      const loaded = rbacReducer(initialState, markMentorPermissionsLoaded());
      const reset = rbacReducer(loaded, resetMentorPermissionsLoaded());
      expect(selectMentorPermissionsLoaded(stateWith(reset))).toBe(false);
    });

    it('is independent of the permissions payload itself', () => {
      const withPerms = rbacReducer(
        initialState,
        updateRbacPermissions({ mentors: {}, mentor: {} }),
      );
      expect(selectMentorPermissionsLoaded(stateWith(withPerms))).toBe(false);
    });

    it('reads a state without the field as loaded, for older consumers', () => {
      expect(
        selectMentorPermissionsLoaded(stateWith({ rbacPermissions: {} })),
      ).toBe(true);
    });
  });
});
