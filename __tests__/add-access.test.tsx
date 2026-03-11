import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AddAccessDialog } from '@/components/modals/edit-mentor-modal/tabs/access-tab/add-access';

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

const mockUseParams = vi.fn();
const mockUseUsername = vi.fn();
const mockUseGetMentorSettingsQuery = vi.fn();
const mockUsePlatformUsersQuery = vi.fn();
const mockUpdateRbacMentorAccess = vi.fn();
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
  useUpdateRbacMentorAccessMutation: () => [mockUpdateRbacMentorAccess, { isLoading: false }],
  isPoliciesResponse: () => false,
}));

vi.mock('@/lib/hooks', () => ({
  useAppSelector: () => mockRbacPermissions(),
}));

vi.mock('@/features/rbac/rbac-slice', () => ({
  selectRbacPermissions: 'selectRbacPermissions',
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

const defaultProps = {
  availableRoles: ['editor'] as Array<'editor'>,
  isLoading: false,
  onAccessCreated: vi.fn().mockResolvedValue(undefined),
};

function setup(overrides: Partial<typeof defaultProps> = {}) {
  const user = userEvent.setup();
  const props = { ...defaultProps, ...overrides };
  const result = render(<AddAccessDialog {...props} />);
  return { user, ...result, props };
}

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /create role access/i }));
}

/* ------------------------------------------------------------------ */
/*  Test suites                                                        */
/* ------------------------------------------------------------------ */

