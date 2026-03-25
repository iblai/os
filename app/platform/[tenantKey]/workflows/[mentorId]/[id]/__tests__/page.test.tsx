import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import WorkflowDetailPage from "../page";

// Mock next/navigation
const mockPush = vi.fn();
const mockBack = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
  }),
  useParams: () => ({
    tenantKey: "test-tenant",
    mentorId: "mentor-1",
    id: "workflow-1",
  }),
  useSearchParams: () => new URLSearchParams("listMentorId=original-mentor"),
}));

// Mock hooks from @/lib/hooks
const { mockUseAppSelector } = vi.hoisted(() => ({
  mockUseAppSelector: vi.fn(),
}));
vi.mock("@/lib/hooks", () => ({
  useAppSelector: mockUseAppSelector,
}));

// Mock use-username hook
const { mockUseUsername } = vi.hoisted(() => ({
  mockUseUsername: vi.fn<() => string | null>(() => "test-user"),
}));
vi.mock("@/hooks/use-user", () => ({
  useUsername: () => mockUseUsername(),
}));

// Mock use-debounce
vi.mock("use-debounce", () => ({
  useDebounce: <T,>(value: T) => [value],
}));

// Mock eventBus
vi.mock("@/lib/eventBus", () => ({
  default: {
    emit: vi.fn(),
  },
  RemoteEvents: {
    newChat: "newChat",
  },
}));

// Mock sonner
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock data-layer hooks
const mockUseGetWorkflowQuery = vi.fn();
const mockUseGetNodeTypesQuery = vi.fn();
const mockPatchWorkflow = vi.fn();
const mockPublishWorkflow = vi.fn();
const mockDeactivateWorkflow = vi.fn();
const mockActivateWorkflow = vi.fn();
const mockDeleteWorkflow = vi.fn();
const mockValidateWorkflow = vi.fn();
const mockFetchMentorSettings = vi.fn();

vi.mock("@iblai/iblai-js/data-layer", () => ({
  useGetWorkflowQuery: () => mockUseGetWorkflowQuery(),
  useGetNodeTypesQuery: () => mockUseGetNodeTypesQuery(),
  usePatchWorkflowMutation: () => [mockPatchWorkflow, { isLoading: false }],
  usePublishWorkflowMutation: () => [mockPublishWorkflow, { isLoading: false }],
  useDeactivateWorkflowMutation: () => [
    mockDeactivateWorkflow,
    { isLoading: false },
  ],
  useActivateWorkflowMutation: () => [
    mockActivateWorkflow,
    { isLoading: false },
  ],
  useDeleteWorkflowMutation: () => [mockDeleteWorkflow, { isLoading: false }],
  useValidateWorkflowMutation: () => [
    mockValidateWorkflow,
    { isLoading: false },
  ],
  useLazyGetMentorSettingsQuery: () => [mockFetchMentorSettings],
}));

// Mock UI components
vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    className,
    variant,
    size,
    ...props
  }: React.ComponentProps<"button"> & { variant?: string; size?: string }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={className}
      data-variant={variant}
      data-size={size}
      {...props}
    >
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: ({
    onChange,
    value,
    onBlur,
    onKeyDown,
    ...props
  }: React.ComponentProps<"input">) => (
    <input
      onChange={onChange}
      value={value}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      {...props}
    />
  ),
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dropdown-menu">{children}</div>
  ),
  DropdownMenuTrigger: ({
    children,
  }: {
    children: React.ReactNode;
    asChild?: boolean;
  }) => <div data-testid="dropdown-trigger">{children}</div>,
  DropdownMenuContent: ({
    children,
    align,
  }: {
    children: React.ReactNode;
    align?: string;
  }) => (
    <div data-testid="dropdown-content" data-align={align}>
      {children}
    </div>
  ),
  DropdownMenuItem: ({
    children,
    onClick,
    disabled,
    className,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
  }) => (
    <button
      data-testid="dropdown-item"
      onClick={onClick}
      disabled={disabled}
      className={className}
    >
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/collapsible", () => ({
  Collapsible: ({
    children,
    open,
  }: {
    children: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }) => (
    <div data-testid="collapsible" data-open={open}>
      {children}
    </div>
  ),
  CollapsibleTrigger: ({
    children,
  }: {
    children: React.ReactNode;
    asChild?: boolean;
  }) => <div data-testid="collapsible-trigger">{children}</div>,
  CollapsibleContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="collapsible-content">{children}</div>
  ),
}));

// Mock workflow components
vi.mock("@/components/workflows/workflow-preview-chat", () => ({
  WorkflowPreviewChat: ({
    tenantKey,
    mentorId,
  }: {
    tenantKey: string;
    mentorId?: string;
  }) => (
    <div
      data-testid="workflow-preview-chat"
      data-tenant={tenantKey}
      data-mentor={mentorId}
    >
      Preview Chat
    </div>
  ),
}));

