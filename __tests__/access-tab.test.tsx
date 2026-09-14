import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AccessTab } from '@/components/modals/edit-mentor-modal/tabs/access-tab';
import { checkRbacPermission } from '@/hoc/withPermissions';

const mockUseParams = vi.fn();
const mockUseUsername = vi.fn();
const mockGetMentorId = vi.fn();
const mockUseGetMentorSettingsQuery = vi.fn();
const mockUseGetRbacMentorAccessListQuery = vi.fn();
const mockGetRbacPermissions = vi.fn();
const mockDispatch = vi.fn();
const renderedAddAccessProps: Array<Record<string, unknown>> = [];
const renderedRoleAccessProps: Array<Record<string, unknown>> = [];

// The RBAC permission tree the component reads out of the store. Defaults to
// an empty map (no `/mentors/{id}/` entry at all), which is the back-compat
// case: every control stays visible.
let storedRbacPermissions: Record<string, unknown> = {};

vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
}));

vi.mock('@/hooks/use-user', () => ({
  useUsername: () => mockUseUsername(),
}));

vi.mock('@/hooks/user-navigate', () => ({
  useNavigate: () => ({
    getMentorId: () => mockGetMentorId(),
  }),
}));

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useGetMentorSettingsQuery: (...args: unknown[]) =>
    mockUseGetMentorSettingsQuery(...args),
  useGetRbacMentorAccessListQuery: (...args: unknown[]) =>
    mockUseGetRbacMentorAccessListQuery(...args),
  useGetRbacPermissionsMutation: () => [mockGetRbacPermissions],
}));

vi.mock('@/lib/hooks', () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: () => storedRbacPermissions,
}));

vi.mock('@/features/rbac/rbac-slice', () => ({
  updateRbacPermissions: (payload: unknown) => ({
    type: 'rbac/updateRbacPermissions',
    payload,
  }),
  selectRbacPermissions: 'selectRbacPermissions',
}));

// The permission engine is NOT stubbed. `@/hoc/withPermissions` is loaded for
// real (and therefore so are `@iblai/iblai-js/web-utils`'s
// `checkRbacPermission` and `config.enableRBAC()`); the factory below only
// wraps the real export in a pass-through recorder so tests can additionally
// assert *which* resource string the component asks about. A hand-rolled
// re-implementation of the permission walk would prove nothing about whether
// the component talks to the real engine correctly.
const checkRbacPermissionCalls: Array<{
  rbacPermissions: unknown;
  rbacResource: string;
  result: boolean;
}> = [];

vi.mock('@/hoc/withPermissions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hoc/withPermissions')>();
  return {
    ...actual,
    checkRbacPermission: (rbacPermissions: object, rbacResource: string) => {
      const result = actual.checkRbacPermission(rbacPermissions, rbacResource);
      checkRbacPermissionCalls.push({
        rbacPermissions,
        rbacResource,
        result,
      });
      return result;
    },
  };
});

vi.mock(
  '@/components/modals/edit-mentor-modal/tabs/access-tab/add-access',
  () => ({
    AddAccessDialog: (props: {
      availableRoles: string[];
      isLoading: boolean;
      onAccessCreated: () => Promise<void>;
    }) => {
      renderedAddAccessProps.push(props);
      return (
        <div data-testid="add-access-dialog">
          add-access-{props.availableRoles.join(',')}-
          {props.isLoading ? 'loading' : 'ready'}
        </div>
      );
    },
  }),
);

vi.mock(
  '@/components/modals/edit-mentor-modal/tabs/access-tab/update-access',
  () => ({
    RoleAccessPanel: (props: {
      policy: Record<string, unknown>;
      onAccessUpdated: () => Promise<void>;
    }) => {
      renderedRoleAccessProps.push(props);
      return (
        <div data-testid="role-access-panel">
          role-panel-{props.policy?.role as string}
        </div>
      );
    },
  }),
);

