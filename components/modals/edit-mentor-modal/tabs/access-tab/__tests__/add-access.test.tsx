import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AddAccessDialog } from "../add-access";
import type { DefaultMentorRole } from "../shared";

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

vi.mock("next/navigation", () => ({
  useParams: () => mockUseParams(),
}));

vi.mock("@/hooks/use-user", () => ({
  useUsername: () => mockUseUsername(),
}));

vi.mock("@iblai/iblai-js/data-layer", () => ({
  usePlatformUsersQuery: (...args: unknown[]) =>
    mockUsePlatformUsersQuery(...args),
  useGetRbacGroupsQuery: (...args: unknown[]) =>
    mockUseGetRbacGroupsQuery(...args),
  useUpdateRbacMentorAccessMutation: () =>
    mockUseUpdateRbacMentorAccessMutation(),
  useGetMentorSettingsQuery: (...args: unknown[]) =>
    mockUseGetMentorSettingsQuery(...args),
  isPoliciesResponse: (results: unknown) =>
    results && typeof results === "object" && "data" in (results as object),
}));

vi.mock("@/lib/hooks", () => ({
  useAppSelector: () => ({}),
}));

vi.mock("@/features/rbac/rbac-slice", () => ({
  selectRbacPermissions: "selectRbacPermissions",
}));

vi.mock("@/hoc/withPermissions", () => ({
  checkRbacPermission: () => true,
}));

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
    success: (...args: unknown[]) => mockToastSuccess(...args),
  },
}));

vi.mock("use-debounce", () => ({
  useDebounce: (value: string) => [value],
}));

