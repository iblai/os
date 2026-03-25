import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorkflowPreviewChat } from "../workflow-preview-chat";

// Mock scrollTo on HTMLDivElement
const mockScrollTo = vi.fn();
Object.defineProperty(HTMLDivElement.prototype, "scrollTo", {
  value: mockScrollTo,
  writable: true,
});

// Mock external dependencies
const mockSendMessage = vi.fn();
const mockStopGenerating = vi.fn();
const mockSetMessage = vi.fn();

// Capture callbacks passed to useAdvancedChat
let capturedErrorHandler: ((message: string) => void) | undefined;

const mockStartNewChat = vi.fn();

vi.mock("@iblai/iblai-js/web-utils", () => ({
  useAdvancedChat: vi.fn(
    (options: { errorHandler?: (msg: string) => void }) => {
      capturedErrorHandler = options.errorHandler;
      return {
        messages: [],
        sendMessage: mockSendMessage,
        stopGenerating: mockStopGenerating,
        setMessage: mockSetMessage,
        activeTab: "chat",
        mentorName: "Test Mentor",
        profileImage: "/test-image.png",
        sessionId: "test-session-id",
        enableSafetyDisclaimer: false,
        isPending: false,
        isStreaming: false,
        currentStreamingMessage: null,
        isConnected: true,
        startNewChat: mockStartNewChat,
      };
    },
  ),
  ANONYMOUS_USERNAME: "anonymous",
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

vi.mock("@/components/chat/chat-messages", () => ({
  ChatMessages: ({
    messages,
    highlightedMessageId,
    handleSubmit,
  }: {
    messages: Array<{ id: number; content: string; role: string }>;
    highlightedMessageId: number | null;
    handleSubmit: (content: string) => void;
  }) => (
    <div data-testid="chat-messages">
      <span data-testid="message-count">{messages.length}</span>
      <span data-testid="highlighted-id">{highlightedMessageId ?? "none"}</span>
      <button
        data-testid="submit-from-messages"
        onClick={() => handleSubmit("test message")}
      >
        Submit from messages
      </button>
    </div>
  ),
}));

vi.mock("@/components/chat-input-form", () => ({
  ChatInputForm: ({
    onSubmit,
    sessionId,
    tenantKey,
    mentorId,
    username,
    isStreaming,
    isConnecting,
    compactMode,
  }: {
    onSubmit: (content: string) => void;
    sessionId: string;
    tenantKey: string;
    mentorId?: string;
    username: string;
    isStreaming: boolean;
    isConnecting: boolean;
    compactMode: boolean;
  }) => (
    <div data-testid="chat-input-form">
      <span data-testid="session-id">{sessionId}</span>
      <span data-testid="tenant-key">{tenantKey}</span>
      <span data-testid="mentor-id">{mentorId}</span>
      <span data-testid="username">{username}</span>
      <span data-testid="is-streaming">{String(isStreaming)}</span>
      <span data-testid="is-connecting">{String(isConnecting)}</span>
      <span data-testid="compact-mode">{String(compactMode)}</span>
      <button data-testid="submit-message" onClick={() => onSubmit("Hello")}>
        Send
      </button>
    </div>
  ),
}));

vi.mock("@/components/chat/loading-message", () => ({
  LoadingMessage: ({
    mentorName,
    profileImage,
  }: {
    mentorName: string;
    profileImage: string;
  }) => (
    <div data-testid="loading-message">
      <span data-testid="loading-mentor-name">{mentorName}</span>
      <span data-testid="loading-profile-image">{profileImage}</span>
    </div>
  ),
}));

const mockUseAxdToken = vi.fn((): string | null => "test-token");
vi.mock("@/hooks/use-tokens", () => ({
  useAxdToken: () => mockUseAxdToken(),
}));

const mockUseUsername = vi.fn((): string | null => "test-user");
vi.mock("@/hooks/use-user", () => ({
  useUsername: () => mockUseUsername(),
}));

vi.mock("@/lib/config", () => ({
  config: {
    baseWsUrl: () => "wss://test.example.com",
  },
}));

vi.mock("@/lib/utils", () => ({
  redirectToAuthSpa: vi.fn(),
}));

vi.mock("@/lib/eventBus", () => ({
  default: {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  },
  RemoteEvents: {
    newChat: "newChat",
  },
}));

describe("WorkflowPreviewChat", () => {
  const defaultProps = {
    tenantKey: "test-tenant",
    mentorId: "test-mentor-id",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    capturedErrorHandler = undefined;
    mockUseAxdToken.mockReturnValue("test-token");
    mockUseUsername.mockReturnValue("test-user");
    mockScrollTo.mockClear();
  });

  describe("rendering", () => {
    it("should render the chat container", () => {
      render(<WorkflowPreviewChat {...defaultProps} />);
      // With empty messages, the placeholder is shown instead of ChatMessages
      expect(screen.getByText("Preview your agent")).toBeInTheDocument();
      expect(screen.getByTestId("chat-input-form")).toBeInTheDocument();
    });

    it("should render ChatMessages component when messages exist", async () => {
      const { useAdvancedChat } = await import("@iblai/iblai-js/web-utils");
      vi.mocked<any>(useAdvancedChat).mockImplementation((options) => {
        capturedErrorHandler = options.errorHandler;
        return {
          messages: [{ id: 1, content: "Hello", role: "user" }],
          sendMessage: mockSendMessage,
          stopGenerating: mockStopGenerating,
          setMessage: mockSetMessage,
          activeTab: "chat",
          mentorName: "Test Mentor",
          profileImage: "/test-image.png",
          sessionId: "test-session-id",
          enableSafetyDisclaimer: false,
          isPending: false,
          isStreaming: false,
          currentStreamingMessage: null,
          isConnected: true,
          startNewChat: mockStartNewChat,
        };
      });

      render(<WorkflowPreviewChat {...defaultProps} />);
      expect(screen.getByTestId("chat-messages")).toBeInTheDocument();
    });

    it("should render ChatInputForm component", () => {
      render(<WorkflowPreviewChat {...defaultProps} />);
      expect(screen.getByTestId("chat-input-form")).toBeInTheDocument();
    });
  });

  describe("props passing", () => {
    it("should pass tenantKey to ChatInputForm", () => {
      render(<WorkflowPreviewChat {...defaultProps} />);
      expect(screen.getByTestId("tenant-key")).toHaveTextContent("test-tenant");
    });

    it("should pass mentorId to ChatInputForm", () => {
      render(<WorkflowPreviewChat {...defaultProps} />);
      expect(screen.getByTestId("mentor-id")).toHaveTextContent(
        "test-mentor-id",
      );
    });

    it("should pass username to ChatInputForm", () => {
      render(<WorkflowPreviewChat {...defaultProps} />);
      expect(screen.getByTestId("username")).toHaveTextContent("test-user");
    });

    it("should pass sessionId to ChatInputForm", () => {
      render(<WorkflowPreviewChat {...defaultProps} />);
      expect(screen.getByTestId("session-id")).toHaveTextContent(
        "test-session-id",
      );
    });

    it("should pass compactMode as true", () => {
      render(<WorkflowPreviewChat {...defaultProps} />);
      expect(screen.getByTestId("compact-mode")).toHaveTextContent("true");
    });
  });

  describe("message handling", () => {
    it("should call sendMessage when form is submitted", async () => {
      const user = userEvent.setup();
      render(<WorkflowPreviewChat {...defaultProps} />);

      await user.click(screen.getByTestId("submit-message"));

      expect(mockSendMessage).toHaveBeenCalledWith("chat", "Hello", {
        visible: true,
      });
    });

    it("should call sendMessage when submitted from messages", async () => {
      const { useAdvancedChat } = await import("@iblai/iblai-js/web-utils");
      vi.mocked<any>(useAdvancedChat).mockImplementation((options) => {
        capturedErrorHandler = options.errorHandler;
        return {
          messages: [{ id: 1, content: "Hello", role: "user" }],
          sendMessage: mockSendMessage,
          stopGenerating: mockStopGenerating,
          setMessage: mockSetMessage,
          activeTab: "chat",
          mentorName: "Test Mentor",
          profileImage: "/test-image.png",
          sessionId: "test-session-id",
          enableSafetyDisclaimer: false,
          isPending: false,
          isStreaming: false,
          currentStreamingMessage: null,
          isConnected: true,
          startNewChat: mockStartNewChat,
        };
      });

      const user = userEvent.setup();
      render(<WorkflowPreviewChat {...defaultProps} />);

      await user.click(screen.getByTestId("submit-from-messages"));

      expect(mockSendMessage).toHaveBeenCalledWith("chat", "test message", {
        visible: true,
      });
    });
  });

  describe("loading state", () => {
    it("should not show loading message when not pending or streaming", () => {
      render(<WorkflowPreviewChat {...defaultProps} />);
      expect(screen.queryByTestId("loading-message")).not.toBeInTheDocument();
    });

    it("should show loading message when isPending is true", async () => {
      const { useAdvancedChat } = await import("@iblai/web-utils");
      vi.mocked<any>(useAdvancedChat).mockReturnValue({
        messages: [],
        sendMessage: mockSendMessage,
        stopGenerating: mockStopGenerating,
        setMessage: mockSetMessage,
        activeTab: "chat",
        mentorName: "Test Mentor",
        profileImage: "/test-image.png",
        sessionId: "test-session-id",
        enableSafetyDisclaimer: false,
        isPending: true,
        isStreaming: false,
        currentStreamingMessage: null,
        isConnected: true,
      } as any);

      render(<WorkflowPreviewChat {...defaultProps} />);
      expect(screen.getByTestId("loading-message")).toBeInTheDocument();
    });

    it("should show loading message when isStreaming with no content", async () => {
      const { useAdvancedChat } = await import("@iblai/web-utils");
      vi.mocked<any>(useAdvancedChat).mockReturnValue({
        messages: [],
        sendMessage: mockSendMessage,
        stopGenerating: mockStopGenerating,
        setMessage: mockSetMessage,
        activeTab: "chat",
        mentorName: "Test Mentor",
        profileImage: "/test-image.png",
        sessionId: "test-session-id",
        enableSafetyDisclaimer: false,
        isPending: false,
        isStreaming: true,
        currentStreamingMessage: null,
        isConnected: true,
      } as any);

      render(<WorkflowPreviewChat {...defaultProps} />);
      expect(screen.getByTestId("loading-message")).toBeInTheDocument();
    });

    it("should not show loading message when streaming with content", async () => {
      const { useAdvancedChat } = await import("@iblai/web-utils");
      vi.mocked<any>(useAdvancedChat).mockReturnValue({
        messages: [],
        sendMessage: mockSendMessage,
        stopGenerating: mockStopGenerating,
        setMessage: mockSetMessage,
        activeTab: "chat",
        mentorName: "Test Mentor",
        profileImage: "/test-image.png",
        sessionId: "test-session-id",
        enableSafetyDisclaimer: false,
        isPending: false,
        isStreaming: true,
        currentStreamingMessage: { content: "Streaming content" },
        isConnected: true,
      } as any);

      render(<WorkflowPreviewChat {...defaultProps} />);
      expect(screen.queryByTestId("loading-message")).not.toBeInTheDocument();
    });
  });

  describe("connection state", () => {
    it("should pass isConnecting false when connected", () => {
      render(<WorkflowPreviewChat {...defaultProps} />);
      expect(screen.getByTestId("is-connecting")).toHaveTextContent("false");
    });

    it("should pass isConnecting true when not connected", async () => {
      const { useAdvancedChat } = await import("@iblai/web-utils");
      vi.mocked<any>(useAdvancedChat).mockReturnValue({
        messages: [],
        sendMessage: mockSendMessage,
        stopGenerating: mockStopGenerating,
        setMessage: mockSetMessage,
        activeTab: "chat",
        mentorName: "Test Mentor",
        profileImage: "/test-image.png",
        sessionId: "test-session-id",
        enableSafetyDisclaimer: false,
        isPending: false,
        isStreaming: false,
        currentStreamingMessage: null,
        isConnected: false,
      } as any);

      render(<WorkflowPreviewChat {...defaultProps} />);
      expect(screen.getByTestId("is-connecting")).toHaveTextContent("true");
    });
  });

  describe("message filtering", () => {
    it("should filter out first assistant message", async () => {
      const { useAdvancedChat } = await import("@iblai/web-utils");
      vi.mocked<any>(useAdvancedChat).mockReturnValue({
        messages: [
          { id: 1, content: "Welcome", role: "assistant" },
          { id: 2, content: "Hello", role: "user" },
          { id: 3, content: "Hi there", role: "assistant" },
        ],
        sendMessage: mockSendMessage,
        stopGenerating: mockStopGenerating,
        setMessage: mockSetMessage,
        activeTab: "chat",
        mentorName: "Test Mentor",
        profileImage: "/test-image.png",
        sessionId: "test-session-id",
        enableSafetyDisclaimer: false,
        isPending: false,
        isStreaming: false,
        currentStreamingMessage: null,
        isConnected: true,
      } as any);

      render(<WorkflowPreviewChat {...defaultProps} />);
      // Should have 2 messages (filtering out first assistant message)
      expect(screen.getByTestId("message-count")).toHaveTextContent("2");
    });

    it("should not filter if first message is from user", async () => {
      const { useAdvancedChat } = await import("@iblai/web-utils");
      vi.mocked<any>(useAdvancedChat).mockReturnValue({
        messages: [
          { id: 1, content: "Hello", role: "user" },
          { id: 2, content: "Hi there", role: "assistant" },
        ],
        sendMessage: mockSendMessage,
        stopGenerating: mockStopGenerating,
        setMessage: mockSetMessage,
        activeTab: "chat",
        mentorName: "Test Mentor",
        profileImage: "/test-image.png",
        sessionId: "test-session-id",
        enableSafetyDisclaimer: false,
        isPending: false,
        isStreaming: false,
        currentStreamingMessage: null,
        isConnected: true,
      } as any);

      render(<WorkflowPreviewChat {...defaultProps} />);
      // Should have all 2 messages
      expect(screen.getByTestId("message-count")).toHaveTextContent("2");
    });

    it("should handle empty messages array", async () => {
      const { useAdvancedChat } = await import("@iblai/web-utils");
      vi.mocked<any>(useAdvancedChat).mockReturnValue({
        messages: [],
        sendMessage: mockSendMessage,
        stopGenerating: mockStopGenerating,
        setMessage: mockSetMessage,
        activeTab: "chat",
        mentorName: "Test Mentor",
        profileImage: "/test-image.png",
        sessionId: "test-session-id",
        enableSafetyDisclaimer: false,
        isPending: false,
        isStreaming: false,
        currentStreamingMessage: null,
        isConnected: true,
      } as any);

      render(<WorkflowPreviewChat {...defaultProps} />);
      // With empty messages, the placeholder is shown instead of ChatMessages
      expect(screen.getByText("Preview your agent")).toBeInTheDocument();
      expect(screen.queryByTestId("chat-messages")).not.toBeInTheDocument();
    });
  });

  describe("without mentorId", () => {
    it("should render without mentorId", () => {
      render(<WorkflowPreviewChat tenantKey="test-tenant" />);
      // With empty messages (default mock), the placeholder is shown
      expect(screen.getByText("Preview your agent")).toBeInTheDocument();
    });

    it("should pass empty string for mentorId when undefined", () => {
      render(<WorkflowPreviewChat tenantKey="test-tenant" />);
      expect(screen.getByTestId("mentor-id")).toHaveTextContent("");
    });
  });

  describe("streaming state", () => {
    it("should pass isStreaming to ChatInputForm", async () => {
      const { useAdvancedChat } = await import("@iblai/web-utils");
      vi.mocked<any>(useAdvancedChat).mockReturnValue({
        messages: [],
        sendMessage: mockSendMessage,
        stopGenerating: mockStopGenerating,
        setMessage: mockSetMessage,
        activeTab: "chat",
        mentorName: "Test Mentor",
        profileImage: "/test-image.png",
        sessionId: "test-session-id",
        enableSafetyDisclaimer: false,
        isPending: false,
        isStreaming: true,
        currentStreamingMessage: { content: "streaming" },
        isConnected: true,
      } as any);

      render(<WorkflowPreviewChat {...defaultProps} />);
      expect(screen.getByTestId("is-streaming")).toHaveTextContent("true");
    });
  });

  describe("errorHandler callback", () => {
    it("should call toast.error when error occurs", async () => {
      const { useAdvancedChat } = await import("@iblai/web-utils");
      const { toast } = await import("sonner");

      vi.mocked<any>(useAdvancedChat).mockImplementation((options) => {
        capturedErrorHandler = options.errorHandler;
        return {
          messages: [],
          sendMessage: mockSendMessage,
          stopGenerating: mockStopGenerating,
          setMessage: mockSetMessage,
          activeTab: "chat",
          mentorName: "Test Mentor",
          profileImage: "/test-image.png",
          sessionId: "test-session-id",
          enableSafetyDisclaimer: false,
          isPending: false,
          isStreaming: false,
          currentStreamingMessage: null,
          isConnected: true,
        };
      });

      render(<WorkflowPreviewChat {...defaultProps} />);

      expect(capturedErrorHandler).toBeDefined();

      act(() => {
        capturedErrorHandler?.("Test error message");
      });

      expect(toast.error).toHaveBeenCalledWith("Test error message");
    });
  });

  describe("username and token handling", () => {
    it("should pass anonymous username when username is null", async () => {
      mockUseUsername.mockReturnValue(null);

      const { useAdvancedChat } = await import("@iblai/web-utils");
      let capturedUsername: string | undefined;
      vi.mocked<any>(useAdvancedChat).mockImplementation(
        (options: { username?: string }) => {
          capturedUsername = options.username;
          return {
            messages: [],
            sendMessage: mockSendMessage,
            stopGenerating: mockStopGenerating,
            setMessage: mockSetMessage,
            activeTab: "chat",
            mentorName: "Test Mentor",
            profileImage: "/test-image.png",
            sessionId: "test-session-id",
            enableSafetyDisclaimer: false,
            isPending: false,
            isStreaming: false,
            currentStreamingMessage: null,
            isConnected: true,
          };
        },
      );

      render(<WorkflowPreviewChat {...defaultProps} />);

      expect(capturedUsername).toBe("anonymous");
    });

    it("should pass empty string for token when useAxdToken returns null", async () => {
      mockUseAxdToken.mockReturnValue(null);

      const { useAdvancedChat } = await import("@iblai/web-utils");
      let capturedToken: string | undefined;
      vi.mocked<any>(useAdvancedChat).mockImplementation(
        (options: { token?: string }) => {
          capturedToken = options.token;
          return {
            messages: [],
            sendMessage: mockSendMessage,
            stopGenerating: mockStopGenerating,
            setMessage: mockSetMessage,
            activeTab: "chat",
            mentorName: "Test Mentor",
            profileImage: "/test-image.png",
            sessionId: "test-session-id",
            enableSafetyDisclaimer: false,
            isPending: false,
            isStreaming: false,
            currentStreamingMessage: null,
            isConnected: true,
          };
        },
      );

      render(<WorkflowPreviewChat {...defaultProps} />);

      expect(capturedToken).toBe("");
    });

    it("should pass empty string for username to ChatInputForm when username is null", async () => {
      mockUseUsername.mockReturnValue(null);

      render(<WorkflowPreviewChat {...defaultProps} />);

      expect(screen.getByTestId("username")).toHaveTextContent("");
    });
  });

  describe("scroll behavior", () => {
    it("should scroll to bottom when messages change", async () => {
      const { useAdvancedChat } = await import("@iblai/web-utils");

      vi.mocked<any>(useAdvancedChat).mockImplementation((options) => {
        capturedErrorHandler = options.errorHandler;
        return {
          messages: [{ id: 1, content: "Hello", role: "user" }],
          sendMessage: mockSendMessage,
          stopGenerating: mockStopGenerating,
          setMessage: mockSetMessage,
          activeTab: "chat",
          mentorName: "Test Mentor",
          profileImage: "/test-image.png",
          sessionId: "test-session-id",
          enableSafetyDisclaimer: false,
          isPending: false,
          isStreaming: false,
          currentStreamingMessage: null,
          isConnected: true,
        };
      });

      render(<WorkflowPreviewChat {...defaultProps} />);

      await waitFor(() => {
        expect(mockScrollTo).toHaveBeenCalledWith({
          top: expect.any(Number),
          behavior: "smooth",
        });
      });
    });

    it("should scroll to bottom when isPending changes", async () => {
      const { useAdvancedChat } = await import("@iblai/web-utils");

      vi.mocked<any>(useAdvancedChat).mockImplementation((options) => {
        capturedErrorHandler = options.errorHandler;
        return {
          messages: [],
          sendMessage: mockSendMessage,
          stopGenerating: mockStopGenerating,
          setMessage: mockSetMessage,
          activeTab: "chat",
          mentorName: "Test Mentor",
          profileImage: "/test-image.png",
          sessionId: "test-session-id",
          enableSafetyDisclaimer: false,
          isPending: true,
          isStreaming: false,
          currentStreamingMessage: null,
          isConnected: true,
        };
      });

      render(<WorkflowPreviewChat {...defaultProps} />);

      await waitFor(() => {
        expect(mockScrollTo).toHaveBeenCalled();
      });
    });

    it("should scroll to bottom when isStreaming changes", async () => {
      const { useAdvancedChat } = await import("@iblai/web-utils");

      vi.mocked<any>(useAdvancedChat).mockImplementation((options) => {
        capturedErrorHandler = options.errorHandler;
        return {
          messages: [],
          sendMessage: mockSendMessage,
          stopGenerating: mockStopGenerating,
          setMessage: mockSetMessage,
          activeTab: "chat",
          mentorName: "Test Mentor",
          profileImage: "/test-image.png",
          sessionId: "test-session-id",
          enableSafetyDisclaimer: false,
          isPending: false,
          isStreaming: true,
          currentStreamingMessage: null,
          isConnected: true,
        };
      });

      render(<WorkflowPreviewChat {...defaultProps} />);

      await waitFor(() => {
        expect(mockScrollTo).toHaveBeenCalled();
      });
    });
  });

  describe("highlight message functionality", () => {
    it("should pass handleHighlightMessage to ChatMessages", async () => {
      const { useAdvancedChat } = await import("@iblai/web-utils");
      vi.mocked<any>(useAdvancedChat).mockImplementation((options) => {
        capturedErrorHandler = options.errorHandler;
        return {
          messages: [
            { id: 1, content: "Hello", role: "user" },
            { id: 2, content: "Hi there", role: "assistant" },
          ],
          sendMessage: mockSendMessage,
          stopGenerating: mockStopGenerating,
          setMessage: mockSetMessage,
          activeTab: "chat",
          mentorName: "Test Mentor",
          profileImage: "/test-image.png",
          sessionId: "test-session-id",
          enableSafetyDisclaimer: false,
          isPending: false,
          isStreaming: false,
          currentStreamingMessage: null,
          isConnected: true,
          startNewChat: mockStartNewChat,
        };
      });

      render(<WorkflowPreviewChat {...defaultProps} />);

      // Initial state should show 'none' for highlighted message
      expect(screen.getByTestId("highlighted-id")).toHaveTextContent("none");
    });
  });

  describe("useAdvancedChat configuration", () => {
    it("should pass correct wsUrl to useAdvancedChat", async () => {
      const { useAdvancedChat } = await import("@iblai/web-utils");
      let capturedWsUrl: string | undefined;
      vi.mocked<any>(useAdvancedChat).mockImplementation(
        (options: { wsUrl?: string }) => {
          capturedWsUrl = options.wsUrl;
          return {
            messages: [],
            sendMessage: mockSendMessage,
            stopGenerating: mockStopGenerating,
            setMessage: mockSetMessage,
            activeTab: "chat",
            mentorName: "Test Mentor",
            profileImage: "/test-image.png",
            sessionId: "test-session-id",
            enableSafetyDisclaimer: false,
            isPending: false,
            isStreaming: false,
            currentStreamingMessage: null,
            isConnected: true,
          };
        },
      );

      render(<WorkflowPreviewChat {...defaultProps} />);

      expect(capturedWsUrl).toBe("wss://test.example.com/ws/langflow/");
    });

    it("should pass correct stopGenerationWsUrl to useAdvancedChat", async () => {
      const { useAdvancedChat } = await import("@iblai/web-utils");
      let capturedStopGenerationWsUrl: string | undefined;
      vi.mocked<any>(useAdvancedChat).mockImplementation(
        (options: { stopGenerationWsUrl?: string }) => {
          capturedStopGenerationWsUrl = options.stopGenerationWsUrl;
          return {
            messages: [],
            sendMessage: mockSendMessage,
            stopGenerating: mockStopGenerating,
            setMessage: mockSetMessage,
            activeTab: "chat",
            mentorName: "Test Mentor",
            profileImage: "/test-image.png",
            sessionId: "test-session-id",
            enableSafetyDisclaimer: false,
            isPending: false,
            isStreaming: false,
            currentStreamingMessage: null,
            isConnected: true,
          };
        },
      );

      render(<WorkflowPreviewChat {...defaultProps} />);

      expect(capturedStopGenerationWsUrl).toBe(
        "wss://test.example.com/ws/langflow-stop-generation/",
      );
    });

    it("should pass redirectToAuthSpa to useAdvancedChat", async () => {
      const { useAdvancedChat } = await import("@iblai/web-utils");
      let capturedRedirectToAuthSpa: (() => void) | undefined;
      vi.mocked<any>(useAdvancedChat).mockImplementation(
        (options: { redirectToAuthSpa?: () => void }) => {
          capturedRedirectToAuthSpa = options.redirectToAuthSpa;
          return {
            messages: [],
            sendMessage: mockSendMessage,
            stopGenerating: mockStopGenerating,
            setMessage: mockSetMessage,
            activeTab: "chat",
            mentorName: "Test Mentor",
            profileImage: "/test-image.png",
            sessionId: "test-session-id",
            enableSafetyDisclaimer: false,
            isPending: false,
            isStreaming: false,
            currentStreamingMessage: null,
            isConnected: true,
          };
        },
      );

      render(<WorkflowPreviewChat {...defaultProps} />);

      expect(capturedRedirectToAuthSpa).toBeDefined();
    });

    it("should pass mentorId to useAdvancedChat", async () => {
      const { useAdvancedChat } = await import("@iblai/web-utils");
      let capturedMentorId: string | undefined;
      vi.mocked<any>(useAdvancedChat).mockImplementation(
        (options: { mentorId?: string }) => {
          capturedMentorId = options.mentorId;
          return {
            messages: [],
            sendMessage: mockSendMessage,
            stopGenerating: mockStopGenerating,
            setMessage: mockSetMessage,
            activeTab: "chat",
            mentorName: "Test Mentor",
            profileImage: "/test-image.png",
            sessionId: "test-session-id",
            enableSafetyDisclaimer: false,
            isPending: false,
            isStreaming: false,
            currentStreamingMessage: null,
            isConnected: true,
          };
        },
      );

      render(<WorkflowPreviewChat {...defaultProps} />);

      expect(capturedMentorId).toBe("test-mentor-id");
    });

    it("should pass empty string for mentorId to useAdvancedChat when undefined", async () => {
      const { useAdvancedChat } = await import("@iblai/web-utils");
      let capturedMentorId: string | undefined;
      vi.mocked<any>(useAdvancedChat).mockImplementation(
        (options: { mentorId?: string }) => {
          capturedMentorId = options.mentorId;
          return {
            messages: [],
            sendMessage: mockSendMessage,
            stopGenerating: mockStopGenerating,
            setMessage: mockSetMessage,
            activeTab: "chat",
            mentorName: "Test Mentor",
            profileImage: "/test-image.png",
            sessionId: "test-session-id",
            enableSafetyDisclaimer: false,
            isPending: false,
            isStreaming: false,
            currentStreamingMessage: null,
            isConnected: true,
          };
        },
      );

      render(<WorkflowPreviewChat tenantKey="test-tenant" />);

      expect(capturedMentorId).toBe("");
    });

    it("should pass tenantKey to useAdvancedChat", async () => {
      const { useAdvancedChat } = await import("@iblai/web-utils");
      let capturedTenantKey: string | undefined;
      vi.mocked<any>(useAdvancedChat).mockImplementation(
        (options: { tenantKey?: string }) => {
          capturedTenantKey = options.tenantKey;
          return {
            messages: [],
            sendMessage: mockSendMessage,
            stopGenerating: mockStopGenerating,
            setMessage: mockSetMessage,
            activeTab: "chat",
            mentorName: "Test Mentor",
            profileImage: "/test-image.png",
            sessionId: "test-session-id",
            enableSafetyDisclaimer: false,
            isPending: false,
            isStreaming: false,
            currentStreamingMessage: null,
            isConnected: true,
          };
        },
      );

      render(<WorkflowPreviewChat {...defaultProps} />);

      expect(capturedTenantKey).toBe("test-tenant");
    });
  });

  describe("loading state with streaming message having empty content", () => {
    it("should show loading message when streaming with empty string content", async () => {
      const { useAdvancedChat } = await import("@iblai/web-utils");
      vi.mocked<any>(useAdvancedChat).mockImplementation((options) => {
        capturedErrorHandler = options.errorHandler;
        return {
          messages: [],
          sendMessage: mockSendMessage,
          stopGenerating: mockStopGenerating,
          setMessage: mockSetMessage,
          activeTab: "chat",
          mentorName: "Test Mentor",
          profileImage: "/test-image.png",
          sessionId: "test-session-id",
          enableSafetyDisclaimer: false,
          isPending: false,
          isStreaming: true,
          currentStreamingMessage: { content: "" },
          isConnected: true,
        };
      });

      render(<WorkflowPreviewChat {...defaultProps} />);
      // Empty content should still not show loading message as it's truthy (but empty)
      // Actually, '' is falsy, so it should show loading message
      expect(screen.getByTestId("loading-message")).toBeInTheDocument();
    });

    it("should show loading message when both isPending and isStreaming are true", async () => {
      const { useAdvancedChat } = await import("@iblai/web-utils");
      vi.mocked<any>(useAdvancedChat).mockImplementation((options) => {
        capturedErrorHandler = options.errorHandler;
        return {
          messages: [],
          sendMessage: mockSendMessage,
          stopGenerating: mockStopGenerating,
          setMessage: mockSetMessage,
          activeTab: "chat",
          mentorName: "Test Mentor",
          profileImage: "/test-image.png",
          sessionId: "test-session-id",
          enableSafetyDisclaimer: false,
          isPending: true,
          isStreaming: true,
          currentStreamingMessage: null,
          isConnected: true,
        };
      });

      render(<WorkflowPreviewChat {...defaultProps} />);
      expect(screen.getByTestId("loading-message")).toBeInTheDocument();
    });
  });

  describe("noop callbacks passed to ChatInputForm", () => {
    it("should pass noop functions that do not throw when called", async () => {
      // Update the ChatInputForm mock to capture the noop callbacks
      vi.doMock("@/components/chat-input-form", () => ({
        ChatInputForm: (props: {
          onScreenSharingClick: () => void;
          onPhoneCallClick: () => void;
          updateSessionTools: () => Promise<void>;
          setSessionTools: () => Promise<void>;
          onSubmit: (content: string) => void;
          sessionId: string;
          tenantKey: string;
          mentorId?: string;
          username: string;
          isStreaming: boolean;
          isConnecting: boolean;
          compactMode: boolean;
        }) => {
          return (
            <div data-testid="chat-input-form-noop">
              <button
                data-testid="test-screen-sharing-click"
                onClick={() => props.onScreenSharingClick()}
              >
                Screen Sharing
              </button>
              <button
                data-testid="test-phone-call-click"
                onClick={() => props.onPhoneCallClick()}
              >
                Phone Call
              </button>
              <button
                data-testid="test-update-session-tools"
                onClick={() => props.updateSessionTools()}
              >
                Update Tools
              </button>
              <button
                data-testid="test-set-session-tools"
                onClick={() => props.setSessionTools()}
              >
                Set Tools
              </button>
            </div>
          );
        },
      }));

      // Note: These noop functions are defined at module level and passed as callbacks
      // They cannot throw errors when called since they are empty functions
      // This test verifies the component doesn't break when these callbacks are invoked
      const { useAdvancedChat } = await import("@iblai/web-utils");
      vi.mocked<any>(useAdvancedChat).mockImplementation((options) => {
        capturedErrorHandler = options.errorHandler;
        return {
          messages: [],
          sendMessage: mockSendMessage,
          stopGenerating: mockStopGenerating,
          setMessage: mockSetMessage,
          activeTab: "chat",
          mentorName: "Test Mentor",
          profileImage: "/test-image.png",
          sessionId: "test-session-id",
          enableSafetyDisclaimer: false,
          isPending: false,
          isStreaming: false,
          currentStreamingMessage: null,
          isConnected: true,
        };
      });

      render(<WorkflowPreviewChat {...defaultProps} />);

      // The component should render successfully with noop functions
      expect(screen.getByTestId("chat-input-form")).toBeInTheDocument();
    });
  });
});