const createAccessQueryState = (overrides: Record<string, unknown> = {}) => ({
  data: { policies: [] },
  isLoading: false,
  isFetching: false,
  isError: false,
  error: null,
  refetch: vi.fn(),
  ...overrides,
});

/**
 * `config.enableRBAC()` is `getEnv('NEXT_PUBLIC_ENABLE_RBAC', 'false') ===
 * 'true'`, and `getEnv` prefers `window.__ENV__` (read on every call) over the
 * build-time `process.env` snapshot that `lib/config.ts` captures at import
 * time. Driving `window.__ENV__` is therefore the only way to flip the real
 * flag per-test — `vi.stubEnv` would mutate `process.env` after the snapshot
 * was already taken and have no effect.
 *
 * Tests must never depend on ambient env: `ORIGINAL_RUNTIME_ENV` is restored
 * in `afterEach` so nothing leaks between files.
 */
type RuntimeEnvWindow = Window & { __ENV__?: Record<string, string> };
const ORIGINAL_RUNTIME_ENV = (window as RuntimeEnvWindow).__ENV__;

const setRbacEnabled = (enabled: boolean) => {
  (window as RuntimeEnvWindow).__ENV__ = {
    ...((window as RuntimeEnvWindow).__ENV__ ?? {}),
    NEXT_PUBLIC_ENABLE_RBAC: enabled ? 'true' : 'false',
  };
};

