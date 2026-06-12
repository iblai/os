import { describe, it, expect, vi } from 'vitest';
import { MentorVisibilityEnum } from '@iblai/iblai-api';

import {
  MENTOR_SEGMENTS,
  filterMentorSegments,
  type MentorSegmentFilterContext,
} from '../use-mentor-segments';
import { MODALS, UserType } from '@/lib/constants';

// ----------------------------------------------------------------------------
// Mocks
//
// The sibling `use-mentor-segments.test.tsx` exercises the React hook and is
// pre-existing broken on baseline because importing `EDIT_MENTOR_TAB_COMPONENTS`
// transitively reaches `@iblai/web-utils` which fails to resolve axios in the
// test environment. To keep this new file fast and isolated, we test the
// exported pure `filterMentorSegments` function — no React, no SDK imports —
// and avoid that broken chain entirely.
// ----------------------------------------------------------------------------

// Block the transitive `@iblai/iblai-js/*` -> `@iblai/web-utils` -> axios
// resolution chain that breaks the sibling test file. We stub each ibl SDK
// entrypoint use-mentor-segments transitively reaches — that's enough
// because this file only exercises the exported pure helpers, not the
// React hook itself.
vi.mock('@iblai/iblai-js/data-layer', () => ({
  useGetMentorSettingsQuery: () => ({ data: undefined, isSuccess: false }),
  useGetMemsearchStatusQuery: () => ({ data: { enable_memsearch: false } }),
  useGetClawMentorConfigQuery: () => ({ data: null }),
}));

// Cut the web-utils chain at host-level wrapper hooks so the underlying
// SDK module never gets evaluated — that file imports axios via a path
// that fails to resolve under vitest.
vi.mock('@iblai/iblai-js/web-utils', () => ({
  WithFormPermissions: (props: { children: (state: object) => unknown }) =>
    props.children({}),
  WithPermissions: (props: { children: (state: object) => unknown }) =>
    props.children({}),
  checkRbacPermission: () => true,
  SUBSCRIPTION_V2_TRIGGERS: {},
  SUBSCRIPTION_TRIGGERS: {},
  selectRbacPermissions: () => ({}),
  useIsAdmin: () => true,
  useUsername: () => 'test-user',
}));

vi.mock('@/hooks/use-user', () => ({
  useIsAdmin: () => true,
  useUsername: () => 'test-user',
}));

vi.mock('@/hooks/use-user-type', () => ({
  useUserType: () => ({ isUserTypeAllowed: () => true }),
}));

vi.mock('@/hooks/user-navigate', () => ({
  useNavigate: () => ({ getMentorId: () => undefined }),
}));

vi.mock('@/features/rbac/rbac-slice', () => ({
  selectRbacPermissions: () => ({}),
}));

vi.mock('@/lib/hooks', () => ({
  useAppSelector: () => ({}),
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ tenantKey: 'test-tenant', mentorId: 'test-mentor' }),
}));

vi.mock('@/lib/config', () => ({
  config: {
    mainTenantKey: () => 'main',
    iblTemplateMentor: () => 'test-mentor',
    enableRBAC: () => false,
  },
}));

vi.mock('@/hoc/utils', () => ({
  rbacPermissionToDisplay: () => true,
}));

vi.mock('@/hoc/withPermissions', () => ({
  checkRbacPermission: () => true,
}));

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

const screenshareSegment = MENTOR_SEGMENTS.find(
  (s) => s.value === MODALS.EDIT_MENTOR.tabs.screenshare,
);

const baseFlags = {
  isMemsearchEnabled: false,
  isClawEnabled: false,
  clawConfigExists: false,
  isMemoryComponentEnabled: false,
  isScreenshareEnabled: false,
  // Voice calls default on so the Screen Share gating tests aren't perturbed
  // by the separate Voice-tab gate.
  isVoiceCallEnabled: true,
};

