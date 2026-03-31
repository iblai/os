import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
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

import { ToolCallIndicator } from "../tool-call-indicator";

function makeToolCall(overrides: Partial<ToolCallInfo> = {}): ToolCallInfo {
  return {
    id: "call_1",
    name: "web_search_call",
    log: "",
    result: "",
    ...overrides,
  };
}

describe("ToolCallIndicator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when toolCalls is empty", () => {
    const { container } = render(<ToolCallIndicator toolCalls={[]} />);
    expect(container.innerHTML).toBe("");
  });

  it("returns null when toolCalls is undefined", () => {
    const { container } = render(
      <ToolCallIndicator toolCalls={undefined as unknown as ToolCallInfo[]} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders a single tool call", () => {
    render(<ToolCallIndicator toolCalls={[makeToolCall()]} />);
    expect(screen.getByText("Searching the web")).toBeInTheDocument();
  });

  it("renders multiple tool calls", () => {
    render(
      <ToolCallIndicator
        toolCalls={[
          makeToolCall({ id: "1", name: "web_search_call" }),
          makeToolCall({ id: "2", name: "vector_search" }),
        ]}
      />,
    );
    expect(screen.getByText("Searching the web")).toBeInTheDocument();
    expect(screen.getByText("Searching knowledge base")).toBeInTheDocument();
  });

  it("only pulses the last tool call when streaming", () => {
    const { container } = render(
      <ToolCallIndicator
        toolCalls={[makeToolCall({ id: "1" }), makeToolCall({ id: "2" })]}
        isCurrentlyStreaming={true}
      />,
    );
    const pulses = container.querySelectorAll(".animate-pulse");
    expect(pulses).toHaveLength(1);
  });

  it("does not pulse any tool call when not streaming", () => {
    const { container } = render(
      <ToolCallIndicator
        toolCalls={[makeToolCall({ id: "1" }), makeToolCall({ id: "2" })]}
        isCurrentlyStreaming={false}
      />,
    );
    const pulses = container.querySelectorAll(".animate-pulse");
    expect(pulses).toHaveLength(0);
  });

  it("defaults isCurrentlyStreaming to false", () => {
    const { container } = render(
      <ToolCallIndicator toolCalls={[makeToolCall()]} />,
    );
    expect(container.querySelector(".animate-pulse")).not.toBeInTheDocument();
  });

  it("uses index as key when toolCall.id is empty", () => {
    // Should render without errors
    render(
      <ToolCallIndicator
        toolCalls={[
          makeToolCall({ id: "", name: "web_search_call" }),
          makeToolCall({ id: "", name: "vector_search" }),
        ]}
      />,
    );
    expect(screen.getByText("Searching the web")).toBeInTheDocument();
    expect(screen.getByText("Searching knowledge base")).toBeInTheDocument();
  });
});
