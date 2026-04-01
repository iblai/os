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

import { SavedMemoriesModal } from "../saved-memories-modal";

// ---- Mocks ----
const mockGetMentorMemoriesQuery = vi.fn();
const mockGetMemoryCategoriesAdminQuery = vi.fn();
const mockDeleteMentorMemory = vi.fn();
const mockUpdateMentorMemory = vi.fn();
const mockCreateMentorMemory = vi.fn();

const mockDeleteUnwrap = vi.fn();
const mockUpdateUnwrap = vi.fn();
const mockCreateUnwrap = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ tenantKey: "test-tenant", mentorId: "mentor-1" }),
}));

vi.mock("@iblai/iblai-js/data-layer", () => ({
  useGetMentorMemoriesQuery: (...args: any[]) =>
    mockGetMentorMemoriesQuery(...args),
  useGetMemoryCategoriesAdminQuery: (...args: any[]) =>
    mockGetMemoryCategoriesAdminQuery(...args),
  useDeleteMentorMemoryMutation: () => [
    (...args: unknown[]) => {
      mockDeleteMentorMemory(...args);
      return { unwrap: mockDeleteUnwrap };
    },
    { isLoading: false },
  ],
  useUpdateMentorMemoryMutation: () => [
    (...args: unknown[]) => {
      mockUpdateMentorMemory(...args);
      return { unwrap: mockUpdateUnwrap };
    },
    { isLoading: false },
  ],
  useCreateMentorMemoryMutation: () => [
    (...args: unknown[]) => {
      mockCreateMentorMemory(...args);
      return { unwrap: mockCreateUnwrap };
    },
    { isLoading: false },
  ],
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock next/dynamic to render modals synchronously
vi.mock("next/dynamic", () => ({
  default: () => {
    return (props: any) => {
      if (!props.open) return null;

      if ("editContent" in props) {
        return (
          <div data-testid="edit-memory-modal">
            <textarea
              data-testid="edit-content-input"
              value={props.editContent}
              onChange={(e: any) => props.onContentChange(e.target.value)}
            />
            {props.categories && (
              <select
                data-testid="edit-category-select"
                value={props.editCategory}
                onChange={(e: any) => props.onCategoryChange(e.target.value)}
              >
                {props.categories.map((cat: string) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            )}
            <button data-testid="edit-save-btn" onClick={props.onSave}>
              Save
            </button>
            <button data-testid="edit-cancel-btn" onClick={props.onCancel}>
              Cancel
            </button>
            <button
              data-testid="edit-close-btn"
              onClick={() => props.onOpenChange(false)}
            >
              Close Edit
            </button>
          </div>
        );
      }
      if ("newMemoryContent" in props) {
        return (
          <div data-testid="add-memory-modal">
            <textarea
              data-testid="add-content-input"
              value={props.newMemoryContent}
              onChange={(e: any) => props.onContentChange(e.target.value)}
            />
            {props.categories && (
              <select
                data-testid="add-category-select"
                value={props.newMemoryCategory}
                onChange={(e: any) => props.onCategoryChange(e.target.value)}
              >
                {props.categories.map((cat: string) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            )}
            <button data-testid="add-save-btn" onClick={props.onSave}>
              Save New
            </button>
            <button data-testid="add-cancel-btn" onClick={props.onCancel}>
              Cancel Add
            </button>
            <button
              data-testid="add-close-btn"
              onClick={() => props.onOpenChange(false)}
            >
              Close Add
            </button>
          </div>
        );
      }
      if ("selectedCategory" in props) {
        return (
          <div data-testid="bulk-delete-modal">
            <span>Delete all {props.selectedCategory} memories?</span>
            <button data-testid="bulk-delete-confirm" onClick={props.onConfirm}>
              Confirm Bulk Delete
            </button>
            <button data-testid="bulk-delete-cancel" onClick={props.onCancel}>
              Cancel Bulk Delete
            </button>
            <button
              data-testid="bulk-close-btn"
              onClick={() => props.onOpenChange(false)}
            >
              Close Bulk
            </button>
          </div>
        );
      }
      if ("isDeleting" in props) {
        return (
          <div data-testid="delete-memory-modal">
            <button data-testid="delete-confirm-btn" onClick={props.onConfirm}>
              Confirm Delete
            </button>
            <button data-testid="delete-cancel-btn" onClick={props.onCancel}>
              Cancel Delete
            </button>
            <button
              data-testid="delete-close-btn"
              onClick={() => props.onOpenChange(false)}
            >
              Close Delete
            </button>
          </div>
        );
      }
      return null;
    };
  },
}));

// Mock UI components
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: any) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: any) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogHeader: ({ children }: any) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children, open, onOpenChange }: any) => (
    <div data-testid="dropdown-menu">
      {typeof onOpenChange === "function" && (
        <button
          data-testid="dropdown-toggle"
          onClick={() => onOpenChange(!open)}
          style={{ display: "none" }}
        />
      )}
      {children}
    </div>
  ),
  DropdownMenuContent: ({ children }: any) => (
    <div data-testid="dropdown-content">{children}</div>
  ),
  DropdownMenuItem: ({ children, onClick }: any) => (
    <div data-testid="dropdown-item" onClick={onClick}>
      {children}
    </div>
  ),
  DropdownMenuTrigger: ({ children }: any) => (
    <div data-testid="dropdown-trigger">{children}</div>
  ),
}));

