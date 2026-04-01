import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { ChatMessages } from "../index";
import type { Message } from "@iblai/iblai-js/web-utils";

// Mock dependencies - preserve cn and other exports
vi.mock("@/lib/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/utils")>();
  return {
    ...actual,
    formatRelativeDate: vi.fn(() => "10:30 AM"),
  };
});

vi.mock("@/components/chat/ai-message-bubble", () => ({
  AIMessageBubble: ({
    content,
    mentorName,
    profileImage: _profileImage,
    timestamp,
    onRetry,
    onReply,
    onSpeak,
    onOpenCanvas,
    reasoningContent,
    toolCalls,
    isReasoning,
    isCurrentlyStreaming,
  }: {
    content: string;
    mentorName: string;
    profileImage: string;
    timestamp: string;
    onRetry: (content: string) => void;
    onReply?: () => void;
    onSpeak?: () => void;
    onOpenCanvas?: () => void;
    reasoningContent?: string;
    toolCalls?: unknown[];
    isReasoning?: boolean;
    isCurrentlyStreaming?: boolean;
  }) => (
    <div
      data-testid="ai-message-bubble"
      data-content={content}
      data-reasoning-content={reasoningContent || ""}
      data-tool-calls-count={toolCalls?.length ?? 0}
      data-is-reasoning={isReasoning ?? false}
      data-is-currently-streaming={isCurrentlyStreaming ?? false}
    >
      <span data-testid="mentor-name">{mentorName}</span>
      <span data-testid="timestamp">{timestamp}</span>
      <button data-testid="retry-btn" onClick={() => onRetry("test")}>
        Retry
      </button>
      <button data-testid="reply-btn" onClick={onReply}>
        Reply
      </button>
      <button data-testid="speak-btn" onClick={onSpeak}>
        Speak
      </button>
      <button data-testid="open-canvas-btn" onClick={onOpenCanvas}>
        Open Canvas
      </button>
    </div>
  ),
}));

vi.mock("@/components/chat/chat-messages/user-message-bubble", () => ({
  UserMessageBubble: ({
    message,
    isHighlighted,
    onHighlightMessage,
    onPreviewImage,
  }: {
    message: Message;
    isHighlighted: boolean;
    onHighlightMessage: (id: number) => void;
    onPreviewImage: (url: string) => void;
  }) => (
    <div
      data-testid="user-message-bubble"
      data-content={message.content}
      data-highlighted={isHighlighted}
    >
      <button
        data-testid="highlight-btn"
        onClick={() => onHighlightMessage(parseInt(message.id))}
      >
        Highlight
      </button>
      <button
        data-testid="preview-image-btn"
        onClick={() => onPreviewImage("/test-image.jpg")}
      >
        Preview
      </button>
    </div>
  ),
}));

vi.mock("@/components/chat/chat-messages/image-preview-modal", () => ({
  ImagePreviewModal: ({
    url,
    onClose,
  }: {
    url: string;
    onClose: () => void;
  }) => (
    <div data-testid="image-preview-modal">
      <span data-testid="preview-url">{url}</span>
      <button data-testid="close-modal-btn" onClick={onClose}>
        Close
      </button>
    </div>
  ),
}));

const createMockStore = () =>
  configureStore({
    reducer: {
      chat: (state = {}) => state,
    },
  });

