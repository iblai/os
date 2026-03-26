import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { toast } from "sonner";

import { CopyMentorModal } from "./copy-mentor-modal";

// ============================================================================
// MOCKS
// ============================================================================

const mockUseParams = vi.fn();
const mockGetMentorId = vi.fn();
const mockGetUpdatedModalStack = vi.fn();
const mockNavigateToMentor = vi.fn();
const mockForkMentor = vi.fn();
const mockEditMentor = vi.fn();
const mockGetMentorSettingsQuery = vi.fn();
const mockGetUserTenantsQuery = vi.fn();
const mockOnClose = vi.fn();
const mockUsername = vi.fn<() => string | null>(() => "testuser");

vi.mock("next/navigation", () => ({
  useParams: () => mockUseParams(),
}));

vi.mock("@/hooks/use-user", () => ({
  useUsername: () => mockUsername(),
}));

vi.mock("@/hooks/user-navigate", () => ({
  useNavigate: () => ({
    getMentorId: mockGetMentorId,
    getUpdatedModalStack: mockGetUpdatedModalStack,
    navigateToMentor: mockNavigateToMentor,
  }),
}));

const mockForkMentorLoading = vi.fn();

vi.mock("@iblai/iblai-js/data-layer", () => ({
  useGetMentorSettingsQuery: (...args: unknown[]) =>
    mockGetMentorSettingsQuery(...args),
  useForkMentorMutation: () => [
    mockForkMentor,
    { isLoading: mockForkMentorLoading() },
  ],
  useEditMentorMutation: () => [mockEditMentor, { isLoading: false }],
}));

vi.mock("@/features/tenants/api-slice", () => ({
  useGetUserTenantsQuery: () => mockGetUserTenantsQuery(),
}));

vi.mock("@iblai/iblai-api", () => ({
  MentorVisibilityEnum: {
    VIEWABLE_BY_ANYONE: "viewable_by_anyone",
    VIEWABLE_BY_TENANT_STUDENTS: "viewable_by_tenant_students",
    VIEWABLE_BY_TENANT_ADMINS: "viewable_by_tenant_admins",
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: any) =>
    open ? <div role="dialog">{children}</div> : null,
  DialogContent: ({ children, className }: any) => (
    <div className={className}>{children}</div>
  ),
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, disabled, className, type, ...props }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={className}
      type={type}
      {...props}
    >
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: ({ value, onChange, disabled, ...props }: any) => (
    <input value={value} onChange={onChange} disabled={disabled} {...props} />
  ),
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({ children, ...props }: any) => <label {...props}>{children}</label>,
}));

vi.mock("@/components/ui/switch", () => ({
  Switch: ({ checked, onCheckedChange, disabled, ...props }: any) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onCheckedChange(e.target.checked)}
      disabled={disabled}
      {...props}
    />
  ),
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({ children, value, onValueChange, disabled }: any) => (
    <div data-testid="select-root" data-value={value} data-disabled={disabled}>
      {React.Children.map(children, (child: any) =>
        React.isValidElement(child)
          ? React.cloneElement(child as any, { onValueChange })
          : child,
      )}
    </div>
  ),
  SelectTrigger: ({ children, ...props }: any) => (
    <button data-testid="select-trigger" {...props}>
      {children}
    </button>
  ),
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
  SelectContent: ({ children, onValueChange }: any) => (
    <div>
      {React.Children.map(children, (child: any) =>
        React.isValidElement(child)
          ? React.cloneElement(child as any, { onValueChange })
          : child,
      )}
    </div>
  ),
  SelectItem: ({ children, value, onValueChange, ...props }: any) => (
    <div
      data-testid={`select-item-${value}`}
      data-value={value}
      onClick={() => onValueChange?.(value)}
      {...props}
    >
      {children}
    </div>
  ),
}));

vi.mock("@/lib/constants", () => ({
  MODALS: {
    EDIT_MENTOR: {
      name: "edit_mentor",
      tabs: { settings: "settings" },
    },
  },
}));

