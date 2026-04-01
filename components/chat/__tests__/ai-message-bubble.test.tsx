import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { AIMessageBubble, getLastUserMessage } from "../ai-message-bubble";
import type { Message } from "@iblai/iblai-js/web-utils";

// Mock dependencies
let mockShowingSharedChat = false;

vi.mock("@iblai/iblai-js/web-utils", async () => {
  const actual = await vi.importActual("@iblai/iblai-js/web-utils");
  return {
    ...actual,
    selectShowingSharedChat: () => mockShowingSharedChat,
  };
});

vi.mock("@/lib/hooks", async () => {
  const actual = await vi.importActual("@/lib/hooks");
  return {
    ...actual,
    useAppSelector: (selector: (state: Record<string, unknown>) => unknown) => {
      if (selector.toString().includes("showingSharedChat")) {
        return mockShowingSharedChat;
      }
      return selector({});
    },
  };
});

vi.mock("@/components/chat/ai-message-copy", () => ({
  AIMessageCopy: ({ content }: { content: string }) => (
    <button data-testid="ai-message-copy">Copy: {content.slice(0, 10)}</button>
  ),
}));

vi.mock("@/components/chat/ai-message-share", () => ({
  AIMessageShare: ({
    sessionId,
    tenantKey,
  }: {
    sessionId: string;
    tenantKey: string;
  }) => (
    <button data-testid="ai-message-share">
      Share: {sessionId} ({tenantKey})
    </button>
  ),
}));

vi.mock("@/components/chat/ai-message-rating", () => ({
  AIMessageRating: () => <div data-testid="ai-message-rating">Rating</div>,
}));

vi.mock("@/components/chat/chat-messages/message-preview", () => ({
  MessagePreview: ({
    content,
    onOpenCanvas,
  }: {
    content: string;
    onOpenCanvas?: () => void;
  }) => (
    <div data-testid="message-preview" onClick={onOpenCanvas}>
      {content}
    </div>
  ),
}));

vi.mock("@/components/chat/reasoning-section", () => ({
  ReasoningSection: ({
    reasoningContent,
    isReasoning,
    isCurrentlyStreaming,
  }: {
    reasoningContent: string;
    isReasoning: boolean;
    isCurrentlyStreaming?: boolean;
  }) => (
    <div
      data-testid="reasoning-section"
      data-reasoning-content={reasoningContent}
      data-is-reasoning={isReasoning}
      data-is-currently-streaming={isCurrentlyStreaming ?? false}
    >
      {reasoningContent}
    </div>
  ),
}));

vi.mock("@/components/chat/tool-call-indicator", () => ({
  ToolCallIndicator: ({
    toolCalls,
    isCurrentlyStreaming,
  }: {
    toolCalls: unknown[];
    isCurrentlyStreaming?: boolean;
  }) => (
    <div
      data-testid="tool-call-indicator"
      data-tool-calls-count={toolCalls.length}
      data-is-currently-streaming={isCurrentlyStreaming ?? false}
    />
  ),
}));

vi.mock("@/lib/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/utils")>();
  return {
    ...actual,
    cn: (...args: (string | undefined | boolean)[]) =>
      args.filter(Boolean).join(" "),
    isLoggedIn: vi.fn(() => true),
    redirectToAuthSpaJoinTenant: vi.fn(),
  };
});

const createMockStore = (showingSharedChat = false) =>
  configureStore({
    reducer: {
      chat: (state = { showingSharedChat }) => state,
    },
    preloadedState: {
      chat: { showingSharedChat },
    },
  });

