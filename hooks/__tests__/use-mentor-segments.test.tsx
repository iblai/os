import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { MentorVisibilityEnum } from '@iblai/iblai-api';

import {
  useMentorSegments,
  MENTOR_SEGMENTS,
  MENTOR_SEGMENT_NAV_CATEGORIES,
} from '../use-mentor-segments';
import { MODALS, UserType } from '@/lib/constants';
import { EDIT_MENTOR_TAB_COMPONENTS } from '@/components/modals/edit-mentor-modal';

// ----------------------------------------------------------------------------
// Mocks
//
// The hook composes a handful of other hooks (data-layer queries, redux
// selectors, navigation). We mock all of them so we can drive the inputs
// directly and assert on the filtered output.
// ----------------------------------------------------------------------------

const mockMentorSettings = vi.fn();
const mockMemsearchEnabled = vi.fn();
const mockClawMentorConfig = vi.fn();
const mockGetMentorId = vi.fn();
const mockTenantKey = vi.fn();
const mockMentorIdParam = vi.fn();
const mockIsAdmin = vi.fn();
const mockUsername = vi.fn();
const mockRbacPermissions = vi.fn();
const mockIsUserTypeAllowed = vi.fn();
const mockUserType = vi.fn();
const mockCheckRbacPermission = vi.fn();

vi.mock('next/navigation', () => ({
  useParams: () => ({
    tenantKey: mockTenantKey(),
    mentorId: mockMentorIdParam(),
  }),
}));

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useGetMentorSettingsQuery: () => ({
    data: mockMentorSettings(),
    isSuccess: mockMentorSettings() !== undefined,
  }),
  useGetMemsearchStatusQuery: () => ({
    data: { enable_memsearch: mockMemsearchEnabled() },
  }),
  useGetClawMentorConfigQuery: () => ({ data: mockClawMentorConfig() }),
}));

vi.mock('@/hooks/use-user', () => ({
  useIsAdmin: () => mockIsAdmin(),
  useUsername: () => mockUsername(),
}));

vi.mock('@/hooks/use-user-type', () => ({
  useUserType: () => ({
    isUserTypeAllowed: (segment: { userTypes: string[] }) =>
      mockIsUserTypeAllowed(segment),
    userType: mockUserType(),
  }),
}));

vi.mock('@/hooks/user-navigate', () => ({
  useNavigate: () => ({
    getMentorId: () => mockGetMentorId(),
  }),
}));

vi.mock('@/lib/hooks', () => ({
  useAppSelector: () => mockRbacPermissions(),
}));

vi.mock('@/features/rbac/rbac-slice', () => ({
  selectRbacPermissions: vi.fn(),
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
  checkRbacPermission: (...args: unknown[]) => mockCheckRbacPermission(...args),
}));

// Mocked so EDIT_MENTOR_TAB_COMPONENTS can import SandboxTab/SkillsTab without
// pulling in @iblai/web-utils -> axios, which fails to resolve in tests.
vi.mock('@iblai/iblai-js/web-containers', () => ({
  SandboxConfig: () => null,
  AgentSkills: () => null,
  AgentConfigPrompts: () => null,
}));

// Same reasoning as above for the Next-only entrypoint that ships the
// AgentPrivacyTab component used by PrivacyTab.
vi.mock('@iblai/iblai-js/web-containers/next', () => ({
  AgentPrivacyTab: () => null,
  AgentTasksTab: () => null,
  AgentSettingsProvider: () => null,
}));

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

const setupDefaults = () => {
  mockTenantKey.mockReturnValue('custom-tenant');
  mockMentorIdParam.mockReturnValue('mentor-from-url');
  mockGetMentorId.mockReturnValue(undefined);
  mockIsAdmin.mockReturnValue(true);
  mockUsername.mockReturnValue('alice');
  mockRbacPermissions.mockReturnValue({});
  mockIsUserTypeAllowed.mockImplementation((s) =>
    s.userTypes.includes(UserType.ADMIN),
  );
  mockUserType.mockReturnValue(UserType.ADMIN);
  mockMemsearchEnabled.mockReturnValue(true);
  // Default: a wired claw-config exists, so Skills tab gating only depends on
  // isClawEnabled in most existing tests. Tests that need the unwired state
  // override this in their own arrangement.
  mockClawMentorConfig.mockReturnValue({ id: 1, enabled: true, server: 7 });
  mockMentorSettings.mockReturnValue({
    platform_key: 'custom-tenant',
    mentor_visibility: MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
    mentor_id: 42,
    permissions: { field: {} },
    enable_memory_component: true,
    // Default the privacy router on so the Privacy segment shows up in the
    // canonical fully-permitted case. Gating-specific tests override it.
    enable_privacy_router: true,
  });
  mockCheckRbacPermission.mockReturnValue(true);
};

