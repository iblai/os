import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";

import Loading from "../loading";

describe("Loading", () => {
  it("renders without crashing", () => {
    const { container } = render(<Loading />);
    expect(container).toBeInTheDocument();
  });

  it("returns null (no visible content)", () => {
    const { container } = render(<Loading />);
    expect(container.firstChild).toBeNull();
  });

  it("does not render any DOM elements", () => {
    const { container } = render(<Loading />);
    expect(container.innerHTML).toBe("");
  });
});