const mockHandleTenantSwitch = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/utils", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
  handleTenantSwitch: (...args: unknown[]) => mockHandleTenantSwitch(...args),
}));

// ============================================================================
// TEST DATA
// ============================================================================

const defaultMentorSettings = {
  mentor_name: "Test Mentor",
  platform_key: "test-tenant",
  mentor_visibility: "viewable_by_tenant_students",
  forkable: true,
  forkable_with_training_data: true,
};

const singleAdminTenants = [
  {
    key: "test-tenant",
    name: "Test Tenant",
    is_admin: true,
    is_staff: false,
    user_id: 1,
    username: "testuser",
    email: "test@test.com",
    user_active: true,
    org: "test-tenant",
    lms_url: "",
    cms_url: "",
    portal_url: null,
    added_on: "",
    expired_on: null,
    public: null,
    active: true,
  },
];

const multipleAdminTenants = [
  ...singleAdminTenants,
  {
    key: "other-tenant",
    name: "Other Tenant",
    is_admin: true,
    is_staff: false,
    user_id: 1,
    username: "testuser",
    email: "test@test.com",
    user_active: true,
    org: "other-tenant",
    lms_url: "",
    cms_url: "",
    portal_url: null,
    added_on: "",
    expired_on: null,
    public: null,
    active: true,
  },
];

const mixedTenants = [
  ...singleAdminTenants,
  {
    key: "non-admin-tenant",
    name: "Non-Admin Tenant",
    is_admin: false,
    is_staff: false,
    user_id: 1,
    username: "testuser",
    email: "test@test.com",
    user_active: true,
    org: "non-admin-tenant",
    lms_url: "",
    cms_url: "",
    portal_url: null,
    added_on: "",
    expired_on: null,
    public: null,
    active: true,
  },
];

// ============================================================================
// TESTS
// ============================================================================