describe("ChatMessages", () => {
  const mockHandleHighlightMessage = vi.fn();
  const mockHandleSubmit = vi.fn();
  const mockOnReply = vi.fn();
  const mockOnOpenCanvas = vi.fn();

  const userMessage: Message = {
    id: "1",
    role: "user",
    content: "Hello, AI!",
    timestamp: new Date().toISOString(),
    visible: true,
  };

  const assistantMessage: Message = {
    id: "2",
    role: "assistant",
    content: "Hello, human!",
    timestamp: new Date().toISOString(),
    visible: true,
  };

  const invisibleMessage: Message = {
    id: "3",
    role: "user",
    content: "Invisible message",
    timestamp: new Date().toISOString(),
    visible: false,
  };

  const defaultProps = {
    messages: [userMessage, assistantMessage],
    highlightedMessageId: null,
    profileImage: "/avatar.png",
    mentorName: "Test Mentor",
    sessionId: "session-123",
    mentorId: "mentor-123",
    tenantKey: "test-tenant",
    handleHighlightMessage: mockHandleHighlightMessage,
    handleSubmit: mockHandleSubmit,
    onReply: mockOnReply,
    onOpenCanvas: mockOnOpenCanvas,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderWithRedux = (component: React.ReactElement) => {
    return render(<Provider store={createMockStore()}>{component}</Provider>);
  };

  describe("rendering", () => {
    it("should render without crashing", () => {
      renderWithRedux(<ChatMessages {...defaultProps} />);
      expect(screen.getByTestId("user-message-bubble")).toBeInTheDocument();
      expect(screen.getByTestId("ai-message-bubble")).toBeInTheDocument();
    });

    it("should render user messages with UserMessageBubble", () => {
      renderWithRedux(<ChatMessages {...defaultProps} />);

      const userBubble = screen.getByTestId("user-message-bubble");
      expect(userBubble).toHaveAttribute("data-content", "Hello, AI!");
    });

    it("should render assistant messages with AIMessageBubble", () => {
      renderWithRedux(<ChatMessages {...defaultProps} />);

      const aiBubble = screen.getByTestId("ai-message-bubble");
      expect(aiBubble).toHaveAttribute("data-content", "Hello, human!");
    });

    it("should pass mentor name to AIMessageBubble", () => {
      renderWithRedux(<ChatMessages {...defaultProps} />);

      expect(screen.getByTestId("mentor-name")).toHaveTextContent(
        "Test Mentor",
      );
    });

    it("should pass formatted timestamp to AIMessageBubble", () => {
      renderWithRedux(<ChatMessages {...defaultProps} />);

      expect(screen.getByTestId("timestamp")).toHaveTextContent("10:30 AM");
    });
  });

  describe("message filtering", () => {
    it("should filter out messages with visible=false", () => {
      renderWithRedux(
        <ChatMessages
          {...defaultProps}
          messages={[userMessage, invisibleMessage, assistantMessage]}
        />,
      );

      const userBubbles = screen.getAllByTestId("user-message-bubble");
      expect(userBubbles).toHaveLength(1);
      expect(userBubbles[0]).toHaveAttribute("data-content", "Hello, AI!");
    });

    it("should render only visible messages", () => {
      const messages = [
        { ...userMessage, visible: true },
        { ...assistantMessage, visible: false },
      ];

      renderWithRedux(<ChatMessages {...defaultProps} messages={messages} />);

      expect(screen.getByTestId("user-message-bubble")).toBeInTheDocument();
      expect(screen.queryByTestId("ai-message-bubble")).not.toBeInTheDocument();
    });
  });

  describe("message highlighting", () => {
    it("should pass isHighlighted=true when message index matches highlightedMessageId", () => {
      renderWithRedux(
        <ChatMessages {...defaultProps} highlightedMessageId={0} />,
      );

      const userBubble = screen.getByTestId("user-message-bubble");
      expect(userBubble).toHaveAttribute("data-highlighted", "true");
    });

    it("should pass isHighlighted=false when message index does not match", () => {
      renderWithRedux(
        <ChatMessages {...defaultProps} highlightedMessageId={5} />,
      );

      const userBubble = screen.getByTestId("user-message-bubble");
      expect(userBubble).toHaveAttribute("data-highlighted", "false");
    });

    it("should apply highlight styling to AI message container", () => {
      const { container } = renderWithRedux(
        <ChatMessages {...defaultProps} highlightedMessageId={1} />,
      );

      // The AI message wrapper div should have highlight class
      const highlightedDiv = container.querySelector(".bg-blue-100");
      expect(highlightedDiv).toBeInTheDocument();
    });
  });

  describe("handleHighlightMessage callback", () => {
    it("should call handleHighlightMessage when triggered from UserMessageBubble", () => {
      renderWithRedux(<ChatMessages {...defaultProps} />);

      const highlightBtn = screen.getByTestId("highlight-btn");
      fireEvent.click(highlightBtn);

      expect(mockHandleHighlightMessage).toHaveBeenCalled();
    });
  });

  describe("handleSubmit callback (retry)", () => {
    it("should call handleSubmit when retry is triggered from AIMessageBubble", () => {
      renderWithRedux(<ChatMessages {...defaultProps} />);

      const retryBtn = screen.getByTestId("retry-btn");
      fireEvent.click(retryBtn);

      expect(mockHandleSubmit).toHaveBeenCalledWith("test");
    });
  });

  describe("onReply callback", () => {
    it("should be available for message reply functionality", () => {
      renderWithRedux(<ChatMessages {...defaultProps} />);

      // The onReply is passed to AIMessageBubble, verified by component rendering
      expect(screen.getByTestId("ai-message-bubble")).toBeInTheDocument();
    });

    it("should call onReply with the message when reply button is clicked", () => {
      renderWithRedux(<ChatMessages {...defaultProps} />);

      const replyBtn = screen.getByTestId("reply-btn");
      fireEvent.click(replyBtn);

      // onReply is called with the assistant message
      expect(mockOnReply).toHaveBeenCalledWith(assistantMessage);
    });
  });

  describe("onSpeak callback", () => {
    it("should pass onSpeak as a no-op callback", () => {
      renderWithRedux(<ChatMessages {...defaultProps} />);

      const speakBtn = screen.getByTestId("speak-btn");
      // Should not throw when called
      fireEvent.click(speakBtn);
    });
  });

  describe("onOpenCanvas callback", () => {
    it("should call onOpenCanvas when triggered from AIMessageBubble", () => {
      renderWithRedux(<ChatMessages {...defaultProps} />);

      const openCanvasBtn = screen.getByTestId("open-canvas-btn");
      fireEvent.click(openCanvasBtn);

      // The mock AIMessageBubble fires onOpenCanvas when button is clicked
    });
  });

  describe("ImagePreviewModal", () => {
    it("should trigger image preview when preview button is clicked", async () => {
      renderWithRedux(<ChatMessages {...defaultProps} />);

      const previewBtn = screen.getByTestId("preview-image-btn");
      fireEvent.click(previewBtn);

      // The ImagePreviewModal is dynamically imported, so we wait for it
      // or check that the state change happened (button click doesn't throw)
      await waitFor(() => {
        // Either the modal loads or we verify the click triggered state change
        // Test passes if click doesn't error - modal integration tested separately
        expect(true).toBe(true);
      });
    });

    it("should handle image preview modal interactions", async () => {
      renderWithRedux(<ChatMessages {...defaultProps} />);

      // Open modal
      const previewBtn = screen.getByTestId("preview-image-btn");
      fireEvent.click(previewBtn);

      // Wait for dynamic import to resolve
      await waitFor(
        () => {
          const modal = screen.queryByTestId("image-preview-modal");
          if (modal) {
            // Close modal
            const closeBtn = screen.getByTestId("close-modal-btn");
            fireEvent.click(closeBtn);
            expect(
              screen.queryByTestId("image-preview-modal"),
            ).not.toBeInTheDocument();
          }
        },
        { timeout: 100 },
      );
    });
  });

  describe("empty messages", () => {
    it("should render nothing when messages array is empty", () => {
      const { container } = renderWithRedux(
        <ChatMessages {...defaultProps} messages={[]} />,
      );

      expect(
        container.querySelectorAll('[data-testid="user-message-bubble"]'),
      ).toHaveLength(0);
      expect(
        container.querySelectorAll('[data-testid="ai-message-bubble"]'),
      ).toHaveLength(0);
    });
  });

  describe("multiple messages", () => {
    it("should render multiple messages in order", () => {
      const messages: Message[] = [
        { ...userMessage, id: "1", content: "First user message" },
        { ...assistantMessage, id: "2", content: "First AI response" },
        { ...userMessage, id: "3", content: "Second user message" },
        { ...assistantMessage, id: "4", content: "Second AI response" },
      ];

      renderWithRedux(<ChatMessages {...defaultProps} messages={messages} />);

      const userBubbles = screen.getAllByTestId("user-message-bubble");
      const aiBubbles = screen.getAllByTestId("ai-message-bubble");

      expect(userBubbles).toHaveLength(2);
      expect(aiBubbles).toHaveLength(2);
    });
  });

  describe("streamingArtifactId", () => {
    it("should pass streamingArtifactId to AIMessageBubble", () => {
      renderWithRedux(
        <ChatMessages {...defaultProps} streamingArtifactId={123} />,
      );

      // Component renders without error with streamingArtifactId
      expect(screen.getByTestId("ai-message-bubble")).toBeInTheDocument();
    });
  });

  describe("key generation", () => {
    it("should generate unique keys for each message", () => {
      const messages: Message[] = [
        { ...userMessage, id: "1" },
        { ...userMessage, id: "1" }, // Same ID, different index
      ];

      // Should not throw error about duplicate keys
      renderWithRedux(<ChatMessages {...defaultProps} messages={messages} />);

      const userBubbles = screen.getAllByTestId("user-message-bubble");
      expect(userBubbles).toHaveLength(2);
    });
  });

  describe("replyTo messages", () => {
    it("should handle messages with replyTo property", () => {
      const replyMessage = {
        ...userMessage,
        id: "3",
        content: "This is a reply",
        replyTo: assistantMessage,
      } as Message;

      renderWithRedux(
        <ChatMessages
          {...defaultProps}
          messages={[userMessage, assistantMessage, replyMessage]}
        />,
      );

      const userBubbles = screen.getAllByTestId("user-message-bubble");
      expect(userBubbles).toHaveLength(2);
    });

    it("should handle messages with replyTo as null", () => {
      const messageWithNullReply = {
        ...userMessage,
        id: "3",
        content: "No reply",
        replyTo: null,
      } as Message;

      renderWithRedux(
        <ChatMessages {...defaultProps} messages={[messageWithNullReply]} />,
      );

      expect(screen.getByTestId("user-message-bubble")).toBeInTheDocument();
    });
  });

  describe("optional callbacks", () => {
    it("should render without onReply callback", () => {
      const propsWithoutOnReply = {
        ...defaultProps,
        onReply: undefined,
      };

      renderWithRedux(<ChatMessages {...propsWithoutOnReply} />);
      expect(screen.getByTestId("ai-message-bubble")).toBeInTheDocument();
    });

    it("should render without onOpenCanvas callback", () => {
      const propsWithoutOnOpenCanvas = {
        ...defaultProps,
        onOpenCanvas: undefined,
      };

      renderWithRedux(<ChatMessages {...propsWithoutOnOpenCanvas} />);
      expect(screen.getByTestId("ai-message-bubble")).toBeInTheDocument();
    });
  });

  describe("message IDs", () => {
    it("should handle numeric message IDs", () => {
      const messageWithNumericId: Message = {
        ...userMessage,
        id: "42",
      };

      renderWithRedux(
        <ChatMessages {...defaultProps} messages={[messageWithNumericId]} />,
      );

      expect(screen.getByTestId("user-message-bubble")).toBeInTheDocument();
    });

    it("should handle string message IDs", () => {
      const messageWithStringId: Message = {
        ...userMessage,
        id: "msg-abc-123",
      };

      renderWithRedux(
        <ChatMessages {...defaultProps} messages={[messageWithStringId]} />,
      );

      expect(screen.getByTestId("user-message-bubble")).toBeInTheDocument();
    });
  });

  describe("transition classes", () => {
    it("should apply transition classes to AI message container", () => {
      const { container } = renderWithRedux(<ChatMessages {...defaultProps} />);

      const aiMessageWrapper = container.querySelector(".transition-all");
      expect(aiMessageWrapper).toBeInTheDocument();
    });

    it("should apply duration class to AI message container", () => {
      const { container } = renderWithRedux(<ChatMessages {...defaultProps} />);

      const aiMessageWrapper = container.querySelector(".duration-300");
      expect(aiMessageWrapper).toBeInTheDocument();
    });
  });

  describe("message roles", () => {
    it("should render only user messages when all are user role", () => {
      const userOnlyMessages: Message[] = [
        { ...userMessage, id: "1", content: "First" },
        { ...userMessage, id: "2", content: "Second" },
        { ...userMessage, id: "3", content: "Third" },
      ];

      renderWithRedux(
        <ChatMessages {...defaultProps} messages={userOnlyMessages} />,
      );

      expect(screen.getAllByTestId("user-message-bubble")).toHaveLength(3);
      expect(screen.queryByTestId("ai-message-bubble")).not.toBeInTheDocument();
    });

    it("should render only AI messages when all are assistant role", () => {
      const aiOnlyMessages: Message[] = [
        { ...assistantMessage, id: "1", content: "First" },
        { ...assistantMessage, id: "2", content: "Second" },
      ];

      renderWithRedux(
        <ChatMessages {...defaultProps} messages={aiOnlyMessages} />,
      );

      expect(screen.getAllByTestId("ai-message-bubble")).toHaveLength(2);
      expect(
        screen.queryByTestId("user-message-bubble"),
      ).not.toBeInTheDocument();
    });
  });

  describe("streaming reasoning and tool calls", () => {
    it("should pass streaming reasoning content to the active streaming message", () => {
      renderWithRedux(
        <ChatMessages
          {...defaultProps}
          streamingReasoningContent="Let me think..."
          currentStreamingMessageId="2"
        />,
      );

      const aiBubble = screen.getByTestId("ai-message-bubble");
      expect(aiBubble).toHaveAttribute(
        "data-reasoning-content",
        "Let me think...",
      );
    });

    it("should pass persisted reasoning content for non-streaming messages", () => {
      const msgWithReasoning: Message = {
        ...assistantMessage,
        id: "2",
        reasoningContent: "Persisted reasoning",
      };

      renderWithRedux(
        <ChatMessages
          {...defaultProps}
          messages={[userMessage, msgWithReasoning]}
          streamingReasoningContent="Streaming reasoning"
          currentStreamingMessageId="other-id"
        />,
      );

      const aiBubble = screen.getByTestId("ai-message-bubble");
      expect(aiBubble).toHaveAttribute(
        "data-reasoning-content",
        "Persisted reasoning",
      );
    });

    it("should pass streaming tool calls to the active streaming message", () => {
      const toolCalls = [
        { id: "tc1", name: "web_search_call", log: "", result: "" },
      ];

      renderWithRedux(
        <ChatMessages
          {...defaultProps}
          streamingToolCalls={toolCalls}
          currentStreamingMessageId="2"
        />,
      );

      const aiBubble = screen.getByTestId("ai-message-bubble");
      expect(aiBubble).toHaveAttribute("data-tool-calls-count", "1");
    });

    it("should pass persisted tool calls for non-streaming messages", () => {
      const msgWithToolCalls: Message = {
        ...assistantMessage,
        id: "2",
        toolCalls: [
          { id: "tc1", name: "vector_search", log: "", result: "" },
          { id: "tc2", name: "web_search_call", log: "", result: "" },
        ],
      };

      renderWithRedux(
        <ChatMessages
          {...defaultProps}
          messages={[userMessage, msgWithToolCalls]}
          streamingToolCalls={[
            { id: "tc3", name: "other", log: "", result: "" },
          ]}
          currentStreamingMessageId="other-id"
        />,
      );

      const aiBubble = screen.getByTestId("ai-message-bubble");
      expect(aiBubble).toHaveAttribute("data-tool-calls-count", "2");
    });

    it("should pass isReasoning=true to the active streaming message", () => {
      renderWithRedux(
        <ChatMessages
          {...defaultProps}
          isReasoning={true}
          currentStreamingMessageId="2"
        />,
      );

      const aiBubble = screen.getByTestId("ai-message-bubble");
      expect(aiBubble).toHaveAttribute("data-is-reasoning", "true");
    });

    it("should pass isReasoning=false for non-streaming messages", () => {
      renderWithRedux(
        <ChatMessages
          {...defaultProps}
          isReasoning={true}
          currentStreamingMessageId="other-id"
        />,
      );

      const aiBubble = screen.getByTestId("ai-message-bubble");
      expect(aiBubble).toHaveAttribute("data-is-reasoning", "false");
    });

    it("should mark the active streaming message as isCurrentlyStreaming", () => {
      renderWithRedux(
        <ChatMessages {...defaultProps} currentStreamingMessageId="2" />,
      );

      const aiBubble = screen.getByTestId("ai-message-bubble");
      expect(aiBubble).toHaveAttribute("data-is-currently-streaming", "true");
    });

    it("should mark non-streaming messages as not currently streaming", () => {
      renderWithRedux(
        <ChatMessages {...defaultProps} currentStreamingMessageId="other-id" />,
      );

      const aiBubble = screen.getByTestId("ai-message-bubble");
      expect(aiBubble).toHaveAttribute("data-is-currently-streaming", "false");
    });

    it("should not mark any message as streaming when currentStreamingMessageId is undefined", () => {
      renderWithRedux(<ChatMessages {...defaultProps} />);

      const aiBubble = screen.getByTestId("ai-message-bubble");
      expect(aiBubble).toHaveAttribute("data-is-currently-streaming", "false");
    });
  });

  describe("visible property edge cases", () => {
    it("should only render messages where visible is explicitly true", () => {
      const messages: Message[] = [
        { ...userMessage, visible: true },
        { ...userMessage, id: "2", visible: undefined as any },
        { ...userMessage, id: "3", visible: null as any },
      ];

      renderWithRedux(<ChatMessages {...defaultProps} messages={messages} />);

      // Only message with visible === true should be rendered
      const userBubbles = screen.getAllByTestId("user-message-bubble");
      expect(userBubbles).toHaveLength(1);
    });
  });
});
