import { RootState } from '@/store';
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type RbacPermissions = {
  mentors: Record<string, unknown>;
  mentor: Record<string, unknown>;
};

type RbacState = {
  rbacPermissions: RbacPermissions | {};
  /**
   * Whether the MENTOR-scoped permissions request has come back for the
   * mentor in view.
   *
   * Separate from `rbacPermissions` because an empty object means both
   * "denied" and "not asked yet". The SDK's chat composer and conversation
   * starters default to ALLOWED when a mentor's key is absent — so anonymous
   * and public routes keep working — which means they cannot tell those apart
   * and would let someone without `#chat` send a message the server then
   * 403s. This is the field they read to hold off until the answer is in.
   *
   * Mentor-scoped, not a single global flag: platform permissions resolve on
   * their own schedule and would otherwise flip this to "loaded" while the
   * mentor's own request was still in flight.
   */
  mentorPermissionsLoaded?: boolean;
};

const initialState: RbacState = {
  rbacPermissions: {},
  mentorPermissionsLoaded: false,
};

const rbacSlice = createSlice({
  name: 'rbac',
  initialState,
  reducers: {
    updateRbacPermissions: (
      state,
      action: PayloadAction<RbacPermissions | {}>,
    ) => {
      state.rbacPermissions = {
        ...state.rbacPermissions,
        ...action.payload,
      };
    },
    /** The mentor-scoped request settled — granted, denied or failed alike. */
    markMentorPermissionsLoaded: (state) => {
      state.mentorPermissionsLoaded = true;
    },
    /**
     * A different mentor is in view, so the previous answer no longer applies.
     * Without this the composer would trust the outgoing mentor's verdict
     * while the new one's permissions were still in flight.
     */
    resetMentorPermissionsLoaded: (state) => {
      state.mentorPermissionsLoaded = false;
    },
  },
});

export const {
  updateRbacPermissions,
  markMentorPermissionsLoaded,
  resetMentorPermissionsLoaded,
} = rbacSlice.actions;

export default rbacSlice.reducer;

export const selectRbacPermissions = (state: RootState) =>
  state.rbac.rbacPermissions;

/**
 * Whether the mentor-scoped permissions answer has arrived. Absent reads as
 * `true` so any consumer predating this field behaves exactly as before.
 */
export const selectMentorPermissionsLoaded = (state: RootState): boolean =>
  state.rbac.mentorPermissionsLoaded ?? true;