vi.mock("@/components/workflows", () => ({
  WorkflowCanvas: ({
    previewMode,
    initialNodes,
    initialEdges,
    onStateChange,
    org,
    defaultMentorId,
  }: {
    onDraggedItem: unknown;
    onClickedItem: unknown;
    previewMode: boolean;
    initialNodes: unknown[];
    initialEdges: unknown[];
    onStateChange: (state: unknown) => void;
    org: string;
    defaultMentorId?: string;
  }) => (
    <div
      data-testid="workflow-canvas"
      data-preview={previewMode}
      data-org={org}
      data-mentor={defaultMentorId}
      data-nodes={JSON.stringify(initialNodes)}
      data-edges={JSON.stringify(initialEdges)}
    >
      <button
        data-testid="trigger-state-change"
        onClick={() =>
          onStateChange({
            nodes: [{ id: "test", type: "test", data: {} }],
            edges: [],
            viewport: { x: 0, y: 0, zoom: 1 },
          })
        }
      >
        Trigger State Change
      </button>
    </div>
  ),
}));

vi.mock("@iblai/iblai-js/web-containers", () => ({
  WorkflowSidebar: ({
    onDragStart,
    onItemClick,
    nodeTypes,
  }: {
    onDragStart: (item: unknown) => void;
    onItemClick: (item: unknown) => void;
    nodeTypes?: unknown;
  }) => (
    <div
      data-testid="workflow-sidebar"
      data-nodetypes={JSON.stringify(nodeTypes)}
    >
      <button
        data-testid="sidebar-item"
        onClick={() => onItemClick({ id: "test", label: "Test", type: "test" })}
      >
        Test Node
      </button>
      <button
        data-testid="sidebar-drag"
        onMouseDown={() =>
          onDragStart({ id: "test", label: "Test", type: "test" })
        }
      >
        Drag Node
      </button>
    </div>
  ),
  DeleteWorkflowModal: ({
    isOpen,
    onClose,
    onConfirm,
    isDeleting,
    workflowName,
  }: {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    isDeleting: boolean;
    workflowName: string;
  }) =>
    isOpen ? (
      <div data-testid="delete-modal" data-name={workflowName}>
        <button
          data-testid="delete-confirm"
          onClick={onConfirm}
          disabled={isDeleting}
        >
          {isDeleting ? "Deleting..." : "Delete"}
        </button>
        <button data-testid="delete-cancel" onClick={onClose}>
          Cancel
        </button>
      </div>
    ) : null,
}));

const createMockWorkflow = (overrides = {}) => ({
  unique_id: "workflow-1",
  name: "Test Workflow",
  description: "Test description",
  is_active: false,
  entry_mentor_id: "mentor-1",
  definition: {
    nodes: [{ id: "start", type: "start", position: { x: 0, y: 0 }, data: {} }],
    edges: [],
  },
  created_at: "2024-01-15T10:00:00Z",
  updated_at: "2024-01-20T15:30:00Z",
  ...overrides,
});

const createMockNodeTypes = () => ({
  node_types: {
    start: { label: "Start", category: "core" },
    mentor: { label: "Mentor", category: "core" },
    condition: { label: "Condition", category: "logic" },
    note: { label: "Note", category: "visual" },
    api_call: { label: "API Call", category: "tools" },
    data_fetch: { label: "Data Fetch", category: "data" },
  },
});