describe("CopyMentorModal", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();

    mockUseParams.mockReturnValue({
      tenantKey: "test-tenant",
      mentorId: "test-mentor",
    });
    mockUsername.mockReturnValue("testuser");
    mockGetMentorId.mockReturnValue(null);
    mockForkMentorLoading.mockReturnValue(false);
    mockForkMentor.mockReturnValue({
      unwrap: vi.fn().mockResolvedValue({ unique_id: "new-mentor-id" }),
    });
    mockEditMentor.mockReturnValue({ unwrap: vi.fn().mockResolvedValue({}) });
    mockGetUpdatedModalStack.mockReturnValue([
      { name: "edit_mentor", tab: "settings" },
    ]);

    mockGetMentorSettingsQuery.mockReturnValue({
      data: defaultMentorSettings,
      isLoading: false,
    });

    mockGetUserTenantsQuery.mockReturnValue({
      data: singleAdminTenants,
      isLoading: false,
    });
  });

  afterEach(() => {
    cleanup();
  });

  describe("Rendering", () => {
    it("renders the copy mentor dialog with title", () => {
      render(<CopyMentorModal onClose={mockOnClose} />);

      expect(screen.getByText("Copy Mentor")).toBeInTheDocument();
    });

    it("renders description", () => {
      render(<CopyMentorModal onClose={mockOnClose} />);

      expect(
        screen.getByText(/Create a copy of this mentor/),
      ).toBeInTheDocument();
    });

    it("renders name input with default value", () => {
      render(<CopyMentorModal onClose={mockOnClose} />);

      expect(
        screen.getByDisplayValue("Copy of Test Mentor"),
      ).toBeInTheDocument();
    });

    it("renders Cancel and Copy buttons", () => {
      render(<CopyMentorModal onClose={mockOnClose} />);

      expect(screen.getByText("Cancel")).toBeInTheDocument();
      expect(screen.getByText("Copy")).toBeInTheDocument();
    });

    it("renders Include training data toggle", () => {
      render(<CopyMentorModal onClose={mockOnClose} />);

      expect(screen.getByText("Include training data")).toBeInTheDocument();
    });

    it("training data toggle defaults to enabled", () => {
      render(<CopyMentorModal onClose={mockOnClose} />);

      const toggle = screen.getByLabelText("Include training data enabled");
      expect(toggle).toBeChecked();
    });
  });

  describe("Tenant Selection", () => {
    it("does not show tenant dropdown when user is admin in only one tenant", () => {
      render(<CopyMentorModal onClose={mockOnClose} />);

      expect(screen.queryByText("Destination")).not.toBeInTheDocument();
    });

    it("shows tenant dropdown when user is admin in multiple tenants", () => {
      mockGetUserTenantsQuery.mockReturnValue({
        data: multipleAdminTenants,
        isLoading: false,
      });

      render(<CopyMentorModal onClose={mockOnClose} />);

      expect(screen.getByText("Destination")).toBeInTheDocument();
    });

    it("only shows admin tenants in dropdown (filters out non-admin)", () => {
      mockGetUserTenantsQuery.mockReturnValue({
        data: mixedTenants,
        isLoading: false,
      });

      render(<CopyMentorModal onClose={mockOnClose} />);

      // With only one admin tenant, dropdown should not show
      expect(screen.queryByText("Destination")).not.toBeInTheDocument();
    });

    it("shows all admin tenants when there are multiple", () => {
      mockGetUserTenantsQuery.mockReturnValue({
        data: multipleAdminTenants,
        isLoading: false,
      });

      render(<CopyMentorModal onClose={mockOnClose} />);

      expect(screen.getByTestId("select-item-test-tenant")).toBeInTheDocument();
      expect(
        screen.getByTestId("select-item-other-tenant"),
      ).toBeInTheDocument();
    });

    it("shows tenant dropdown disabled while loading", () => {
      mockGetUserTenantsQuery.mockReturnValue({
        data: multipleAdminTenants,
        isLoading: true,
      });

      render(<CopyMentorModal onClose={mockOnClose} />);

      expect(screen.getByText("Destination")).toBeInTheDocument();
      const selectRoot = screen.getByTestId("select-root");
      expect(selectRoot).toHaveAttribute("data-disabled", "true");
    });

    it("defaults destination to current tenant", () => {
      mockGetUserTenantsQuery.mockReturnValue({
        data: multipleAdminTenants,
        isLoading: false,
      });

      render(<CopyMentorModal onClose={mockOnClose} />);

      const selectRoot = screen.getByTestId("select-root");
      expect(selectRoot).toHaveAttribute("data-value", "test-tenant");
    });

    it("allows selecting a different destination tenant", () => {
      mockGetUserTenantsQuery.mockReturnValue({
        data: multipleAdminTenants,
        isLoading: false,
      });

      render(<CopyMentorModal onClose={mockOnClose} />);

      const otherTenantItem = screen.getByTestId("select-item-other-tenant");
      fireEvent.click(otherTenantItem);

      const selectRoot = screen.getByTestId("select-root");
      expect(selectRoot).toHaveAttribute("data-value", "other-tenant");
    });

    it("displays tenant names in dropdown", () => {
      mockGetUserTenantsQuery.mockReturnValue({
        data: multipleAdminTenants,
        isLoading: false,
      });

      render(<CopyMentorModal onClose={mockOnClose} />);

      expect(screen.getByText("Test Tenant")).toBeInTheDocument();
      expect(screen.getByText("Other Tenant")).toBeInTheDocument();
    });

    it("falls back to tenant key when name is empty", () => {
      const tenantsWithoutName = [
        { ...singleAdminTenants[0] },
        { ...multipleAdminTenants[1], name: "" },
      ];

      mockGetUserTenantsQuery.mockReturnValue({
        data: tenantsWithoutName,
        isLoading: false,
      });

      render(<CopyMentorModal onClose={mockOnClose} />);

      expect(screen.getByText("other-tenant")).toBeInTheDocument();
    });
  });

  describe("Training Data Toggle", () => {
    it("toggles training data off", () => {
      render(<CopyMentorModal onClose={mockOnClose} />);

      const toggle = screen.getByLabelText("Include training data enabled");
      fireEvent.click(toggle);

      expect(
        screen.getByLabelText("Include training data disabled"),
      ).not.toBeChecked();
    });

    it("disables training data toggle when forkable_with_training_data is false", () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: { ...defaultMentorSettings, forkable_with_training_data: false },
        isLoading: false,
      });

      render(<CopyMentorModal onClose={mockOnClose} />);

      const toggle = screen.getByLabelText("Include training data disabled");
      expect(toggle).toBeDisabled();
      expect(toggle).not.toBeChecked();
    });

    it("enables training data toggle when forkable_with_training_data is true", () => {
      render(<CopyMentorModal onClose={mockOnClose} />);

      const toggle = screen.getByLabelText("Include training data enabled");
      expect(toggle).not.toBeDisabled();
      expect(toggle).toBeChecked();
    });

    it("sends clone_documents false when forkable_with_training_data is false", async () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: { ...defaultMentorSettings, forkable_with_training_data: false },
        isLoading: false,
      });

      render(<CopyMentorModal onClose={mockOnClose} />);

      fireEvent.click(screen.getByText("Copy"));

      await waitFor(() => {
        expect(mockForkMentor).toHaveBeenCalledWith(
          expect.objectContaining({
            requestBody: expect.objectContaining({
              clone_documents: false,
            }),
          }),
        );
      });
    });
  });

  describe("Copy Action", () => {
    it("calls forkMentor with correct parameters on copy", async () => {
      render(<CopyMentorModal onClose={mockOnClose} />);

      fireEvent.click(screen.getByText("Copy"));

      await waitFor(() => {
        expect(mockForkMentor).toHaveBeenCalledWith(
          expect.objectContaining({
            mentor: "test-mentor",
            org: "test-tenant",
            userId: "testuser",
            requestBody: expect.objectContaining({
              new_mentor_name: "Copy of Test Mentor",
              destination_platform_key: "test-tenant",
              clone_documents: true,
            }),
          }),
        );
      });
    });

    it("uses custom name from input when changed", async () => {
      render(<CopyMentorModal onClose={mockOnClose} />);

      const nameInput = screen.getByDisplayValue("Copy of Test Mentor");
      fireEvent.change(nameInput, { target: { value: "My Custom Mentor" } });

      fireEvent.click(screen.getByText("Copy"));

      await waitFor(() => {
        expect(mockForkMentor).toHaveBeenCalledWith(
          expect.objectContaining({
            requestBody: expect.objectContaining({
              new_mentor_name: "My Custom Mentor",
            }),
          }),
        );
      });
    });

    it("disables Copy button when name is empty", () => {
      render(<CopyMentorModal onClose={mockOnClose} />);

      const nameInput = screen.getByDisplayValue("Copy of Test Mentor");
      fireEvent.change(nameInput, { target: { value: "" } });

      expect(screen.getByText("Copy")).toBeDisabled();
    });

    it("disables Copy button when name is only whitespace", () => {
      render(<CopyMentorModal onClose={mockOnClose} />);

      const nameInput = screen.getByDisplayValue("Copy of Test Mentor");
      fireEvent.change(nameInput, { target: { value: "   " } });

      expect(screen.getByText("Copy")).toBeDisabled();
    });

    it("sends clone_documents false when toggle is off", async () => {
      render(<CopyMentorModal onClose={mockOnClose} />);

      const toggle = screen.getByLabelText("Include training data enabled");
      fireEvent.click(toggle);

      fireEvent.click(screen.getByText("Copy"));

      await waitFor(() => {
        expect(mockForkMentor).toHaveBeenCalledWith(
          expect.objectContaining({
            requestBody: expect.objectContaining({
              clone_documents: false,
            }),
          }),
        );
      });
    });

    it("copies to selected destination tenant", async () => {
      mockGetUserTenantsQuery.mockReturnValue({
        data: multipleAdminTenants,
        isLoading: false,
      });

      render(<CopyMentorModal onClose={mockOnClose} />);

      const otherTenantItem = screen.getByTestId("select-item-other-tenant");
      fireEvent.click(otherTenantItem);

      fireEvent.click(screen.getByText("Copy"));

      await waitFor(() => {
        expect(mockForkMentor).toHaveBeenCalledWith(
          expect.objectContaining({
            requestBody: expect.objectContaining({
              destination_platform_key: "other-tenant",
            }),
          }),
        );
      });
    });

    it("shows success toast on successful copy", async () => {
      render(<CopyMentorModal onClose={mockOnClose} />);

      fireEvent.click(screen.getByText("Copy"));

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          "Mentor copied successfully. Switching to new mentor...",
        );
      });
    });

    it("calls onClose on successful copy", async () => {
      render(<CopyMentorModal onClose={mockOnClose} />);

      fireEvent.click(screen.getByText("Copy"));

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it("navigates to new mentor on same-tenant copy", async () => {
      render(<CopyMentorModal onClose={mockOnClose} />);

      fireEvent.click(screen.getByText("Copy"));

      await waitFor(() => {
        expect(mockNavigateToMentor).toHaveBeenCalledWith(
          "new-mentor-id",
          expect.any(String),
        );
      });
      expect(mockHandleTenantSwitch).not.toHaveBeenCalled();
    });

    it("switches tenant when copied to a different tenant", async () => {
      mockGetUserTenantsQuery.mockReturnValue({
        data: multipleAdminTenants,
        isLoading: false,
      });

      render(<CopyMentorModal onClose={mockOnClose} />);

      const otherTenantItem = screen.getByTestId("select-item-other-tenant");
      fireEvent.click(otherTenantItem);

      fireEvent.click(screen.getByText("Copy"));

      await waitFor(() => {
        expect(mockHandleTenantSwitch).toHaveBeenCalledWith(
          "other-tenant",
          false,
          expect.stringContaining("/platform/other-tenant/new-mentor-id"),
        );
        const redirectUrl = mockHandleTenantSwitch.mock.calls[0][2] as string;
        expect(redirectUrl).toContain("modal=");
        expect(redirectUrl).toContain("edit_mentor");
      });
      expect(mockNavigateToMentor).not.toHaveBeenCalled();
    });

    it("shows error toast on failed copy", async () => {
      mockForkMentor.mockReturnValue({
        unwrap: vi.fn().mockRejectedValue(new Error("Fork failed")),
      });

      render(<CopyMentorModal onClose={mockOnClose} />);

      fireEvent.click(screen.getByText("Copy"));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Failed to copy mentor");
      });
    });

    it("does not call onClose on failed copy", async () => {
      mockForkMentor.mockReturnValue({
        unwrap: vi.fn().mockRejectedValue(new Error("Fork failed")),
      });

      render(<CopyMentorModal onClose={mockOnClose} />);

      fireEvent.click(screen.getByText("Copy"));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled();
      });

      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it("disables Copy button when context is missing", () => {
      mockUseParams.mockReturnValue({
        tenantKey: undefined,
        mentorId: undefined,
      });

      render(<CopyMentorModal onClose={mockOnClose} />);

      expect(screen.getByText("Copy")).toBeDisabled();
    });

    it("shows error toast when username is missing", async () => {
      mockUsername.mockReturnValue(null);

      render(<CopyMentorModal onClose={mockOnClose} />);

      fireEvent.click(screen.getByText("Copy"));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          "Unable to copy mentor. Missing context.",
        );
      });
    });

    it("adjusts visibility when forked mentor is viewable by anyone", async () => {
      mockForkMentor.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({
          unique_id: "new-mentor-id",
          settings: { mentor_visibility: "viewable_by_anyone" },
        }),
      });

      render(<CopyMentorModal onClose={mockOnClose} />);

      fireEvent.click(screen.getByText("Copy"));

      await waitFor(() => {
        expect(mockEditMentor).toHaveBeenCalledWith(
          expect.objectContaining({
            mentor: "new-mentor-id",
            org: "test-tenant",
            formData: {
              mentor_visibility: "viewable_by_tenant_students",
            },
          }),
        );
      });
    });

    it("defaults name to Copy of Mentor when mentor settings are not loaded", () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: undefined,
        isLoading: true,
      });

      render(<CopyMentorModal onClose={mockOnClose} />);

      expect(screen.getByDisplayValue("Copy of Mentor")).toBeInTheDocument();
    });
  });

  describe("Loading States", () => {
    it("shows Copying... text while copying", () => {
      mockForkMentorLoading.mockReturnValue(true);

      render(<CopyMentorModal onClose={mockOnClose} />);

      expect(screen.getByText("Copying...")).toBeInTheDocument();
    });

    it("disables Copy button while copying", () => {
      mockForkMentorLoading.mockReturnValue(true);

      render(<CopyMentorModal onClose={mockOnClose} />);

      expect(screen.getByText("Copying...")).toBeDisabled();
    });

    it("disables Cancel button while copying", () => {
      mockForkMentorLoading.mockReturnValue(true);

      render(<CopyMentorModal onClose={mockOnClose} />);

      expect(screen.getByText("Cancel")).toBeDisabled();
    });

    it("disables name input while copying", () => {
      mockForkMentorLoading.mockReturnValue(true);

      render(<CopyMentorModal onClose={mockOnClose} />);

      const nameInput = screen.getByPlaceholderText("Mentor Name");
      expect(nameInput).toBeDisabled();
    });

    it("disables training data toggle while copying", () => {
      mockForkMentorLoading.mockReturnValue(true);

      render(<CopyMentorModal onClose={mockOnClose} />);

      const toggle = screen.getByLabelText("Include training data enabled");
      expect(toggle).toBeDisabled();
    });
  });

  describe("Cancel Action", () => {
    it("calls onClose when Cancel is clicked", () => {
      render(<CopyMentorModal onClose={mockOnClose} />);

      fireEvent.click(screen.getByText("Cancel"));

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe("getMentorId fallback", () => {
    it("uses getMentorId when it returns a value", () => {
      mockGetMentorId.mockReturnValue("active-mentor-123");

      render(<CopyMentorModal onClose={mockOnClose} />);

      expect(mockGetMentorSettingsQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          mentor: "active-mentor-123",
        }),
        expect.anything(),
      );
    });

    it("falls back to mentorId from params when getMentorId returns null", () => {
      mockGetMentorId.mockReturnValue(null);

      render(<CopyMentorModal onClose={mockOnClose} />);

      expect(mockGetMentorSettingsQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          mentor: "test-mentor",
        }),
        expect.anything(),
      );
    });
  });

  describe("Edge Cases", () => {
    it("handles empty tenants list", () => {
      mockGetUserTenantsQuery.mockReturnValue({
        data: [],
        isLoading: false,
      });

      render(<CopyMentorModal onClose={mockOnClose} />);

      expect(screen.queryByText("Destination")).not.toBeInTheDocument();
    });

    it("handles null tenants data", () => {
      mockGetUserTenantsQuery.mockReturnValue({
        data: null,
        isLoading: false,
      });

      render(<CopyMentorModal onClose={mockOnClose} />);

      expect(screen.getByText("Copy Mentor")).toBeInTheDocument();
    });

    it("handles tenants loading state", () => {
      mockGetUserTenantsQuery.mockReturnValue({
        data: undefined,
        isLoading: true,
      });

      render(<CopyMentorModal onClose={mockOnClose} />);

      expect(screen.getByText("Copy Mentor")).toBeInTheDocument();
    });
  });
});
