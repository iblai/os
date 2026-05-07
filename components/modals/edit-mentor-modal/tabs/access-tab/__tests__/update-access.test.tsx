import {
  render,
  screen,
  waitFor,
  act,
  fireEvent,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
  checkRbacPermission: () => true,
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
});