describe('useMentorSegments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaults();
  });

  it('returns the canonical 24 mentor segments unfiltered', () => {
    const { result } = renderHook(() => useMentorSegments());
    expect(result.current.segments).toBe(MENTOR_SEGMENTS);
    // 17 original + Voice + Screen Share (feat/mentor/1763) + Tasks
    // (feat/mentor/715) + LTI + Analytics hub (feat/2040) + Grader
    // (feat/2272).
    expect(MENTOR_SEGMENTS).toHaveLength(24);
  });

  it('places the Sandbox segment right after Settings', () => {
    const settingsIndex = MENTOR_SEGMENTS.findIndex(
      (s) => s.label === 'Settings',
    );
    expect(MENTOR_SEGMENTS[settingsIndex + 1]?.label).toBe('Sandbox');
  });

  it('places the Skills segment right after Prompts', () => {
    const promptsIndex = MENTOR_SEGMENTS.findIndex(
      (s) => s.label === 'Prompts',
    );
    expect(MENTOR_SEGMENTS[promptsIndex + 1]?.label).toBe('Skills');
  });

  describe('Sandbox & Skills visibility (always visible for admins)', () => {
    // The enable_claw / clawConfigExists gates were removed: the Sandbox and
    // Skills tabs are now always visible to admins. The master toggle lives
    // inline on the Sandbox tab, and Skills renders a grayed "connect a
    // sandbox" preview until an instance is wired.
    it('shows Sandbox and Skills even when enable_claw is false', () => {
      mockMentorSettings.mockReturnValue({
        platform_key: 'custom-tenant',
        mentor_visibility: MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
        mentor_id: 42,
        permissions: { field: {} },
        enable_claw: false,
      });

      const { result } = renderHook(() => useMentorSegments());
      const labels = result.current.filteredSegments.map((s) => s.label);

      expect(labels).toContain('Sandbox');
      expect(labels).toContain('Skills');
    });

    it('shows Sandbox and Skills when enable_claw is missing', () => {
      mockMentorSettings.mockReturnValue({
        platform_key: 'custom-tenant',
        mentor_visibility: MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
        mentor_id: 42,
        permissions: { field: {} },
      });

      const { result } = renderHook(() => useMentorSegments());
      const labels = result.current.filteredSegments.map((s) => s.label);

      expect(labels).toContain('Sandbox');
      expect(labels).toContain('Skills');
    });

    it('shows Sandbox and Skills when enable_claw is true', () => {
      mockMentorSettings.mockReturnValue({
        platform_key: 'custom-tenant',
        mentor_visibility: MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
        mentor_id: 42,
        permissions: { field: {} },
        enable_claw: true,
      });

      const { result } = renderHook(() => useMentorSegments());
      const labels = result.current.filteredSegments.map((s) => s.label);

      expect(labels).toContain('Sandbox');
      expect(labels).toContain('Skills');
    });

    it('hides Sandbox and Skills from non-admin users (still user-type gated)', () => {
      mockMentorSettings.mockReturnValue({
        platform_key: 'custom-tenant',
        mentor_visibility: MentorVisibilityEnum.VIEWABLE_BY_TENANT_STUDENTS,
        mentor_id: 42,
        permissions: { field: {} },
        enable_claw: true,
      });
      mockIsUserTypeAllowed.mockImplementation(
        (s) =>
          s.userTypes.includes(UserType.FREE_TRIAL) &&
          !s.userTypes.includes(UserType.ADMIN),
      );

      const { result } = renderHook(() => useMentorSegments());
      const labels = result.current.filteredSegments.map((s) => s.label);

      expect(labels).not.toContain('Sandbox');
      expect(labels).not.toContain('Skills');
    });

    it('isSegmentVisible returns true for Sandbox regardless of enable_claw', () => {
      const sandboxSegment = MENTOR_SEGMENTS.find(
        (s) => s.label === 'Sandbox',
      )!;

      mockMentorSettings.mockReturnValue({
        platform_key: 'custom-tenant',
        mentor_visibility: MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
        mentor_id: 42,
        permissions: { field: {} },
        enable_claw: true,
      });
      const { result } = renderHook(() => useMentorSegments());
      expect(result.current.isSegmentVisible(sandboxSegment)).toBe(true);

      mockMentorSettings.mockReturnValue({
        platform_key: 'custom-tenant',
        mentor_visibility: MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
        mentor_id: 42,
        permissions: { field: {} },
        enable_claw: false,
      });
      const { result: result2 } = renderHook(() => useMentorSegments());
      expect(result2.current.isSegmentVisible(sandboxSegment)).toBe(true);
    });
  });

  it('returns the filtered segment list for an admin on a non-main tenant', () => {
    const { result } = renderHook(() => useMentorSegments());

    const labels = result.current.filteredSegments.map((s) => s.label);
    // Admin on a custom tenant should see all segments that pass user-type
    // and config gates.
    expect(labels).toContain('Settings');
    expect(labels).toContain('LLM');
    expect(labels).toContain('Memory'); // memsearch is enabled
  });

  it('shows the Memory segment even when memsearch is disabled (always visible)', () => {
    // The memsearch / enable_memory_component gates were removed — Memory is
    // always visible now, with the master toggle inline on the Memory tab.
    mockMemsearchEnabled.mockReturnValue(false);

    const { result } = renderHook(() => useMentorSegments());

    const labels = result.current.filteredSegments.map((s) => s.label);
    expect(labels).toContain('Memory');
    expect(labels).toContain('Settings');
    expect(labels).toContain('LLM');
  });

  it('shows the Memory segment when memsearch is enabled', () => {
    mockMemsearchEnabled.mockReturnValue(true);

    const { result } = renderHook(() => useMentorSegments());

    const labels = result.current.filteredSegments.map((s) => s.label);
    expect(labels).toContain('Memory');
  });

  it('shows the Memory segment even when enable_memory_component is false (always visible)', () => {
    mockMemsearchEnabled.mockReturnValue(true);
    mockMentorSettings.mockReturnValue({
      platform_key: 'custom-tenant',
      mentor_visibility: MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
      mentor_id: 42,
      permissions: { field: {} },
      enable_memory_component: false,
    });

    const { result } = renderHook(() => useMentorSegments());

    const labels = result.current.filteredSegments.map((s) => s.label);
    expect(labels).toContain('Memory');
    expect(labels).toContain('Settings');
  });

  describe('Privacy segment gating', () => {
    it('shows Privacy even when enable_privacy_router is false (always visible)', () => {
      // The enable_privacy_router gate was removed — Privacy is always visible
      // now, with the master toggle inline on the Privacy tab.
      mockMentorSettings.mockReturnValue({
        platform_key: 'custom-tenant',
        mentor_visibility: MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
        mentor_id: 42,
        permissions: { field: {} },
        enable_memory_component: true,
        enable_privacy_router: false,
      });

      const { result } = renderHook(() => useMentorSegments());

      const labels = result.current.filteredSegments.map((s) => s.label);
      expect(labels).toContain('Privacy');
      expect(labels).toContain('Settings');
    });

    it('shows Privacy when enable_privacy_router is true', () => {
      mockMentorSettings.mockReturnValue({
        platform_key: 'custom-tenant',
        mentor_visibility: MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
        mentor_id: 42,
        permissions: { field: {} },
        enable_memory_component: true,
        enable_privacy_router: true,
      });

      const { result } = renderHook(() => useMentorSegments());

      const labels = result.current.filteredSegments.map((s) => s.label);
      expect(labels).toContain('Privacy');
    });
  });

  describe('LTI segment', () => {
    it('orders LTI immediately before Embed', () => {
      const ltiIndex = MENTOR_SEGMENTS.findIndex((s) => s.label === 'LTI');
      expect(ltiIndex).toBeGreaterThanOrEqual(0);
      expect(MENTOR_SEGMENTS[ltiIndex + 1]?.label).toBe('Embed');
    });

    it('is NOT gated on is_lti_accessible (no enabledThroughConfig)', () => {
      // Unlike Voice/Screen-share, the LTI tab must stay reachable so an admin
      // can create the first link (which turns LTI access on inline).
      const ltiSegment = MENTOR_SEGMENTS.find((s) => s.label === 'LTI')!;
      expect(ltiSegment.enabledThroughConfig).toBeUndefined();
    });

    it('is visible to admins regardless of the is_lti_accessible value', () => {
      for (const value of [false, undefined, true]) {
        mockMentorSettings.mockReturnValue({
          platform_key: 'custom-tenant',
          mentor_visibility: MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
          mentor_id: 42,
          permissions: { field: {} },
          is_lti_accessible: value,
        });

        const { result, unmount } = renderHook(() => useMentorSegments());
        const labels = result.current.filteredSegments.map((s) => s.label);
        expect(labels).toContain('LTI');
        unmount();
      }
    });

    it('is hidden from non-admin users', () => {
      mockMentorSettings.mockReturnValue({
        platform_key: 'custom-tenant',
        mentor_visibility: MentorVisibilityEnum.VIEWABLE_BY_TENANT_STUDENTS,
        mentor_id: 42,
        permissions: { field: {} },
        is_lti_accessible: true,
      });
      mockIsUserTypeAllowed.mockImplementation(
        (s) =>
          s.userTypes.includes(UserType.FREE_TRIAL) &&
          !s.userTypes.includes(UserType.ADMIN),
      );

      const { result } = renderHook(() => useMentorSegments());
      const labels = result.current.filteredSegments.map((s) => s.label);
      expect(labels).not.toContain('LTI');
    });
  });

  it('exposes isSegmentVisible reflecting the same filter pipeline', () => {
    const { result } = renderHook(() => useMentorSegments());

    // Memory is always visible now, so use an RBAC-gated segment (Audit) to
    // prove isSegmentVisible reflects the pipeline: visible for an admin,
    // hidden once RBAC denies the resource.
    const auditSegment = MENTOR_SEGMENTS.find((s) => s.label === 'Audit')!;
    expect(result.current.isSegmentVisible(auditSegment)).toBe(true);

    mockCheckRbacPermission.mockReturnValue(false);
    const { result: result2 } = renderHook(() => useMentorSegments());
    expect(result2.current.isSegmentVisible(auditSegment)).toBe(false);
  });

  it('recomputes filteredSegments when userType flips from ADMIN to STUDENT', () => {
    mockUserType.mockReturnValue(UserType.ADMIN);
    mockIsUserTypeAllowed.mockImplementation((s) =>
      s.userTypes.includes(UserType.ADMIN),
    );

    const { result, rerender } = renderHook(() => useMentorSegments());

    const adminLabels = result.current.filteredSegments.map((s) => s.label);
    expect(adminLabels).toContain('Access');
    expect(adminLabels).toContain('Audit');

    // Toggle to student ("User") mode: userType flips and the gate now rejects
    // any segment that isn't explicitly student-visible. Without `userType` in
    // the filterContext useMemo deps the memo stays cached (the gate is read
    // through a ref, so nothing else in the dep list changes) and the admin
    // segments would remain — this rerender is the regression guard.
    mockUserType.mockReturnValue(UserType.STUDENT);
    mockIsUserTypeAllowed.mockImplementation((s) =>
      s.userTypes.includes(UserType.STUDENT),
    );

    rerender();

    const studentLabels = result.current.filteredSegments.map((s) => s.label);
    expect(studentLabels).not.toContain('Access');
    expect(studentLabels).not.toContain('Audit');
  });

  it('filters out segments whose user type the current user lacks', () => {
    // Only allow non-admin users → Access (admin-only) should be filtered out.
    mockIsUserTypeAllowed.mockImplementation(
      (s) =>
        s.userTypes.includes(UserType.FREE_TRIAL) &&
        !s.userTypes.includes(UserType.ADMIN),
    );

    const { result } = renderHook(() => useMentorSegments());
    const labels = result.current.filteredSegments.map((s) => s.label);
    expect(labels).not.toContain('Access');
  });

  describe('main-tenant visibility edge cases', () => {
    it('hides every segment from a non-admin on the main tenant', () => {
      mockIsAdmin.mockReturnValue(false);
      mockTenantKey.mockReturnValue('main');
      mockIsUserTypeAllowed.mockReturnValue(true);
      mockMentorSettings.mockReturnValue({
        platform_key: 'main',
        mentor_visibility: MentorVisibilityEnum.VIEWABLE_BY_TENANT_STUDENTS,
        mentor_id: 42,
        permissions: { field: {} },
        enable_memory_component: true,
        enable_privacy_router: true,
      });

      const { result } = renderHook(() => useMentorSegments());

      expect(result.current.filteredSegments).toHaveLength(0);
    });
  });

  describe('nullish input fallbacks', () => {
    it('resolves without throwing when the username is undefined', () => {
      mockUsername.mockReturnValue(undefined);

      const { result } = renderHook(() => useMentorSegments());

      expect(Array.isArray(result.current.filteredSegments)).toBe(true);
    });

    it('resolves without throwing when enable_memsearch is undefined', () => {
      // Memory is no longer gated on memsearch, so it stays visible; this just
      // guards against the undefined flag breaking the pipeline.
      mockMemsearchEnabled.mockReturnValue(undefined);

      const { result } = renderHook(() => useMentorSegments());

      const labels = result.current.filteredSegments.map((s) => s.label);
      expect(labels).toContain('Memory');
    });
  });

  describe('Audit segment RBAC gating', () => {
    it('declares the view_audit_logs rbac resource on the Audit segment', () => {
      const auditSegment = MENTOR_SEGMENTS.find((s) => s.label === 'Audit');
      expect(auditSegment).toBeDefined();
      expect(auditSegment!.rbacResource).toBeDefined();
      expect(auditSegment!.rbacResource!(42)).toBe(
        '/mentors/42/#view_audit_logs',
      );
    });

    it('hides the Audit segment when checkRbacPermission denies view_audit_logs', () => {
      mockCheckRbacPermission.mockImplementation(
        (_permissions: unknown, resource: string) =>
          resource !== '/mentors/42/#view_audit_logs',
      );

      const { result } = renderHook(() => useMentorSegments());

      const labels = result.current.filteredSegments.map((s) => s.label);
      expect(labels).not.toContain('Audit');
      // Other segments still pass
      expect(labels).toContain('Settings');
    });

    it('shows the Audit segment when checkRbacPermission grants view_audit_logs', () => {
      mockCheckRbacPermission.mockReturnValue(true);

      const { result } = renderHook(() => useMentorSegments());

      const labels = result.current.filteredSegments.map((s) => s.label);
      expect(labels).toContain('Audit');
    });
  });

  describe('Grader segment visibility (admin-only)', () => {
    it('declares no rbac resource and gates on ADMIN only', () => {
      // The backend does not expose grader RBAC resources yet, so the
      // segment is admin-only via userTypes (mirroring Tasks / LTI).
      // Re-add the rbacResource assertion once the permissions land.
      const graderSegment = MENTOR_SEGMENTS.find((s) => s.label === 'Grader');
      expect(graderSegment).toBeDefined();
      expect(graderSegment!.rbacResource).toBeUndefined();
      expect(graderSegment!.userTypes).toEqual([UserType.ADMIN]);
    });

    it('shows the Grader segment for admins', () => {
      const { result } = renderHook(() => useMentorSegments());

      const labels = result.current.filteredSegments.map((s) => s.label);
      expect(labels).toContain('Grader');
    });

    it('hides the Grader segment when the user type filter rejects admin-only segments', () => {
      mockIsUserTypeAllowed.mockImplementation(
        (segment: { userTypes: string[] }) =>
          !(
            segment.userTypes.length === 1 &&
            segment.userTypes[0] === UserType.ADMIN
          ),
      );

      const { result } = renderHook(() => useMentorSegments());

      const labels = result.current.filteredSegments.map((s) => s.label);
      expect(labels).not.toContain('Grader');
      // Non-admin-only segments still pass
      expect(labels).toContain('Settings');
    });
  });

  describe('preferModalMentorId option', () => {
    it('uses the URL mentor id by default (NavBar behavior)', () => {
      mockGetMentorId.mockReturnValue('mentor-from-modal-stack');
      mockMentorIdParam.mockReturnValue('mentor-from-url');

      // Using the default (preferModalMentorId: false) means we should NOT
      // observe the modal-stack mentor id influencing anything; the hook
      // still resolves a list because mentorSettings comes from the mock.
      const { result } = renderHook(() => useMentorSegments());
      expect(result.current.filteredSegments.length).toBeGreaterThan(0);
    });

    it('falls back to the URL mentor id when no modal mentor is set', () => {
      mockGetMentorId.mockReturnValue(undefined);
      mockMentorIdParam.mockReturnValue('mentor-from-url');

      const { result } = renderHook(() =>
        useMentorSegments({ preferModalMentorId: true }),
      );
      expect(result.current.filteredSegments.length).toBeGreaterThan(0);
    });

    it('prefers the modal mentor id when set and the option is enabled', () => {
      mockGetMentorId.mockReturnValue('mentor-from-modal-stack');
      mockMentorIdParam.mockReturnValue('mentor-from-url');

      const { result } = renderHook(() =>
        useMentorSegments({ preferModalMentorId: true }),
      );
      expect(result.current.filteredSegments.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // SKILLS — now always visible; the "connect a sandbox" state is handled by
  // the tab content (grayed preview), not by hiding the segment.
  // ==========================================================================

  describe('Skills tab — always visible for admins', () => {
    const adminClawEnabledSettings = {
      platform_key: 'custom-tenant',
      mentor_visibility: MentorVisibilityEnum.VIEWABLE_BY_TENANT_ADMINS,
      mentor_id: 42,
      mentor_unique_id: 'mentor-uuid-123',
      permissions: { field: {} },
      enable_claw: true,
    };

    it('shows both Sandbox and Skills when claw is enabled but no config wired', () => {
      mockMentorSettings.mockReturnValue(adminClawEnabledSettings);
      mockClawMentorConfig.mockReturnValue(null); // 404 → null

      const { result } = renderHook(() => useMentorSegments());
      const labels = result.current.filteredSegments.map((s) => s.label);

      expect(labels).toContain('Sandbox');
      expect(labels).toContain('Skills');
    });

    it('shows both Sandbox and Skills when claw is enabled AND a config is wired', () => {
      mockMentorSettings.mockReturnValue(adminClawEnabledSettings);
      mockClawMentorConfig.mockReturnValue({ id: 1, enabled: true, server: 7 });

      const { result } = renderHook(() => useMentorSegments());
      const labels = result.current.filteredSegments.map((s) => s.label);

      expect(labels).toContain('Sandbox');
      expect(labels).toContain('Skills');
    });

    it('shows both Sandbox and Skills even when claw is disabled', () => {
      mockMentorSettings.mockReturnValue({
        ...adminClawEnabledSettings,
        enable_claw: false,
      });
      mockClawMentorConfig.mockReturnValue(null);

      const { result } = renderHook(() => useMentorSegments());
      const labels = result.current.filteredSegments.map((s) => s.label);

      expect(labels).toContain('Skills');
      expect(labels).toContain('Sandbox');
    });
  });
});

describe('EDIT_MENTOR_TAB_COMPONENTS coverage', () => {
  it('has a component entry for every mentor segment', () => {
    // If a segment is added to MENTOR_SEGMENTS without a matching component
    // mapping in the modal, the rendered tab panel would be `undefined`.
    // This test ensures any new segment is paired with a component.
    const missing = MENTOR_SEGMENTS.filter(
      (segment) => !(segment.value in EDIT_MENTOR_TAB_COMPONENTS),
    );
    expect(missing.map((s) => s.label)).toEqual([]);
  });

  it('only contains keys that correspond to known mentor segments', () => {
    const segmentValues = new Set(MENTOR_SEGMENTS.map((s) => s.value));
    const orphaned = Object.keys(EDIT_MENTOR_TAB_COMPONENTS).filter(
      (value) => !segmentValues.has(value),
    );
    expect(orphaned).toEqual([]);
  });

  it('uses canonical EDIT_MENTOR tab keys', () => {
    // Smoke check that the values line up with the global MODALS constants.
    expect(MENTOR_SEGMENTS.find((s) => s.label === 'Settings')?.value).toBe(
      MODALS.EDIT_MENTOR.tabs.settings,
    );
    expect(MENTOR_SEGMENTS.find((s) => s.label === 'Memory')?.value).toBe(
      MODALS.EDIT_MENTOR.tabs.memory,
    );
  });

  it('gives every canonical segment a navCategory', () => {
    // The categorized layout (modal sidebar + nav-bar dropdown) silently
    // skips any segment without a navCategory — see the early `continue`
    // in EditMentorModal's bucketing and the `.filter((s) => s.navCategory)`
    // in the NavBar. A canonical segment missing one renders nowhere. This
    // guards the regression where Evals shipped without a category and
    // disappeared from both consumers.
    const uncategorized = MENTOR_SEGMENTS.filter((s) => !s.navCategory);
    expect(uncategorized.map((s) => s.label)).toEqual([]);
  });

  it('assigns the Evals segment a known nav category', () => {
    // Which bucket Evals lives in is a product call; what matters for the
    // layout is that it has one (covered above too). Assert the value is a
    // recognised category rather than pinning a specific bucket.
    const evals = MENTOR_SEGMENTS.find((s) => s.label === 'Evals');
    const known = MENTOR_SEGMENT_NAV_CATEGORIES.map((c) => c.key);
    expect(evals?.navCategory).toBeDefined();
    expect(known).toContain(evals?.navCategory);
  });
});
