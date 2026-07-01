import {
  render,
  screen,
  waitFor,
  act,
  fireEvent,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

import { RoleAccessPanel } from '../update-access';
import type { MentorAccessPolicy } from '../shared';

// Mock hooks and modules
const mockUseParams = vi.fn();
const mockUseUsername = vi.fn();
const mockUsePlatformUsersQuery = vi.fn();
const mockUseGetRbacGroupsQuery = vi.fn();
const mockUseUpdateRbacMentorAccessMutation = vi.fn();
const mockUseGetMentorSettingsQuery = vi.fn();
const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();
const mockUpdateMentorAccess = vi.fn();
// Defaults to granting every permission (matching prior behaviour). Individual
// tests override the implementation to exercise the manual-entry mode
// (no `/users/#list`) and the groups section (`/groups/#list`).
const mockCheckRbacPermission = vi.fn((..._args: unknown[]) => true);

vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
}));

vi.mock('@/hooks/use-user', () => ({
  useUsername: () => mockUseUsername(),
}));

vi.mock('@iblai/iblai-js/data-layer', () => ({
  usePlatformUsersQuery: (...args: unknown[]) =>
    mockUsePlatformUsersQuery(...args),
  useGetRbacGroupsQuery: (...args: unknown[]) =>
    mockUseGetRbacGroupsQuery(...args),
  useUpdateRbacMentorAccessMutation: () =>
    mockUseUpdateRbacMentorAccessMutation(),
  useGetMentorSettingsQuery: (...args: unknown[]) =>
    mockUseGetMentorSettingsQuery(...args),
  isPoliciesResponse: (results: unknown) =>
    results && typeof results === 'object' && 'data' in (results as object),
}));

vi.mock('@/lib/hooks', () => ({
  useAppSelector: () => ({}),
}));

vi.mock('@/features/rbac/rbac-slice', () => ({
  selectRbacPermissions: 'selectRbacPermissions',
}));

vi.mock('@/hoc/withPermissions', () => ({
  checkRbacPermission: (...args: unknown[]) => mockCheckRbacPermission(...args),
}));

vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
    success: (...args: unknown[]) => mockToastSuccess(...args),
  },
}));

vi.mock('use-debounce', () => ({
  useDebounce: (value: string) => [value],
}));

// Render the Radix Select as a native <select> so the manual input-type switch
// is deterministic under jsdom. The component's Select/SelectItem JSX still
// executes (coverage is unaffected); only the interaction is simplified.
vi.mock('@/components/ui/select', () => {
  return {
    Select: ({
      value,
      onValueChange,
      children,
    }: {
      value: string;
      onValueChange: (v: string) => void;
      children: ReactNode;
    }) => (
      <select
        aria-label="Select input type"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
      >
        {children}
      </select>
    ),
    SelectTrigger: () => null,
    SelectValue: () => null,
    SelectContent: ({ children }: { children: ReactNode }) => children,
    SelectItem: ({
      value,
      children,
    }: {
      value: string;
      children: ReactNode;
    }) => <option value={value}>{children}</option>,
  };
});

