import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

import { LearnersMemories } from "../learners-memories";

// ---- Mocks ----
const mockGetMentorMemoriesQuery = vi.fn();
const mockGetMemoryCategoriesAdminQuery = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ tenantKey: "test-tenant", mentorId: "mentor-1" }),
}));

vi.mock("@/hooks/use-user", () => ({
  useUsername: () => "testuser",
}));

vi.mock("@/hooks/user-navigate", () => ({
  useNavigate: () => ({
    getMentorId: () => "mentor-1",
  }),
}));

vi.mock("@iblai/iblai-js/data-layer", () => ({
  useGetMentorMemoriesQuery: (...args: any[]) =>
    mockGetMentorMemoriesQuery(...args),
  useGetMemoryCategoriesAdminQuery: (...args: any[]) =>
    mockGetMemoryCategoriesAdminQuery(...args),
}));

// Mock UI components
vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children, open, onOpenChange }: any) => (
    <div data-testid="popover" data-open={open}>
      {typeof onOpenChange === "function" && (
        <button
          data-testid="popover-toggle"
          onClick={() => onOpenChange(!open)}
          style={{ display: "none" }}
        />
      )}
      {children}
    </div>
  ),
  PopoverTrigger: ({ children }: any) => (
    <div data-testid="popover-trigger">{children}</div>
  ),
  PopoverContent: ({ children }: any) => (
    <div data-testid="popover-content">{children}</div>
  ),
}));

vi.mock("@/components/ui/command", () => ({
  Command: ({ children }: any) => <div data-testid="command">{children}</div>,
  CommandInput: ({ placeholder }: any) => (
    <input data-testid="command-input" placeholder={placeholder} />
  ),
  CommandList: ({ children }: any) => (
    <div data-testid="command-list">{children}</div>
  ),
  CommandEmpty: ({ children }: any) => (
    <div data-testid="command-empty">{children}</div>
  ),
  CommandGroup: ({ children }: any) => (
    <div data-testid="command-group">{children}</div>
  ),
  CommandItem: ({ children, onSelect, value }: any) => (
    <div data-testid="command-item" data-value={value} onClick={onSelect}>
      {children}
    </div>
  ),
}));

vi.mock("@/components/ui/calendar", () => ({
  Calendar: ({ onSelect, mode }: any) => (
    <div data-testid="calendar" data-mode={mode}>
      <button
        data-testid="calendar-select"
        onClick={() =>
          onSelect({
            from: new Date("2024-01-01"),
            to: new Date("2024-01-31"),
          })
        }
      >
        Select Date
      </button>
    </div>
  ),
}));

vi.mock("@/components/spinner", () => ({
  Spinner: () => <div data-testid="spinner">Loading...</div>,
}));

vi.mock("@/lib/utils", () => ({
  cn: (...classes: any[]) => classes.filter(Boolean).join(" "),
}));

// ---- Test Data ----
const mockMemoriesByCategoryResponse = [
  {
    category: { id: 1, name: "Personal Info", slug: "personal-info" },
    memories: [
      {
        id: 1,
        content: "User prefers dark mode",
        category: { id: 1, name: "Personal Info", slug: "personal-info" },
        username: "learner1",
        created_at: "2024-06-15T10:00:00Z",
      },
    ],
  },
  {
    category: { id: 2, name: "Preferences", slug: "preferences" },
    memories: [
      {
        id: 2,
        content: "Likes visual explanations",
        category: { id: 2, name: "Preferences", slug: "preferences" },
        username: "learner2",
        created_at: "2024-06-14T10:00:00Z",
      },
      {
        id: 3,
        content: "Fast pace preferred",
        category: { id: 2, name: "Preferences", slug: "preferences" },
        username: "learner1",
        created_at: "2024-06-13T10:00:00Z",
      },
    ],
  },
];

const mockAdminCategories = [
  { id: 1, name: "Personal Info", slug: "personal-info" },
  { id: 2, name: "Preferences", slug: "preferences" },
];