vi.mock("@/lib/types", () => ({
  TenantKeyMentorIdParams: {},
}));

// ---- Test Data ----
const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  tenantKey: "test-tenant",
  username: "testuser",
};

const mockMemoriesByCategoryResponse = [
  {
    category: { id: 1, name: "Personal Info", slug: "personal-info" },
    memories: [
      {
        id: 1,
        content: "User preference value",
        category: { id: 1, name: "Personal Info", slug: "personal-info" },
        username: "user1",
        created_at: "2024-06-15T10:00:00Z",
      },
    ],
  },
  {
    category: { id: 2, name: "Learning Style", slug: "learning-style" },
    memories: [
      {
        id: 2,
        content: "Visual learner preference",
        category: { id: 2, name: "Learning Style", slug: "learning-style" },
        username: "user2",
        created_at: "2024-06-14T10:00:00Z",
      },
      {
        id: 3,
        content: "Fast pace preferred",
        category: { id: 2, name: "Learning Style", slug: "learning-style" },
        username: "user1",
        created_at: "2024-06-13T10:00:00Z",
      },
    ],
  },
];

const mockAdminCategories = [
  { id: 1, name: "Personal Info", slug: "personal-info" },
  { id: 2, name: "Learning Style", slug: "learning-style" },
];

describe("SavedMemoriesModal", () => {
  beforeEach(() => {
    cleanup();
    mockGetMentorMemoriesQuery.mockReset();
    mockGetMemoryCategoriesAdminQuery.mockReset();
    mockDeleteMentorMemory.mockReset();
    mockUpdateMentorMemory.mockReset();
    mockCreateMentorMemory.mockReset();
    mockDeleteUnwrap.mockReset();
    mockUpdateUnwrap.mockReset();
    mockCreateUnwrap.mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
    defaultProps.onOpenChange.mockReset();

    mockGetMentorMemoriesQuery.mockReturnValue({
      data: mockMemoriesByCategoryResponse,
      isLoading: false,
    });

    mockGetMemoryCategoriesAdminQuery.mockReturnValue({
      data: mockAdminCategories,
    });

    mockDeleteUnwrap.mockResolvedValue({});
    mockUpdateUnwrap.mockResolvedValue({});
    mockCreateUnwrap.mockResolvedValue({});
  });

  afterEach(() => {
    cleanup();
  });

  describe("Rendering", () => {
    it("renders the dialog with title", () => {
      render(<SavedMemoriesModal {...defaultProps} />);
      expect(screen.getByText("Saved Memories")).toBeInTheDocument();
    });

    it("does not render when open is false", () => {
      render(<SavedMemoriesModal {...defaultProps} open={false} />);
      expect(screen.queryByTestId("dialog")).not.toBeInTheDocument();
    });

    it("renders category tabs", () => {
      render(<SavedMemoriesModal {...defaultProps} />);
      expect(screen.getAllByText("All").length).toBeGreaterThanOrEqual(1);
      expect(
        screen.getAllByText("Personal Info").length,
      ).toBeGreaterThanOrEqual(1);
      expect(
        screen.getAllByText("Learning Style").length,
      ).toBeGreaterThanOrEqual(1);
    });

    it("renders the Add Memory button", () => {
      render(<SavedMemoriesModal {...defaultProps} />);
      expect(screen.getByText("Add Memory")).toBeInTheDocument();
    });

    it("renders memory cards with content", () => {
      render(<SavedMemoriesModal {...defaultProps} />);
      expect(screen.getByText("User preference value")).toBeInTheDocument();
      expect(screen.getByText("Visual learner preference")).toBeInTheDocument();
      expect(screen.getByText("Fast pace preferred")).toBeInTheDocument();
    });

    it("renders mobile category dropdown", () => {
      render(<SavedMemoriesModal {...defaultProps} />);
      const dropdownMenus = screen.getAllByTestId("dropdown-menu");
      expect(dropdownMenus.length).toBeGreaterThanOrEqual(1);
    });

    it("renders mobile Add button text", () => {
      render(<SavedMemoriesModal {...defaultProps} />);
      expect(screen.getByText("Add")).toBeInTheDocument();
    });
  });

  describe("Loading State", () => {
    it("shows loading message when memories are loading", () => {
      mockGetMentorMemoriesQuery.mockReturnValue({
        data: undefined,
        isLoading: true,
      });

      render(<SavedMemoriesModal {...defaultProps} />);
      expect(screen.getByText("Loading memories...")).toBeInTheDocument();
    });
  });

  describe("Empty State", () => {
    it('shows "No saved memories yet." when no memories exist', () => {
      mockGetMentorMemoriesQuery.mockReturnValue({
        data: [],
        isLoading: false,
      });

      render(<SavedMemoriesModal {...defaultProps} />);
      expect(screen.getByText("No saved memories yet.")).toBeInTheDocument();
    });

    it("shows empty state when data is undefined", () => {
      mockGetMentorMemoriesQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
      });

      render(<SavedMemoriesModal {...defaultProps} />);
      expect(screen.getByText("No saved memories yet.")).toBeInTheDocument();
    });
  });

  describe("Category Filtering", () => {
    it('defaults to "All" category showing all memories', () => {
      render(<SavedMemoriesModal {...defaultProps} />);
      expect(screen.getByText("User preference value")).toBeInTheDocument();
      expect(screen.getByText("Visual learner preference")).toBeInTheDocument();
    });

    it("filters memories by category when a category tab is clicked", () => {
      render(<SavedMemoriesModal {...defaultProps} />);

      const categoryButtons = screen.getAllByText("Personal Info");
      const tabButton = categoryButtons.find((el) => el.tagName === "BUTTON");
      if (tabButton) fireEvent.click(tabButton);

      expect(screen.getByText("User preference value")).toBeInTheDocument();
      expect(
        screen.queryByText("Visual learner preference"),
      ).not.toBeInTheDocument();
    });

    it('shows "Delete All" button when a non-All category is selected with memories', () => {
      render(<SavedMemoriesModal {...defaultProps} />);

      const categoryButtons = screen.getAllByText("Personal Info");
      const tabButton = categoryButtons.find((el) => el.tagName === "BUTTON");
      if (tabButton) fireEvent.click(tabButton);

      expect(screen.getByText("Delete All")).toBeInTheDocument();
    });

    it('does not show "Delete All" button when All category is selected', () => {
      render(<SavedMemoriesModal {...defaultProps} />);
      expect(screen.queryByText("Delete All")).not.toBeInTheDocument();
    });

    it("selects category via mobile dropdown", () => {
      render(<SavedMemoriesModal {...defaultProps} />);

      const dropdownItems = screen.getAllByTestId("dropdown-item");
      // Find the Personal Info dropdown item
      const personalInfoItem = dropdownItems.find(
        (item) => item.textContent === "Personal Info",
      );
      if (personalInfoItem) fireEvent.click(personalInfoItem);

      expect(screen.getByText("User preference value")).toBeInTheDocument();
    });
  });

  describe("Delete Memory", () => {
    it("shows delete confirmation modal when delete is clicked", () => {
      render(<SavedMemoriesModal {...defaultProps} />);

      const deleteItems = screen.getAllByText("Delete");
      fireEvent.click(deleteItems[0]);

      expect(screen.getByTestId("delete-memory-modal")).toBeInTheDocument();
    });

    it("calls deleteMentorMemory when confirmed", async () => {
      render(<SavedMemoriesModal {...defaultProps} />);

      const deleteItems = screen.getAllByText("Delete");
      fireEvent.click(deleteItems[0]);

      const confirmBtn = screen.getByTestId("delete-confirm-btn");
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(mockDeleteMentorMemory).toHaveBeenCalledWith({
          org: "test-tenant",
          userId: "testuser",
          mentorId: "mentor-1",
          memoryId: 1,
        });
      });
    });

    it("shows success toast on successful delete", async () => {
      render(<SavedMemoriesModal {...defaultProps} />);

      const deleteItems = screen.getAllByText("Delete");
      fireEvent.click(deleteItems[0]);

      const confirmBtn = screen.getByTestId("delete-confirm-btn");
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          "Memory deleted successfully",
        );
      });
    });

    it("shows error toast on failed delete", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      mockDeleteUnwrap.mockRejectedValue(new Error("Delete failed"));

      render(<SavedMemoriesModal {...defaultProps} />);

      const deleteItems = screen.getAllByText("Delete");
      fireEvent.click(deleteItems[0]);

      const confirmBtn = screen.getByTestId("delete-confirm-btn");
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Failed to delete memory");
      });
      consoleSpy.mockRestore();
    });

    it("closes delete modal when cancel is clicked", () => {
      render(<SavedMemoriesModal {...defaultProps} />);

      const deleteItems = screen.getAllByText("Delete");
      fireEvent.click(deleteItems[0]);

      expect(screen.getByTestId("delete-memory-modal")).toBeInTheDocument();

      const cancelBtn = screen.getByTestId("delete-cancel-btn");
      fireEvent.click(cancelBtn);

      expect(
        screen.queryByTestId("delete-memory-modal"),
      ).not.toBeInTheDocument();
    });

    it("closes delete modal via onOpenChange(false)", () => {
      render(<SavedMemoriesModal {...defaultProps} />);

      const deleteItems = screen.getAllByText("Delete");
      fireEvent.click(deleteItems[0]);

      expect(screen.getByTestId("delete-memory-modal")).toBeInTheDocument();

      const closeBtn = screen.getByTestId("delete-close-btn");
      fireEvent.click(closeBtn);

      expect(
        screen.queryByTestId("delete-memory-modal"),
      ).not.toBeInTheDocument();
    });

    it("does not call deleteMentorMemory when tenantKey is missing", async () => {
      render(
        <SavedMemoriesModal
          open={true}
          onOpenChange={vi.fn()}
          tenantKey=""
          username="testuser"
        />,
      );

      const deleteItems = screen.getAllByText("Delete");
      fireEvent.click(deleteItems[0]);

      const confirmBtn = screen.getByTestId("delete-confirm-btn");
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(mockDeleteMentorMemory).not.toHaveBeenCalled();
      });
    });

    it("does not call deleteMentorMemory when username is null", async () => {
      render(
        <SavedMemoriesModal
          open={true}
          onOpenChange={vi.fn()}
          tenantKey="test-tenant"
          username={null}
        />,
      );

      const deleteItems = screen.getAllByText("Delete");
      fireEvent.click(deleteItems[0]);

      const confirmBtn = screen.getByTestId("delete-confirm-btn");
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(mockDeleteMentorMemory).not.toHaveBeenCalled();
      });
    });
  });

  describe("Bulk Delete", () => {
    it("shows bulk delete modal when Delete All is clicked", () => {
      render(<SavedMemoriesModal {...defaultProps} />);

      const categoryButtons = screen.getAllByText("Personal Info");
      const tabButton = categoryButtons.find((el) => el.tagName === "BUTTON");
      if (tabButton) fireEvent.click(tabButton);

      const deleteAllBtn = screen.getByText("Delete All");
      fireEvent.click(deleteAllBtn);

      expect(screen.getByTestId("bulk-delete-modal")).toBeInTheDocument();
    });

    it("calls deleteMentorMemory for each memory on confirm", async () => {
      render(<SavedMemoriesModal {...defaultProps} />);

      const categoryButtons = screen.getAllByText("Personal Info");
      const tabButton = categoryButtons.find((el) => el.tagName === "BUTTON");
      if (tabButton) fireEvent.click(tabButton);

      const deleteAllBtn = screen.getByText("Delete All");
      fireEvent.click(deleteAllBtn);

      const confirmBtn = screen.getByTestId("bulk-delete-confirm");
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(mockDeleteMentorMemory).toHaveBeenCalledWith({
          org: "test-tenant",
          userId: "testuser",
          mentorId: "mentor-1",
          memoryId: 1,
        });
      });
    });

    it("shows success toast on successful bulk delete", async () => {
      render(<SavedMemoriesModal {...defaultProps} />);

      const categoryButtons = screen.getAllByText("Personal Info");
      const tabButton = categoryButtons.find((el) => el.tagName === "BUTTON");
      if (tabButton) fireEvent.click(tabButton);

      const deleteAllBtn = screen.getByText("Delete All");
      fireEvent.click(deleteAllBtn);

      const confirmBtn = screen.getByTestId("bulk-delete-confirm");
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          "All Personal Info memories deleted successfully",
        );
      });
    });

    it("shows error toast on failed bulk delete", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      mockDeleteUnwrap.mockRejectedValue(new Error("Bulk delete failed"));

      render(<SavedMemoriesModal {...defaultProps} />);

      const categoryButtons = screen.getAllByText("Personal Info");
      const tabButton = categoryButtons.find((el) => el.tagName === "BUTTON");
      if (tabButton) fireEvent.click(tabButton);

      const deleteAllBtn = screen.getByText("Delete All");
      fireEvent.click(deleteAllBtn);

      const confirmBtn = screen.getByTestId("bulk-delete-confirm");
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Failed to delete memories");
      });
      consoleSpy.mockRestore();
    });

    it("does not call bulk delete when tenantKey is missing", async () => {
      render(
        <SavedMemoriesModal
          open={true}
          onOpenChange={vi.fn()}
          tenantKey=""
          username="testuser"
        />,
      );

      const categoryButtons = screen.getAllByText("Personal Info");
      const tabButton = categoryButtons.find((el) => el.tagName === "BUTTON");
      if (tabButton) fireEvent.click(tabButton);

      const deleteAllBtn = screen.getByText("Delete All");
      fireEvent.click(deleteAllBtn);

      const confirmBtn = screen.getByTestId("bulk-delete-confirm");
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(mockDeleteMentorMemory).not.toHaveBeenCalled();
      });
    });

    it("closes bulk delete modal via onOpenChange(false)", () => {
      render(<SavedMemoriesModal {...defaultProps} />);

      const categoryButtons = screen.getAllByText("Personal Info");
      const tabButton = categoryButtons.find((el) => el.tagName === "BUTTON");
      if (tabButton) fireEvent.click(tabButton);

      const deleteAllBtn = screen.getByText("Delete All");
      fireEvent.click(deleteAllBtn);

      expect(screen.getByTestId("bulk-delete-modal")).toBeInTheDocument();

      const closeBtn = screen.getByTestId("bulk-close-btn");
      fireEvent.click(closeBtn);

      expect(screen.queryByTestId("bulk-delete-modal")).not.toBeInTheDocument();
    });

    it("closes bulk delete modal via cancel button", () => {
      render(<SavedMemoriesModal {...defaultProps} />);

      const categoryButtons = screen.getAllByText("Personal Info");
      const tabButton = categoryButtons.find((el) => el.tagName === "BUTTON");
      if (tabButton) fireEvent.click(tabButton);

      const deleteAllBtn = screen.getByText("Delete All");
      fireEvent.click(deleteAllBtn);

      expect(screen.getByTestId("bulk-delete-modal")).toBeInTheDocument();

      const cancelBtn = screen.getByTestId("bulk-delete-cancel");
      fireEvent.click(cancelBtn);

      expect(screen.queryByTestId("bulk-delete-modal")).not.toBeInTheDocument();
    });
  });

  describe("Edit Memory", () => {
    it("opens edit modal when Edit is clicked", () => {
      render(<SavedMemoriesModal {...defaultProps} />);

      const editItems = screen.getAllByText("Edit");
      fireEvent.click(editItems[0]);

      expect(screen.getByTestId("edit-memory-modal")).toBeInTheDocument();
    });

    it("pre-fills edit modal with memory content", () => {
      render(<SavedMemoriesModal {...defaultProps} />);

      const editItems = screen.getAllByText("Edit");
      fireEvent.click(editItems[0]);

      const textarea = screen.getByTestId(
        "edit-content-input",
      ) as HTMLTextAreaElement;
      expect(textarea.value).toBe("User preference value");
    });

    it("calls updateMentorMemory when save is clicked", async () => {
      render(<SavedMemoriesModal {...defaultProps} />);

      const editItems = screen.getAllByText("Edit");
      fireEvent.click(editItems[0]);

      const saveBtn = screen.getByTestId("edit-save-btn");
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(mockUpdateMentorMemory).toHaveBeenCalledWith({
          org: "test-tenant",
          userId: "testuser",
          mentorId: "mentor-1",
          memoryId: 1,
          data: {
            content: "User preference value",
          },
        });
      });
    });

    it("shows success toast on successful edit", async () => {
      render(<SavedMemoriesModal {...defaultProps} />);

      const editItems = screen.getAllByText("Edit");
      fireEvent.click(editItems[0]);

      const saveBtn = screen.getByTestId("edit-save-btn");
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          "Memory updated successfully",
        );
      });
    });

    it("shows error toast on failed edit", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      mockUpdateUnwrap.mockRejectedValue(new Error("Update failed"));

      render(<SavedMemoriesModal {...defaultProps} />);

      const editItems = screen.getAllByText("Edit");
      fireEvent.click(editItems[0]);

      const saveBtn = screen.getByTestId("edit-save-btn");
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Failed to update memory");
      });
      consoleSpy.mockRestore();
    });

    it("closes edit modal when cancel is clicked", () => {
      render(<SavedMemoriesModal {...defaultProps} />);

      const editItems = screen.getAllByText("Edit");
      fireEvent.click(editItems[0]);
      expect(screen.getByTestId("edit-memory-modal")).toBeInTheDocument();

      const cancelBtn = screen.getByTestId("edit-cancel-btn");
      fireEvent.click(cancelBtn);

      expect(screen.queryByTestId("edit-memory-modal")).not.toBeInTheDocument();
    });

    it("closes edit modal via onOpenChange(false)", () => {
      render(<SavedMemoriesModal {...defaultProps} />);

      const editItems = screen.getAllByText("Edit");
      fireEvent.click(editItems[0]);
      expect(screen.getByTestId("edit-memory-modal")).toBeInTheDocument();

      const closeBtn = screen.getByTestId("edit-close-btn");
      fireEvent.click(closeBtn);
      expect(screen.queryByTestId("edit-memory-modal")).not.toBeInTheDocument();
    });

    it("updates edit content via textarea change", async () => {
      render(<SavedMemoriesModal {...defaultProps} />);

      const editItems = screen.getAllByText("Edit");
      fireEvent.click(editItems[0]);

      const textarea = screen.getByTestId("edit-content-input");
      fireEvent.change(textarea, { target: { value: "Updated content" } });

      const saveBtn = screen.getByTestId("edit-save-btn");
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(mockUpdateMentorMemory).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              content: "Updated content",
            }),
          }),
        );
      });
    });

    it("sends category_slug when category is changed", async () => {
      render(<SavedMemoriesModal {...defaultProps} />);

      const editItems = screen.getAllByText("Edit");
      fireEvent.click(editItems[0]);

      // Change category
      const categorySelect = screen.getByTestId("edit-category-select");
      fireEvent.change(categorySelect, { target: { value: "Learning Style" } });

      const saveBtn = screen.getByTestId("edit-save-btn");
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(mockUpdateMentorMemory).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              category_slug: "learning-style",
            }),
          }),
        );
      });
    });

    it("does not call updateMentorMemory when username is null", async () => {
      render(
        <SavedMemoriesModal
          open={true}
          onOpenChange={vi.fn()}
          tenantKey="test-tenant"
          username={null}
        />,
      );

      const editItems = screen.getAllByText("Edit");
      fireEvent.click(editItems[0]);

      const saveBtn = screen.getByTestId("edit-save-btn");
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(mockUpdateMentorMemory).not.toHaveBeenCalled();
      });
    });
  });

  describe("Add Memory", () => {
    it("opens add modal when Add Memory button is clicked", () => {
      render(<SavedMemoriesModal {...defaultProps} />);

      const addBtn = screen.getByText("Add Memory");
      fireEvent.click(addBtn);

      expect(screen.getByTestId("add-memory-modal")).toBeInTheDocument();
    });

    it("calls createMentorMemory when save is clicked with content", async () => {
      render(<SavedMemoriesModal {...defaultProps} />);

      const addBtn = screen.getByText("Add Memory");
      fireEvent.click(addBtn);

      const textarea = screen.getByTestId("add-content-input");
      fireEvent.change(textarea, { target: { value: "New memory content" } });

      const saveBtn = screen.getByTestId("add-save-btn");
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(mockCreateMentorMemory).toHaveBeenCalledWith({
          org: "test-tenant",
          userId: "testuser",
          mentorId: "mentor-1",
          data: {
            category_slug: "general",
            content: "New memory content",
          },
        });
      });
    });

    it("uses selected category slug when adding memory in a filtered view", async () => {
      render(<SavedMemoriesModal {...defaultProps} />);

      // Select Personal Info category first
      const categoryButtons = screen.getAllByText("Personal Info");
      const tabButton = categoryButtons.find((el) => el.tagName === "BUTTON");
      if (tabButton) fireEvent.click(tabButton);

      const addBtn = screen.getByText("Add Memory");
      fireEvent.click(addBtn);

      const textarea = screen.getByTestId("add-content-input");
      fireEvent.change(textarea, { target: { value: "Category memory" } });

      // Change category to match an existing one via select
      const categorySelect = screen.getByTestId("add-category-select");
      fireEvent.change(categorySelect, { target: { value: "Learning Style" } });

      const saveBtn = screen.getByTestId("add-save-btn");
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(mockCreateMentorMemory).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              category_slug: "learning-style",
            }),
          }),
        );
      });
    });

    it("shows success toast on successful create", async () => {
      render(<SavedMemoriesModal {...defaultProps} />);

      const addBtn = screen.getByText("Add Memory");
      fireEvent.click(addBtn);

      const textarea = screen.getByTestId("add-content-input");
      fireEvent.change(textarea, { target: { value: "New memory content" } });

      const saveBtn = screen.getByTestId("add-save-btn");
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          "Memory created successfully",
        );
      });
    });

    it("shows error toast on failed create", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      mockCreateUnwrap.mockRejectedValue(new Error("Create failed"));

      render(<SavedMemoriesModal {...defaultProps} />);

      const addBtn = screen.getByText("Add Memory");
      fireEvent.click(addBtn);

      const textarea = screen.getByTestId("add-content-input");
      fireEvent.change(textarea, { target: { value: "Some content" } });

      const saveBtn = screen.getByTestId("add-save-btn");
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Failed to create memory");
      });
      consoleSpy.mockRestore();
    });

    it("does not create memory when content is empty", async () => {
      render(<SavedMemoriesModal {...defaultProps} />);

      const addBtn = screen.getByText("Add Memory");
      fireEvent.click(addBtn);

      const saveBtn = screen.getByTestId("add-save-btn");
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(mockCreateMentorMemory).not.toHaveBeenCalled();
      });
    });

    it("does not create memory when content is whitespace only", async () => {
      render(<SavedMemoriesModal {...defaultProps} />);

      const addBtn = screen.getByText("Add Memory");
      fireEvent.click(addBtn);

      const textarea = screen.getByTestId("add-content-input");
      fireEvent.change(textarea, { target: { value: "   " } });

      const saveBtn = screen.getByTestId("add-save-btn");
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(mockCreateMentorMemory).not.toHaveBeenCalled();
      });
    });

    it("closes add modal when cancel is clicked", () => {
      render(<SavedMemoriesModal {...defaultProps} />);

      const addBtn = screen.getByText("Add Memory");
      fireEvent.click(addBtn);
      expect(screen.getByTestId("add-memory-modal")).toBeInTheDocument();

      const cancelBtn = screen.getByTestId("add-cancel-btn");
      fireEvent.click(cancelBtn);

      expect(screen.queryByTestId("add-memory-modal")).not.toBeInTheDocument();
    });

    it("closes add modal via onOpenChange(false)", () => {
      render(<SavedMemoriesModal {...defaultProps} />);

      const addBtn = screen.getByText("Add Memory");
      fireEvent.click(addBtn);
      expect(screen.getByTestId("add-memory-modal")).toBeInTheDocument();

      const closeBtn = screen.getByTestId("add-close-btn");
      fireEvent.click(closeBtn);

      expect(screen.queryByTestId("add-memory-modal")).not.toBeInTheDocument();
    });

    it("does not create memory when tenantKey is missing", async () => {
      render(
        <SavedMemoriesModal
          open={true}
          onOpenChange={vi.fn()}
          tenantKey=""
          username="testuser"
        />,
      );

      const addBtn = screen.getByText("Add Memory");
      fireEvent.click(addBtn);

      const textarea = screen.getByTestId("add-content-input");
      fireEvent.change(textarea, { target: { value: "Some content" } });

      const saveBtn = screen.getByTestId("add-save-btn");
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(mockCreateMentorMemory).not.toHaveBeenCalled();
      });
    });
  });

  describe("Query Parameters", () => {
    it("passes org, userId, and mentorId to mentor memories query", () => {
      render(<SavedMemoriesModal {...defaultProps} />);
      expect(mockGetMentorMemoriesQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          org: "test-tenant",
          userId: "testuser",
          mentorId: "mentor-1",
        }),
        expect.any(Object),
      );
    });

    it("skips query when dialog is closed", () => {
      render(<SavedMemoriesModal {...defaultProps} open={false} />);
      expect(mockGetMentorMemoriesQuery).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ skip: true }),
      );
    });

    it("skips query when tenantKey is missing", () => {
      render(
        <SavedMemoriesModal
          open={true}
          onOpenChange={vi.fn()}
          tenantKey=""
          username="testuser"
        />,
      );
      expect(mockGetMentorMemoriesQuery).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ skip: true }),
      );
    });

    it("skips query when username is null", () => {
      render(
        <SavedMemoriesModal
          open={true}
          onOpenChange={vi.fn()}
          tenantKey="test-tenant"
          username={null}
        />,
      );
      expect(mockGetMentorMemoriesQuery).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ skip: true }),
      );
    });
  });

  describe("Edge Cases", () => {
    it("handles undefined adminCategories", () => {
      mockGetMemoryCategoriesAdminQuery.mockReturnValue({
        data: undefined,
      });

      render(<SavedMemoriesModal {...defaultProps} />);
      expect(screen.getAllByText("All").length).toBeGreaterThanOrEqual(1);
    });

    it("handles empty adminCategories array", () => {
      mockGetMemoryCategoriesAdminQuery.mockReturnValue({
        data: [],
      });

      render(<SavedMemoriesModal {...defaultProps} />);
      expect(screen.getAllByText("All").length).toBeGreaterThanOrEqual(1);
    });

    it("derives categories from response when admin categories are empty", () => {
      mockGetMemoryCategoriesAdminQuery.mockReturnValue({
        data: [],
      });

      render(<SavedMemoriesModal {...defaultProps} />);
      expect(
        screen.getAllByText("Personal Info").length,
      ).toBeGreaterThanOrEqual(1);
    });

    it("shows only All when no data and no admin categories", () => {
      mockGetMemoryCategoriesAdminQuery.mockReturnValue({
        data: undefined,
      });
      mockGetMentorMemoriesQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
      });

      render(<SavedMemoriesModal {...defaultProps} />);
      expect(screen.getAllByText("All").length).toBeGreaterThanOrEqual(1);
    });
  });
});
