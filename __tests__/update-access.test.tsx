import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RoleAccessPanel } from '@/components/modals/edit-mentor-modal/tabs/access-tab/update-access';

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

const mockUseParams = vi.fn();
const mockUseUsername = vi.fn();
const mockUseGetMentorSettingsQuery = vi.fn();
const mockUsePlatformUsersQuery = vi.fn();
const mockUpdateMentorAccess = vi.fn();
const mockGetRbacPermissions = vi.fn();
const mockDispatch = vi.fn();
const mockRbacPermissions = vi.fn();
const mockCheckRbacPermission = vi.fn();

vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
}));

vi.mock('@/hooks/use-user', () => ({
  useUsername: () => mockUseUsername(),
}));

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useGetMentorSettingsQuery: (...args: unknown[]) => mockUseGetMentorSettingsQuery(...args),
  usePlatformUsersQuery: (...args: unknown[]) => mockUsePlatformUsersQuery(...args),
  useUpdateRbacMentorAccessMutation: () => [mockUpdateMentorAccess],
  useGetRbacPermissionsMutation: () => [mockGetRbacPermissions],
  isPoliciesResponse: () => false,
}));

vi.mock('@/lib/hooks', () => ({
  useAppSelector: () => mockRbacPermissions(),
  useAppDispatch: () => mockDispatch,
}));

vi.mock('@/features/rbac/rbac-slice', () => ({
  selectRbacPermissions: 'selectRbacPermissions',
  updateRbacPermissions: (payload: unknown) => ({ type: 'rbac/updateRbacPermissions', payload }),
}));