describe('RoleAccessPanel', () => {
  const defaultPolicy: MentorAccessPolicy = {
    id: 1,
    mentor_id: 123,
    platform_key: 'test-tenant',
    role: 'editor',
    users: [
      { id: 1, username: 'user1', email: 'user1@example.com' },
      { id: 2, username: 'user2', email: 'user2@example.com' },
    ],
  };

  const defaultProps = {
    policy: defaultPolicy,
    onAccessUpdated: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // clearAllMocks only clears call history, not implementations, so reset the
    // permission gate back to "all granted" before each test.
    mockCheckRbacPermission.mockImplementation(() => true);

    // Mock scrollIntoView for jsdom
    Element.prototype.scrollIntoView = vi.fn();

    mockUseParams.mockReturnValue({
      tenantKey: 'test-tenant',
      mentorId: 'test-mentor',
    });

    mockUseUsername.mockReturnValue('testuser');

    mockUsePlatformUsersQuery.mockReturnValue({
      data: {
        results: [
          {
            id: 3,
            name: 'New User',
            username: 'newuser',
            email: 'newuser@example.com',
          },
          {
            id: 4,
            name: 'Another User',
            username: 'anotheruser',
            email: 'another@example.com',
          },
        ],
      },
      isFetching: false,
      isLoading: false,
    });

    mockUseGetRbacGroupsQuery.mockReturnValue({
      data: undefined,
      isFetching: false,
      isLoading: false,
    });

    mockUpdateMentorAccess.mockReturnValue({
      unwrap: vi.fn().mockResolvedValue({}),
    });

    mockUseUpdateRbacMentorAccessMutation.mockReturnValue([
      mockUpdateMentorAccess,
    ]);

    mockUseGetMentorSettingsQuery.mockReturnValue({
      data: { mentor_id: 123 },
    });
  });

  it('renders the panel with role information', () => {
    render(<RoleAccessPanel {...defaultProps} />);

    expect(screen.getByText('Assigned users')).toBeInTheDocument();
    // There's both a heading and a label with "Add users" text
    expect(screen.getAllByText('Add users').length).toBeGreaterThanOrEqual(1);
  });

  it('displays assigned users', () => {
    render(<RoleAccessPanel {...defaultProps} />);

    // email takes precedence over username in display
    expect(screen.getByText('user1@example.com')).toBeInTheDocument();
    expect(screen.getByText('user2@example.com')).toBeInTheDocument();
  });

  it('shows empty state when no users are assigned', () => {
    render(
      <RoleAccessPanel
        {...defaultProps}
        policy={{ ...defaultPolicy, users: [] }}
      />,
    );

    expect(
      screen.getByText('No users have this role yet.'),
    ).toBeInTheDocument();
  });

  it('shows user search input', () => {
    render(<RoleAccessPanel {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText(
      /search by name, username, or email/i,
    );
    expect(searchInput).toBeInTheDocument();
  });

  it('shows minimum character message when search term is too short', async () => {
    const user = userEvent.setup();
    render(<RoleAccessPanel {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText(
      /search by name, username, or email/i,
    );
    await user.type(searchInput, 'a');
    await user.click(searchInput);

    await waitFor(() => {
      expect(
        screen.getByText('Type at least two characters to search.'),
      ).toBeInTheDocument();
    });
  });

  it('shows loading state while fetching users', async () => {
    const user = userEvent.setup();
    mockUsePlatformUsersQuery.mockReturnValue({
      data: null,
      isFetching: true,
      isLoading: true,
    });

    render(<RoleAccessPanel {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText(
      /search by name, username, or email/i,
    );
    await user.type(searchInput, 'test');
    await user.click(searchInput);

    await waitFor(() => {
      expect(screen.getByText(/searching users/i)).toBeInTheDocument();
    });
  });

  it('shows user search results', async () => {
    const user = userEvent.setup();
    render(<RoleAccessPanel {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText(
      /search by name, username, or email/i,
    );
    await user.type(searchInput, 'new');
    await user.click(searchInput);

    await waitFor(() => {
      expect(screen.getByText('New User')).toBeInTheDocument();
    });
  });

  it('adds user when clicking on search result', async () => {
    const user = userEvent.setup();
    const onAccessUpdated = vi.fn().mockResolvedValue(undefined);

    render(
      <RoleAccessPanel {...defaultProps} onAccessUpdated={onAccessUpdated} />,
    );

    const searchInput = screen.getByPlaceholderText(
      /search by name, username, or email/i,
    );
    await user.type(searchInput, 'new');

    await waitFor(() => {
      expect(screen.getByText('New User')).toBeInTheDocument();
    });

    // Click on the user result option
    const userButton = screen.getByRole('option', { name: /new user/i });
    await user.click(userButton);

    await waitFor(() => {
      expect(mockUpdateMentorAccess).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: expect.objectContaining({
            users_to_add: [3],
          }),
        }),
      );
      expect(mockToastSuccess).toHaveBeenCalled();
      expect(onAccessUpdated).toHaveBeenCalled();
    });
  });

  it('removes user when clicking remove button', async () => {
    const user = userEvent.setup();
    const onAccessUpdated = vi.fn().mockResolvedValue(undefined);

    render(
      <RoleAccessPanel {...defaultProps} onAccessUpdated={onAccessUpdated} />,
    );

    // Find and click remove button for user1
    const removeButton = screen.getByRole('button', { name: /remove user1/i });
    await user.click(removeButton);

    await waitFor(() => {
      expect(mockUpdateMentorAccess).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: expect.objectContaining({
            users_to_remove: [1],
          }),
        }),
      );
      expect(mockToastSuccess).toHaveBeenCalled();
      expect(onAccessUpdated).toHaveBeenCalled();
    });
  });

  it('shows error when trying to add user without mentor context', async () => {
    const user = userEvent.setup();
    mockUseGetMentorSettingsQuery.mockReturnValue({
      data: { mentor_id: undefined },
    });

    render(<RoleAccessPanel {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText(
      /search by name, username, or email/i,
    );
    await user.type(searchInput, 'new');

    await waitFor(() => {
      expect(screen.getByText('New User')).toBeInTheDocument();
    });

    const userButton = screen.getByRole('option', { name: /new user/i });
    await user.click(userButton);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        'Agent context is missing. Close the modal and try again.',
      );
    });
  });

  it('handles add user error', async () => {
    const user = userEvent.setup();
    mockUpdateMentorAccess.mockReturnValue({
      unwrap: vi.fn().mockRejectedValue(new Error('Failed to add user')),
    });

    render(<RoleAccessPanel {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText(
      /search by name, username, or email/i,
    );
    await user.type(searchInput, 'new');

    await waitFor(() => {
      expect(screen.getByText('New User')).toBeInTheDocument();
    });

    const userButton = screen.getByRole('option', { name: /new user/i });
    await user.click(userButton);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalled();
    });
  });

  it('handles remove user error', async () => {
    const user = userEvent.setup();
    mockUpdateMentorAccess.mockReturnValue({
      unwrap: vi.fn().mockRejectedValue({ message: 'Failed to remove user' }),
    });

    render(<RoleAccessPanel {...defaultProps} />);

    const removeButton = screen.getByRole('button', { name: /remove user1/i });
    await user.click(removeButton);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalled();
    });
  });

  it('shows no matching users message when search returns empty', async () => {
    const user = userEvent.setup();
    mockUsePlatformUsersQuery.mockReturnValue({
      data: { results: [] },
      isFetching: false,
      isLoading: false,
    });

    render(<RoleAccessPanel {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText(
      /search by name, username, or email/i,
    );
    await user.type(searchInput, 'nonexistent');

    await waitFor(() => {
      expect(screen.getByText('No matching users found.')).toBeInTheDocument();
    });
  });

  it('navigates search results with keyboard ArrowDown', async () => {
    const user = userEvent.setup();
    render(<RoleAccessPanel {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText(
      /search by name, username, or email/i,
    );
    await user.type(searchInput, 'user');

    await waitFor(() => {
      expect(screen.getByText('New User')).toBeInTheDocument();
    });

    // Press ArrowDown
    await user.keyboard('{ArrowDown}');

    // First item should be highlighted
    const firstOption = screen.getByRole('option', { name: /new user/i });
    expect(firstOption).toHaveAttribute('aria-selected', 'true');
  });

  it('navigates search results with keyboard ArrowUp', async () => {
    const user = userEvent.setup();
    render(<RoleAccessPanel {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText(
      /search by name, username, or email/i,
    );
    await user.type(searchInput, 'user');

    await waitFor(() => {
      expect(screen.getByText('New User')).toBeInTheDocument();
    });

    // Press ArrowUp (should wrap to last item)
    await user.keyboard('{ArrowUp}');

    // Last item should be highlighted
    const options = screen.getAllByRole('option');
    const lastOption = options[options.length - 1];
    expect(lastOption).toHaveAttribute('aria-selected', 'true');
  });

  it('selects user with Enter key', async () => {
    const user = userEvent.setup();
    const onAccessUpdated = vi.fn().mockResolvedValue(undefined);

    render(
      <RoleAccessPanel {...defaultProps} onAccessUpdated={onAccessUpdated} />,
    );

    const searchInput = screen.getByPlaceholderText(
      /search by name, username, or email/i,
    );
    await user.type(searchInput, 'user');

    await waitFor(() => {
      expect(screen.getByText('New User')).toBeInTheDocument();
    });

    // Navigate down and select with Enter
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(mockUpdateMentorAccess).toHaveBeenCalled();
    });
  });

  it('closes search results with Escape key', async () => {
    const user = userEvent.setup();
    render(<RoleAccessPanel {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText(
      /search by name, username, or email/i,
    );
    await user.type(searchInput, 'user');

    await waitFor(() => {
      expect(screen.getByText('New User')).toBeInTheDocument();
    });

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
  });

  it('handles blur event on container', async () => {
    const user = userEvent.setup();
    render(<RoleAccessPanel {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText(
      /search by name, username, or email/i,
    );
    await user.type(searchInput, 'user');

    await waitFor(() => {
      expect(screen.getByText('New User')).toBeInTheDocument();
    });

    // Click outside the container
    await user.click(document.body);

    await waitFor(() => {
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
  });

  it('handles focus on search input when search term is 2+ chars', async () => {
    const user = userEvent.setup();
    render(<RoleAccessPanel {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText(
      /search by name, username, or email/i,
    );
    await user.type(searchInput, 'us');

    // Click away
    await user.click(document.body);

    // Focus back
    await user.click(searchInput);

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });
  });

  it('does not show search results on focus when search term is too short', async () => {
    const user = userEvent.setup();
    render(<RoleAccessPanel {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText(
      /search by name, username, or email/i,
    );
    await user.type(searchInput, 'u');

    // Click away
    await user.click(document.body);

    // Focus back
    await user.click(searchInput);

    // Results should not be shown yet (too short search term)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('filters out already assigned users from search results', async () => {
    const user = userEvent.setup();
    mockUsePlatformUsersQuery.mockReturnValue({
      data: {
        results: [
          {
            id: 1,
            name: 'User One',
            username: 'user1',
            email: 'user1@example.com',
          }, // Already assigned
          {
            id: 3,
            name: 'New User',
            username: 'newuser',
            email: 'newuser@example.com',
          },
        ],
      },
      isFetching: false,
      isLoading: false,
    });

    render(<RoleAccessPanel {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText(
      /search by name, username, or email/i,
    );
    await user.type(searchInput, 'user');

    await waitFor(() => {
      // New User should be in results
      expect(screen.getByText('New User')).toBeInTheDocument();
      // User One should NOT be in results (already assigned)
      const options = screen.getAllByRole('option');
      const userOneOption = options.find(
        (opt) =>
          opt.textContent?.includes('User One') &&
          opt.getAttribute('role') === 'option',
      );
      expect(userOneOption).toBeUndefined();
    });
  });

  it('displays email when username is numeric', () => {
    render(
      <RoleAccessPanel
        {...defaultProps}
        policy={{
          ...defaultPolicy,
          users: [{ id: 1, username: '12345', email: 'user1@example.com' }],
        }}
      />,
    );

    // Should display email instead of numeric username
    expect(screen.getByText('user1@example.com')).toBeInTheDocument();
  });

  it('displays email when available', () => {
    render(<RoleAccessPanel {...defaultProps} />);

    // email takes precedence over username
    expect(screen.getByText('user1@example.com')).toBeInTheDocument();
  });

  it('disables buttons during pending operations', async () => {
    const user = userEvent.setup();

    // Create a promise that we can control
    let resolvePromise: () => void;
    const pendingPromise = new Promise<void>((resolve) => {
      resolvePromise = resolve;
    });

    mockUpdateMentorAccess.mockReturnValue({
      unwrap: vi.fn().mockReturnValue(pendingPromise),
    });

    render(<RoleAccessPanel {...defaultProps} />);

    const removeButton = screen.getByRole('button', { name: /remove user1/i });
    await user.click(removeButton);

    // Other remove buttons should be disabled during the operation
    const removeButton2 = screen.getByRole('button', { name: /remove user2/i });
    expect(removeButton2).toBeDisabled();

    // Resolve the promise
    await act(async () => {
      resolvePromise!();
    });
  });

  it('shows loading indicator during remove operation', async () => {
    const user = userEvent.setup();

    let resolvePromise: () => void;
    const pendingPromise = new Promise<void>((resolve) => {
      resolvePromise = resolve;
    });

    mockUpdateMentorAccess.mockReturnValue({
      unwrap: vi.fn().mockReturnValue(pendingPromise),
    });

    render(<RoleAccessPanel {...defaultProps} />);

    const removeButton = screen.getByRole('button', { name: /remove user1/i });
    await user.click(removeButton);

    // Should show loading indicator (Loader2 spinner with animate-spin class)
    await waitFor(() => {
      expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    });

    await act(async () => {
      resolvePromise!();
    });
  });

  it('handles policies response format', async () => {
    const user = userEvent.setup();
    mockUsePlatformUsersQuery.mockReturnValue({
      data: {
        results: {
          data: [
            {
              id: 3,
              name: 'New User',
              username: 'newuser',
              email: 'newuser@example.com',
            },
          ],
        },
      },
      isFetching: false,
      isLoading: false,
    });

    render(<RoleAccessPanel {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText(
      /search by name, username, or email/i,
    );
    await user.type(searchInput, 'user');

    await waitFor(() => {
      expect(screen.getByText('New User')).toBeInTheDocument();
    });
  });

  it('handles user_id instead of id in response', async () => {
    const user = userEvent.setup();
    mockUsePlatformUsersQuery.mockReturnValue({
      data: {
        results: [
          {
            user_id: 3,
            name: 'New User',
            username: 'newuser',
            email: 'newuser@example.com',
          },
        ],
      },
      isFetching: false,
      isLoading: false,
    });

    render(<RoleAccessPanel {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText(
      /search by name, username, or email/i,
    );
    await user.type(searchInput, 'user');

    await waitFor(() => {
      expect(screen.getByText('New User')).toBeInTheDocument();
    });
  });

  it('handles string id conversion', async () => {
    const user = userEvent.setup();
    mockUsePlatformUsersQuery.mockReturnValue({
      data: {
        results: [
          {
            id: '3',
            name: 'New User',
            username: 'newuser',
            email: 'newuser@example.com',
          },
        ],
      },
      isFetching: false,
      isLoading: false,
    });

    render(<RoleAccessPanel {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText(
      /search by name, username, or email/i,
    );
    await user.type(searchInput, 'user');

    await waitFor(() => {
      expect(screen.getByText('New User')).toBeInTheDocument();
    });
  });

  it('filters out invalid candidates from results', async () => {
    const user = userEvent.setup();
    mockUsePlatformUsersQuery.mockReturnValue({
      data: {
        results: [
          null,
          undefined,
          'invalid',
          {
            id: 3,
            name: 'Valid User',
            username: 'valid',
            email: 'valid@example.com',
          },
          { name: 'No ID User', username: 'noid', email: 'noid@example.com' },
        ],
      },
      isFetching: false,
      isLoading: false,
    });

    render(<RoleAccessPanel {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText(
      /search by name, username, or email/i,
    );
    await user.type(searchInput, 'user');

    await waitFor(() => {
      expect(screen.getByText('Valid User')).toBeInTheDocument();
      expect(screen.queryByText('No ID User')).not.toBeInTheDocument();
    });
  });

  it('wraps highlighted index when navigating past the end', async () => {
    const user = userEvent.setup();
    mockUsePlatformUsersQuery.mockReturnValue({
      data: {
        results: [
          {
            id: 3,
            name: 'Only User',
            username: 'only',
            email: 'only@example.com',
          },
        ],
      },
      isFetching: false,
      isLoading: false,
    });

    render(<RoleAccessPanel {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText(
      /search by name, username, or email/i,
    );
    await user.type(searchInput, 'user');

    await waitFor(() => {
      expect(screen.getByText('Only User')).toBeInTheDocument();
    });

    // Press ArrowDown twice (should wrap to first item)
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{ArrowDown}');

    const option = screen.getByRole('option', { name: /only user/i });
    expect(option).toHaveAttribute('aria-selected', 'true');
  });

  it('does nothing on keyboard navigation when results are not shown', async () => {
    const user = userEvent.setup();
    render(<RoleAccessPanel {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText(
      /search by name, username, or email/i,
    );
    await user.click(searchInput);

    // Press ArrowDown without showing results
    await user.keyboard('{ArrowDown}');

    // Should not throw and should not show results
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('does nothing on keyboard navigation when results are empty', async () => {
    const user = userEvent.setup();
    mockUsePlatformUsersQuery.mockReturnValue({
      data: { results: [] },
      isFetching: false,
      isLoading: false,
    });

    render(<RoleAccessPanel {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText(
      /search by name, username, or email/i,
    );
    await user.type(searchInput, 'user');

    await waitFor(() => {
      expect(screen.getByText('No matching users found.')).toBeInTheDocument();
    });

    // Press ArrowDown with empty results
    await user.keyboard('{ArrowDown}');

    // Should not throw
    expect(screen.getByText('No matching users found.')).toBeInTheDocument();
  });

  it('prevents add if operation is pending', async () => {
    const user = userEvent.setup();

    let resolvePromise: () => void;
    const pendingPromise = new Promise<void>((resolve) => {
      resolvePromise = resolve;
    });

    mockUpdateMentorAccess.mockReturnValue({
      unwrap: vi.fn().mockReturnValue(pendingPromise),
    });

    render(<RoleAccessPanel {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText(
      /search by name, username, or email/i,
    );
    await user.type(searchInput, 'user');

    await waitFor(() => {
      expect(screen.getByText('New User')).toBeInTheDocument();
    });

    const userButton = screen.getByRole('option', { name: /new user/i });

    // Click to start operation
    await user.click(userButton);

    // Try to click again - should be disabled
    expect(userButton).toBeDisabled();

    await act(async () => {
      resolvePromise!();
    });
  });

  it('returns early from handleAddUser if operation is already pending', async () => {
    const user = userEvent.setup();

    let resolvePromise: () => void;
    const pendingPromise = new Promise<void>((resolve) => {
      resolvePromise = resolve;
    });

    mockUpdateMentorAccess.mockReturnValue({
      unwrap: vi.fn().mockReturnValue(pendingPromise),
    });

    render(<RoleAccessPanel {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText(
      /search by name, username, or email/i,
    );
    await user.type(searchInput, 'user');

    await waitFor(() => {
      expect(screen.getByText('New User')).toBeInTheDocument();
    });

    const userButton = screen.getByRole('option', { name: /new user/i });

    // Click to start first operation
    await user.click(userButton);

    // Force click again using fireEvent (bypasses disabled check) to test early return
    fireEvent.click(userButton);

    // Should only have been called once (early return prevents second call)
    expect(mockUpdateMentorAccess).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolvePromise!();
    });
  });

  it('returns early from handleRemoveUser if operation is already pending', async () => {
    const user = userEvent.setup();

    let resolvePromise: () => void;
    const pendingPromise = new Promise<void>((resolve) => {
      resolvePromise = resolve;
    });

    mockUpdateMentorAccess.mockReturnValue({
      unwrap: vi.fn().mockReturnValue(pendingPromise),
    });

    render(<RoleAccessPanel {...defaultProps} />);

    const removeButton = screen.getByRole('button', { name: /remove user1/i });

    // Click to start first operation
    await user.click(removeButton);

    // Force click second remove button using fireEvent to test early return
    const removeButton2 = screen.getByRole('button', { name: /remove user2/i });
    fireEvent.click(removeButton2);

    // Should only have been called once (early return prevents second call)
    expect(mockUpdateMentorAccess).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolvePromise!();
    });
  });

  it('displays email as fallback when name is missing in search results', async () => {
    const user = userEvent.setup();
    mockUsePlatformUsersQuery.mockReturnValue({
      data: {
        results: [
          {
            id: 3,
            name: '',
            username: 'newuser',
            email: 'newuser@example.com',
          },
        ],
      },
      isFetching: false,
      isLoading: false,
    });

    render(<RoleAccessPanel {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText(
      /search by name, username, or email/i,
    );
    await user.type(searchInput, 'user');

    await waitFor(() => {
      expect(screen.getByText('newuser@example.com')).toBeInTheDocument();
    });
  });

  it('handles missing tenantKey', async () => {
    const user = userEvent.setup();
    mockUseParams.mockReturnValue({
      tenantKey: undefined,
      mentorId: 'test-mentor',
    });

    render(<RoleAccessPanel {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText(
      /search by name, username, or email/i,
    );
    await user.type(searchInput, 'new');

    await waitFor(() => {
      expect(screen.getByText('New User')).toBeInTheDocument();
    });

    const userButton = screen.getByRole('option', { name: /new user/i });
    await user.click(userButton);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        'Agent context is missing. Close the modal and try again.',
      );
    });
  });

  it('scrolls highlighted option into view', async () => {
    const user = userEvent.setup();
    const scrollIntoViewMock = vi.fn();

    // Mock scrollIntoView
    Element.prototype.scrollIntoView = scrollIntoViewMock;

    render(<RoleAccessPanel {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText(
      /search by name, username, or email/i,
    );
    await user.type(searchInput, 'user');

    await waitFor(() => {
      expect(screen.getByText('New User')).toBeInTheDocument();
    });

    await user.keyboard('{ArrowDown}');

    await waitFor(() => {
      expect(scrollIntoViewMock).toHaveBeenCalledWith({ block: 'nearest' });
    });
  });

  it('handles undefined users array in policy', () => {
    render(
      <RoleAccessPanel
        {...defaultProps}
        policy={{ ...defaultPolicy, users: undefined }}
      />,
    );

    expect(
      screen.getByText('No users have this role yet.'),
    ).toBeInTheDocument();
  });

  describe('manual entry mode (no users:list permission)', () => {
    beforeEach(() => {
      // Deny the `/users/#list` permission so the panel renders the manual
      // email/username entry UI instead of the directory search. Deny groups
      // too so the manual input is the only text field on screen.
      mockCheckRbacPermission.mockImplementation(() => false);
    });

    // The manual input is labelled "Add by" (htmlFor="manual-user-input"),
    // stable across both email and username input types.
    const getManualInput = () => screen.getByLabelText(/add by/i);
    // Submit button text is an ICU plural: "Add" (0), "Add 1 user", "Add N users".
    const getSubmitButton = () =>
      screen.getByRole('button', { name: /^add( \d+ users?| 1 user)?$/i });

    it('renders the manual entry UI instead of directory search', () => {
      render(<RoleAccessPanel {...defaultProps} />);

      expect(
        screen.queryByPlaceholderText(/search by name, username, or email/i),
      ).not.toBeInTheDocument();
      expect(getManualInput()).toBeInTheDocument();
    });

    it('stages an entry via the add button and submits emails', async () => {
      const user = userEvent.setup();
      const onAccessUpdated = vi.fn().mockResolvedValue(undefined);
      render(
        <RoleAccessPanel {...defaultProps} onAccessUpdated={onAccessUpdated} />,
      );

      await user.type(getManualInput(), 'new@example.com');
      // The icon-only "+" stage button (sr-only label).
      await user.click(screen.getByRole('button', { name: /add entry/i }));

      // Staged chip appears and the input is cleared.
      expect(screen.getByText('new@example.com')).toBeInTheDocument();

      await user.click(getSubmitButton());

      await waitFor(() => {
        expect(mockUpdateMentorAccess).toHaveBeenCalledWith(
          expect.objectContaining({
            requestBody: expect.objectContaining({
              emails_to_add: ['new@example.com'],
            }),
          }),
        );
      });
      expect(mockToastSuccess).toHaveBeenCalled();
      expect(onAccessUpdated).toHaveBeenCalled();
    });

    it('stages an entry with the Enter key', async () => {
      const user = userEvent.setup();
      render(<RoleAccessPanel {...defaultProps} />);

      await user.type(getManualInput(), 'someone@example.com{Enter}');

      expect(screen.getByText('someone@example.com')).toBeInTheDocument();
    });

    it('does not stage blank or duplicate entries', async () => {
      const user = userEvent.setup();
      render(<RoleAccessPanel {...defaultProps} />);

      // Whitespace only -> no chip.
      await user.type(getManualInput(), '   {Enter}');
      expect(screen.queryByText('   ')).not.toBeInTheDocument();

      // Stage a value, then attempt to stage the same value again.
      await user.type(getManualInput(), 'dup@example.com{Enter}');
      await user.type(getManualInput(), 'dup@example.com{Enter}');

      expect(screen.getAllByText('dup@example.com')).toHaveLength(1);
    });

    it('removes a staged entry', async () => {
      const user = userEvent.setup();
      render(<RoleAccessPanel {...defaultProps} />);

      await user.type(getManualInput(), 'remove@example.com{Enter}');
      expect(screen.getByText('remove@example.com')).toBeInTheDocument();

      await user.click(
        screen.getByRole('button', { name: /remove remove@example\.com/i }),
      );
      expect(screen.queryByText('remove@example.com')).not.toBeInTheDocument();
    });

    it('submits usernames when the input type is switched', async () => {
      const user = userEvent.setup();
      render(<RoleAccessPanel {...defaultProps} />);

      // Switch the (mocked native) Select from email to username.
      await user.selectOptions(
        screen.getByRole('combobox', { name: /select input type/i }),
        'username',
      );

      await user.type(getManualInput(), 'jdoe{Enter}');
      await user.click(getSubmitButton());

      await waitFor(() => {
        expect(mockUpdateMentorAccess).toHaveBeenCalledWith(
          expect.objectContaining({
            requestBody: expect.objectContaining({
              usernames_to_add: ['jdoe'],
            }),
          }),
        );
      });
    });

    it('includes a not-yet-staged input value on submit', async () => {
      const user = userEvent.setup();
      render(<RoleAccessPanel {...defaultProps} />);

      // Type but do NOT press Enter; the value should still be submitted.
      await user.type(getManualInput(), 'unstaged@example.com');
      await user.click(getSubmitButton());

      await waitFor(() => {
        expect(mockUpdateMentorAccess).toHaveBeenCalledWith(
          expect.objectContaining({
            requestBody: expect.objectContaining({
              emails_to_add: ['unstaged@example.com'],
            }),
          }),
        );
      });
    });

    it('shows an error when agent context is missing', async () => {
      const user = userEvent.setup();
      mockUseGetMentorSettingsQuery.mockReturnValue({
        data: { mentor_id: undefined },
      });
      render(<RoleAccessPanel {...defaultProps} />);

      await user.type(getManualInput(), 'noctx@example.com{Enter}');
      await user.click(getSubmitButton());

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith(
          'Agent context is missing. Close the modal and try again.',
        );
      });
      expect(mockUpdateMentorAccess).not.toHaveBeenCalled();
    });

    it('shows an error toast when the manual add fails', async () => {
      const user = userEvent.setup();
      mockUpdateMentorAccess.mockReturnValue({
        unwrap: vi.fn().mockRejectedValue(new Error('boom')),
      });
      render(<RoleAccessPanel {...defaultProps} />);

      await user.type(getManualInput(), 'fail@example.com{Enter}');
      await user.click(getSubmitButton());

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalled();
      });
    });
  });

  describe('group management', () => {
    const policyWithGroups = {
      ...defaultPolicy,
      groups: [{ id: 20, name: 'Sales', unique_id: 'sales' }],
    } as typeof defaultPolicy;

    it('shows the empty state when no groups are assigned', () => {
      render(<RoleAccessPanel {...defaultProps} />);

      expect(screen.getByText('Assigned groups')).toBeInTheDocument();
      expect(
        screen.getByText('No groups have this role yet.'),
      ).toBeInTheDocument();
    });

    it('removes an assigned group', async () => {
      const user = userEvent.setup();
      const onAccessUpdated = vi.fn().mockResolvedValue(undefined);
      render(
        <RoleAccessPanel
          {...defaultProps}
          policy={policyWithGroups}
          onAccessUpdated={onAccessUpdated}
        />,
      );

      expect(screen.getByText('Sales')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: /remove sales/i }));

      await waitFor(() => {
        expect(mockUpdateMentorAccess).toHaveBeenCalledWith(
          expect.objectContaining({
            requestBody: expect.objectContaining({
              groups_to_remove: [20],
            }),
          }),
        );
      });
      expect(onAccessUpdated).toHaveBeenCalled();
    });

    it('searches for and adds a group', async () => {
      const user = userEvent.setup();
      mockUseGetRbacGroupsQuery.mockReturnValue({
        data: { results: [{ id: 30, name: 'Engineering' }] },
        isFetching: false,
        isLoading: false,
      });
      render(<RoleAccessPanel {...defaultProps} />);

      const groupSearch = screen.getByPlaceholderText(/search groups by name/i);
      await user.type(groupSearch, 'eng');

      await waitFor(() => {
        expect(screen.getByText('Engineering')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Engineering'));

      await waitFor(() => {
        expect(mockUpdateMentorAccess).toHaveBeenCalledWith(
          expect.objectContaining({
            requestBody: expect.objectContaining({
              groups_to_add: [30],
            }),
          }),
        );
      });
    });

    it('filters out already-assigned groups from search results', async () => {
      const user = userEvent.setup();
      mockUseGetRbacGroupsQuery.mockReturnValue({
        data: {
          results: [
            { id: 20, name: 'Sales' }, // already assigned -> filtered out
            { id: 30, name: 'Engineering' },
          ],
        },
        isFetching: false,
        isLoading: false,
      });
      render(<RoleAccessPanel {...defaultProps} policy={policyWithGroups} />);

      await user.type(
        screen.getByPlaceholderText(/search groups by name/i),
        'a',
      );
      await user.type(
        screen.getByPlaceholderText(/search groups by name/i),
        'l',
      );

      await waitFor(() => {
        expect(screen.getByText('Engineering')).toBeInTheDocument();
      });
      // The already-assigned "Sales" should not appear as a search option.
      const options = screen
        .getAllByRole('button')
        .filter((b) => b.textContent === 'Sales');
      expect(options).toHaveLength(0);
    });

    it('shows the minimum-characters hint for a short group query', async () => {
      const user = userEvent.setup();
      render(<RoleAccessPanel {...defaultProps} />);

      await user.type(
        screen.getByPlaceholderText(/search groups by name/i),
        'e',
      );

      await waitFor(() => {
        expect(
          screen.getByText('Type at least two characters to search.'),
        ).toBeInTheDocument();
      });
    });

    it('shows the loading state while fetching groups', async () => {
      const user = userEvent.setup();
      mockUseGetRbacGroupsQuery.mockReturnValue({
        data: undefined,
        isFetching: true,
        isLoading: true,
      });
      render(<RoleAccessPanel {...defaultProps} />);

      await user.type(
        screen.getByPlaceholderText(/search groups by name/i),
        'eng',
      );

      await waitFor(() => {
        expect(screen.getByText(/searching groups/i)).toBeInTheDocument();
      });
    });

    it('shows the no-results state when no groups match', async () => {
      const user = userEvent.setup();
      mockUseGetRbacGroupsQuery.mockReturnValue({
        data: { results: [] },
        isFetching: false,
        isLoading: false,
      });
      render(<RoleAccessPanel {...defaultProps} />);

      await user.type(
        screen.getByPlaceholderText(/search groups by name/i),
        'zzz',
      );

      await waitFor(() => {
        expect(
          screen.getByText('No matching groups found.'),
        ).toBeInTheDocument();
      });
    });

    it('hides group results on blur and re-shows them on focus', async () => {
      const user = userEvent.setup();
      mockUseGetRbacGroupsQuery.mockReturnValue({
        data: { results: [{ id: 30, name: 'Engineering' }] },
        isFetching: false,
        isLoading: false,
      });
      render(<RoleAccessPanel {...defaultProps} />);

      const groupSearch = screen.getByPlaceholderText(/search groups by name/i);
      await user.type(groupSearch, 'eng');
      expect(screen.getByText('Engineering')).toBeInTheDocument();

      // Blur schedules a 100ms timeout that hides the results.
      fireEvent.blur(groupSearch);
      await waitFor(() => {
        expect(screen.queryByText('Engineering')).not.toBeInTheDocument();
      });

      // Focusing again with a 2+ char term re-opens the results.
      fireEvent.focus(groupSearch);
      await waitFor(() => {
        expect(screen.getByText('Engineering')).toBeInTheDocument();
      });
    });
  });
});