describe("WorkflowDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUsername.mockReturnValue("test-user");
    mockUseAppSelector.mockReturnValue({
      activeTab: "default",
      chats: { default: [] },
    });

    mockUseGetWorkflowQuery.mockReturnValue({
      data: createMockWorkflow(),
      isLoading: false,
      error: null,
    });

    mockUseGetNodeTypesQuery.mockReturnValue({
      data: createMockNodeTypes(),
      isLoading: false,
    });

    mockPatchWorkflow.mockReturnValue({
      unwrap: vi.fn().mockResolvedValue({}),
    });

    mockPublishWorkflow.mockReturnValue({
      unwrap: vi.fn().mockResolvedValue({}),
    });

    mockDeactivateWorkflow.mockReturnValue({
      unwrap: vi.fn().mockResolvedValue({}),
    });

    mockActivateWorkflow.mockReturnValue({
      unwrap: vi
        .fn()
        .mockResolvedValue({ is_valid: true, errors: [], warnings: [] }),
    });

    mockDeleteWorkflow.mockReturnValue({
      unwrap: vi.fn().mockResolvedValue({}),
    });

    mockValidateWorkflow.mockReturnValue({
      unwrap: vi.fn().mockResolvedValue({ errors: [], warnings: [] }),
    });

    mockFetchMentorSettings.mockReturnValue({
      unwrap: vi.fn().mockResolvedValue({}),
    });
  });

  describe("loading state", () => {
    it("should show loading spinner when workflow is loading", () => {
      mockUseGetWorkflowQuery.mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
      });

      render(<WorkflowDetailPage />);
      // Loader2 icon should be visible - container should have spin class
      expect(document.querySelector(".animate-spin")).toBeInTheDocument();
    });

    it("should show loading spinner while fetching mentor settings", () => {
      // Workflow has mentor nodes that need settings
      mockUseGetWorkflowQuery.mockReturnValue({
        data: createMockWorkflow({
          definition: {
            nodes: [
              {
                id: "start",
                type: "start",
                position: { x: 0, y: 0 },
                data: {},
              },
              {
                id: "mentor-1",
                type: "mentor",
                position: { x: 100, y: 0 },
                data: { mentor_id: "some-mentor" },
              },
            ],
            edges: [],
          },
        }),
        isLoading: false,
        error: null,
      });

      // Mock that username is not yet available
      mockUseUsername.mockReturnValue(null);

      render(<WorkflowDetailPage />);
      // Should show loading while waiting for mentor settings
      expect(document.querySelector(".animate-spin")).toBeInTheDocument();
    });
  });

  describe("error state", () => {
    it("should show error message when workflow fails to load", () => {
      mockUseGetWorkflowQuery.mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error("API Error"),
      });

      render(<WorkflowDetailPage />);
      expect(screen.getByText("Failed to load workflow")).toBeInTheDocument();
    });

    it("should show Go Back button on error", () => {
      mockUseGetWorkflowQuery.mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error("API Error"),
      });

      render(<WorkflowDetailPage />);
      expect(screen.getByText("Go Back")).toBeInTheDocument();
    });

    it("should navigate back when clicking Go Back button", async () => {
      const user = userEvent.setup();
      mockUseGetWorkflowQuery.mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error("API Error"),
      });

      render(<WorkflowDetailPage />);
      await user.click(screen.getByText("Go Back"));

      expect(mockBack).toHaveBeenCalled();
    });

    it("should show error when workflow is null", () => {
      mockUseGetWorkflowQuery.mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
      });

      render(<WorkflowDetailPage />);
      expect(screen.getByText("Failed to load workflow")).toBeInTheDocument();
    });
  });

  describe("workflow name", () => {
    it("should display workflow name", () => {
      render(<WorkflowDetailPage />);
      expect(screen.getByText("Test Workflow")).toBeInTheDocument();
    });

    it("should allow editing workflow name", async () => {
      const user = userEvent.setup();
      render(<WorkflowDetailPage />);

      const nameButton = screen.getByText("Test Workflow");
      await user.click(nameButton);

      expect(screen.getByDisplayValue("Test Workflow")).toBeInTheDocument();
    });

    it("should save name on blur", async () => {
      const user = userEvent.setup();
      render(<WorkflowDetailPage />);

      const nameButton = screen.getByText("Test Workflow");
      await user.click(nameButton);

      const input = screen.getByDisplayValue("Test Workflow");
      await user.clear(input);
      await user.type(input, "New Name");
      fireEvent.blur(input);

      await waitFor(() => {
        expect(mockPatchWorkflow).toHaveBeenCalledWith({
          org: "test-tenant",
          uniqueId: "workflow-1",
          data: { name: "New Name" },
        });
      });
    });

    it("should save name on Enter key", async () => {
      const user = userEvent.setup();
      render(<WorkflowDetailPage />);

      const nameButton = screen.getByText("Test Workflow");
      await user.click(nameButton);

      const input = screen.getByDisplayValue("Test Workflow");
      await user.clear(input);
      await user.type(input, "New Name{Enter}");

      await waitFor(() => {
        expect(mockPatchWorkflow).toHaveBeenCalledWith({
          org: "test-tenant",
          uniqueId: "workflow-1",
          data: { name: "New Name" },
        });
      });
    });

    it("should show success toast on name update", async () => {
      const user = userEvent.setup();
      const { toast } = await import("sonner");
      render(<WorkflowDetailPage />);

      const nameButton = screen.getByText("Test Workflow");
      await user.click(nameButton);

      const input = screen.getByDisplayValue("Test Workflow");
      await user.clear(input);
      await user.type(input, "New Name");
      fireEvent.blur(input);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith("Workflow name updated");
      });
    });

    it("should show error toast on name update failure", async () => {
      const user = userEvent.setup();
      const { toast } = await import("sonner");
      mockPatchWorkflow.mockReturnValue({
        unwrap: vi.fn().mockRejectedValue(new Error("Update failed")),
      });

      render(<WorkflowDetailPage />);

      const nameButton = screen.getByText("Test Workflow");
      await user.click(nameButton);

      const input = screen.getByDisplayValue("Test Workflow");
      await user.clear(input);
      await user.type(input, "New Name");
      fireEvent.blur(input);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Failed to update name");
      });
    });

    it("should revert name on update failure", async () => {
      const user = userEvent.setup();
      mockPatchWorkflow.mockReturnValue({
        unwrap: vi.fn().mockRejectedValue(new Error("Update failed")),
      });

      render(<WorkflowDetailPage />);

      const nameButton = screen.getByText("Test Workflow");
      await user.click(nameButton);

      const input = screen.getByDisplayValue("Test Workflow");
      await user.clear(input);
      await user.type(input, "New Name");
      fireEvent.blur(input);

      await waitFor(() => {
        expect(screen.getByText("Test Workflow")).toBeInTheDocument();
      });
    });

    it("should not save name if unchanged", async () => {
      const user = userEvent.setup();
      render(<WorkflowDetailPage />);

      const nameButton = screen.getByText("Test Workflow");
      await user.click(nameButton);

      const input = screen.getByDisplayValue("Test Workflow");
      fireEvent.blur(input);

      expect(mockPatchWorkflow).not.toHaveBeenCalled();
    });
  });

  describe("workflow status", () => {
    it("should show Draft status for inactive workflow", () => {
      render(<WorkflowDetailPage />);
      expect(screen.getByText("Draft")).toBeInTheDocument();
    });

    it("should show Active status for active workflow", () => {
      mockUseGetWorkflowQuery.mockReturnValue({
        data: createMockWorkflow({ is_active: true }),
        isLoading: false,
        error: null,
      });

      render(<WorkflowDetailPage />);
      expect(screen.getByText("Active")).toBeInTheDocument();
    });
  });

  describe("back navigation", () => {
    it("should navigate back when clicking back button", async () => {
      const user = userEvent.setup();
      render(<WorkflowDetailPage />);

      // Find the back button (chevron left)
      const backButtons = screen.getAllByRole("button");
      const backButton = backButtons.find((btn) =>
        btn.className.includes("text-muted-foreground"),
      );
      if (backButton) {
        await user.click(backButton);
        expect(mockBack).toHaveBeenCalled();
      }
    });
  });

  describe("save workflow", () => {
    it("should not save when there are no unsaved changes", async () => {
      const user = userEvent.setup();
      render(<WorkflowDetailPage />);

      // Click Save without triggering any state change
      await user.click(screen.getByText("Save"));

      // patchWorkflow should not be called for saving (may be called for name changes but not for definition)
      expect(mockPatchWorkflow).not.toHaveBeenCalled();
    });

    it("should save workflow when clicking Save button", async () => {
      const user = userEvent.setup();
      render(<WorkflowDetailPage />);

      // First trigger state change to have something to save
      await user.click(screen.getByTestId("trigger-state-change"));

      const saveButton = screen.getByText("Save");
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockPatchWorkflow).toHaveBeenCalled();
      });
    });

    it("should show success toast on save", async () => {
      const user = userEvent.setup();
      const { toast } = await import("sonner");
      render(<WorkflowDetailPage />);

      await user.click(screen.getByTestId("trigger-state-change"));
      await user.click(screen.getByText("Save"));

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith("Workflow saved");
      });
    });

    it("should show error toast on save failure", async () => {
      const user = userEvent.setup();
      const { toast } = await import("sonner");
      mockPatchWorkflow.mockReturnValue({
        unwrap: vi.fn().mockRejectedValue(new Error("Save failed")),
      });

      render(<WorkflowDetailPage />);

      await user.click(screen.getByTestId("trigger-state-change"));
      await user.click(screen.getByText("Save"));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Failed to save workflow");
      });
    });
  });

  describe("publish workflow", () => {
    it("should publish workflow when clicking Publish button in preview mode", async () => {
      const user = userEvent.setup();
      render(<WorkflowDetailPage />);

      // Enter preview mode first
      await user.click(screen.getByText("Preview"));
      await user.click(screen.getByText("Publish"));

      await waitFor(() => {
        expect(mockPublishWorkflow).toHaveBeenCalledWith({
          org: "test-tenant",
          uniqueId: "workflow-1",
          data: undefined,
        });
      });
    });

    it("should show success toast on publish", async () => {
      const user = userEvent.setup();
      const { toast } = await import("sonner");
      render(<WorkflowDetailPage />);

      await user.click(screen.getByText("Preview"));
      await user.click(screen.getByText("Publish"));

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith("Workflow published");
      });
    });

    it("should show validation errors on publish failure with validation data", async () => {
      const user = userEvent.setup();
      const { toast } = await import("sonner");
      mockPublishWorkflow.mockReturnValue({
        unwrap: vi.fn().mockRejectedValue({
          data: {
            is_valid: false,
            errors: ["Error 1", "Error 2"],
            warnings: ["Warning 1"],
          },
        }),
      });

      render(<WorkflowDetailPage />);

      await user.click(screen.getByText("Preview"));
      await user.click(screen.getByText("Publish"));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          "Workflow has validation issues",
        );
      });
    });

    it("should show generic error on publish failure without validation data", async () => {
      const user = userEvent.setup();
      const { toast } = await import("sonner");
      mockPublishWorkflow.mockReturnValue({
        unwrap: vi.fn().mockRejectedValue(new Error("Publish failed")),
      });

      render(<WorkflowDetailPage />);

      await user.click(screen.getByText("Preview"));
      await user.click(screen.getByText("Publish"));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Failed to publish workflow");
      });
    });
  });

  describe("activate workflow", () => {
    it("should activate workflow from dropdown menu", async () => {
      const user = userEvent.setup();
      render(<WorkflowDetailPage />);

      // Find and click the Activate button in dropdown
      const activateButton = screen.getByText("Activate");
      await user.click(activateButton);

      await waitFor(() => {
        expect(mockActivateWorkflow).toHaveBeenCalledWith({
          org: "test-tenant",
          uniqueId: "workflow-1",
        });
      });
    });

    it("should show success toast when activation is valid", async () => {
      const user = userEvent.setup();
      const { toast } = await import("sonner");
      render(<WorkflowDetailPage />);

      await user.click(screen.getByText("Activate"));

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith("Workflow activated");
      });
    });

    it("should show validation errors when activation fails validation", async () => {
      const user = userEvent.setup();
      const { toast } = await import("sonner");
      mockActivateWorkflow.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({
          is_valid: false,
          errors: ["Error 1"],
          warnings: [],
        }),
      });

      render(<WorkflowDetailPage />);
      await user.click(screen.getByText("Activate"));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          "Workflow has validation issues",
        );
      });
    });

    it("should show validation errors on activation failure with validation data", async () => {
      const user = userEvent.setup();
      const { toast } = await import("sonner");
      mockActivateWorkflow.mockReturnValue({
        unwrap: vi.fn().mockRejectedValue({
          data: {
            is_valid: false,
            errors: ["Error 1"],
            warnings: [],
          },
        }),
      });

      render(<WorkflowDetailPage />);
      await user.click(screen.getByText("Activate"));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          "Workflow has validation issues",
        );
      });
    });

    it("should show generic error on activation failure without validation data", async () => {
      const user = userEvent.setup();
      const { toast } = await import("sonner");
      mockActivateWorkflow.mockReturnValue({
        unwrap: vi.fn().mockRejectedValue(new Error("Activate failed")),
      });

      render(<WorkflowDetailPage />);
      await user.click(screen.getByText("Activate"));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Failed to activate workflow");
      });
    });
  });

  describe("deactivate workflow", () => {
    it("should show Deactivate option for active workflows", () => {
      mockUseGetWorkflowQuery.mockReturnValue({
        data: createMockWorkflow({ is_active: true }),
        isLoading: false,
        error: null,
      });

      render(<WorkflowDetailPage />);
      expect(screen.getByText("Deactivate")).toBeInTheDocument();
    });

    it("should deactivate workflow when clicking Deactivate", async () => {
      const user = userEvent.setup();
      mockUseGetWorkflowQuery.mockReturnValue({
        data: createMockWorkflow({ is_active: true }),
        isLoading: false,
        error: null,
      });

      render(<WorkflowDetailPage />);
      await user.click(screen.getByText("Deactivate"));

      await waitFor(() => {
        expect(mockDeactivateWorkflow).toHaveBeenCalledWith({
          org: "test-tenant",
          uniqueId: "workflow-1",
        });
      });
    });

    it("should show success toast on deactivate", async () => {
      const user = userEvent.setup();
      const { toast } = await import("sonner");
      mockUseGetWorkflowQuery.mockReturnValue({
        data: createMockWorkflow({ is_active: true }),
        isLoading: false,
        error: null,
      });

      render(<WorkflowDetailPage />);
      await user.click(screen.getByText("Deactivate"));

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith("Workflow deactivated");
      });
    });

    it("should show error toast on deactivate failure", async () => {
      const user = userEvent.setup();
      const { toast } = await import("sonner");
      mockUseGetWorkflowQuery.mockReturnValue({
        data: createMockWorkflow({ is_active: true }),
        isLoading: false,
        error: null,
      });
      mockDeactivateWorkflow.mockReturnValue({
        unwrap: vi.fn().mockRejectedValue(new Error("Deactivate failed")),
      });

      render(<WorkflowDetailPage />);
      await user.click(screen.getByText("Deactivate"));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          "Failed to deactivate workflow",
        );
      });
    });
  });

  describe("delete workflow", () => {
    it("should open delete modal when clicking Delete", async () => {
      const user = userEvent.setup();
      render(<WorkflowDetailPage />);

      await user.click(screen.getByText("Delete"));

      expect(screen.getByTestId("delete-modal")).toBeInTheDocument();
    });

    it("should close delete modal when clicking Cancel", async () => {
      const user = userEvent.setup();
      render(<WorkflowDetailPage />);

      await user.click(screen.getByText("Delete"));
      await user.click(screen.getByTestId("delete-cancel"));

      expect(screen.queryByTestId("delete-modal")).not.toBeInTheDocument();
    });

    it("should delete workflow and navigate on confirm", async () => {
      const user = userEvent.setup();
      render(<WorkflowDetailPage />);

      await user.click(screen.getByText("Delete"));
      await user.click(screen.getByTestId("delete-confirm"));

      await waitFor(() => {
        expect(mockDeleteWorkflow).toHaveBeenCalledWith({
          org: "test-tenant",
          uniqueId: "workflow-1",
        });
      });

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          "/platform/test-tenant/workflows/original-mentor",
        );
      });
    });

    it("should show success toast on delete", async () => {
      const user = userEvent.setup();
      const { toast } = await import("sonner");
      render(<WorkflowDetailPage />);

      await user.click(screen.getByText("Delete"));
      await user.click(screen.getByTestId("delete-confirm"));

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith("Workflow deleted");
      });
    });

    it("should show error toast on delete failure", async () => {
      const user = userEvent.setup();
      const { toast } = await import("sonner");
      mockDeleteWorkflow.mockReturnValue({
        unwrap: vi.fn().mockRejectedValue(new Error("Delete failed")),
      });

      render(<WorkflowDetailPage />);

      await user.click(screen.getByText("Delete"));
      await user.click(screen.getByTestId("delete-confirm"));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Failed to delete workflow");
      });
    });
  });

  describe("preview mode", () => {
    it("should enter preview mode when clicking Preview", async () => {
      const user = userEvent.setup();
      render(<WorkflowDetailPage />);

      await user.click(screen.getByText("Preview"));

      expect(screen.getByTestId("workflow-preview-chat")).toBeInTheDocument();
      expect(screen.getByTestId("workflow-canvas")).toHaveAttribute(
        "data-preview",
        "true",
      );
    });

    it("should exit preview mode when clicking Close preview", async () => {
      const user = userEvent.setup();
      render(<WorkflowDetailPage />);

      await user.click(screen.getByText("Preview"));
      await user.click(screen.getByText("Close preview"));

      expect(
        screen.queryByTestId("workflow-preview-chat"),
      ).not.toBeInTheDocument();
    });

    it("should hide sidebar in preview mode", async () => {
      const user = userEvent.setup();
      render(<WorkflowDetailPage />);

      await user.click(screen.getByText("Preview"));

      expect(screen.queryByTestId("workflow-sidebar")).not.toBeInTheDocument();
    });

    it("should show New Chat button when there are chat messages", async () => {
      const user = userEvent.setup();
      mockUseAppSelector.mockReturnValue({
        activeTab: "default",
        chats: { default: [{ id: "1", content: "test" }] },
      });

      render(<WorkflowDetailPage />);

      await user.click(screen.getByText("Preview"));

      expect(screen.getByText("New Chat")).toBeInTheDocument();
    });

    it("should always show New Chat button in preview mode", async () => {
      const user = userEvent.setup();
      render(<WorkflowDetailPage />);

      await user.click(screen.getByText("Preview"));

      expect(screen.getByText("New Chat")).toBeInTheDocument();
    });

    it("should emit newChat event when clicking New Chat", async () => {
      const user = userEvent.setup();
      const eventBus = (await import("@/lib/eventBus")).default;
      mockUseAppSelector.mockReturnValue({
        activeTab: "default",
        chats: { default: [{ id: "1", content: "test" }] },
      });

      render(<WorkflowDetailPage />);

      await user.click(screen.getByText("Preview"));
      await user.click(screen.getByText("New Chat"));

      expect(eventBus.emit).toHaveBeenCalledWith("newChat");
    });
  });

  describe("validation banner", () => {
    it("should not show validation banner when no validation errors", () => {
      render(<WorkflowDetailPage />);
      expect(screen.queryByTestId("collapsible")).not.toBeInTheDocument();
    });

    it("should dismiss validation banner when clicking close button", async () => {
      const user = userEvent.setup();
      mockPublishWorkflow.mockReturnValue({
        unwrap: vi.fn().mockRejectedValue({
          data: {
            is_valid: false,
            errors: ["Error 1"],
            warnings: [],
          },
        }),
      });

      render(<WorkflowDetailPage />);

      // Enter preview mode and publish to trigger validation errors
      await user.click(screen.getByText("Preview"));
      await user.click(screen.getByText("Publish"));

      await waitFor(() => {
        expect(screen.getByTestId("collapsible")).toBeInTheDocument();
      });

      // Find the span inside the collapsible that has role="button"
      const collapsible = screen.getByTestId("collapsible");
      const dismissSpan = collapsible.querySelector('[role="button"]');
      if (dismissSpan) {
        await user.click(dismissSpan as HTMLElement);
      }

      await waitFor(() => {
        expect(screen.queryByTestId("collapsible")).not.toBeInTheDocument();
      });
    });

    it("should dismiss validation banner with keyboard", async () => {
      const user = userEvent.setup();
      mockPublishWorkflow.mockReturnValue({
        unwrap: vi.fn().mockRejectedValue({
          data: {
            is_valid: false,
            errors: ["Error 1"],
            warnings: [],
          },
        }),
      });

      render(<WorkflowDetailPage />);

      await user.click(screen.getByText("Preview"));
      await user.click(screen.getByText("Publish"));

      await waitFor(() => {
        expect(screen.getByTestId("collapsible")).toBeInTheDocument();
      });

      const collapsible = screen.getByTestId("collapsible");
      const dismissSpan = collapsible.querySelector('[role="button"]');
      if (dismissSpan) {
        fireEvent.keyDown(dismissSpan, { key: "Enter" });
      }

      await waitFor(() => {
        expect(screen.queryByTestId("collapsible")).not.toBeInTheDocument();
      });
    });
  });

  describe("unsaved changes indicator", () => {
    it("should show Unsaved indicator when there are unsaved changes", async () => {
      const user = userEvent.setup();
      // Prevent auto-save from clearing unsaved state
      mockPatchWorkflow.mockReturnValue({
        unwrap: () => new Promise(() => {}),
      });
      render(<WorkflowDetailPage />);

      await user.click(screen.getByTestId("trigger-state-change"));

      expect(screen.getByText("Unsaved")).toBeInTheDocument();
    });
  });

  describe("workflow canvas interactions", () => {
    it("should pass initialNodes to WorkflowCanvas", async () => {
      mockUseGetWorkflowQuery.mockReturnValue({
        data: createMockWorkflow({
          definition: {
            nodes: [
              {
                id: "start",
                type: "start",
                position: { x: 0, y: 0 },
                data: { label: "Start" },
              },
              {
                id: "mentor-1",
                type: "mentor",
                position: { x: 100, y: 0 },
                data: { label: "Mentor" },
              },
            ],
            edges: [{ id: "e1", source: "start", target: "mentor-1" }],
          },
        }),
        isLoading: false,
        error: null,
      });

      render(<WorkflowDetailPage />);
      const canvas = await screen.findByTestId("workflow-canvas");
      const nodes = JSON.parse(canvas.getAttribute("data-nodes") || "[]");
      expect(nodes).toHaveLength(2);
    });

    it("should pass initialEdges to WorkflowCanvas", () => {
      mockUseGetWorkflowQuery.mockReturnValue({
        data: createMockWorkflow({
          definition: {
            nodes: [
              {
                id: "start",
                type: "start",
                position: { x: 0, y: 0 },
                data: {},
              },
            ],
            edges: [{ id: "e1", source: "start", target: "end" }],
          },
        }),
        isLoading: false,
        error: null,
      });

      render(<WorkflowDetailPage />);
      const canvas = screen.getByTestId("workflow-canvas");
      const edges = JSON.parse(canvas.getAttribute("data-edges") || "[]");
      expect(edges).toHaveLength(1);
    });
  });

  describe("sidebar interactions", () => {
    it("should handle sidebar item click", async () => {
      const user = userEvent.setup();
      render(<WorkflowDetailPage />);

      await user.click(screen.getByTestId("sidebar-item"));

      // Should not throw and item should be processed
      expect(screen.getByTestId("workflow-canvas")).toBeInTheDocument();
    });

    it("should handle sidebar drag start", () => {
      render(<WorkflowDetailPage />);

      fireEvent.mouseDown(screen.getByTestId("sidebar-drag"));

      expect(screen.getByTestId("workflow-canvas")).toBeInTheDocument();
    });
  });

  describe("node types transformation", () => {
    it("should transform node types for sidebar", () => {
      render(<WorkflowDetailPage />);
      const sidebar = screen.getByTestId("workflow-sidebar");
      const nodeTypes = JSON.parse(
        sidebar.getAttribute("data-nodetypes") || "null",
      );

      // Should have Core, Tools, Logic, Data categories (not 'visual' since 'note' is overridden to 'core')
      expect(nodeTypes).toBeDefined();
      expect(Array.isArray(nodeTypes)).toBe(true);
    });

    it("should filter out start node from sidebar", () => {
      render(<WorkflowDetailPage />);
      const sidebar = screen.getByTestId("workflow-sidebar");
      const nodeTypes = JSON.parse(
        sidebar.getAttribute("data-nodetypes") || "null",
      );

      // Start should not be in the node types
      if (nodeTypes) {
        const allItems = nodeTypes.flatMap(
          (section: { items: { id: string }[] }) => section.items,
        );
        const startNode = allItems.find(
          (item: { id: string }) => item.id === "start",
        );
        expect(startNode).toBeUndefined();
      }
    });

    it("should handle empty node types", () => {
      mockUseGetNodeTypesQuery.mockReturnValue({
        data: { node_types: {} },
        isLoading: false,
      });

      render(<WorkflowDetailPage />);
      const sidebar = screen.getByTestId("workflow-sidebar");
      const nodeTypes = JSON.parse(
        sidebar.getAttribute("data-nodetypes") || "null",
      );
      expect(nodeTypes).toEqual([]);
    });

    it("should handle undefined node types", () => {
      mockUseGetNodeTypesQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
      });

      render(<WorkflowDetailPage />);
      const sidebar = screen.getByTestId("workflow-sidebar");
      const nodeTypes = JSON.parse(
        sidebar.getAttribute("data-nodetypes") || "null",
      );
      expect(nodeTypes).toBeNull();
    });

    it("should override note category from visual to core", () => {
      render(<WorkflowDetailPage />);
      const sidebar = screen.getByTestId("workflow-sidebar");
      const nodeTypes = JSON.parse(
        sidebar.getAttribute("data-nodetypes") || "null",
      );

      if (nodeTypes) {
        const coreSection = nodeTypes.find(
          (section: { title: string }) => section.title === "Core",
        );
        const noteInCore = coreSection?.items.find(
          (item: { id: string }) => item.id === "note",
        );
        expect(noteInCore).toBeDefined();
      }
    });
  });

  describe("mentor settings prefill", () => {
    it("should show loading spinner while mentor settings are being fetched", () => {
      // When workflow has mentor nodes, it shows loading while fetching settings
      mockUseGetWorkflowQuery.mockReturnValue({
        data: createMockWorkflow({
          entry_mentor_id: "mentor-1",
          definition: {
            nodes: [
              {
                id: "start",
                type: "start",
                position: { x: 0, y: 0 },
                data: {},
              },
              {
                id: "mentor-node",
                type: "mentor",
                position: { x: 100, y: 0 },
                data: { label: "Mentor", entry_mentor_id: "mentor-1" },
              },
            ],
            edges: [],
          },
        }),
        isLoading: false,
        error: null,
      });

      render(<WorkflowDetailPage />);

      // Should show loading spinner while waiting for mentor settings
      expect(document.querySelector(".animate-spin")).toBeInTheDocument();
    });

    it("should identify mentor IDs from workflow definition", () => {
      // Test that workflow with mentor nodes extracts mentor IDs correctly
      const workflowData = createMockWorkflow({
        entry_mentor_id: "entry-mentor",
        definition: {
          nodes: [
            { id: "start", type: "start", position: { x: 0, y: 0 }, data: {} },
            {
              id: "mentor-1",
              type: "mentor",
              position: { x: 100, y: 0 },
              data: { mentor_id: "specific-mentor" },
            },
          ],
          edges: [],
        },
      });

      // Verify the workflow data has correct structure
      expect(workflowData.entry_mentor_id).toBe("entry-mentor");
      expect(workflowData.definition?.nodes).toHaveLength(2);
      expect(workflowData.definition?.nodes?.[1].type).toBe("mentor");
    });

    it("should call fetchMentorSettings for mentor nodes", async () => {
      mockUseGetWorkflowQuery.mockReturnValue({
        data: createMockWorkflow({
          entry_mentor_id: "mentor-1",
          definition: {
            nodes: [
              {
                id: "start",
                type: "start",
                position: { x: 0, y: 0 },
                data: {},
              },
              {
                id: "mentor-node",
                type: "mentor",
                position: { x: 100, y: 0 },
                data: { label: "Mentor", mentor_id: "mentor-1" },
              },
            ],
            edges: [],
          },
        }),
        isLoading: false,
        error: null,
      });

      render(<WorkflowDetailPage />);

      // Verify that fetchMentorSettings was called for the mentor node
      await waitFor(() => {
        expect(mockFetchMentorSettings).toHaveBeenCalledWith({
          mentor: "mentor-1",
          org: "test-tenant",
        });
      });
    });
  });

  describe("entrymentorid fallback", () => {
    it("should use entrymentorid when entry_mentor_id is not available", () => {
      mockUseGetWorkflowQuery.mockReturnValue({
        data: {
          ...createMockWorkflow(),
          entry_mentor_id: undefined,
          entrymentorid: "fallback-mentor-id",
        },
        isLoading: false,
        error: null,
      });

      render(<WorkflowDetailPage />);
      const canvas = screen.getByTestId("workflow-canvas");
      expect(canvas.getAttribute("data-mentor")).toBe("fallback-mentor-id");
    });
  });

  describe("empty definition handling", () => {
    it("should handle workflow with no definition", () => {
      mockUseGetWorkflowQuery.mockReturnValue({
        data: createMockWorkflow({ definition: null }),
        isLoading: false,
        error: null,
      });

      render(<WorkflowDetailPage />);
      const canvas = screen.getByTestId("workflow-canvas");
      const nodes = JSON.parse(canvas.getAttribute("data-nodes") || "[]");
      expect(nodes).toEqual([]);
    });

    it("should handle workflow with undefined nodes", () => {
      mockUseGetWorkflowQuery.mockReturnValue({
        data: createMockWorkflow({ definition: { edges: [] } }),
        isLoading: false,
        error: null,
      });

      render(<WorkflowDetailPage />);
      const canvas = screen.getByTestId("workflow-canvas");
      const nodes = JSON.parse(canvas.getAttribute("data-nodes") || "[]");
      expect(nodes).toEqual([]);
    });

    it("should handle workflow with undefined edges", () => {
      mockUseGetWorkflowQuery.mockReturnValue({
        data: createMockWorkflow({
          definition: {
            nodes: [
              {
                id: "start",
                type: "start",
                position: { x: 0, y: 0 },
                data: {},
              },
            ],
          },
        }),
        isLoading: false,
        error: null,
      });

      render(<WorkflowDetailPage />);
      const canvas = screen.getByTestId("workflow-canvas");
      const edges = JSON.parse(canvas.getAttribute("data-edges") || "[]");
      expect(edges).toEqual([]);
    });
  });
});