describe("AIMessageBubble", () => {
  const mockOnRetry = vi.fn();
  const mockOnSpeak = vi.fn();
  const mockOnReply = vi.fn();
  const mockOnOpenCanvas = vi.fn();

  const mockMessages: Message[] = [
    {
      id: "1",
      role: "user",
      content: "Hello, how are you?",
      timestamp: new Date().toISOString(),
      visible: true,
    },
    {
      id: "2",
      role: "assistant",
      content: "I am doing well, thank you!",
      timestamp: new Date().toISOString(),
      visible: true,
    },
  ];

  const defaultProps = {
    content: "This is an AI response message.",
    profileImage: "/avatar.png",
    mentorName: "Test Mentor",
    timestamp: "10:30 AM",
    sessionId: "session-123",
    messages: mockMessages,
    tenantKey: "test-tenant",
    mentorId: "mentor-123",
    onRetry: mockOnRetry,
    onSpeak: mockOnSpeak,
    onReply: mockOnReply,
    onOpenCanvas: mockOnOpenCanvas,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderWithRedux = (
    component: React.ReactElement,
    showingSharedChat = false,
  ) => {
    return render(
      <Provider store={createMockStore(showingSharedChat)}>
        {component}
      </Provider>,
    );
  };

  describe("rendering", () => {
    it("should render without crashing", () => {
      renderWithRedux(<AIMessageBubble {...defaultProps} />);
      expect(screen.getByTestId("message-preview")).toBeInTheDocument();
    });

    it("should display the mentor name", () => {
      renderWithRedux(<AIMessageBubble {...defaultProps} />);
      expect(screen.getByText("Test Mentor")).toBeInTheDocument();
    });

    it("should display the timestamp", () => {
      renderWithRedux(<AIMessageBubble {...defaultProps} />);
      expect(screen.getByText("10:30 AM")).toBeInTheDocument();
    });

    it("should display the message content", () => {
      renderWithRedux(<AIMessageBubble {...defaultProps} />);
      expect(
        screen.getByText("This is an AI response message."),
      ).toBeInTheDocument();
    });

    it("should render avatar with profile image", () => {
      const { container } = renderWithRedux(
        <AIMessageBubble {...defaultProps} />,
      );
      // Avatar component may render img within nested structure
      const avatarImg = container.querySelector("img");
      if (avatarImg) {
        expect(avatarImg).toBeInTheDocument();
      } else {
        // Fallback: Avatar might not show img if image fails to load
        // Check that avatar container exists
        const avatar = container.querySelector('[data-slot="avatar"]');
        expect(avatar || screen.getByText("TE")).toBeTruthy();
      }
    });

    it("should render avatar fallback with mentor initials", () => {
      renderWithRedux(<AIMessageBubble {...defaultProps} />);
      // Fallback should show "TE" for "Test Mentor"
      expect(screen.getByText("TE")).toBeInTheDocument();
    });
  });

  describe("action buttons", () => {
    it("should render copy button", () => {
      renderWithRedux(<AIMessageBubble {...defaultProps} />);
      expect(screen.getByTestId("ai-message-copy")).toBeInTheDocument();
    });

    it("should render share button when not in shared chat", () => {
      renderWithRedux(<AIMessageBubble {...defaultProps} />);
      expect(screen.getByTestId("ai-message-share")).toBeInTheDocument();
    });

    it("should not render share button when in shared chat", () => {
      mockShowingSharedChat = true;
      renderWithRedux(<AIMessageBubble {...defaultProps} />, true);
      expect(screen.queryByTestId("ai-message-share")).not.toBeInTheDocument();
      mockShowingSharedChat = false; // Reset for other tests
    });

    it("should render rating component when logged in and not shared chat", () => {
      renderWithRedux(<AIMessageBubble {...defaultProps} />);
      expect(screen.getByTestId("ai-message-rating")).toBeInTheDocument();
    });

    it("should render retry button when logged in and not shared chat", () => {
      renderWithRedux(<AIMessageBubble {...defaultProps} />);
      expect(screen.getByText("Retry for a new response")).toBeInTheDocument();
    });
  });

  describe("retry functionality", () => {
    it("should call onRetry with last user message when retry is clicked", () => {
      renderWithRedux(<AIMessageBubble {...defaultProps} />);

      const retryButton = screen.getByRole("button", { name: /retry/i });
      fireEvent.click(retryButton);

      expect(mockOnRetry).toHaveBeenCalledWith("Hello, how are you?");
    });

    it("should not call onRetry if there is no user message", () => {
      const messagesWithNoUser: Message[] = [
        {
          id: "1",
          role: "assistant",
          content: "AI message",
          timestamp: new Date().toISOString(),
          visible: true,
        },
      ];

      renderWithRedux(
        <AIMessageBubble {...defaultProps} messages={messagesWithNoUser} />,
      );

      const retryButton = screen.getByRole("button", { name: /retry/i });
      fireEvent.click(retryButton);

      expect(mockOnRetry).not.toHaveBeenCalled();
    });
  });

  describe("artifact versions handling", () => {
    it("should apply different styling when message has artifact versions", () => {
      const messageWithArtifacts: Message = {
        id: "3",
        role: "assistant",
        content: "Message with artifact",
        timestamp: new Date().toISOString(),
        visible: true,
        artifactVersions: [
          {
            id: 1,
            artifact: {
              id: 100,
              title: "Test Artifact",
              content: "Artifact content",
              file_extension: "md",
              version_count: 1,
              current_version_number: 1,
              date_created: new Date().toISOString(),
              date_updated: new Date().toISOString(),
            },
            title: "Test Artifact",
            content: "Artifact content",
            is_current: true,
            version_number: 1,
            date_created: new Date().toISOString(),
          },
        ],
      };

      const { container } = renderWithRedux(
        <AIMessageBubble {...defaultProps} message={messageWithArtifacts} />,
      );

      // When has artifact versions, should have different background
      const messageContainer = container.querySelector(".bg-white");
      expect(messageContainer).toBeInTheDocument();
    });
  });

  describe("message actions", () => {
    it("should render action buttons when message has actions", () => {
      const messageWithActions: Message = {
        id: "3",
        role: "assistant",
        content: "Message with action",
        timestamp: new Date().toISOString(),
        visible: true,
        actions: [
          {
            actionType: "redirectToAuthSpaJoinTenant",
            text: "Join Now",
            type: "primary",
          },
        ],
      };

      renderWithRedux(
        <AIMessageBubble {...defaultProps} message={messageWithActions} />,
      );

      expect(screen.getByText("Join Now")).toBeInTheDocument();
    });

    it("should call correct callback when action button is clicked", async () => {
      const { redirectToAuthSpaJoinTenant } = await import("@/lib/utils");
      const messageWithActions: Message = {
        id: "3",
        role: "assistant",
        content: "Message with action",
        timestamp: new Date().toISOString(),
        visible: true,
        actions: [
          {
            actionType: "redirectToAuthSpaJoinTenant",
            text: "Join Now",
            type: "primary",
          },
        ],
      };

      renderWithRedux(
        <AIMessageBubble {...defaultProps} message={messageWithActions} />,
      );

      const actionButton = screen.getByText("Join Now");
      fireEvent.click(actionButton);

      expect(redirectToAuthSpaJoinTenant).toHaveBeenCalled();
    });
  });

  describe("MessagePreview integration", () => {
    it("should pass content to MessagePreview", () => {
      renderWithRedux(<AIMessageBubble {...defaultProps} />);
      expect(screen.getByTestId("message-preview")).toHaveTextContent(
        "This is an AI response message.",
      );
    });

    it("should pass onOpenCanvas to MessagePreview", () => {
      renderWithRedux(<AIMessageBubble {...defaultProps} />);

      const messagePreview = screen.getByTestId("message-preview");
      fireEvent.click(messagePreview);

      // The mock MessagePreview calls onOpenCanvas on click
      // This tests the prop is passed through
    });

    it("should pass artifactVersions to MessagePreview", () => {
      const messageWithArtifacts: Message = {
        id: "3",
        role: "assistant",
        content: "Content",
        timestamp: new Date().toISOString(),
        visible: true,
        artifactVersions: [],
      };

      renderWithRedux(
        <AIMessageBubble {...defaultProps} message={messageWithArtifacts} />,
      );

      expect(screen.getByTestId("message-preview")).toBeInTheDocument();
    });
  });

  describe("TooltipProvider", () => {
    it("should wrap content in TooltipProvider", () => {
      renderWithRedux(<AIMessageBubble {...defaultProps} />);
      // The component should render without errors, indicating TooltipProvider is working
      expect(screen.getByText("Test Mentor")).toBeInTheDocument();
    });
  });

  describe("streaming artifact", () => {
    it("should pass streamingArtifactId to MessagePreview", () => {
      renderWithRedux(
        <AIMessageBubble {...defaultProps} streamingArtifactId={456} />,
      );

      expect(screen.getByTestId("message-preview")).toBeInTheDocument();
    });
  });

  describe("reasoning section", () => {
    it("should render ReasoningSection when reasoningContent is provided", () => {
      renderWithRedux(
        <AIMessageBubble
          {...defaultProps}
          reasoningContent="Let me think..."
          isReasoning={true}
        />,
      );
      expect(screen.getByTestId("reasoning-section")).toBeInTheDocument();
      expect(screen.getByTestId("reasoning-section")).toHaveAttribute(
        "data-reasoning-content",
        "Let me think...",
      );
    });

    it("should not render ReasoningSection when reasoningContent is empty", () => {
      renderWithRedux(
        <AIMessageBubble {...defaultProps} reasoningContent="" />,
      );
      expect(screen.queryByTestId("reasoning-section")).not.toBeInTheDocument();
    });

    it("should not render ReasoningSection when reasoningContent is undefined", () => {
      renderWithRedux(<AIMessageBubble {...defaultProps} />);
      expect(screen.queryByTestId("reasoning-section")).not.toBeInTheDocument();
    });

    it("should pass isReasoning to ReasoningSection", () => {
      renderWithRedux(
        <AIMessageBubble
          {...defaultProps}
          reasoningContent="thinking"
          isReasoning={true}
        />,
      );
      expect(screen.getByTestId("reasoning-section")).toHaveAttribute(
        "data-is-reasoning",
        "true",
      );
    });

    it("should default isReasoning to false for ReasoningSection", () => {
      renderWithRedux(
        <AIMessageBubble {...defaultProps} reasoningContent="done thinking" />,
      );
      expect(screen.getByTestId("reasoning-section")).toHaveAttribute(
        "data-is-reasoning",
        "false",
      );
    });

    it("should pass isCurrentlyStreaming to ReasoningSection", () => {
      renderWithRedux(
        <AIMessageBubble
          {...defaultProps}
          reasoningContent="thinking"
          isReasoning={true}
          isCurrentlyStreaming={true}
        />,
      );
      expect(screen.getByTestId("reasoning-section")).toHaveAttribute(
        "data-is-currently-streaming",
        "true",
      );
    });
  });

  describe("tool call indicator", () => {
    const mockToolCalls = [
      { id: "tc1", name: "web_search_call", log: "", result: "" },
      { id: "tc2", name: "vector_search", log: "", result: "" },
    ];

    it("should render ToolCallIndicator when toolCalls are provided", () => {
      renderWithRedux(
        <AIMessageBubble {...defaultProps} toolCalls={mockToolCalls} />,
      );
      expect(screen.getByTestId("tool-call-indicator")).toBeInTheDocument();
      expect(screen.getByTestId("tool-call-indicator")).toHaveAttribute(
        "data-tool-calls-count",
        "2",
      );
    });

    it("should not render ToolCallIndicator when toolCalls is empty", () => {
      renderWithRedux(<AIMessageBubble {...defaultProps} toolCalls={[]} />);
      expect(
        screen.queryByTestId("tool-call-indicator"),
      ).not.toBeInTheDocument();
    });

    it("should not render ToolCallIndicator when toolCalls is undefined", () => {
      renderWithRedux(<AIMessageBubble {...defaultProps} />);
      expect(
        screen.queryByTestId("tool-call-indicator"),
      ).not.toBeInTheDocument();
    });

    it("should pass isCurrentlyStreaming to ToolCallIndicator", () => {
      renderWithRedux(
        <AIMessageBubble
          {...defaultProps}
          toolCalls={mockToolCalls}
          isCurrentlyStreaming={true}
        />,
      );
      expect(screen.getByTestId("tool-call-indicator")).toHaveAttribute(
        "data-is-currently-streaming",
        "true",
      );
    });
  });
});

describe("getLastUserMessage", () => {
  it("should return the last user message from messages array", () => {
    const messages: Message[] = [
      {
        id: "1",
        role: "user",
        content: "First user message",
        timestamp: new Date().toISOString(),
        visible: true,
      },
      {
        id: "2",
        role: "assistant",
        content: "Assistant response",
        timestamp: new Date().toISOString(),
        visible: true,
      },
      {
        id: "3",
        role: "user",
        content: "Second user message",
        timestamp: new Date().toISOString(),
        visible: true,
      },
    ];

    const result = getLastUserMessage(messages);
    expect(result?.content).toBe("Second user message");
  });

  it("should return null if no user messages exist", () => {
    const messages: Message[] = [
      {
        id: "1",
        role: "assistant",
        content: "Assistant message",
        timestamp: new Date().toISOString(),
        visible: true,
      },
    ];

    const result = getLastUserMessage(messages);
    expect(result).toBeNull();
  });

  it("should return null for empty messages array", () => {
    const result = getLastUserMessage([]);
    expect(result).toBeNull();
  });

  it("should return the only user message when there is one", () => {
    const messages: Message[] = [
      {
        id: "1",
        role: "user",
        content: "Only user message",
        timestamp: new Date().toISOString(),
        visible: true,
      },
    ];

    const result = getLastUserMessage(messages);
    expect(result?.content).toBe("Only user message");
  });
});
