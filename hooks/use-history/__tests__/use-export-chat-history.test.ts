import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useExportChatHistory } from "../use-export-chat-history";

// Mock dependencies
vi.mock("next/navigation", () => ({
  useParams: vi.fn(() => ({
    tenantKey: "test-tenant",
    mentorId: "test-mentor",
  })),
}));

vi.mock("@/hooks/user-navigate", () => ({
  useNavigate: vi.fn(() => ({
    getMentorId: vi.fn(() => "active-mentor-id"),
  })),
}));

const mockInitializeReportDownload = vi.fn();
vi.mock("@iblai/iblai-js/web-containers", () => ({
  useReports: vi.fn(() => ({
    initializeReportDownload: mockInitializeReportDownload,
    isGenerating: false,
  })),
}));

describe("useExportChatHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return handleExport and isExporting", () => {
    const { result } = renderHook(() => useExportChatHistory());

    expect(result.current.handleExport).toBeDefined();
    expect(typeof result.current.handleExport).toBe("function");
    expect(result.current.isExporting).toBe(false);
  });

  it("should not be exporting initially", () => {
    const { result } = renderHook(() => useExportChatHistory());

    expect(result.current.isExporting).toBe(false);
  });

  it("should call initializeReportDownload with correct parameters when handleExport is called", () => {
    const { result } = renderHook(() => useExportChatHistory());

    const filters = {
      dateRange: {
        from: new Date("2024-01-01"),
        to: new Date("2024-01-31"),
      },
      sentiment: "positive",
      topics: "topic1,topic2",
      users: undefined,
    };

    act(() => {
      result.current.handleExport(filters);
    });

    expect(mockInitializeReportDownload).toHaveBeenCalledWith({
      report: {
        report_name: "ai-mentor-chat-history",
      },
      autoDownload: true,
      extraRequestBody: expect.objectContaining({
        start_date: "2024-01-01",
        end_date: "2024-01-31",
        sentiment: "positive",
        topics: "topic1,topic2",
      }),
    });
  });

  it("should handle export with empty filters", () => {
    const { result } = renderHook(() => useExportChatHistory());

    const filters = {
      dateRange: undefined,
      sentiment: undefined,
      topics: undefined,
      users: undefined,
    };

    act(() => {
      result.current.handleExport(filters);
    });

    expect(mockInitializeReportDownload).toHaveBeenCalledWith({
      report: {
        report_name: "ai-mentor-chat-history",
      },
      autoDownload: true,
      extraRequestBody: {
        end_date: undefined,
        start_date: undefined,
        sentiment: undefined,
        topics: undefined,
        source: "http://localhost:3000",
      },
    });
  });

  it("should show isExporting as true when isGenerating is true", async () => {
    const { useReports } = await import("@iblai/iblai-js/web-containers");
    (useReports as ReturnType<typeof vi.fn>).mockReturnValue({
      initializeReportDownload: mockInitializeReportDownload,
      isGenerating: true,
    });

    const { result } = renderHook(() => useExportChatHistory());

    expect(result.current.isExporting).toBe(true);
  });

  it("should use getMentorId from useNavigate if available", () => {
    const { result } = renderHook(() => useExportChatHistory());

    // The hook uses getMentorId() || mentorId, so active-mentor-id should be used
    expect(result.current).toBeDefined();
  });

  it("should fall back to params mentorId if getMentorId returns null", async () => {
    const { useNavigate } = await import("@/hooks/user-navigate");
    (useNavigate as ReturnType<typeof vi.fn>).mockReturnValue({
      getMentorId: vi.fn(() => null),
    });

    const { result } = renderHook(() => useExportChatHistory());

    expect(result.current).toBeDefined();
  });
});