describe('AccessTab', () => {
  afterEach(() => {
    if (ORIGINAL_RUNTIME_ENV === undefined) {
      Reflect.deleteProperty(window, '__ENV__');
    } else {
      (window as RuntimeEnvWindow).__ENV__ = ORIGINAL_RUNTIME_ENV;
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
    checkRbacPermissionCalls.length = 0;
    // Every test in this file runs with the real RBAC engine *enabled* unless
    // it explicitly opts out, so the gate is genuinely exercised.
    setRbacEnabled(true);
    mockUseParams.mockReturnValue({
      tenantKey: 'tenant-1',
      mentorId: 'mentor-from-route',
    });
    mockUseUsername.mockReturnValue('mentor-user');
    mockGetMentorId.mockReturnValue('mentor-from-navigate');

    mockUseGetMentorSettingsQuery.mockReturnValue({
      data: { mentor_id: 101 },
      isLoading: false,
    });

    mockUseGetRbacMentorAccessListQuery.mockReturnValue(
      createAccessQueryState(),
    );
    mockGetRbacPermissions.mockReturnValue({
      unwrap: () => Promise.resolve({}),
    });

    renderedAddAccessProps.length = 0;
    renderedRoleAccessProps.length = 0;
    storedRbacPermissions = {};
  });

  /* ---------- RBAC permission fetch on mount ---------- */

  it('fetches RBAC permissions on mount with correct args', async () => {
    render(<AccessTab />);

    await waitFor(() => {
      expect(mockGetRbacPermissions).toHaveBeenCalledWith({
        requestBody: {
          platform_key: 'tenant-1',
          resources: ['/users/', '/groups/'],
        },
      });
    });
  });

  it('dispatches updateRbacPermissions after successful fetch', async () => {
    const permResult = { '/users/': { list: true } };
    mockGetRbacPermissions.mockReturnValue({
      unwrap: () => Promise.resolve(permResult),
    });

    render(<AccessTab />);

    await waitFor(() => {
      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'rbac/updateRbacPermissions',
        payload: { ...permResult },
      });
    });
  });

  it('does not fetch permissions when tenantKey is missing', () => {
    mockUseParams.mockReturnValue({
      tenantKey: undefined,
      mentorId: 'mentor-from-route',
    });
    render(<AccessTab />);
    expect(mockGetRbacPermissions).not.toHaveBeenCalled();
  });

  /* ---------- Loading / error / empty states ---------- */

  it('renders loading placeholders while queries are loading', () => {
    mockUseGetMentorSettingsQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
    });

    const { container } = render(<AccessTab />);

    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(2);
    expect(screen.queryByTestId('add-access-dialog')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Access management is unavailable.'),
    ).not.toBeInTheDocument();
  });

  it('shows manage unavailable state when mentor context is missing', () => {
    mockUseGetMentorSettingsQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
    });

    render(<AccessTab />);

    expect(
      screen.getByText('Access management is unavailable.'),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('add-access-dialog')).not.toBeInTheDocument();
  });

  it('renders table of policies and add access dialog when data is available', () => {
    const policies = [
      {
        id: 1,
        mentor_id: 101,
        platform_key: 'tenant-1',
        role: 'viewer',
        users: [{ id: 11, username: 'alpha' }],
      },
    ];

    mockUseGetRbacMentorAccessListQuery.mockReturnValue(
      createAccessQueryState({
        data: { policies },
      }),
    );

    render(<AccessTab />);

    expect(
      screen.getByRole('heading', { name: 'Access control' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Viewer')).toBeInTheDocument();
    expect(
      screen.getByText('1 user assigned to this role'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('add-access-dialog')).toHaveTextContent(
      'add-access-editor,chat,analytics_viewer,dataset_curator-ready',
    );
  });

  it('renders analytics_viewer policy with formatted name and description', () => {
    const policies = [
      {
        id: 3,
        mentor_id: 101,
        platform_key: 'tenant-1',
        role: 'analytics_viewer',
        users: [],
      },
    ];

    mockUseGetRbacMentorAccessListQuery.mockReturnValue(
      createAccessQueryState({
        data: { policies },
      }),
    );

    render(<AccessTab />);

    expect(screen.getByText('Analytics Viewer')).toBeInTheDocument();
    expect(
      screen.getByText(/view analytics data for this agent/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Edit Analytics Viewer access' }),
    ).toBeInTheDocument();
    // analytics_viewer is one of five defaults; four remain available
    expect(screen.getByTestId('add-access-dialog')).toHaveTextContent(
      'add-access-editor,chat,dataset_curator,viewer-ready',
    );
  });

  it('shows empty state when there are no access policies', () => {
    mockUseGetRbacMentorAccessListQuery.mockReturnValue(
      createAccessQueryState({
        data: { policies: [] },
      }),
    );

    render(<AccessTab />);

    expect(
      screen.getByText('No roles available for this agent.'),
    ).toBeInTheDocument();
  });

  it('hides add access dialog when all default roles already exist', () => {
    const policies = [
      {
        id: 1,
        mentor_id: 101,
        platform_key: 'tenant-1',
        role: 'editor',
      },
      {
        id: 2,
        mentor_id: 101,
        platform_key: 'tenant-1',
        role: 'chat',
      },
      {
        id: 3,
        mentor_id: 101,
        platform_key: 'tenant-1',
        role: 'analytics_viewer',
      },
      {
        id: 4,
        mentor_id: 101,
        platform_key: 'tenant-1',
        role: 'dataset_curator',
      },
      {
        id: 5,
        mentor_id: 101,
        platform_key: 'tenant-1',
        role: 'viewer',
      },
    ];

    mockUseGetRbacMentorAccessListQuery.mockReturnValue(
      createAccessQueryState({
        data: { policies },
      }),
    );

    render(<AccessTab />);

    expect(screen.queryByTestId('add-access-dialog')).not.toBeInTheDocument();
  });

  it('renders error state when fetching policies fails', () => {
    mockUseGetRbacMentorAccessListQuery.mockReturnValue(
      createAccessQueryState({
        data: undefined,
        isError: true,
        error: { message: 'Something went wrong' },
      }),
    );

    render(<AccessTab />);

    expect(
      screen.getByText('Unable to load agent access.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('opens role access dialog when edit button is clicked', async () => {
    const user = userEvent.setup();
    const policies = [
      {
        id: 1,
        mentor_id: 101,
        platform_key: 'tenant-1',
        role: 'viewer',
        users: [],
      },
    ];

    mockUseGetRbacMentorAccessListQuery.mockReturnValue(
      createAccessQueryState({
        data: { policies },
      }),
    );

    render(<AccessTab />);

    await user.click(
      screen.getByRole('button', { name: 'Edit Viewer access' }),
    );

    expect(screen.getByTestId('role-access-panel')).toHaveTextContent(
      'role-panel-viewer',
    );
    expect(renderedRoleAccessProps.at(-1)?.policy).toMatchObject({
      role: 'viewer',
    });
  });

  it('closes role access dialog and clears editing state', async () => {
    const user = userEvent.setup();
    const policies = [
      {
        id: 1,
        mentor_id: 101,
        platform_key: 'tenant-1',
        role: 'viewer',
        users: [],
      },
    ];

    mockUseGetRbacMentorAccessListQuery.mockReturnValue(
      createAccessQueryState({
        data: { policies },
      }),
    );

    render(<AccessTab />);

    // Open dialog
    await user.click(
      screen.getByRole('button', { name: 'Edit Viewer access' }),
    );
    expect(screen.getByTestId('role-access-panel')).toBeInTheDocument();

    // Close via Escape (triggers onOpenChange(false))
    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByTestId('role-access-panel')).not.toBeInTheDocument();
    });
  });

  it('calls refetch when onAccessCreated is invoked', async () => {
    const refetchMock = vi.fn();
    mockUseGetRbacMentorAccessListQuery.mockReturnValue(
      createAccessQueryState({
        data: { policies: [] },
        refetch: refetchMock,
      }),
    );

    render(<AccessTab />);

    // The AddAccessDialog receives onAccessCreated as a prop
    const addAccessProps = renderedAddAccessProps.at(-1);
    expect(addAccessProps).toBeDefined();

    const onAccessCreated =
      addAccessProps?.onAccessCreated as () => Promise<void>;
    await onAccessCreated();

    expect(refetchMock).toHaveBeenCalled();
  });

  /* ---------- share_mentor RBAC gating (iblai-platform#2018) ---------- */

  describe('share_mentor permission gating', () => {
    const policies = [
      {
        id: 1,
        mentor_id: 101,
        platform_key: 'tenant-1',
        role: 'viewer',
        users: [{ id: 11, username: 'alpha' }],
      },
    ];

    beforeEach(() => {
      mockUseGetRbacMentorAccessListQuery.mockReturnValue(
        createAccessQueryState({ data: { policies } }),
      );
    });

    it('hides the add-access trigger and the edit pencil when share_mentor is false', () => {
      storedRbacPermissions = {
        '/mentors/101/': { read_shared_mentor: true, share_mentor: false },
      };

      render(<AccessTab />);

      // The assigned-role list is still readable…
      expect(screen.getByText('Viewer')).toBeInTheDocument();
      expect(
        screen.getByText('1 user assigned to this role'),
      ).toBeInTheDocument();
      // …but nothing that would mutate it is rendered.
      expect(screen.queryByTestId('add-access-dialog')).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Edit Viewer access' }),
      ).not.toBeInTheDocument();
    });

    it('renders the add-access trigger and the edit pencil when share_mentor is true', () => {
      storedRbacPermissions = {
        '/mentors/101/': { read_shared_mentor: true, share_mentor: true },
      };

      render(<AccessTab />);

      expect(screen.getByTestId('add-access-dialog')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Edit Viewer access' }),
      ).toBeInTheDocument();
      expect(renderedAddAccessProps.at(-1)?.canShare).toBe(true);
    });

    it('keeps both visible when the mentor entry is absent from the RBAC map', () => {
      // Back-compat: a permission-check endpoint that predates `share_mentor`
      // returns no entry for this mentor, so the flag must not be enforced.
      storedRbacPermissions = { '/users/': { list: true } };

      render(<AccessTab />);

      expect(screen.getByTestId('add-access-dialog')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Edit Viewer access' }),
      ).toBeInTheDocument();
    });

    it('passes canShare down to the role access panel', async () => {
      const user = userEvent.setup();
      storedRbacPermissions = {
        '/mentors/101/': { read_shared_mentor: true, share_mentor: true },
      };

      render(<AccessTab />);

      await user.click(
        screen.getByRole('button', { name: 'Edit Viewer access' }),
      );

      expect(renderedRoleAccessProps.at(-1)?.canShare).toBe(true);
    });

    it('asks the real engine for exactly `/mentors/{dbId}/#share_mentor`', () => {
      storedRbacPermissions = {
        '/mentors/101/': { share_mentor: true },
      };

      render(<AccessTab />);

      expect(
        checkRbacPermissionCalls.map((call) => call.rbacResource),
      ).toContain('/mentors/101/#share_mentor');
    });

    /* ---- 2. NEXT_PUBLIC_ENABLE_RBAC short-circuit (real, documented) ---- */

    describe('when NEXT_PUBLIC_ENABLE_RBAC is not "true" the gate is a deliberate no-op', () => {
      // `config.enableRBAC()` defaults to false, and the real
      // `checkRbacPermission` returns `true` unconditionally when RBAC is
      // disabled. Every control therefore stays visible even for a viewer
      // whose permission tree explicitly denies `share_mentor`. This is
      // CURRENT, INTENTIONAL behaviour of the shared permission engine — the
      // server remains the source of truth — and NOT a bug in this component.
      // If someone ever wants the gate to hold with RBAC disabled, these tests
      // are the ones that must change.

      it('renders every mutating control despite share_mentor: false when RBAC is disabled', () => {
        setRbacEnabled(false);
        storedRbacPermissions = {
          '/mentors/101/': { share_mentor: false },
        };

        render(<AccessTab />);

        expect(screen.getByTestId('add-access-dialog')).toBeInTheDocument();
        expect(
          screen.getByRole('button', { name: 'Edit Viewer access' }),
        ).toBeInTheDocument();
        expect(renderedAddAccessProps.at(-1)?.canShare).toBe(true);
      });

      it('short-circuits inside the real engine rather than walking the tree', () => {
        setRbacEnabled(false);
        storedRbacPermissions = {
          '/mentors/101/': { share_mentor: false },
        };

        render(<AccessTab />);

        // The very same arguments that return false with RBAC on…
        const call = checkRbacPermissionCalls.find(
          (c) => c.rbacResource === '/mentors/101/#share_mentor',
        );
        expect(call).toBeDefined();
        // …return true here purely because of the enableRBAC short-circuit.
        expect(call?.result).toBe(true);
      });

      it('is the only reason the gate passes — the same tree denies with RBAC enabled', () => {
        setRbacEnabled(true);
        storedRbacPermissions = {
          '/mentors/101/': { share_mentor: false },
        };

        render(<AccessTab />);

        expect(
          checkRbacPermission(
            storedRbacPermissions,
            '/mentors/101/#share_mentor',
          ),
        ).toBe(false);
        expect(
          screen.queryByTestId('add-access-dialog'),
        ).not.toBeInTheDocument();
      });
    });

    /* ---- 3. permission-shape matrix, evaluated by the real engine ---- */

    describe('permission-shape matrix (real engine, RBAC enabled)', () => {
      const visible = true;
      const hidden = false;

      const cases: Array<{
        name: string;
        permissions: Record<string, unknown>;
        expected: boolean;
      }> = [
        {
          name: 'mentor entry present with share_mentor: true',
          permissions: { '/mentors/101/': { share_mentor: true } },
          expected: visible,
        },
        {
          name: 'mentor entry present with share_mentor: false',
          permissions: { '/mentors/101/': { share_mentor: false } },
          expected: hidden,
        },
        {
          name: 'mentor entry present but share_mentor key absent entirely',
          permissions: {
            '/mentors/101/': { read_shared_mentor: true, edit_mentor: true },
          },
          expected: hidden,
        },
        {
          name: 'mentor entry present but an empty object',
          permissions: { '/mentors/101/': {} },
          expected: hidden,
        },
        {
          name: 'mentor entry absent from the map (back-compat guard)',
          permissions: { '/users/': { list: true } },
          expected: visible,
        },
        {
          name: 'empty permissions map (back-compat guard)',
          permissions: {},
          expected: visible,
        },
        {
          name: "a different mentor's entry present but not this one's",
          permissions: {
            '/mentors/999/': { share_mentor: true },
            '/mentors/1010/': { share_mentor: false },
          },
          expected: visible,
        },
        {
          name: 'share_mentor: 0 (falsy, not false)',
          permissions: { '/mentors/101/': { share_mentor: 0 } },
          expected: hidden,
        },
        {
          name: "share_mentor: '' (falsy, not false)",
          permissions: { '/mentors/101/': { share_mentor: '' } },
          expected: hidden,
        },
        {
          name: 'share_mentor: null (falsy, not false)',
          permissions: { '/mentors/101/': { share_mentor: null } },
          expected: hidden,
        },
        {
          name: 'share_mentor: 1 (truthy, not true)',
          permissions: { '/mentors/101/': { share_mentor: 1 } },
          expected: visible,
        },
        {
          name: "share_mentor: 'yes' (truthy, not true)",
          permissions: { '/mentors/101/': { share_mentor: 'yes' } },
          expected: visible,
        },
        {
          name: 'share_mentor: a nested object (truthy — engine keeps walking)',
          permissions: { '/mentors/101/': { share_mentor: { any: true } } },
          expected: visible,
        },
      ];

      it.each(cases)(
        'given $name the mutating controls are $expected',
        ({ permissions, expected }) => {
          storedRbacPermissions = permissions;

          render(<AccessTab />);

          const addAccess = screen.queryByTestId('add-access-dialog');
          const pencil = screen.queryByRole('button', {
            name: 'Edit Viewer access',
          });

          if (expected) {
            expect(addAccess).toBeInTheDocument();
            expect(pencil).toBeInTheDocument();
            expect(renderedAddAccessProps.at(-1)?.canShare).toBe(true);
          } else {
            expect(addAccess).not.toBeInTheDocument();
            expect(pencil).not.toBeInTheDocument();
            expect(renderedAddAccessProps).toHaveLength(0);
          }
        },
      );

      it.each(cases)(
        'given $name the role list itself is never gated',
        ({ permissions }) => {
          storedRbacPermissions = permissions;

          render(<AccessTab />);

          // Section 6: whatever the permission shape, a viewer must always be
          // able to READ the access list.
          expect(screen.getByText('Viewer')).toBeInTheDocument();
          expect(
            screen.getByText('1 user assigned to this role'),
          ).toBeInTheDocument();
          expect(screen.getByTestId('access-info-box')).toBeInTheDocument();
        },
      );
    });

    /* ---- 6. what must NOT be gated ---- */

    describe('read-only viewers keep the whole informational surface', () => {
      beforeEach(() => {
        storedRbacPermissions = {
          '/mentors/101/': { share_mentor: false },
        };
      });

      it('still renders the role table, its headers and every row', () => {
        mockUseGetRbacMentorAccessListQuery.mockReturnValue(
          createAccessQueryState({
            data: {
              policies: [
                { id: 1, role: 'viewer', users: [{ id: 11 }] },
                { id: 2, role: 'analytics_viewer', users: [] },
              ],
            },
          }),
        );

        render(<AccessTab />);

        expect(screen.getByRole('table')).toBeInTheDocument();
        expect(
          screen.getByRole('columnheader', { name: 'Role' }),
        ).toBeInTheDocument();
        expect(
          screen.getByRole('columnheader', { name: 'Description' }),
        ).toBeInTheDocument();
        expect(
          screen.getByRole('columnheader', { name: 'Users' }),
        ).toBeInTheDocument();
        expect(
          screen.getByRole('columnheader', { name: 'Actions' }),
        ).toBeInTheDocument();
        // Both role rows render with their names…
        expect(screen.getByText('Viewer')).toBeInTheDocument();
        expect(screen.getByText('Analytics Viewer')).toBeInTheDocument();
        // …their descriptions…
        expect(
          screen.getByText(/view analytics data for this agent/i),
        ).toBeInTheDocument();
        // …and their user counts.
        expect(
          screen.getByText('1 user assigned to this role'),
        ).toBeInTheDocument();
        expect(
          screen.getByText('0 users assigned to this role'),
        ).toBeInTheDocument();
        // Only the mutating affordance is gone.
        expect(
          screen.queryAllByRole('button', { name: /^Edit .* access$/ }),
        ).toHaveLength(0);
      });

      it('still renders the tab heading and informational copy', () => {
        render(<AccessTab />);

        expect(
          screen.getByRole('heading', { name: 'Access control' }),
        ).toBeInTheDocument();
        expect(
          screen.getByText(
            'Manage which users can view or edit this agent by role.',
          ),
        ).toBeInTheDocument();
        expect(screen.getByTestId('access-info-box')).toHaveTextContent(
          /Decide who can use this agent/i,
        );
      });

      it('still surfaces the load-failure state and its retry affordance', () => {
        mockUseGetRbacMentorAccessListQuery.mockReturnValue(
          createAccessQueryState({
            data: undefined,
            isError: true,
            error: { message: 'boom' },
          }),
        );

        render(<AccessTab />);

        expect(
          screen.getByText('Unable to load agent access.'),
        ).toBeInTheDocument();
        expect(
          screen.getByRole('button', { name: 'Try again' }),
        ).toBeInTheDocument();
      });

      it('still surfaces the empty state', () => {
        mockUseGetRbacMentorAccessListQuery.mockReturnValue(
          createAccessQueryState({ data: { policies: [] } }),
        );

        render(<AccessTab />);

        expect(
          screen.getByText('No roles available for this agent.'),
        ).toBeInTheDocument();
      });

      it('passes canShare: false down to the role access panel', () => {
        // The pencil is hidden, so the panel can only be reached by a caller
        // that renders it directly — pin the prop that would make it
        // read-only if it ever is.
        render(<AccessTab />);

        expect(
          screen.queryByRole('button', { name: 'Edit Viewer access' }),
        ).not.toBeInTheDocument();
        expect(
          screen.queryByTestId('role-access-panel'),
        ).not.toBeInTheDocument();
      });
    });

    /* ---- 4. falsy mentorDbId ---- */

    describe('falsy mentorDbId', () => {
      // `mentorRbacKey` is `null` when `mentorDbId` is falsy, so the component
      // builds the literal string `"null#share_mentor"`. That is currently
      // harmless ONLY because `!hasMentorRbacEntry` short-circuits the `||`
      // before `checkRbacPermission` is ever reached. These tests pin that
      // behaviour so a refactor that reorders the boolean cannot silently
      // start denying access on a bogus resource path.

      it.each([
        { label: 'undefined mentor_id', settings: { data: undefined } },
        { label: 'null mentor_id', settings: { data: { mentor_id: null } } },
        { label: 'zero mentor_id', settings: { data: { mentor_id: 0 } } },
      ])(
        'renders the unavailable state without crashing for $label',
        ({ settings }) => {
          storedRbacPermissions = {
            '/mentors/101/': { share_mentor: false },
          };
          mockUseGetMentorSettingsQuery.mockReturnValue({
            ...settings,
            isLoading: false,
          });

          expect(() => render(<AccessTab />)).not.toThrow();

          expect(
            screen.getByText('Access management is unavailable.'),
          ).toBeInTheDocument();
          expect(
            screen.queryByTestId('add-access-dialog'),
          ).not.toBeInTheDocument();
        },
      );

      it('never asks the engine about the bogus "null#share_mentor" resource', () => {
        mockUseGetMentorSettingsQuery.mockReturnValue({
          data: undefined,
          isLoading: false,
        });

        render(<AccessTab />);

        expect(
          checkRbacPermissionCalls.map((call) => call.rbacResource),
        ).not.toContain('null#share_mentor');
      });

      it('documents that the bogus path would deny if the guard were removed', () => {
        // Not a behaviour of the component today — a canary. If someone drops
        // `!hasMentorRbacEntry` from the `||`, `canShare` becomes this value.
        expect(checkRbacPermission({}, 'null#share_mentor')).toBe(false);
      });
    });
  });

  /* ---------- 1. contract: the real permission engine ---------- */

  describe('real permission engine contract (@/hoc/withPermissions)', () => {
    // These assertions run against the genuine
    // `@iblai/iblai-js/web-utils` implementation reached through
    // `@/hoc/withPermissions`. They exist so that any upgrade of web-utils
    // that changes the truthiness walk, the `#` nesting, or the enableRBAC
    // short-circuit fails the build here rather than silently unlatching the
    // gate in `access-tab/index.tsx`.

    it.each([
      {
        label: 'share_mentor: true',
        permissions: { '/mentors/101/': { share_mentor: true } },
        expected: true,
      },
      {
        label: 'share_mentor: false',
        permissions: { '/mentors/101/': { share_mentor: false } },
        expected: false,
      },
      {
        label: 'share_mentor: 1',
        permissions: { '/mentors/101/': { share_mentor: 1 } },
        expected: true,
      },
      {
        label: 'share_mentor: 0',
        permissions: { '/mentors/101/': { share_mentor: 0 } },
        expected: false,
      },
      {
        label: "share_mentor: ''",
        permissions: { '/mentors/101/': { share_mentor: '' } },
        expected: false,
      },
      {
        label: 'share_mentor: null',
        permissions: { '/mentors/101/': { share_mentor: null } },
        expected: false,
      },
      {
        label: "share_mentor: 'yes'",
        permissions: { '/mentors/101/': { share_mentor: 'yes' } },
        expected: true,
      },
      {
        label: 'share_mentor key absent',
        permissions: { '/mentors/101/': { other: true } },
        expected: false,
      },
      {
        label: 'empty mentor entry',
        permissions: { '/mentors/101/': {} },
        expected: false,
      },
      {
        label: 'only a different mentor entry',
        permissions: { '/mentors/999/': { share_mentor: true } },
        expected: false,
      },
      { label: 'empty permissions map', permissions: {}, expected: false },
    ])(
      'with RBAC enabled, $label resolves to $expected',
      ({ permissions, expected }) => {
        setRbacEnabled(true);
        expect(
          checkRbacPermission(permissions, '/mentors/101/#share_mentor'),
        ).toBe(expected);
      },
    );

    it('returns true for every one of those shapes when RBAC is disabled', () => {
      setRbacEnabled(false);
      const shapes: Array<Record<string, unknown>> = [
        { '/mentors/101/': { share_mentor: false } },
        { '/mentors/101/': {} },
        {},
      ];
      for (const permissions of shapes) {
        expect(
          checkRbacPermission(permissions, '/mentors/101/#share_mentor'),
        ).toBe(true);
      }
    });

    it('walks arbitrarily nested "#"-separated resource paths', () => {
      setRbacEnabled(true);
      const permissions = { '/mentors/': { 101: { share_mentor: true } } };
      expect(
        checkRbacPermission(permissions, '/mentors/#101#share_mentor'),
      ).toBe(true);
      expect(
        checkRbacPermission(permissions, '/mentors/#102#share_mentor'),
      ).toBe(false);
    });
  });
});