describe('AddAccessDialog', () => {
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
    mockUpdateRbacMentorAccess.mockReturnValue({ unwrap: () => Promise.resolve({}) });
  });

  /* ---------- With permission: search mode ---------- */

  describe('with users permission (search mode)', () => {
    beforeEach(() => {
      mockCheckRbacPermission.mockReturnValue(true);
    });

    it('renders search input when dialog is opened', async () => {
      const { user } = setup();
      await openDialog(user);

      expect(screen.getByPlaceholderText('Search by name, username, or email')).toBeInTheDocument();
      expect(screen.queryByLabelText('Select input type')).not.toBeInTheDocument();
    });

    it('shows selected users with email display', async () => {
      mockUsePlatformUsersQuery.mockReturnValue({
        data: {
          results: [
            { user_id: 1, name: 'Alice', username: 'alice', email: 'alice@test.com' },
          ],
        },
        isFetching: false,
        isLoading: false,
      });

      const { user } = setup();
      await openDialog(user);

      const searchInput = screen.getByPlaceholderText('Search by name, username, or email');
      await user.type(searchInput, 'ali');

      // Click on the user result
      const resultButton = await screen.findByText('Alice');
      await user.click(resultButton);

      // Should display email (email || name fallback)
      expect(screen.getByText('alice@test.com')).toBeInTheDocument();
    });

    it('submits with users_to_add payload when search users selected', async () => {
      mockUsePlatformUsersQuery.mockReturnValue({
        data: {
          results: [
            { user_id: 1, name: 'Alice', username: 'alice', email: 'alice@test.com' },
          ],
        },
        isFetching: false,
        isLoading: false,
      });

      const { user } = setup();
      await openDialog(user);

      // Select a role
      await user.click(screen.getByRole('combobox', { name: /select role/i }));
      await user.click(screen.getByRole('option', { name: /editor/i }));

      // Search and select user
      const searchInput = screen.getByPlaceholderText('Search by name, username, or email');
      await user.type(searchInput, 'ali');
      const resultButton = await screen.findByText('Alice');
      await user.click(resultButton);

      // Click create
      await user.click(screen.getByRole('button', { name: /create$/i }));

      await waitFor(() => {
        expect(mockUpdateRbacMentorAccess).toHaveBeenCalledWith({
          requestBody: expect.objectContaining({
            platform_key: 'test-tenant',
            mentor_id: 42,
            role: 'editor',
            users_to_add: [1],
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

    it('renders manual input with email/username selector', async () => {
      const { user } = setup();
      await openDialog(user);

      expect(screen.getByLabelText('Select input type')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('user@example.com')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add entry/i })).toBeInTheDocument();
      expect(screen.queryByPlaceholderText('Search by name, username, or email')).not.toBeInTheDocument();
    });

    it('stages entries via Enter key', async () => {
      const { user } = setup();
      await openDialog(user);

      const input = screen.getByPlaceholderText('user@example.com');
      await user.type(input, 'alice@test.com{Enter}');

      // Entry should appear as a chip
      expect(screen.getByText('alice@test.com')).toBeInTheDocument();
      // Input should be cleared
      expect(input).toHaveValue('');
    });

    it('stages entries via plus button', async () => {
      const { user } = setup();
      await openDialog(user);

      const input = screen.getByPlaceholderText('user@example.com');
      await user.type(input, 'bob@test.com');

      await user.click(screen.getByRole('button', { name: /add entry/i }));

      expect(screen.getByText('bob@test.com')).toBeInTheDocument();
      expect(input).toHaveValue('');
    });

    it('does not stage empty entries', async () => {
      const { user } = setup();
      await openDialog(user);

      const input = screen.getByPlaceholderText('user@example.com');
      await user.type(input, '   {Enter}');

      // No chips should appear
      expect(screen.queryByRole('button', { name: /remove/i })).not.toBeInTheDocument();
    });

    it('does not stage duplicate entries', async () => {
      const { user } = setup();
      await openDialog(user);

      const input = screen.getByPlaceholderText('user@example.com');
      await user.type(input, 'alice@test.com{Enter}');
      await user.type(input, 'alice@test.com{Enter}');

      // Only one chip
      const chips = screen.getAllByText('alice@test.com');
      expect(chips).toHaveLength(1);
    });

    it('removes staged entries when X is clicked', async () => {
      const { user } = setup();
      await openDialog(user);

      const input = screen.getByPlaceholderText('user@example.com');
      await user.type(input, 'alice@test.com{Enter}');
      await user.type(input, 'bob@test.com{Enter}');

      // Remove alice
      await user.click(screen.getByRole('button', { name: /remove alice@test.com/i }));

      expect(screen.queryByText('alice@test.com')).not.toBeInTheDocument();
      expect(screen.getByText('bob@test.com')).toBeInTheDocument();
    });

    it('submits with emails_to_add when input type is email', async () => {
      const { user } = setup();
      await openDialog(user);

      // Select role
      await user.click(screen.getByRole('combobox', { name: /select role/i }));
      await user.click(screen.getByRole('option', { name: /editor/i }));

      // Stage emails
      const input = screen.getByPlaceholderText('user@example.com');
      await user.type(input, 'alice@test.com{Enter}');
      await user.type(input, 'bob@test.com{Enter}');

      // Click create
      await user.click(screen.getByRole('button', { name: /create$/i }));

      await waitFor(() => {
        expect(mockUpdateRbacMentorAccess).toHaveBeenCalledWith({
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
      await openDialog(user);

      // Select role
      await user.click(screen.getByRole('combobox', { name: /select role/i }));
      await user.click(screen.getByRole('option', { name: /editor/i }));

      // Switch to username mode
      await user.click(screen.getByLabelText('Select input type'));
      await user.click(screen.getByRole('option', { name: /username/i }));

      // Stage usernames
      const input = screen.getByPlaceholderText('username');
      await user.type(input, 'alice{Enter}');
      await user.type(input, 'bob{Enter}');

      // Click create
      await user.click(screen.getByRole('button', { name: /create$/i }));

      await waitFor(() => {
        expect(mockUpdateRbacMentorAccess).toHaveBeenCalledWith({
          requestBody: expect.objectContaining({
            usernames_to_add: ['alice', 'bob'],
          }),
        });
      });
    });

    it('also stages remaining input text on submit', async () => {
      const { user } = setup();
      await openDialog(user);

      // Select role
      await user.click(screen.getByRole('combobox', { name: /select role/i }));
      await user.click(screen.getByRole('option', { name: /editor/i }));

      // Stage one, leave another in the input
      const input = screen.getByPlaceholderText('user@example.com');
      await user.type(input, 'alice@test.com{Enter}');
      await user.type(input, 'bob@test.com');
      // Don't press Enter - just click Create

      await user.click(screen.getByRole('button', { name: /create$/i }));

      await waitFor(() => {
        expect(mockUpdateRbacMentorAccess).toHaveBeenCalledWith({
          requestBody: expect.objectContaining({
            emails_to_add: ['alice@test.com', 'bob@test.com'],
          }),
        });
      });
    });

    it('clears manual entries on dialog close', async () => {
      const { user } = setup();
      await openDialog(user);

      // Stage entries
      const input = screen.getByPlaceholderText('user@example.com');
      await user.type(input, 'alice@test.com{Enter}');

      expect(screen.getByText('alice@test.com')).toBeInTheDocument();

      // Click cancel
      await user.click(screen.getByRole('button', { name: /cancel/i }));

      // Reopen
      await openDialog(user);

      // Entries should be gone
      expect(screen.queryByText('alice@test.com')).not.toBeInTheDocument();
    });

    it('shows helper text about staging entries', async () => {
      const { user } = setup();
      await openDialog(user);

      expect(screen.getByText(/press enter or click \+ to stage/i)).toBeInTheDocument();
    });

    it('disables plus button when input is empty', async () => {
      const { user } = setup();
      await openDialog(user);

      expect(screen.getByRole('button', { name: /add entry/i })).toBeDisabled();
    });
  });

  /* ---------- General behavior ---------- */

  it('disables create button when no role is selected', async () => {
    const { user } = setup();
    await openDialog(user);

    expect(screen.getByRole('button', { name: /create$/i })).toBeDisabled();
  });

  it('clears state on successful creation', async () => {
    mockCheckRbacPermission.mockReturnValue(false);
    const { user } = setup();
    await openDialog(user);

    // Select role
    await user.click(screen.getByRole('combobox', { name: /select role/i }));
    await user.click(screen.getByRole('option', { name: /editor/i }));

    // Stage email
    const input = screen.getByPlaceholderText('user@example.com');
    await user.type(input, 'alice@test.com{Enter}');

    // Create
    await user.click(screen.getByRole('button', { name: /create$/i }));

    await waitFor(() => {
      expect(defaultProps.onAccessCreated).toHaveBeenCalled();
    });
  });
});