const buildContext = (
  overrides: Partial<MentorSegmentFilterContext> = {},
): MentorSegmentFilterContext => ({
  isAdmin: true,
  tenantKey: 'custom-tenant',
  mentorSettings: {
    platform_key: 'custom-tenant',
    mentor_visibility: MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
    mentor_id: 42,
    permissions: { field: {} },
  },
  rbacPermissions: {},
  flags: { ...baseFlags },
  isUserTypeAllowed: (segment) => segment.userTypes.includes(UserType.ADMIN),
  ...overrides,
});

// ----------------------------------------------------------------------------
// Tests
// ----------------------------------------------------------------------------

describe('Screen Share mentor segment', () => {
  it('is registered in MENTOR_SEGMENTS with the canonical label, value, and field-permission shape', () => {
    expect(screenshareSegment).toBeDefined();
    expect(screenshareSegment?.label).toBe('Screen Share');
    expect(screenshareSegment?.value).toBe(MODALS.EDIT_MENTOR.tabs.screenshare);
    // No host-side RBAC field gating — the SDK renders an off-state hint
    // when `enable_video` is false and the host gates visibility at the
    // segment level via `enabledThroughConfig`. See the screenshare-tab
    // wrapper for the rationale.
    expect(screenshareSegment?.permissionFieldsCheck).toEqual([]);
    expect(screenshareSegment?.rbacResource).toBeUndefined();
    // Visible to the same audiences as the other Voice-related tabs.
    expect(screenshareSegment?.mentorVisibility).toEqual(
      expect.arrayContaining([
        MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
        MentorVisibilityEnum.VIEWABLE_BY_TENANT_STUDENTS,
      ]),
    );
    expect(screenshareSegment?.userTypes).toEqual(
      expect.arrayContaining([UserType.ADMIN, UserType.FREE_TRIAL]),
    );
  });

  describe('enabledThroughConfig gating', () => {
    it('hides the Screen Share tab when isScreenshareEnabled is false', () => {
      const ctx = buildContext({
        flags: { ...baseFlags, isScreenshareEnabled: false },
      });
      const labels = filterMentorSegments(MENTOR_SEGMENTS, ctx).map(
        (s) => s.label,
      );
      expect(labels).not.toContain('Screen Share');
    });

    it('shows the Screen Share tab when isScreenshareEnabled is true', () => {
      const ctx = buildContext({
        flags: { ...baseFlags, isScreenshareEnabled: true },
      });
      const labels = filterMentorSegments(MENTOR_SEGMENTS, ctx).map(
        (s) => s.label,
      );
      expect(labels).toContain('Screen Share');
    });

    it('still hides Screen Share when isScreenshareEnabled is true but the user-type is not allowed', () => {
      const ctx = buildContext({
        flags: { ...baseFlags, isScreenshareEnabled: true },
        isUserTypeAllowed: (segment) =>
          segment.userTypes.includes(UserType.FREE_TRIAL) &&
          !segment.userTypes.includes(UserType.ADMIN),
        mentorSettings: {
          platform_key: 'custom-tenant',
          mentor_visibility: MentorVisibilityEnum.VIEWABLE_BY_TENANT_STUDENTS,
          mentor_id: 42,
          permissions: { field: {} },
        },
      });
      // Sanity: the segment registers FREE_TRIAL but the test's predicate
      // disallows it — verifies the user-type filter runs orthogonally to
      // the config-flag filter.
      const labels = filterMentorSegments(MENTOR_SEGMENTS, ctx).map(
        (s) => s.label,
      );
      // FREE_TRIAL would normally see the tab, but our predicate excludes
      // any segment whose userTypes includes ADMIN — Screen Share's
      // userTypes does include ADMIN, so it gets filtered out.
      expect(labels).not.toContain('Screen Share');
    });
  });

  describe('predicate is evaluated against the live flags', () => {
    it('the enabledThroughConfig predicate returns false when the flag is false', () => {
      expect(
        screenshareSegment?.enabledThroughConfig?.({
          ...baseFlags,
          isScreenshareEnabled: false,
        }),
      ).toBe(false);
    });

    it('the enabledThroughConfig predicate returns true when the flag is true', () => {
      expect(
        screenshareSegment?.enabledThroughConfig?.({
          ...baseFlags,
          isScreenshareEnabled: true,
        }),
      ).toBe(true);
    });
  });
});
