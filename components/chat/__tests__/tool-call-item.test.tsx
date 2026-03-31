import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ToolCallInfo } from "@iblai/iblai-js/web-utils";

vi.mock("@iblai/iblai-js/web-utils", async () => {
  const actual = await vi.importActual("@iblai/iblai-js/web-utils");
  return {
    ...actual,
    TOOL_NAME_MAP: {
      web_search_call: "Searching the web",
      vector_search: "Searching knowledge base",
    },
  };
});

vi.mock("@/lib/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/utils")>();
  return {
    ...actual,
    cn: (...args: (string | undefined | boolean)[]) =>
      args.filter(Boolean).join(" "),
  };
});

import { ToolCallItem } from "../tool-call-item";

function makeToolCall(overrides: Partial<ToolCallInfo> = {}): ToolCallInfo {
  return {
    id: "call_1",
    name: "web_search_call",
    log: "",
    result: "",
    ...overrides,
  };
}

describe("ToolCallItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("simple pill (no details)", () => {
    it("renders friendly tool name", () => {
      render(
        <ToolCallItem
          toolCall={makeToolCall()}
          shouldPulse={false}
          isCurrentlyStreaming={false}
        />,
      );
      expect(screen.getByText("Searching the web")).toBeInTheDocument();
    });

    it("renders title-cased fallback for unknown tools", () => {
      render(
        <ToolCallItem
          toolCall={makeToolCall({ name: "custom_tool" })}
          shouldPulse={false}
          isCurrentlyStreaming={false}
        />,
      );
      expect(screen.getByText("Custom tool")).toBeInTheDocument();
    });

    it("shows pulse indicator when shouldPulse is true", () => {
      const { container } = render(
        <ToolCallItem
          toolCall={makeToolCall()}
          shouldPulse={true}
          isCurrentlyStreaming={true}
        />,
      );
      expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
    });

    it("hides pulse indicator when shouldPulse is false", () => {
      const { container } = render(
        <ToolCallItem
          toolCall={makeToolCall()}
          shouldPulse={false}
          isCurrentlyStreaming={false}
        />,
      );
      expect(container.querySelector(".animate-pulse")).not.toBeInTheDocument();
    });
  });

  describe("collapsible pill (with details)", () => {
    it("renders as collapsible when query is available", () => {
      render(
        <ToolCallItem
          toolCall={makeToolCall({ input: { query: "F1 race" } })}
          shouldPulse={false}
          isCurrentlyStreaming={false}
        />,
      );
      expect(screen.getByText("Searching the web")).toBeInTheDocument();
      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("renders title-cased fallback for unknown tools with details", () => {
      render(
        <ToolCallItem
          toolCall={makeToolCall({
            name: "deep_research_call",
            input: { query: "AI trends" },
          })}
          shouldPulse={false}
          isCurrentlyStreaming={false}
        />,
      );
      expect(screen.getByText("Deep research call")).toBeInTheDocument();
    });

    it("shows query preview in trigger when collapsed", () => {
      render(
        <ToolCallItem
          toolCall={makeToolCall({ input: { query: "next race" } })}
          shouldPulse={false}
          isCurrentlyStreaming={false}
        />,
      );
      expect(screen.getByText(/— next race/)).toBeInTheDocument();
    });

    it("shows query detail when expanded", () => {
      render(
        <ToolCallItem
          toolCall={makeToolCall({ input: { query: "next race" } })}
          shouldPulse={false}
          isCurrentlyStreaming={true}
        />,
      );
      // Starts open during streaming
      expect(screen.getByText("Query")).toBeInTheDocument();
      expect(screen.getByText("next race")).toBeInTheDocument();
    });

    it("shows result section when result is available", () => {
      render(
        <ToolCallItem
          toolCall={makeToolCall({
            input: { query: "test" },
            result: "The answer is 42",
          })}
          shouldPulse={false}
          isCurrentlyStreaming={true}
        />,
      );
      expect(screen.getByText("Result")).toBeInTheDocument();
      expect(screen.getByText("The answer is 42")).toBeInTheDocument();
    });

    it("does not show result section when result is empty", () => {
      render(
        <ToolCallItem
          toolCall={makeToolCall({ input: { query: "test" }, result: "" })}
          shouldPulse={false}
          isCurrentlyStreaming={true}
        />,
      );
      expect(screen.queryByText("Result")).not.toBeInTheDocument();
    });

    it("formats result by collapsing excessive newlines", () => {
      render(
        <ToolCallItem
          toolCall={makeToolCall({
            input: { query: "test" },
            result: "line1\n\n\n\nline2",
          })}
          shouldPulse={false}
          isCurrentlyStreaming={true}
        />,
      );
      const resultEl = screen.getByText(/line1/);
      expect(resultEl.textContent).toBe("line1\n\nline2");
    });

    it("hides query preview when expanded", () => {
      render(
        <ToolCallItem
          toolCall={makeToolCall({ input: { query: "my query" } })}
          shouldPulse={false}
          isCurrentlyStreaming={true}
        />,
      );
      // When open, the "— my query" preview should not be in the trigger
      expect(screen.queryByText(/— my query/)).not.toBeInTheDocument();
    });

    it("toggles open/closed on trigger click", () => {
      render(
        <ToolCallItem
          toolCall={makeToolCall({ input: { query: "test query" } })}
          shouldPulse={false}
          isCurrentlyStreaming={false}
        />,
      );
      // Starts closed (not streaming)
      expect(screen.getByText(/— test query/)).toBeInTheDocument();

      // Click to open
      fireEvent.click(screen.getByRole("button"));
      expect(screen.getByText("Query")).toBeInTheDocument();

      // Click to close
      fireEvent.click(screen.getByRole("button"));
      expect(screen.getByText(/— test query/)).toBeInTheDocument();
    });

    it("shows pulse indicator in collapsible trigger", () => {
      const { container } = render(
        <ToolCallItem
          toolCall={makeToolCall({ input: { query: "test" } })}
          shouldPulse={true}
          isCurrentlyStreaming={true}
        />,
      );
      expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
    });
  });

  describe("auto-collapse behavior", () => {
    it("starts open when streaming", () => {
      render(
        <ToolCallItem
          toolCall={makeToolCall({ input: { query: "test" } })}
          shouldPulse={true}
          isCurrentlyStreaming={true}
        />,
      );
      expect(screen.getByText("Query")).toBeInTheDocument();
    });

    it("starts closed when not streaming", () => {
      render(
        <ToolCallItem
          toolCall={makeToolCall({ input: { query: "test" } })}
          shouldPulse={false}
          isCurrentlyStreaming={false}
        />,
      );
      // Should show preview (collapsed state)
      expect(screen.getByText(/— test/)).toBeInTheDocument();
    });

    it("auto-collapses when streaming ends", () => {
      const { rerender } = render(
        <ToolCallItem
          toolCall={makeToolCall({ input: { query: "test" } })}
          shouldPulse={true}
          isCurrentlyStreaming={true}
        />,
      );
      // Starts open
      expect(screen.getByText("Query")).toBeInTheDocument();

      // Streaming ends
      rerender(
        <ToolCallItem
          toolCall={makeToolCall({ input: { query: "test" } })}
          shouldPulse={false}
          isCurrentlyStreaming={false}
        />,
      );
      // Should collapse — preview visible again
      expect(screen.getByText(/— test/)).toBeInTheDocument();
    });
  });

  describe("renders with result-only details", () => {
    it("shows collapsible when only result is present (no query)", () => {
      render(
        <ToolCallItem
          toolCall={makeToolCall({ result: "Some result text" })}
          shouldPulse={false}
          isCurrentlyStreaming={true}
        />,
      );
      // Should be collapsible (has details), trigger should be a button
      expect(screen.getByRole("button")).toBeInTheDocument();
      expect(screen.getByText("Searching the web")).toBeInTheDocument();
    });
  });
});