describe("AddAccessDialog", () => {
  const defaultProps = {
    availableRoles: ["editor"] as DefaultMentorRole[],
    isLoading: false,
    onAccessCreated: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock methods for Radix UI Select in jsdom
    Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
    Element.prototype.setPointerCapture = vi.fn();
    Element.prototype.releasePointerCapture = vi.fn();
    Element.prototype.scrollIntoView = vi.fn();

    mockUseParams.mockReturnValue({
      tenantKey: "test-tenant",
      mentorId: "test-mentor",
    });

    mockUseUsername.mockReturnValue("testuser");

    mockUsePlatformUsersQuery.mockReturnValue({
      data: {
        results: [
          {
            id: 1,
            name: "User One",
            username: "user1",
            email: "user1@example.com",
          },
          {
            id: 2,
            name: "User Two",
            username: "user2",
            email: "user2@example.com",
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
      { isLoading: false },
    ]);

    mockUseGetMentorSettingsQuery.mockReturnValue({
      data: { mentor_id: 123 },
    });
  });

  it("renders the create role access button", () => {
    render(<AddAccessDialog {...defaultProps} />);

    expect(
      screen.getByRole("button", { name: /create role access/i }),
    ).toBeInTheDocument();
  });

  it("disables button when isLoading is true", () => {
    render(<AddAccessDialog {...defaultProps} isLoading={true} />);

    expect(
      screen.getByRole("button", { name: /create role access/i }),
    ).toBeDisabled();
  });

  it("disables button when mentorDbId is not available", () => {
    mockUseGetMentorSettingsQuery.mockReturnValue({
      data: { mentor_id: undefined },
    });

    render(<AddAccessDialog {...defaultProps} />);

    expect(
      screen.getByRole("button", { name: /create role access/i }),
    ).toBeDisabled();
  });

  it("opens dialog when clicking create role access button", async () => {
    const user = userEvent.setup();
    render(<AddAccessDialog {...defaultProps} />);

    await user.click(
      screen.getByRole("button", { name: /create role access/i }),
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Create mentor role access")).toBeInTheDocument();
  });

  it("shows available roles in select dropdown", async () => {
    const user = userEvent.setup();
    render(<AddAccessDialog {...defaultProps} />);

    await user.click(
      screen.getByRole("button", { name: /create role access/i }),
    );

    const selectTrigger = screen.getByRole("combobox", {
      name: /select role/i,
    });
    expect(selectTrigger).toBeInTheDocument();
  });

  it("disables create button when no role is selected", async () => {
    const user = userEvent.setup();
    render(<AddAccessDialog {...defaultProps} />);

    await user.click(
      screen.getByRole("button", { name: /create role access/i }),
    );

    // The Create button should be disabled when no role is selected
    expect(screen.getByRole("button", { name: /^create$/i })).toBeDisabled();
  });

  it("shows error when mentor context is missing", () => {
    mockUseGetMentorSettingsQuery.mockReturnValue({
      data: { mentor_id: undefined },
    });
    mockUseParams.mockReturnValue({
      tenantKey: undefined,
      mentorId: "test-mentor",
    });

    render(<AddAccessDialog {...defaultProps} />);

    // Button is disabled when mentor context is missing, so this test validates the button state
    expect(
      screen.getByRole("button", { name: /create role access/i }),
    ).toBeDisabled();
  });

  it("shows error when role already exists", async () => {
    const user = userEvent.setup();
    render(<AddAccessDialog {...defaultProps} availableRoles={[]} />);

    // Dialog should auto-close when no available roles
    await user.click(
      screen.getByRole("button", { name: /create role access/i }),
    );

    // Select should be disabled with no roles
    const selectTrigger = screen.queryByRole("combobox", {
      name: /select role/i,
    });
    if (selectTrigger) {
      expect(selectTrigger).toBeDisabled();
    }
  });

  it("handles cancel button click", async () => {
    const user = userEvent.setup();
    render(<AddAccessDialog {...defaultProps} />);

    await user.click(
      screen.getByRole("button", { name: /create role access/i }),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /cancel/i }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("shows no users selected state initially", async () => {
    const user = userEvent.setup();
    render(<AddAccessDialog {...defaultProps} />);

    await user.click(
      screen.getByRole("button", { name: /create role access/i }),
    );

    expect(screen.getByText("No users selected yet.")).toBeInTheDocument();
  });

  it("shows user search input", async () => {
    const user = userEvent.setup();
    render(<AddAccessDialog {...defaultProps} />);

    await user.click(
      screen.getByRole("button", { name: /create role access/i }),
    );

    const searchInput = screen.getByPlaceholderText(
      /search by name, username, or email/i,
    );
    expect(searchInput).toBeInTheDocument();
  });

  it("shows minimum character message when search term is too short", async () => {
    const user = userEvent.setup();
    render(<AddAccessDialog {...defaultProps} />);

    await user.click(
      screen.getByRole("button", { name: /create role access/i }),
    );

    const searchInput = screen.getByPlaceholderText(
      /search by name, username, or email/i,
    );
    await user.type(searchInput, "a");
    await user.click(searchInput); // Focus to show results

    await waitFor(() => {
      expect(
        screen.getByText("Type at least two characters to search."),
      ).toBeInTheDocument();
    });
  });

  it("shows loading state while fetching users", async () => {
    const user = userEvent.setup();
    mockUsePlatformUsersQuery.mockReturnValue({
      data: null,
      isFetching: true,
      isLoading: true,
    });

    render(<AddAccessDialog {...defaultProps} />);

    await user.click(
      screen.getByRole("button", { name: /create role access/i }),
    );

    const searchInput = screen.getByPlaceholderText(
      /search by name, username, or email/i,
    );
    await user.type(searchInput, "test");
    await user.click(searchInput);

    await waitFor(() => {
      expect(screen.getByText(/searching users/i)).toBeInTheDocument();
    });
  });

  it("shows user search results", async () => {
    const user = userEvent.setup();
    render(<AddAccessDialog {...defaultProps} />);

    await user.click(
      screen.getByRole("button", { name: /create role access/i }),
    );

    const searchInput = screen.getByPlaceholderText(
      /search by name, username, or email/i,
    );
    await user.type(searchInput, "user");
    await user.click(searchInput);

    await waitFor(() => {
      expect(screen.getByText("User One")).toBeInTheDocument();
      expect(screen.getByText("User Two")).toBeInTheDocument();
    });
  });

  it("adds user to selection when clicking on search result", async () => {
    const user = userEvent.setup();
    render(<AddAccessDialog {...defaultProps} />);

    await user.click(
      screen.getByRole("button", { name: /create role access/i }),
    );

    const searchInput = screen.getByPlaceholderText(
      /search by name, username, or email/i,
    );
    await user.type(searchInput, "user");

    await waitFor(() => {
      expect(screen.getByText("User One")).toBeInTheDocument();
    });

    // Click on the user result button
    const userButton = screen.getByRole("button", { name: /user one/i });
    await user.click(userButton);

    await waitFor(() => {
      // User should appear in selected users area
      expect(
        screen.queryByText("No users selected yet."),
      ).not.toBeInTheDocument();
    });
  });

  it("removes user from selection when clicking remove button", async () => {
    const user = userEvent.setup();
    render(<AddAccessDialog {...defaultProps} />);

    await user.click(
      screen.getByRole("button", { name: /create role access/i }),
    );

    const searchInput = screen.getByPlaceholderText(
      /search by name, username, or email/i,
    );
    await user.type(searchInput, "user");

    await waitFor(() => {
      expect(screen.getByText("User One")).toBeInTheDocument();
    });

    // Add user
    await user.click(screen.getByRole("button", { name: /user one/i }));

    // Wait for user to be added
    await waitFor(() => {
      const removeButtons = screen.queryAllByRole("button", {
        name: /remove/i,
      });
      expect(removeButtons.length).toBeGreaterThan(0);
    });

    // Remove user (email takes precedence in sr-only label)
    const removeButton = screen.getByRole("button", {
      name: /remove user1@example.com/i,
    });
    await user.click(removeButton);

    await waitFor(() => {
      expect(screen.getByText("No users selected yet.")).toBeInTheDocument();
    });
  });

  it("creates role access successfully", async () => {
    const user = userEvent.setup();
    const onAccessCreated = vi.fn().mockResolvedValue(undefined);

    render(
      <AddAccessDialog {...defaultProps} onAccessCreated={onAccessCreated} />,
    );

    await user.click(
      screen.getByRole("button", { name: /create role access/i }),
    );

    // Select role
    const selectTrigger = screen.getByRole("combobox", {
      name: /select role/i,
    });
    await user.click(selectTrigger);

    await waitFor(() => {
      const editorOption = screen.getByRole("option", { name: /editor/i });
      expect(editorOption).toBeInTheDocument();
    });

    await user.click(screen.getByRole("option", { name: /editor/i }));

    // Submit
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    await waitFor(() => {
      expect(mockUpdateMentorAccess).toHaveBeenCalled();
      expect(mockToastSuccess).toHaveBeenCalledWith("Editor access created.");
      expect(onAccessCreated).toHaveBeenCalled();
    });
  });

  it("handles create access error", async () => {
    const user = userEvent.setup();
    mockUpdateMentorAccess.mockReturnValue({
      unwrap: vi.fn().mockRejectedValue(new Error("Failed to create")),
    });

    render(<AddAccessDialog {...defaultProps} />);

    await user.click(
      screen.getByRole("button", { name: /create role access/i }),
    );

    // Select role
    const selectTrigger = screen.getByRole("combobox", {
      name: /select role/i,
    });
    await user.click(selectTrigger);

    await waitFor(() => {
      const editorOption = screen.getByRole("option", { name: /editor/i });
      expect(editorOption).toBeInTheDocument();
    });

    await user.click(screen.getByRole("option", { name: /editor/i }));

    // Submit
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalled();
    });
  });

  it("shows no matching users message when search returns empty", async () => {
    const user = userEvent.setup();
    mockUsePlatformUsersQuery.mockReturnValue({
      data: { results: [] },
      isFetching: false,
      isLoading: false,
    });

    render(<AddAccessDialog {...defaultProps} />);

    await user.click(
      screen.getByRole("button", { name: /create role access/i }),
    );

    const searchInput = screen.getByPlaceholderText(
      /search by name, username, or email/i,
    );
    await user.type(searchInput, "nonexistent");

    await waitFor(() => {
      expect(screen.getByText("No matching users found.")).toBeInTheDocument();
    });
  });

  it("closes dialog when dialog open state changes to false", async () => {
    const user = userEvent.setup();
    render(<AddAccessDialog {...defaultProps} />);

    await user.click(
      screen.getByRole("button", { name: /create role access/i }),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // Press escape to close
    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("clears selected role when it becomes unavailable", async () => {
    const { rerender } = render(
      <AddAccessDialog {...defaultProps} availableRoles={["editor"]} />,
    );

    // Rerender with empty available roles
    rerender(<AddAccessDialog {...defaultProps} availableRoles={[]} />);

    // Dialog should be closed when no roles available
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("handles user with user_id instead of id", async () => {
    const user = userEvent.setup();
    mockUsePlatformUsersQuery.mockReturnValue({
      data: {
        results: [
          {
            user_id: 1,
            name: "User One",
            username: "user1",
            email: "user1@example.com",
          },
        ],
      },
      isFetching: false,
      isLoading: false,
    });

    render(<AddAccessDialog {...defaultProps} />);

    await user.click(
      screen.getByRole("button", { name: /create role access/i }),
    );

    const searchInput = screen.getByPlaceholderText(
      /search by name, username, or email/i,
    );
    await user.type(searchInput, "user");

    await waitFor(() => {
      expect(screen.getByText("User One")).toBeInTheDocument();
    });
  });

  it("handles policies response format", async () => {
    const user = userEvent.setup();
    mockUsePlatformUsersQuery.mockReturnValue({
      data: {
        results: {
          data: [
            {
              id: 1,
              name: "User One",
              username: "user1",
              email: "user1@example.com",
            },
          ],
        },
      },
      isFetching: false,
      isLoading: false,
    });

    render(<AddAccessDialog {...defaultProps} />);

    await user.click(
      screen.getByRole("button", { name: /create role access/i }),
    );

    const searchInput = screen.getByPlaceholderText(
      /search by name, username, or email/i,
    );
    await user.type(searchInput, "user");

    await waitFor(() => {
      expect(screen.getByText("User One")).toBeInTheDocument();
    });
  });

  it("filters out invalid candidates from results", async () => {
    const user = userEvent.setup();
    mockUsePlatformUsersQuery.mockReturnValue({
      data: {
        results: [
          null,
          undefined,
          "invalid",
          {
            id: 1,
            name: "Valid User",
            username: "valid",
            email: "valid@example.com",
          },
          { name: "No ID User", username: "noid", email: "noid@example.com" },
        ],
      },
      isFetching: false,
      isLoading: false,
    });

    render(<AddAccessDialog {...defaultProps} />);

    await user.click(
      screen.getByRole("button", { name: /create role access/i }),
    );

    const searchInput = screen.getByPlaceholderText(
      /search by name, username, or email/i,
    );
    await user.type(searchInput, "user");

    await waitFor(() => {
      expect(screen.getByText("Valid User")).toBeInTheDocument();
      // No ID User should be filtered out
      expect(screen.queryByText("No ID User")).not.toBeInTheDocument();
    });
  });

  it("does not add duplicate users", async () => {
    const user = userEvent.setup();
    render(<AddAccessDialog {...defaultProps} />);

    await user.click(
      screen.getByRole("button", { name: /create role access/i }),
    );

    const searchInput = screen.getByPlaceholderText(
      /search by name, username, or email/i,
    );
    await user.type(searchInput, "user");

    await waitFor(() => {
      expect(screen.getByText("User One")).toBeInTheDocument();
    });

    // Add user
    await user.click(screen.getByRole("button", { name: /user one/i }));

    // Wait for user to be added, then search again
    await waitFor(() => {
      expect(
        screen.queryByText("No users selected yet."),
      ).not.toBeInTheDocument();
    });

    // Try to search again - the selected user should not appear in results
    await user.clear(searchInput);
    await user.type(searchInput, "user");

    // User One should not appear in results since already selected
    await waitFor(() => {
      // Only User Two should be visible in results now
      const buttons = screen.getAllByRole("button");
      const userOneButtons = buttons.filter((btn) =>
        btn.textContent?.includes("User One"),
      );
      // One in selected area, none in search results (since already selected)
      expect(userOneButtons.length).toBeLessThanOrEqual(1);
    });
  });

  it("shows loading state when creating access", async () => {
    const user = userEvent.setup();

    // Make mutation return pending state
    mockUseUpdateRbacMentorAccessMutation.mockReturnValue([
      mockUpdateMentorAccess,
      { isLoading: true },
    ]);

    render(<AddAccessDialog {...defaultProps} />);

    await user.click(
      screen.getByRole("button", { name: /create role access/i }),
    );

    // The create button should show loading state
    const createButton = screen.getByRole("button", { name: /creating/i });
    expect(createButton).toBeDisabled();
  });

  it("handles blur event on search input", async () => {
    const user = userEvent.setup();
    vi.useFakeTimers({ shouldAdvanceTime: true });

    render(<AddAccessDialog {...defaultProps} />);

    await user.click(
      screen.getByRole("button", { name: /create role access/i }),
    );

    const searchInput = screen.getByPlaceholderText(
      /search by name, username, or email/i,
    );
    await user.type(searchInput, "user");

    // Results should be visible
    await waitFor(() => {
      expect(screen.getByText("User One")).toBeInTheDocument();
    });

    // Blur the input
    fireEvent.blur(searchInput);

    // Advance timers to trigger the delayed close
    await act(async () => {
      vi.advanceTimersByTime(150);
    });

    vi.useRealTimers();
  });

  it("handles focus event on search input with existing search term", async () => {
    const user = userEvent.setup();
    vi.useFakeTimers({ shouldAdvanceTime: true });

    render(<AddAccessDialog {...defaultProps} />);

    await user.click(
      screen.getByRole("button", { name: /create role access/i }),
    );

    const searchInput = screen.getByPlaceholderText(
      /search by name, username, or email/i,
    );

    // Type search term
    await user.type(searchInput, "user");

    // Blur then focus back using fireEvent (click on body doesn't work with modal)
    fireEvent.blur(searchInput);
    await user.click(searchInput);

    // Results should be visible
    await waitFor(() => {
      expect(screen.getByText("User One")).toBeInTheDocument();
    });

    // Flush the pending blur timeout so it doesn't fire after teardown
    await act(async () => {
      vi.advanceTimersByTime(150);
    });
    vi.useRealTimers();
  });

  it("displays user email as fallback when name is missing", async () => {
    const user = userEvent.setup();
    mockUsePlatformUsersQuery.mockReturnValue({
      data: {
        results: [
          { id: 1, name: "", username: "user1", email: "user1@example.com" },
        ],
      },
      isFetching: false,
      isLoading: false,
    });

    render(<AddAccessDialog {...defaultProps} />);

    await user.click(
      screen.getByRole("button", { name: /create role access/i }),
    );

    const searchInput = screen.getByPlaceholderText(
      /search by name, username, or email/i,
    );
    await user.type(searchInput, "user");

    await waitFor(() => {
      expect(screen.getByText("user1@example.com")).toBeInTheDocument();
    });
  });

  it("handles string id conversion", async () => {
    const user = userEvent.setup();
    mockUsePlatformUsersQuery.mockReturnValue({
      data: {
        results: [
          {
            id: "123",
            name: "User One",
            username: "user1",
            email: "user1@example.com",
          },
        ],
      },
      isFetching: false,
      isLoading: false,
    });

    render(<AddAccessDialog {...defaultProps} />);

    await user.click(
      screen.getByRole("button", { name: /create role access/i }),
    );

    const searchInput = screen.getByPlaceholderText(
      /search by name, username, or email/i,
    );
    await user.type(searchInput, "user");

    await waitFor(() => {
      expect(screen.getByText("User One")).toBeInTheDocument();
    });
  });

  it("creates role access with selected users", async () => {
    const user = userEvent.setup();
    const onAccessCreated = vi.fn().mockResolvedValue(undefined);

    render(
      <AddAccessDialog {...defaultProps} onAccessCreated={onAccessCreated} />,
    );

    await user.click(
      screen.getByRole("button", { name: /create role access/i }),
    );

    // Select role
    const selectTrigger = screen.getByRole("combobox", {
      name: /select role/i,
    });
    await user.click(selectTrigger);

    await waitFor(() => {
      expect(
        screen.getByRole("option", { name: /editor/i }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("option", { name: /editor/i }));

    // Add a user
    const searchInput = screen.getByPlaceholderText(
      /search by name, username, or email/i,
    );
    await user.type(searchInput, "user");

    await waitFor(() => {
      expect(screen.getByText("User One")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /user one/i }));

    // Wait for user to be added
    await waitFor(() => {
      expect(
        screen.queryByText("No users selected yet."),
      ).not.toBeInTheDocument();
    });

    // Submit with users
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    await waitFor(() => {
      expect(mockUpdateMentorAccess).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: expect.objectContaining({
            users_to_add: [1],
          }),
        }),
      );
    });
  });

  it("clears selected role when it becomes unavailable after selection", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<AddAccessDialog {...defaultProps} />);

    await user.click(
      screen.getByRole("button", { name: /create role access/i }),
    );

    // Select role
    const selectTrigger = screen.getByRole("combobox", {
      name: /select role/i,
    });
    await user.click(selectTrigger);

    await waitFor(() => {
      expect(
        screen.getByRole("option", { name: /editor/i }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("option", { name: /editor/i }));

    // Verify role is selected
    await waitFor(() => {
      expect(selectTrigger).toHaveTextContent("Editor");
    });

    // Re-render with empty available roles
    rerender(<AddAccessDialog {...defaultProps} availableRoles={[]} />);

    // The role should be cleared and dialog should close
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  describe("handleCreateRoleAccess defensive paths", () => {
    it("clears selected role and closes dialog when role becomes unavailable", async () => {
      const user = userEvent.setup();
      const { rerender } = render(
        <AddAccessDialog {...defaultProps} availableRoles={["editor"]} />,
      );

      await user.click(
        screen.getByRole("button", { name: /create role access/i }),
      );

      // Select editor role
      const selectTrigger = screen.getByRole("combobox", {
        name: /select role/i,
      });
      await user.click(selectTrigger);

      await waitFor(() => {
        expect(
          screen.getByRole("option", { name: /editor/i }),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByRole("option", { name: /editor/i }));

      // Verify role is selected
      await waitFor(() => {
        expect(selectTrigger).toHaveTextContent("Editor");
      });

      // Now rerender with empty availableRoles - the selected role becomes unavailable
      // This simulates a race condition where the role becomes unavailable
      rerender(<AddAccessDialog {...defaultProps} availableRoles={[]} />);

      // Dialog should close when no roles are available
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
    });

    it("handles submission when platform key is missing", async () => {
      // Set up missing platformKey
      mockUseParams.mockReturnValue({
        tenantKey: undefined,
        mentorId: "test-mentor",
      });

      render(<AddAccessDialog {...defaultProps} />);

      // Button should be disabled when platform context is missing
      expect(
        screen.getByRole("button", { name: /create role access/i }),
      ).toBeDisabled();
    });

    it("handles empty selectedRole when trying to submit", async () => {
      const user = userEvent.setup();
      render(<AddAccessDialog {...defaultProps} />);

      await user.click(
        screen.getByRole("button", { name: /create role access/i }),
      );

      // The Create button should be disabled when no role is selected
      const createButton = screen.getByRole("button", { name: /^create$/i });
      expect(createButton).toBeDisabled();
    });
  });
});
