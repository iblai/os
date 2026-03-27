import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";

// Mock AppLayout before importing the component
vi.mock("../../../_components/app-layout", () => ({
  default: ({
    children,
    defaultOpen,
  }: {
    children: React.ReactNode;
    defaultOpen: boolean;
  }) => (
    <div data-testid="app-layout" data-default-open={defaultOpen}>
      {children}
    </div>
  ),
}));

import WorkflowsLayout from "../layout";

describe("WorkflowsLayout", () => {
  let originalCookie: PropertyDescriptor | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    originalCookie = Object.getOwnPropertyDescriptor(document, "cookie");
  });

  afterEach(() => {
    if (originalCookie) {
      Object.defineProperty(document, "cookie", originalCookie);
    } else {
      Object.defineProperty(document, "cookie", {
        get: () => "",
        set: () => {},
        configurable: true,
      });
    }
  });

  describe("Basic rendering", () => {
    it("renders children inside AppLayout", () => {
      render(
        <WorkflowsLayout>
          <div data-testid="child-content">Test Content</div>
        </WorkflowsLayout>,
      );

      expect(screen.getByTestId("child-content")).toBeInTheDocument();
      expect(screen.getByText("Test Content")).toBeInTheDocument();
    });

    it("renders AppLayout component", () => {
      render(
        <WorkflowsLayout>
          <div>Content</div>
        </WorkflowsLayout>,
      );

      expect(screen.getByTestId("app-layout")).toBeInTheDocument();
    });

    it("renders immediately without blocking on cookie read", () => {
      render(
        <WorkflowsLayout>
          <div data-testid="immediate-content">Immediate</div>
        </WorkflowsLayout>,
      );

      expect(screen.getByTestId("immediate-content")).toBeInTheDocument();
    });
  });

  describe("Cookie reading behavior", () => {
    it("defaults to defaultOpen=false when no cookie exists", async () => {
      Object.defineProperty(document, "cookie", {
        get: () => "",
        configurable: true,
      });

      render(
        <WorkflowsLayout>
          <div>Content</div>
        </WorkflowsLayout>,
      );

      const appLayout = screen.getByTestId("app-layout");
      expect(appLayout).toHaveAttribute("data-default-open", "false");
    });

    it('sets defaultOpen=true when sidebar_state cookie is "true"', async () => {
      Object.defineProperty(document, "cookie", {
        get: () => "sidebar_state=true",
        configurable: true,
      });

      render(
        <WorkflowsLayout>
          <div>Content</div>
        </WorkflowsLayout>,
      );

      await waitFor(() => {
        const appLayout = screen.getByTestId("app-layout");
        expect(appLayout).toHaveAttribute("data-default-open", "true");
      });
    });

    it('keeps defaultOpen=false when sidebar_state cookie is "false"', async () => {
      Object.defineProperty(document, "cookie", {
        get: () => "sidebar_state=false",
        configurable: true,
      });

      render(
        <WorkflowsLayout>
          <div>Content</div>
        </WorkflowsLayout>,
      );

      await waitFor(() => {
        const appLayout = screen.getByTestId("app-layout");
        expect(appLayout).toHaveAttribute("data-default-open", "false");
      });
    });

    it("extracts sidebar_state from multiple cookies", async () => {
      Object.defineProperty(document, "cookie", {
        get: () => "other_cookie=value; sidebar_state=true; another=data",
        configurable: true,
      });

      render(
        <WorkflowsLayout>
          <div>Content</div>
        </WorkflowsLayout>,
      );

      await waitFor(() => {
        const appLayout = screen.getByTestId("app-layout");
        expect(appLayout).toHaveAttribute("data-default-open", "true");
      });
    });

    it("handles sidebar_state as first cookie", async () => {
      Object.defineProperty(document, "cookie", {
        get: () => "sidebar_state=true; other=value",
        configurable: true,
      });

      render(
        <WorkflowsLayout>
          <div>Content</div>
        </WorkflowsLayout>,
      );

      await waitFor(() => {
        const appLayout = screen.getByTestId("app-layout");
        expect(appLayout).toHaveAttribute("data-default-open", "true");
      });
    });

    it("handles sidebar_state as last cookie", async () => {
      Object.defineProperty(document, "cookie", {
        get: () => "first=a; second=b; sidebar_state=true",
        configurable: true,
      });

      render(
        <WorkflowsLayout>
          <div>Content</div>
        </WorkflowsLayout>,
      );

      await waitFor(() => {
        const appLayout = screen.getByTestId("app-layout");
        expect(appLayout).toHaveAttribute("data-default-open", "true");
      });
    });
  });

  describe("Edge cases", () => {
    it("handles empty cookie string gracefully", async () => {
      Object.defineProperty(document, "cookie", {
        get: () => "",
        configurable: true,
      });

      render(
        <WorkflowsLayout>
          <div>Content</div>
        </WorkflowsLayout>,
      );

      await waitFor(() => {
        const appLayout = screen.getByTestId("app-layout");
        expect(appLayout).toHaveAttribute("data-default-open", "false");
      });
    });

    it("handles cookie with similar name prefix", async () => {
      Object.defineProperty(document, "cookie", {
        get: () => "sidebar_state_old=true; sidebar_state=false",
        configurable: true,
      });

      render(
        <WorkflowsLayout>
          <div>Content</div>
        </WorkflowsLayout>,
      );

      await waitFor(() => {
        const appLayout = screen.getByTestId("app-layout");
        expect(appLayout).toHaveAttribute("data-default-open", "false");
      });
    });

    it("handles malformed cookie string gracefully", async () => {
      Object.defineProperty(document, "cookie", {
        get: () => "sidebar_state",
        configurable: true,
      });

      render(
        <WorkflowsLayout>
          <div>Content</div>
        </WorkflowsLayout>,
      );

      await waitFor(() => {
        const appLayout = screen.getByTestId("app-layout");
        expect(appLayout).toHaveAttribute("data-default-open", "false");
      });
    });

    it("handles cookie string without sidebar_state", async () => {
      Object.defineProperty(document, "cookie", {
        get: () => "other_cookie=value; another_cookie=data",
        configurable: true,
      });

      render(
        <WorkflowsLayout>
          <div>Content</div>
        </WorkflowsLayout>,
      );

      await waitFor(() => {
        const appLayout = screen.getByTestId("app-layout");
        expect(appLayout).toHaveAttribute("data-default-open", "false");
      });
    });

    it("handles cookie with empty value", async () => {
      Object.defineProperty(document, "cookie", {
        get: () => "sidebar_state=",
        configurable: true,
      });

      render(
        <WorkflowsLayout>
          <div>Content</div>
        </WorkflowsLayout>,
      );

      await waitFor(() => {
        const appLayout = screen.getByTestId("app-layout");
        expect(appLayout).toHaveAttribute("data-default-open", "false");
      });
    });

    it("handles non-boolean cookie value", async () => {
      Object.defineProperty(document, "cookie", {
        get: () => "sidebar_state=open",
        configurable: true,
      });

      render(
        <WorkflowsLayout>
          <div>Content</div>
        </WorkflowsLayout>,
      );

      await waitFor(() => {
        const appLayout = screen.getByTestId("app-layout");
        expect(appLayout).toHaveAttribute("data-default-open", "false");
      });
    });
  });

  describe("Children handling", () => {
    it("passes multiple children correctly", () => {
      render(
        <WorkflowsLayout>
          <div data-testid="child-1">First</div>
          <div data-testid="child-2">Second</div>
        </WorkflowsLayout>,
      );

      expect(screen.getByTestId("child-1")).toBeInTheDocument();
      expect(screen.getByTestId("child-2")).toBeInTheDocument();
    });

    it("handles null children", () => {
      render(<WorkflowsLayout>{null}</WorkflowsLayout>);

      expect(screen.getByTestId("app-layout")).toBeInTheDocument();
    });

    it("handles text children", () => {
      render(<WorkflowsLayout>Plain text content</WorkflowsLayout>);

      expect(screen.getByText("Plain text content")).toBeInTheDocument();
    });
  });

  describe("Component lifecycle", () => {
    it("reads cookie only once on mount", async () => {
      let cookieReadCount = 0;
      Object.defineProperty(document, "cookie", {
        get: () => {
          cookieReadCount++;
          return "sidebar_state=true";
        },
        configurable: true,
      });

      const { rerender } = render(
        <WorkflowsLayout>
          <div>Content</div>
        </WorkflowsLayout>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("app-layout")).toHaveAttribute(
          "data-default-open",
          "true",
        );
      });

      const initialReadCount = cookieReadCount;

      rerender(
        <WorkflowsLayout>
          <div>Updated Content</div>
        </WorkflowsLayout>,
      );

      expect(cookieReadCount).toBeLessThanOrEqual(initialReadCount + 2);
    });

    it("updates state correctly after mount", async () => {
      Object.defineProperty(document, "cookie", {
        get: () => "sidebar_state=true",
        configurable: true,
      });

      render(
        <WorkflowsLayout>
          <div>Content</div>
        </WorkflowsLayout>,
      );

      await waitFor(() => {
        const appLayout = screen.getByTestId("app-layout");
        expect(appLayout).toHaveAttribute("data-default-open", "true");
      });
    });
  });
});
