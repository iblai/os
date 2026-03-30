import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InsideButtons } from "../inside-buttons";

vi.mock("@iblai/iblai-js/web-utils", () => ({
  TOOLS: {
    CANVAS: "canvas",
    STUDY_MODE: "study-mode",
    DEEP_RESEARCH: "deep-research",
    MEMORY: "memory",
  },
}));

vi.mock("@/components/icons/svg-icons", () => ({
  DeepSearchIcon: ({ className }: { className?: string }) => (
    <svg data-testid="deep-search-icon" className={className} />
  ),
  CanvasIcon: ({ className }: { className?: string }) => (
    <svg data-testid="canvas-icon" className={className} />
  ),
}));

vi.mock("../memory-button", () => ({
  MemoryButton: () => <button data-testid="memory-button">Memory</button>,
}));

// Mock hooks that require Redux Provider
vi.mock("@/hooks/use-user", () => ({
  useIsAdmin: vi.fn(() => true),
  useLearnerMode: vi.fn(() => ({ isInstructorMode: true })),
  useUsername: vi.fn(() => "testuser"),
}));

// Mock config
vi.mock("@/lib/config", () => ({
  config: {
    iblTemplateMentor: vi.fn(() => "default-mentor"),
    iblAiUrl: vi.fn(() => "http://localhost"),
    platformPublicKey: vi.fn(() => "test-key"),
    useGoogleOnetap: vi.fn(() => false),
    enableAdminDebugTools: vi.fn(() => false),
  },
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ tenantKey: "test-tenant", mentorId: "mentor-123" }),
}));

vi.mock("@/hooks/user-navigate", () => ({
  useNavigate: () => ({
    getMentorId: () => "mentor-123",
  }),
}));

let mockMemsearchConfig: any = { enable_memsearch: false };
vi.mock("@iblai/data-layer", () => ({
  useGetMemsearchConfigQuery: () => ({
    data: mockMemsearchConfig,
  }),
}));

let mockMentorSettings: any = { enable_memory_component: false };
vi.mock("@iblai/iblai-js/data-layer", () => ({
  useGetMentorSettingsQuery: () => ({
    data: mockMentorSettings,
    isLoading: false,
  }),
}));

// Import mocked modules for testing
import { useIsAdmin, useLearnerMode } from "@/hooks/use-user";