describe("LearnersMemories", () => {
  beforeEach(() => {
    cleanup();
    mockGetMentorMemoriesQuery.mockReset();
    mockGetMemoryCategoriesAdminQuery.mockReset();

    // Default: return full response for both filtered and unfiltered calls
    mockGetMentorMemoriesQuery.mockReturnValue({
      data: mockMemoriesByCategoryResponse,
      isLoading: false,
    });

    mockGetMemoryCategoriesAdminQuery.mockReturnValue({
      data: mockAdminCategories,
    });
  });

  afterEach(() => {
    cleanup();
  });

  describe("Rendering", () => {
    it("renders the header with title and info icon", () => {
      render(<LearnersMemories />);
      expect(screen.getByText("Learner Memories")).toBeInTheDocument();
    });

    it("renders the learner selector", () => {
      render(<LearnersMemories />);
      expect(screen.getByText("Select Learner")).toBeInTheDocument();
    });

    it("renders the date range picker", () => {
      render(<LearnersMemories />);
      expect(screen.getByText("Pick a Date Range")).toBeInTheDocument();
    });

    it("renders category filter with categories from admin endpoint", () => {
      render(<LearnersMemories />);
      expect(
        screen.getAllByText("Personal Info").length,
      ).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Preferences").length).toBeGreaterThanOrEqual(
        1,
      );
    });
  });

  describe("Loading State", () => {
    it("shows spinner when memories are loading", () => {
      mockGetMentorMemoriesQuery.mockReturnValue({
        data: undefined,
        isLoading: true,
      });

      render(<LearnersMemories />);
      expect(screen.getByTestId("spinner")).toBeInTheDocument();
    });
  });

  describe("Empty State", () => {
    it('shows "No Memories" when response is empty', () => {
      mockGetMentorMemoriesQuery.mockReturnValue({
        data: [],
        isLoading: false,
      });

      render(<LearnersMemories />);
      expect(screen.getByText("No Memories")).toBeInTheDocument();
    });

    it('shows "No Memories" when data is undefined', () => {
      mockGetMentorMemoriesQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
      });

      render(<LearnersMemories />);
      expect(screen.getByText("No Memories")).toBeInTheDocument();
    });
  });

  describe("Memory List", () => {
    it("renders memory cards for each memory", () => {
      render(<LearnersMemories />);
      expect(screen.getByText("User prefers dark mode")).toBeInTheDocument();
      expect(screen.getByText("Likes visual explanations")).toBeInTheDocument();
      expect(screen.getByText("Fast pace preferred")).toBeInTheDocument();
    });

    it("displays category badges for each memory", () => {
      render(<LearnersMemories />);
      expect(
        screen.getAllByText("Personal Info").length,
      ).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Preferences").length).toBeGreaterThanOrEqual(
        1,
      );
    });

    it("displays learner usernames on cards", () => {
      render(<LearnersMemories />);
      const learner1Elements = screen.getAllByText("learner1");
      expect(learner1Elements.length).toBeGreaterThanOrEqual(1);
      const learner2Elements = screen.getAllByText("learner2");
      expect(learner2Elements.length).toBeGreaterThanOrEqual(1);
    });

    it("displays relative time for each memory", () => {
      render(<LearnersMemories />);
      const timeElements = screen.getAllByText(/ago/);
      expect(timeElements.length).toBeGreaterThanOrEqual(2);
    });

    it('shows "Unknown" for memories without username', () => {
      mockGetMentorMemoriesQuery.mockReturnValue({
        data: [
          {
            category: { id: 1, name: "General", slug: "general" },
            memories: [
              {
                id: 10,
                content: "No user memory",
                category: { id: 1, name: "General", slug: "general" },
                created_at: "2024-06-15T10:00:00Z",
              },
            ],
          },
        ],
        isLoading: false,
      });

      render(<LearnersMemories />);
      expect(screen.getByText("Unknown")).toBeInTheDocument();
    });
  });

  describe("Memory Selection", () => {
    it("shows detail view placeholder when no memory is selected", () => {
      render(<LearnersMemories />);
      expect(
        screen.getByText("Select a memory to view details."),
      ).toBeInTheDocument();
    });

    it("shows memory details when a memory card is clicked", () => {
      render(<LearnersMemories />);

      const cards = document.querySelectorAll('[class*="cursor-pointer"]');
      expect(cards.length).toBe(3);
      fireEvent.click(cards[0]);

      expect(screen.getByText("Memory Content")).toBeInTheDocument();
    });

    it("highlights selected memory card", () => {
      render(<LearnersMemories />);

      const cards = document.querySelectorAll('[class*="cursor-pointer"]');
      fireEvent.click(cards[0]);

      expect(cards[0].className).toContain("bg-gray-100");
    });

    it("shows formatted date in detail panel", () => {
      render(<LearnersMemories />);

      const cards = document.querySelectorAll('[class*="cursor-pointer"]');
      fireEvent.click(cards[0]);

      expect(screen.getByText(/Jun 15, 2024/)).toBeInTheDocument();
    });

    it("shows category badge in detail panel", () => {
      render(<LearnersMemories />);

      const cards = document.querySelectorAll('[class*="cursor-pointer"]');
      fireEvent.click(cards[0]);

      const categoryBadges = screen.getAllByText("Personal Info");
      expect(categoryBadges.length).toBeGreaterThanOrEqual(2); // card + detail
    });

    it("switches selected memory when clicking a different card", () => {
      render(<LearnersMemories />);

      const cards = document.querySelectorAll('[class*="cursor-pointer"]');
      fireEvent.click(cards[0]);
      expect(screen.getByText("Memory Content")).toBeInTheDocument();

      fireEvent.click(cards[1]);
      // Detail panel should still show Memory Content heading
      expect(screen.getByText("Memory Content")).toBeInTheDocument();
      // Second card is now highlighted
      expect(cards[1].className).toContain("bg-gray-100");
    });
  });

  describe("Learner Selection", () => {
    it('renders "All Learners" option in dropdown', () => {
      render(<LearnersMemories />);
      expect(screen.getByText("All Learners")).toBeInTheDocument();
    });

    it("renders learner names in dropdown", () => {
      render(<LearnersMemories />);
      const items = screen.getAllByTestId("command-item");
      // "All Learners" + 2 learners + category items = variable, check for learner items
      expect(items.length).toBeGreaterThanOrEqual(3);
    });

    it("selects a learner when clicked", () => {
      render(<LearnersMemories />);

      // Find the learner command items (not category ones)
      const learnerItems = screen.getAllByTestId("command-item");
      // Click the second item (first learner after "All Learners")
      fireEvent.click(learnerItems[1]);

      const learner1Elements = screen.getAllByText("learner1");
      expect(learner1Elements.length).toBeGreaterThanOrEqual(1);
    });

    it('clears selection when "All Learners" is clicked', () => {
      render(<LearnersMemories />);

      const learnerItems = screen.getAllByTestId("command-item");
      fireEvent.click(learnerItems[1]);

      const allItems = screen.getAllByTestId("command-item");
      fireEvent.click(allItems[0]);

      expect(screen.getByText("Select Learner")).toBeInTheDocument();
    });
  });

  describe("Date Range Selection", () => {
    it("updates date display when calendar selection is made", () => {
      render(<LearnersMemories />);

      const selectDateBtn = screen.getAllByTestId("calendar-select")[0];
      fireEvent.click(selectDateBtn);

      expect(
        screen.getAllByText(/Jan 01 - Jan 31/).length,
      ).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Query Parameters", () => {
    it("passes org, userId, and mentorId to mentor memories query", () => {
      render(<LearnersMemories />);
      expect(mockGetMentorMemoriesQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          org: "test-tenant",
          userId: "testuser",
          mentorId: "mentor-1",
        }),
        expect.objectContaining({ skip: false }),
      );
    });

    it("passes org and mentorId to categories admin query", () => {
      render(<LearnersMemories />);
      expect(mockGetMemoryCategoriesAdminQuery).toHaveBeenCalledWith(
        { org: "test-tenant", mentorId: "mentor-1" },
        expect.objectContaining({ skip: false }),
      );
    });

    it("calls useGetMentorMemoriesQuery with correct args", () => {
      render(<LearnersMemories />);
      expect(mockGetMentorMemoriesQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          org: "test-tenant",
          userId: "testuser",
          mentorId: "mentor-1",
        }),
        expect.objectContaining({ skip: false }),
      );
    });
  });

  describe("Edge Cases", () => {
    it("handles undefined adminCategories by deriving from response", () => {
      mockGetMemoryCategoriesAdminQuery.mockReturnValue({
        data: undefined,
      });

      render(<LearnersMemories />);
      // Categories should still appear from the response
      expect(
        screen.getAllByText("Personal Info").length,
      ).toBeGreaterThanOrEqual(1);
    });

    it("handles empty adminCategories by deriving from response", () => {
      mockGetMemoryCategoriesAdminQuery.mockReturnValue({
        data: [],
      });

      render(<LearnersMemories />);
      expect(
        screen.getAllByText("Personal Info").length,
      ).toBeGreaterThanOrEqual(1);
    });

    it("handles memory without created_at", () => {
      mockGetMentorMemoriesQuery.mockReturnValue({
        data: [
          {
            category: { id: 1, name: "General", slug: "general" },
            memories: [
              {
                id: 20,
                content: "No timestamp memory",
                category: { id: 1, name: "General", slug: "general" },
                username: "user1",
              },
            ],
          },
        ],
        isLoading: false,
      });

      render(<LearnersMemories />);
      expect(screen.getByText("No timestamp memory")).toBeInTheDocument();
    });

    it('shows "All" in category filter by default', () => {
      render(<LearnersMemories />);
      expect(screen.getAllByText("All").length).toBeGreaterThanOrEqual(1);
    });

    it("handles no unfiltered response for learner list", () => {
      // First call (filtered) returns data, second call (unfiltered) returns undefined
      let callCount = 0;
      mockGetMentorMemoriesQuery.mockImplementation(() => {
        callCount++;
        if (callCount <= 1) {
          return { data: mockMemoriesByCategoryResponse, isLoading: false };
        }
        return { data: undefined, isLoading: false };
      });

      render(<LearnersMemories />);
      // Should still render without crashing
      expect(screen.getByText("Learner Memories")).toBeInTheDocument();
    });
  });
});
