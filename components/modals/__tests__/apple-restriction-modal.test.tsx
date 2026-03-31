import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AppleRestrictionModal } from "../apple-restriction-modal";

describe("AppleRestrictionModal", () => {
  const onClose = vi.fn();

  const renderModal = (isOpen = true) =>
    render(<AppleRestrictionModal isOpen={isOpen} onClose={onClose} />);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("when open", () => {
    it("renders the dialog", () => {
      renderModal();
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("renders the headline", () => {
      renderModal();
      expect(screen.getByText("You can't subscribe here")).toBeInTheDocument();
    });

    it("renders the Apple guidelines explanation", () => {
      renderModal();
      expect(screen.getByText(/Apple guidelines/i)).toBeInTheDocument();
    });

    it("renders a link to ibl.ai/pricing", () => {
      renderModal();
      const link = screen.getByRole("link", { name: /ibl\.ai\/pricing/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", "https://www.ibl.ai/pricing");
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    });

    it('renders the "Not now" dismiss button', () => {
      renderModal();
      expect(
        screen.getByRole("button", { name: /not now/i }),
      ).toBeInTheDocument();
    });

    it("does not render a close (X) button", () => {
      renderModal();
      expect(
        screen.queryByRole("button", { name: /close/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe("interactions", () => {
    it('calls onClose when "Not now" is clicked', () => {
      renderModal();
      fireEvent.click(screen.getByRole("button", { name: /not now/i }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("calls onClose when dialog is dismissed via Escape key", () => {
      renderModal();
      fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe("when closed", () => {
    it("does not render the dialog", () => {
      renderModal(false);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});