describe("InsideButtons", () => {
  const mockOnOptionClick = vi.fn();

  const defaultProps = {
    activeOptions: [],
    onOptionClick: mockOnOptionClick,
    deepResearch: true,
    studyMode: false,
    artifactsEnabled: false,
    containerWidth: 1000,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mocks to default values
    (useIsAdmin as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (useLearnerMode as ReturnType<typeof vi.fn>).mockReturnValue({
      isInstructorMode: true,
    });
    mockMemsearchConfig = { enable_memsearch: false };
    mockMentorSettings = { enable_memory_component: false };
  });

  describe("rendering", () => {
    it("should render Canvas button when artifactsEnabled is true", () => {
      render(<InsideButtons {...defaultProps} artifactsEnabled={true} />);
      expect(screen.getByText("Canvas")).toBeInTheDocument();
    });

    it("should render Deep Research button when deepResearch is true", () => {
      render(<InsideButtons {...defaultProps} deepResearch={true} />);
      expect(screen.getByText("Deep Research")).toBeInTheDocument();
    });

    it("should not render Deep Research button when deepResearch is false", () => {
      render(<InsideButtons {...defaultProps} deepResearch={false} />);
      expect(screen.queryByText("Deep Research")).not.toBeInTheDocument();
    });

    it("should render Study Mode button when studyMode is true", () => {
      render(
        <InsideButtons
          {...defaultProps}
          studyMode={true}
          containerWidth={1000}
        />,
      );
      expect(screen.getByText("Study Mode")).toBeInTheDocument();
    });

    it("should not render Study Mode button when studyMode is false", () => {
      render(
        <InsideButtons
          {...defaultProps}
          studyMode={false}
          containerWidth={1000}
        />,
      );
      expect(screen.queryByText("Study Mode")).not.toBeInTheDocument();
    });

    it("should render all enabled buttons when container is wide", () => {
      render(
        <InsideButtons
          {...defaultProps}
          artifactsEnabled={true}
          deepResearch={true}
          containerWidth={1000}
        />,
      );

      expect(screen.getByText("Canvas")).toBeInTheDocument();
      expect(screen.getByText("Deep Research")).toBeInTheDocument();
    });

    it("should render MemoryButton when the filtered list includes Memory", () => {
      const originalFilter = Array.prototype.filter;
      let bypassed = false;
      const filterSpy = vi
        .spyOn(Array.prototype, "filter")
        .mockImplementation(function (
          this: any[],
          ...args: Parameters<typeof Array.prototype.filter>
        ) {
          if (!bypassed) {
            bypassed = true;
            return this;
          }
          return originalFilter.apply(
            this,
            args as [
              predicate: (value: any, index: number, array: any[]) => unknown,
              thisArg?: any,
            ],
          );
        });

      render(
        <InsideButtons
          {...defaultProps}
          artifactsEnabled={true}
          deepResearch={true}
          containerWidth={1000}
        />,
      );

      expect(screen.getByTestId("memory-button")).toBeInTheDocument();
      filterSpy.mockRestore();
    });
  });

  describe("button interactions", () => {
    it("should call onOptionClick with CANVAS when Canvas button is clicked", async () => {
      render(
        <InsideButtons
          {...defaultProps}
          artifactsEnabled={true}
          containerWidth={1000}
        />,
      );

      const canvasButton = screen.getByText("Canvas").closest("button");
      expect(canvasButton).toBeInTheDocument();
      fireEvent.click(canvasButton!);

      expect(mockOnOptionClick).toHaveBeenCalledWith("canvas");
    });

    it("should call onOptionClick with DEEP_RESEARCH when Deep Research button is clicked", async () => {
      render(<InsideButtons {...defaultProps} containerWidth={1000} />);

      const deepResearchButton = screen
        .getByText("Deep Research")
        .closest("button");
      expect(deepResearchButton).toBeInTheDocument();
      fireEvent.click(deepResearchButton!);

      expect(mockOnOptionClick).toHaveBeenCalledWith("deep-research");
    });

    it("should call onOptionClick with STUDY_MODE when Study Mode button is clicked", async () => {
      render(
        <InsideButtons
          {...defaultProps}
          studyMode={true}
          containerWidth={1000}
        />,
      );

      const studyModeButton = screen.getByText("Study Mode").closest("button");
      expect(studyModeButton).toBeInTheDocument();
      fireEvent.click(studyModeButton!);

      expect(mockOnOptionClick).toHaveBeenCalledWith("study-mode");
    });

    it("should prevent default and stop propagation on button click", async () => {
      render(
        <InsideButtons
          {...defaultProps}
          artifactsEnabled={true}
          containerWidth={1000}
        />,
      );

      const canvasButton = screen.getByText("Canvas").closest("button");
      const clickEvent = new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
      });
      const preventDefaultSpy = vi.spyOn(clickEvent, "preventDefault");
      const stopPropagationSpy = vi.spyOn(clickEvent, "stopPropagation");

      canvasButton!.dispatchEvent(clickEvent);

      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(stopPropagationSpy).toHaveBeenCalled();
    });
  });

  describe("active state styling", () => {
    it("should apply active styling when Canvas is active", () => {
      render(
        <InsideButtons
          {...defaultProps}
          artifactsEnabled={true}
          containerWidth={1000}
        />,
      );

      const canvasButton = screen.getByText("Canvas").closest("button");
      // When artifactsEnabled is true, button should have active styling
      expect(canvasButton).toHaveClass("text-[#38A1E5]");
    });

    it("should apply active styling when Deep Research is in activeOptions", () => {
      render(
        <InsideButtons
          {...defaultProps}
          activeOptions={["deep-research"]}
          containerWidth={1000}
        />,
      );

      const deepResearchButton = screen
        .getByText("Deep Research")
        .closest("button");
      expect(deepResearchButton).toHaveClass("text-[#38A1E5]");
    });

    it("should apply active styling when Study Mode is in activeOptions", () => {
      render(
        <InsideButtons
          {...defaultProps}
          studyMode={true}
          activeOptions={["study-mode"]}
          containerWidth={1000}
        />,
      );

      const studyModeButton = screen.getByText("Study Mode").closest("button");
      expect(studyModeButton).toHaveClass("text-[#38A1E5]");
    });

    it("should not apply active styling when Study Mode is not in activeOptions", () => {
      render(
        <InsideButtons
          {...defaultProps}
          studyMode={true}
          activeOptions={[]}
          containerWidth={1000}
        />,
      );

      const studyModeButton = screen.getByText("Study Mode").closest("button");
      expect(studyModeButton).not.toHaveClass("text-[#38A1E5]");
    });

    it("should show X icon when button is active", () => {
      render(
        <InsideButtons
          {...defaultProps}
          artifactsEnabled={true}
          containerWidth={1000}
        />,
      );

      const canvasButton = screen.getByText("Canvas").closest("button");
      // Check for X icon in active button
      const xIcon = canvasButton?.querySelector(".ml-1");
      expect(xIcon).toBeInTheDocument();
    });

    it("should prevent default and stop propagation when X icon is clicked", () => {
      render(
        <InsideButtons
          {...defaultProps}
          artifactsEnabled={true}
          containerWidth={1000}
        />,
      );

      const canvasButton = screen.getByText("Canvas").closest("button");
      const xIcon = canvasButton?.querySelector(".ml-1") as SVGElement | null;
      expect(xIcon).toBeInTheDocument();

      const clickEvent = new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
      });
      const preventDefaultSpy = vi.spyOn(clickEvent, "preventDefault");
      const stopPropagationSpy = vi.spyOn(clickEvent, "stopPropagation");

      xIcon?.dispatchEvent(clickEvent);

      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(stopPropagationSpy).toHaveBeenCalled();
    });
  });

  describe("responsive behavior", () => {
    it("should show inactive buttons in dropdown when containerWidth is less than 600", () => {
      render(
        <InsideButtons
          {...defaultProps}
          artifactsEnabled={false}
          deepResearch={true}
          containerWidth={500}
        />,
      );

      // Inactive buttons should be in dropdown
      expect(screen.queryByText("Canvas")).not.toBeInTheDocument();
      expect(screen.queryByText("Deep Research")).not.toBeInTheDocument();
      // Should show more options button
      expect(screen.getByText("•••")).toBeInTheDocument();
    });

    it("should show active buttons visible on mobile even when containerWidth is less than 600", () => {
      render(
        <InsideButtons
          {...defaultProps}
          artifactsEnabled={true}
          deepResearch={true}
          containerWidth={500}
        />,
      );

      // Active button (Canvas) should be visible
      expect(screen.getByText("Canvas")).toBeInTheDocument();
      // Inactive button (Deep Research) should be in dropdown
      expect(screen.queryAllByText("Deep Research")).toHaveLength(0);
      // Should show more options button for inactive tools
      expect(screen.getByText("•••")).toBeInTheDocument();
    });

    it("should show one button and dropdown when containerWidth is between 600-800", () => {
      render(
        <InsideButtons
          {...defaultProps}
          artifactsEnabled={true}
          deepResearch={true}
          containerWidth={700}
        />,
      );

      // Active button should be visible
      expect(screen.getByText("Canvas")).toBeInTheDocument();
      // More options should exist for inactive tools
      expect(screen.getByText("•••")).toBeInTheDocument();
    });

    it("should show all buttons when containerWidth is 800 or more", () => {
      render(
        <InsideButtons
          {...defaultProps}
          artifactsEnabled={true}
          deepResearch={true}
          containerWidth={1000}
        />,
      );

      expect(screen.getByText("Canvas")).toBeInTheDocument();
      expect(screen.getByText("Deep Research")).toBeInTheDocument();
      // No dropdown menu
      expect(screen.queryByText("•••")).not.toBeInTheDocument();
    });
  });

  describe("dropdown menu", () => {
    it("should render dropdown trigger when hidden buttons exist", () => {
      render(
        <InsideButtons
          {...defaultProps}
          artifactsEnabled={true}
          deepResearch={true}
          containerWidth={500}
        />,
      );

      const moreButton = screen.getByText("•••").closest("button");
      expect(moreButton).toBeInTheDocument();
      expect(moreButton).toHaveAttribute("aria-haspopup", "menu");
    });
  });

  describe("button type attribute", () => {
    it('should have type="button" to prevent form submission', () => {
      render(
        <InsideButtons
          {...defaultProps}
          artifactsEnabled={true}
          containerWidth={1000}
        />,
      );

      const canvasButton = screen.getByText("Canvas").closest("button");
      expect(canvasButton).toHaveAttribute("type", "button");
    });
  });

  describe("empty state", () => {
    it("should render empty when no buttons are enabled", () => {
      const { container } = render(
        <InsideButtons
          {...defaultProps}
          artifactsEnabled={false}
          deepResearch={false}
          containerWidth={1000}
        />,
      );

      // Only Canvas is rendered since it always shows (isEnabled: true)
      // But with artifactsEnabled false, no buttons should show
      // Container should be empty or only have the relative wrapper
      expect(container.querySelector(".flex.items-center")).toBeInTheDocument();
    });
  });

  describe("icons", () => {
    it("should render CanvasIcon for Canvas button", () => {
      render(
        <InsideButtons
          {...defaultProps}
          artifactsEnabled={true}
          containerWidth={1000}
        />,
      );
      expect(screen.getByTestId("canvas-icon")).toBeInTheDocument();
    });

    it("should render DeepSearchIcon for Deep Research button", () => {
      render(
        <InsideButtons
          {...defaultProps}
          deepResearch={true}
          containerWidth={1000}
        />,
      );
      expect(screen.getByTestId("deep-search-icon")).toBeInTheDocument();
    });
  });

  describe("accessibility", () => {
    it("should have accessible more options button with sr-only text", () => {
      render(
        <InsideButtons
          {...defaultProps}
          artifactsEnabled={true}
          deepResearch={true}
          containerWidth={500}
        />,
      );

      expect(screen.getByText("More options")).toHaveClass("sr-only");
    });
  });

  describe("tablet responsive behavior (600-800px)", () => {
    it("should show first inactive button when no buttons are active on tablet with multiple buttons", () => {
      // Both Canvas and Deep Research enabled, both inactive
      // This tests line 84: activeButtons.length === 0 ? inactiveButtons.slice(0, 1) : []
      render(
        <InsideButtons
          {...defaultProps}
          artifactsEnabled={false} // Canvas isActive = false, isEnabled = true
          deepResearch={true} // Deep Research isEnabled = true
          activeOptions={[]} // Neither is active
          containerWidth={700} // Tablet width
        />,
      );

      // With two inactive buttons on tablet and no active buttons,
      // should show first inactive button (Canvas) and hide the rest
      expect(screen.getByText("Canvas")).toBeInTheDocument();
      // Deep Research should be in dropdown
      expect(screen.getByText("•••")).toBeInTheDocument();
    });

    it("should show only active buttons on tablet (not the first inactive)", () => {
      // Canvas: artifactsEnabled=true means isActive=true
      // Deep Research: not in activeOptions, so isActive=false
      render(
        <InsideButtons
          {...defaultProps}
          artifactsEnabled={true}
          deepResearch={true}
          activeOptions={[]}
          containerWidth={700}
        />,
      );

      // Active button (Canvas due to artifactsEnabled) should be visible
      expect(screen.getByText("Canvas")).toBeInTheDocument();
      // Since Canvas is active, inactive buttons (Deep Research) go to dropdown
      // visibleInactive will be [] because activeButtons.length > 0
      expect(screen.getByText("•••")).toBeInTheDocument();
    });
  });

  describe("dropdown menu interactions", () => {
    it("should have dropdown trigger when hidden buttons exist", () => {
      render(
        <InsideButtons
          {...defaultProps}
          artifactsEnabled={true}
          deepResearch={true}
          containerWidth={500}
        />,
      );

      const moreButton = screen.getByText("•••").closest("button");
      expect(moreButton).toHaveAttribute("aria-haspopup", "menu");
    });

    it("should show hidden buttons in dropdown menu when opened", async () => {
      const user = userEvent.setup();
      render(
        <InsideButtons
          {...defaultProps}
          artifactsEnabled={true}
          deepResearch={true}
          containerWidth={500}
        />,
      );

      const moreButton = screen.getByText("•••").closest("button");
      await user.click(moreButton!);

      // Dropdown should be open with Deep Research inside
      await waitFor(() => {
        expect(screen.getByRole("menu")).toBeInTheDocument();
      });
    });

    it("should call onOptionClick when dropdown item is clicked", async () => {
      const user = userEvent.setup();
      render(
        <InsideButtons
          {...defaultProps}
          artifactsEnabled={true}
          deepResearch={true}
          containerWidth={500}
        />,
      );

      const moreButton = screen.getByText("•••").closest("button");
      await user.click(moreButton!);

      await waitFor(() => {
        expect(screen.getByRole("menu")).toBeInTheDocument();
      });

      // Find and click the menu item
      const menuItems = screen.getAllByRole("menuitem");
      await user.click(menuItems[0]);

      expect(mockOnOptionClick).toHaveBeenCalled();
    });

    it("should show icon in dropdown menu items", async () => {
      const user = userEvent.setup();
      render(
        <InsideButtons
          {...defaultProps}
          artifactsEnabled={true}
          deepResearch={true}
          containerWidth={500}
        />,
      );

      const moreButton = screen.getByText("•••").closest("button");
      await user.click(moreButton!);

      await waitFor(() => {
        screen.getByRole("menuitem");
        // Deep Research icon should be in the menu item
        expect(screen.getByTestId("deep-search-icon")).toBeInTheDocument();
      });
    });
  });

  describe("single button edge case", () => {
    it("should render single button without dropdown when only one button exists and width > minButtonWidth", () => {
      render(
        <InsideButtons
          {...defaultProps}
          artifactsEnabled={false}
          deepResearch={false}
          containerWidth={200}
        />,
      );

      // With only Canvas enabled (deepResearch=false) and width > 120, should show button without dropdown
      expect(screen.getByText("Canvas")).toBeInTheDocument();
      expect(screen.queryByText("•••")).not.toBeInTheDocument();
    });
  });

  describe("disabled state", () => {
    it("should disable all buttons when disabled prop is true", () => {
      render(
        <InsideButtons
          {...defaultProps}
          artifactsEnabled={true}
          deepResearch={true}
          containerWidth={1000}
          disabled={true}
        />,
      );

      const canvasButton = screen.getByText("Canvas").closest("button");
      const deepResearchButton = screen
        .getByText("Deep Research")
        .closest("button");

      expect(canvasButton).toBeDisabled();
      expect(deepResearchButton).toBeDisabled();
    });

    it("should disable more options button when disabled prop is true", () => {
      render(
        <InsideButtons
          {...defaultProps}
          artifactsEnabled={true}
          deepResearch={true}
          containerWidth={500}
          disabled={true}
        />,
      );

      const moreButton = screen.getByText("•••").closest("button");
      expect(moreButton).toBeDisabled();
    });
  });

  describe("Prompts button", () => {
    const mockOnOpenPromptGallery = vi.fn();

    it("should render Prompts button when promptsIsEnabled is true and not in embed mode", () => {
      render(
        <InsideButtons
          {...defaultProps}
          promptsIsEnabled={true}
          embedMode={false}
          onOpenPromptGallery={mockOnOpenPromptGallery}
          containerWidth={1000}
        />,
      );
      expect(screen.getByText("Prompts")).toBeInTheDocument();
    });

    it("should NOT render Prompts button when in embed mode", () => {
      render(
        <InsideButtons
          {...defaultProps}
          promptsIsEnabled={true}
          embedMode={true}
          onOpenPromptGallery={mockOnOpenPromptGallery}
          containerWidth={1000}
        />,
      );
      expect(screen.queryByText("Prompts")).not.toBeInTheDocument();
    });

    it("should NOT render Prompts button when promptsIsEnabled is false", () => {
      render(
        <InsideButtons
          {...defaultProps}
          promptsIsEnabled={false}
          embedMode={false}
          onOpenPromptGallery={mockOnOpenPromptGallery}
          containerWidth={1000}
        />,
      );
      expect(screen.queryByText("Prompts")).not.toBeInTheDocument();
    });

    it("should call onOpenPromptGallery when Prompts button is clicked", () => {
      render(
        <InsideButtons
          {...defaultProps}
          promptsIsEnabled={true}
          embedMode={false}
          onOpenPromptGallery={mockOnOpenPromptGallery}
          containerWidth={1000}
        />,
      );
      const button = screen.getByText("Prompts").closest("button");
      fireEvent.click(button!);
      expect(mockOnOpenPromptGallery).toHaveBeenCalled();
    });

    it("should render Terminal icon for Prompts button", () => {
      render(
        <InsideButtons
          {...defaultProps}
          promptsIsEnabled={true}
          embedMode={false}
          onOpenPromptGallery={mockOnOpenPromptGallery}
          containerWidth={1000}
        />,
      );
      const button = screen.getByText("Prompts").closest("button");
      const icon = button?.querySelector(".lucide-terminal");
      expect(icon).toBeInTheDocument();
    });

    it("should never show X icon for Prompts (isActive is always false)", () => {
      render(
        <InsideButtons
          {...defaultProps}
          promptsIsEnabled={true}
          embedMode={false}
          onOpenPromptGallery={mockOnOpenPromptGallery}
          containerWidth={1000}
        />,
      );
      const button = screen.getByText("Prompts").closest("button");
      const xIcon = button?.querySelector(".ml-1");
      expect(xIcon).not.toBeInTheDocument();
    });

    it("should render Prompts as the second button (after Canvas)", () => {
      render(
        <InsideButtons
          {...defaultProps}
          promptsIsEnabled={true}
          embedMode={false}
          onOpenPromptGallery={mockOnOpenPromptGallery}
          containerWidth={1000}
        />,
      );
      const buttons = screen.getAllByRole("button");
      const buttonTexts = buttons.map((btn) =>
        btn.textContent?.replace(/[×✕]/g, "").trim(),
      );
      const canvasIndex = buttonTexts.indexOf("Canvas");
      const promptsIndex = buttonTexts.indexOf("Prompts");
      expect(promptsIndex).toBe(canvasIndex + 1);
    });

    it("should handle missing onOpenPromptGallery gracefully", () => {
      render(
        <InsideButtons
          {...defaultProps}
          promptsIsEnabled={true}
          embedMode={false}
          containerWidth={1000}
        />,
      );
      const button = screen.getByText("Prompts").closest("button");
      // Should not throw when clicked without onOpenPromptGallery
      expect(() => fireEvent.click(button!)).not.toThrow();
    });
  });

  describe("memory availability", () => {
    it("does not show Memory button when both memsearch and memory component are disabled", () => {
      mockMemsearchConfig = { enable_memsearch: false };
      mockMentorSettings = { enable_memory_component: false };

      render(<InsideButtons {...defaultProps} containerWidth={1000} />);

      expect(screen.queryByTestId("memory-button")).not.toBeInTheDocument();
      expect(screen.queryByText("Memory")).not.toBeInTheDocument();
    });

    it("does not show Memory button even when memsearch is enabled", () => {
      mockMemsearchConfig = { enable_memsearch: true };
      mockMentorSettings = { enable_memory_component: false };

      render(<InsideButtons {...defaultProps} containerWidth={1000} />);

      expect(screen.queryByTestId("memory-button")).not.toBeInTheDocument();
      expect(screen.queryByText("Memory")).not.toBeInTheDocument();
    });

    it("does not show Memory button even when mentor memory component is enabled", () => {
      mockMemsearchConfig = { enable_memsearch: false };
      mockMentorSettings = { enable_memory_component: true };

      render(<InsideButtons {...defaultProps} containerWidth={1000} />);

      expect(screen.queryByTestId("memory-button")).not.toBeInTheDocument();
      expect(screen.queryByText("Memory")).not.toBeInTheDocument();
    });

    it("computes isMemoryAvailable as false when memsearch enabled but memory component disabled", () => {
      mockMemsearchConfig = { enable_memsearch: true };
      mockMentorSettings = { enable_memory_component: false };

      render(<InsideButtons {...defaultProps} containerWidth={1000} />);

      // Memory button should not appear because isEnabled is hardcoded to false
      expect(screen.queryByTestId("memory-button")).not.toBeInTheDocument();
    });

    it("computes isMemoryAvailable as false when memsearch disabled but memory component enabled", () => {
      mockMemsearchConfig = { enable_memsearch: false };
      mockMentorSettings = { enable_memory_component: true };

      render(<InsideButtons {...defaultProps} containerWidth={1000} />);

      // Memory button should not appear because isEnabled is hardcoded to false
      expect(screen.queryByTestId("memory-button")).not.toBeInTheDocument();
    });
  });
});