vi.mock('@/hoc/withPermissions', () => ({
  checkRbacPermission: (...args: unknown[]) => mockCheckRbacPermission(...args),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const createPolicy = (overrides = {}) => ({
  id: 1,
  mentor_id: 42,
  platform_key: 'test-tenant',
  role: 'editor',
  users: [],
  ...overrides,
});

const defaultProps = {
  policy: createPolicy(),
  onAccessUpdated: vi.fn().mockResolvedValue(undefined),
};

function setup(overrides: Partial<typeof defaultProps> = {}) {
  const user = userEvent.setup();
  const props = { ...defaultProps, ...overrides };
  const result = render(<RoleAccessPanel {...props} />);
  return { user, ...result, props };
}

/* ------------------------------------------------------------------ */
/*  Test suites                                                        */
/* ------------------------------------------------------------------ */

describe('RoleAccessPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseParams.mockReturnValue({ tenantKey: 'test-tenant', mentorId: 'test-mentor' });
    mockUseUsername.mockReturnValue('testuser');
    mockUseGetMentorSettingsQuery.mockReturnValue({
      data: { mentor_id: 42 },
      isLoading: false,
    });
    mockUsePlatformUsersQuery.mockReturnValue({
      data: undefined,
      isFetching: false,
      isLoading: false,
    });
    mockRbacPermissions.mockReturnValue({});
    mockCheckRbacPermission.mockReturnValue(true);
    mockGetRbacPermissions.mockReturnValue({ unwrap: () => Promise.resolve({}) });
    mockUpdateMentorAccess.mockReturnValue({ unwrap: () => Promise.resolve({}) });
  });

  /* ---------- RBAC permission fetch on mount ---------- */

  it('fetches RBAC permissions on mount', async () => {
    setup();

    await waitFor(() => {
      expect(mockGetRbacPermissions).toHaveBeenCalledWith({
        requestBody: {
          platform_key: 'test-tenant',
          resources: ['/users/'],
        },
      });
    });
  });

  it('dispatches updateRbacPermissions after fetch', async () => {
    const permResult = { '/users/': { list: true } };
    mockGetRbacPermissions.mockReturnValue({ unwrap: () => Promise.resolve(permResult) });

    setup();

    await waitFor(() => {
      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'rbac/updateRbacPermissions',
        payload: { ...permResult },
      });
    });
  });

  it('does not fetch permissions when tenantKey is missing', () => {
    mockUseParams.mockReturnValue({ tenantKey: undefined, mentorId: 'test-mentor' });
    setup();
    expect(mockGetRbacPermissions).not.toHaveBeenCalled();
  });

  /* ---------- Assigned users display ---------- */

  it('shows assigned users with email (email || username fallback)', () => {
    setup({
      policy: createPolicy({
        users: [
          { id: 1, username: 'alice', email: 'alice@test.com' },
          { id: 2, username: 'bob', email: '' },
        ],
      }),
    });

    // alice should show email
    expect(screen.getByText('alice@test.com')).toBeInTheDocument();
    // bob has no email, should show username
    expect(screen.getByText('bob')).toBeInTheDocument();
  });

  it('shows empty state when no users assigned', () => {
    setup({ policy: createPolicy({ users: [] }) });

    expect(screen.getByText('No users have this role yet.')).toBeInTheDocument();
  });

  it('removes user and calls mutation with users_to_remove', async () => {
    const { user } = setup({
      policy: createPolicy({
        users: [{ id: 1, username: 'alice', email: 'alice@test.com' }],
      }),
    });

    await user.click(screen.getByRole('button', { name: /remove alice/i }));

    await waitFor(() => {
      expect(mockUpdateMentorAccess).toHaveBeenCalledWith({
        requestBody: expect.objectContaining({
          users_to_remove: [1],
          role: 'editor',
        }),
      });
    });
  });

  /* ---------- With permission: search mode ---------- */

  describe('with users permission (search mode)', () => {
    beforeEach(() => {
      mockCheckRbacPermission.mockReturnValue(true);
    });

    it('renders search input', () => {
      setup();

      expect(screen.getByPlaceholderText('Search by name, username, or email')).toBeInTheDocument();
      expect(screen.queryByLabelText('Select input type')).not.toBeInTheDocument();
    });

    it('shows description for search mode', () => {
      setup();

      expect(
        screen.getByText('Search by name, username, or email to grant this role to additional users.'),
      ).toBeInTheDocument();
    });

    it('adds user via search and calls mutation with users_to_add', async () => {
      mockUsePlatformUsersQuery.mockReturnValue({
        data: {
          results: [
            { user_id: 5, name: 'Charlie', username: 'charlie', email: 'charlie@test.com' },
          ],
        },
        isFetching: false,
        isLoading: false,
      });

      const { user } = setup();

      const searchInput = screen.getByPlaceholderText('Search by name, username, or email');
      await user.type(searchInput, 'cha');

      const resultButton = await screen.findByText('Charlie');
      await user.click(resultButton);

      await waitFor(() => {
        expect(mockUpdateMentorAccess).toHaveBeenCalledWith({
          requestBody: expect.objectContaining({
            users_to_add: [5],
            role: 'editor',
          }),
        });
      });
    });
  });

  /* ---------- Without permission: manual input mode ---------- */

  describe('without users permission (manual input mode)', () => {
    beforeEach(() => {
      mockCheckRbacPermission.mockReturnValue(false);
    });

    it('renders manual input with email/username selector', () => {
      setup();

      expect(screen.getByLabelText('Select input type')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('user@example.com')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add entry/i })).toBeInTheDocument();
      expect(screen.queryByPlaceholderText('Search by name, username, or email')).not.toBeInTheDocument();
    });

    it('shows description for manual mode', () => {
      setup();

      expect(
        screen.getByText('Enter a username or email to grant this role to additional users.'),
      ).toBeInTheDocument();
    });

    it('stages entries via Enter key', async () => {
      const { user } = setup();

      const input = screen.getByPlaceholderText('user@example.com');
      await user.type(input, 'alice@test.com{Enter}');

      expect(screen.getByText('alice@test.com')).toBeInTheDocument();
      expect(input).toHaveValue('');
    });

    it('stages entries via plus button', async () => {
      const { user } = setup();

      const input = screen.getByPlaceholderText('user@example.com');
      await user.type(input, 'bob@test.com');

      await user.click(screen.getByRole('button', { name: /add entry/i }));

      expect(screen.getByText('bob@test.com')).toBeInTheDocument();
      expect(input).toHaveValue('');
    });

    it('does not stage empty entries', async () => {
      const { user } = setup();

      const input = screen.getByPlaceholderText('user@example.com');
      await user.type(input, '   {Enter}');

      expect(screen.queryByRole('button', { name: /remove/i })).not.toBeInTheDocument();
    });

    it('does not stage duplicate entries', async () => {
      const { user } = setup();

      const input = screen.getByPlaceholderText('user@example.com');
      await user.type(input, 'alice@test.com{Enter}');
      await user.type(input, 'alice@test.com{Enter}');

      const chips = screen.getAllByText('alice@test.com');
      expect(chips).toHaveLength(1);
    });

    it('removes staged entries when X is clicked', async () => {
      const { user } = setup();

      const input = screen.getByPlaceholderText('user@example.com');
      await user.type(input, 'alice@test.com{Enter}');
      await user.type(input, 'bob@test.com{Enter}');

      await user.click(screen.getByRole('button', { name: /remove alice@test.com/i }));

      expect(screen.queryByText('alice@test.com')).not.toBeInTheDocument();
      expect(screen.getByText('bob@test.com')).toBeInTheDocument();
    });

    it('submits with emails_to_add when input type is email', async () => {
      const { user } = setup();

      const input = screen.getByPlaceholderText('user@example.com');
      await user.type(input, 'alice@test.com{Enter}');
      await user.type(input, 'bob@test.com{Enter}');

      // Click the "Add 2 users" button
      const addButton = screen.getByRole('button', { name: /add 2 users/i });
      await user.click(addButton);

      await waitFor(() => {
        expect(mockUpdateMentorAccess).toHaveBeenCalledWith({
          requestBody: expect.objectContaining({
            platform_key: 'test-tenant',
            mentor_id: 42,
            role: 'editor',
            emails_to_add: ['alice@test.com', 'bob@test.com'],
          }),
        });
      });
    });

    it('submits with usernames_to_add when input type is username', async () => {
      const { user } = setup();

      // Switch to username mode
      await user.click(screen.getByLabelText('Select input type'));
      await user.click(screen.getByRole('option', { name: /username/i }));

      const input = screen.getByPlaceholderText('username');
      await user.type(input, 'alice{Enter}');
      await user.type(input, 'bob{Enter}');

      const addButton = screen.getByRole('button', { name: /add 2 users/i });
      await user.click(addButton);

      await waitFor(() => {
        expect(mockUpdateMentorAccess).toHaveBeenCalledWith({
          requestBody: expect.objectContaining({
            usernames_to_add: ['alice', 'bob'],
          }),
        });
      });
    });

    it('also stages remaining input text on submit', async () => {
      const { user } = setup();

      const input = screen.getByPlaceholderText('user@example.com');
      await user.type(input, 'alice@test.com{Enter}');
      await user.type(input, 'bob@test.com');
      // Don't press Enter, click Add directly

      // The "Add 1 user" button (not the "Add entry" plus button)
      const addButton = screen.getByRole('button', { name: /add 1 user/i });
      await user.click(addButton);

      await waitFor(() => {
        expect(mockUpdateMentorAccess).toHaveBeenCalledWith({
          requestBody: expect.objectContaining({
            emails_to_add: ['alice@test.com', 'bob@test.com'],
          }),
        });
      });
    });

    it('clears entries after successful submission', async () => {
      const { user } = setup();

      const input = screen.getByPlaceholderText('user@example.com');
      await user.type(input, 'alice@test.com{Enter}');

      const addButton = screen.getByRole('button', { name: /add 1 user/i });
      await user.click(addButton);

      await waitFor(() => {
        expect(mockUpdateMentorAccess).toHaveBeenCalled();
      });

      // After success, entries should be cleared
      await waitFor(() => {
        expect(screen.queryByText('alice@test.com')).not.toBeInTheDocument();
      });
    });

    it('disables plus button when input is empty', () => {
      setup();

      expect(screen.getByRole('button', { name: /add entry/i })).toBeDisabled();
    });

    it('shows helper text about staging entries', () => {
      setup();

      expect(screen.getByText(/press enter or click \+ to stage/i)).toBeInTheDocument();
    });

    it('shows single user add text for one entry', async () => {
      const { user } = setup();

      const input = screen.getByPlaceholderText('user@example.com');
      await user.type(input, 'alice@test.com{Enter}');

      expect(screen.getByRole('button', { name: /add 1 user$/i })).toBeInTheDocument();
    });
  });
});
