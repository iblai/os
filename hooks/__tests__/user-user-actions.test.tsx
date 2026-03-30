import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useShowFreeTrialDialog } from "../user-user-actions";

// Mock dependencies
const mockDispatch = vi.fn();

let mockSubscriptionState = {
  creditExhausted: false,
  callToAction: null as string | null,
};

vi.mock("@/lib/hooks", () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: vi.fn((selector) => {
    const mockState = {
      subscription: {
        subscriptionStatus: mockSubscriptionState,
      },
      topBanner: {
        topBannerOptions: {},
      },
    };
    return selector(mockState);
  }),
}));

let mockIsAppleDevice = false;
vi.mock("@/hooks/use-os", () => ({
  useOS: vi.fn(() => ({ isAppleDevice: mockIsAppleDevice })),
}));

vi.mock("@/features/subscription/subscription-slice", () => ({
  setOpenAppleRestrictionModal: vi.fn((val: boolean) => ({
    type: "subscription/setOpenAppleRestrictionModal",
    payload: val,
  })),
}));

vi.mock("@/hooks/use-user", () => ({
  useCurrentTenant: () => ({
    currentTenant: {
      key: "test-tenant",
      org: "test-org",
      is_admin: true,
      is_advertising: false,
    },
  }),
  useUserTenants: () => ({
    userTenants: [{ key: "test-tenant" }],
  }),
}));

vi.mock("@/lib/config", () => ({
  config: {
    iblPlatform: () => "test-platform",
    mainTenantKey: () => "main",
    mentorUrl: () => "https://mentor.test.com",
  },
}));

vi.mock("@/features/utils", () => ({
  getUserEmail: () => "test@example.com",
  getUserName: () => "testuser",
}));

vi.mock("@/hooks/subscription/subscription-flow-v2", () => ({
  MentorSubscriptionFlowV2: vi.fn().mockImplementation(() => ({})),
}));

vi.mock("@iblai/iblai-js/web-utils", () => ({
  SUBSCRIPTION_V2_TRIGGERS: {
    PRICING_MODAL: "PRICING_MODAL",
  },
  useSubscriptionHandlerV2: () => ({
    bannerButtonTriggerCallback: vi.fn(() => vi.fn()),
  }),
}));

vi.mock("@/components/free-trial-dialog", () => ({
  FreeTrialDialog: () => null,
}));

describe("useShowFreeTrialDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAppleDevice = false;
    mockSubscriptionState = { creditExhausted: false, callToAction: null };
  });

  describe("initial state", () => {
    it("should return initial state with isModalOpen false", () => {
      const { result } = renderHook(() => useShowFreeTrialDialog());

      expect(result.current.isModalOpen).toBe(false);
      expect(typeof result.current.executeWithTrialCheck).toBe("function");
      expect(typeof result.current.closeModal).toBe("function");
    });

    it("should return FreeTrialDialog component when enableFallbackModal is true", () => {
      const { result } = renderHook(() =>
        useShowFreeTrialDialog({
          modalComponent: null,
          enableFallbackModal: true,
        }),
      );

      expect(result.current.FreeTrialDialog).not.toBeNull();
    });

    it("should return null for FreeTrialDialog when enableFallbackModal is false", () => {
      const { result } = renderHook(() =>
        useShowFreeTrialDialog({
          modalComponent: null,
          enableFallbackModal: false,
        }),
      );

      expect(result.current.FreeTrialDialog).toBeNull();
    });

    it("should use custom modal component when provided", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const CustomModal = (() => <div>Custom Modal</div>) as any;
      const { result } = renderHook(() =>
        useShowFreeTrialDialog({
          modalComponent: CustomModal,
          enableFallbackModal: true,
        }),
      );

      expect(result.current.FreeTrialDialog).toBe(CustomModal);
    });
  });

  describe("closeModal", () => {
    it("should close modal when closeModal is called", () => {
      const { result } = renderHook(() => useShowFreeTrialDialog());

      // Initially modal is closed
      expect(result.current.isModalOpen).toBe(false);

      // Call closeModal to ensure it works (even when already closed)
      act(() => {
        result.current.closeModal();
      });

      expect(result.current.isModalOpen).toBe(false);
    });
  });

  describe("executeWithTrialCheck", () => {
    it("should execute action function when user is admin", () => {
      const { result } = renderHook(() => useShowFreeTrialDialog());
      const mockAction = vi.fn().mockReturnValue("action-result");

      let actionResult;
      act(() => {
        actionResult = result.current.executeWithTrialCheck(mockAction);
      });

      expect(mockAction).toHaveBeenCalled();
      expect(actionResult).toBe("action-result");
    });

    it("should execute action when isAdminAction is false", () => {
      const { result } = renderHook(() => useShowFreeTrialDialog());
      const mockAction = vi.fn().mockReturnValue("result");

      let actionResult;
      act(() => {
        actionResult = result.current.executeWithTrialCheck(mockAction, false);
      });

      expect(mockAction).toHaveBeenCalled();
      expect(actionResult).toBe("result");
    });

    it("should dispatch setOpenAppleRestrictionModal and return null on Apple device when credit exhausted", () => {
      mockIsAppleDevice = true;
      mockSubscriptionState = {
        creditExhausted: true,
        callToAction: "PRICING_MODAL",
      };
      const { result } = renderHook(() => useShowFreeTrialDialog());
      const mockAction = vi.fn();

      let actionResult: unknown;
      act(() => {
        actionResult = result.current.executeWithTrialCheck(mockAction);
      });

      expect(mockAction).not.toHaveBeenCalled();
      expect(actionResult).toBeNull();
      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "subscription/setOpenAppleRestrictionModal",
          payload: true,
        }),
      );
    });

    it("should not dispatch Apple modal and run action normally when not Apple device", () => {
      mockIsAppleDevice = false;
      mockSubscriptionState = { creditExhausted: false, callToAction: null };
      const { result } = renderHook(() => useShowFreeTrialDialog());
      const mockAction = vi.fn().mockReturnValue("done");

      let actionResult: unknown;
      act(() => {
        actionResult = result.current.executeWithTrialCheck(mockAction);
      });

      expect(mockAction).toHaveBeenCalled();
      expect(actionResult).toBe("done");
      expect(mockDispatch).not.toHaveBeenCalledWith(
        expect.objectContaining({
          type: "subscription/setOpenAppleRestrictionModal",
        }),
      );
    });
  });
});
