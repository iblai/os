import { describe, it, expect } from 'vitest';
import rbacReducer, { updateRbacPermissions, selectRbacPermissions } from '../rbac-slice';

describe('rbac/rbac-slice', () => {
  const initialState = {
    rbacPermissions: {},
  };

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

      const state = rbacReducer(initialState, updateRbacPermissions(permissions));

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

      const state = rbacReducer(initialState, updateRbacPermissions(permissions));

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

      const state = rbacReducer(existingState, updateRbacPermissions(newPermissions as any));

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

      const state = rbacReducer(existingState, updateRbacPermissions(newPermissions as any));

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
});
