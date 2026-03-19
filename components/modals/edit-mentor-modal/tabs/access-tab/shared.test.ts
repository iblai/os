import { describe, it, expect } from "vitest";
import {
  formatRoleName,
  getErrorMessage,
  roleDescriptions,
  DEFAULT_MENTOR_ROLES,
} from "./shared";

describe("shared access-tab utilities", () => {
  describe("formatRoleName", () => {
    it("should capitalize a simple role name", () => {
      expect(formatRoleName("editor")).toBe("Editor");
    });

    it("should handle underscores in role names", () => {
      expect(formatRoleName("super_admin")).toBe("Super Admin");
    });

    it("should handle hyphens in role names", () => {
      expect(formatRoleName("content-editor")).toBe("Content Editor");
    });

    it("should handle spaces in role names", () => {
      expect(formatRoleName("content editor")).toBe("Content Editor");
    });

    it("should handle multiple separators", () => {
      expect(formatRoleName("super_admin-level_one")).toBe(
        "Super Admin Level One",
      );
    });

    it("should handle empty string", () => {
      expect(formatRoleName("")).toBe("");
    });
  });

  describe("getErrorMessage", () => {
    it("should return fallback when error is null", () => {
      expect(getErrorMessage(null)).toBe("Something went wrong.");
    });

    it("should return fallback when error is undefined", () => {
      expect(getErrorMessage(undefined)).toBe("Something went wrong.");
    });

    it("should return custom fallback when error is falsy", () => {
      expect(getErrorMessage(null, "Custom error")).toBe("Custom error");
    });

    it("should return the error when it is a string", () => {
      expect(getErrorMessage("Error message")).toBe("Error message");
    });

    it("should return detail from error.data when present", () => {
      const error = { data: { detail: "Detailed error message" } };
      expect(getErrorMessage(error)).toBe("Detailed error message");
    });

    it("should return message from error.data when detail is not present", () => {
      const error = { data: { message: "Error message from data" } };
      expect(getErrorMessage(error)).toBe("Error message from data");
    });

    it("should return error.message when data does not have detail or message", () => {
      const error = { message: "Direct error message" };
      expect(getErrorMessage(error)).toBe("Direct error message");
    });

    it("should return fallback when error object has no usable properties", () => {
      const error = { otherProp: "value" };
      expect(getErrorMessage(error)).toBe("Something went wrong.");
    });

    it("should return fallback when error.message is empty string", () => {
      const error = { message: "" };
      expect(getErrorMessage(error)).toBe("Something went wrong.");
    });

    it("should return fallback when error.message is whitespace", () => {
      const error = { message: "   " };
      expect(getErrorMessage(error)).toBe("Something went wrong.");
    });

    it("should prioritize error.data.detail over error.message", () => {
      const error = {
        data: { detail: "Detail message" },
        message: "Regular message",
      };
      expect(getErrorMessage(error)).toBe("Detail message");
    });

    it("should prioritize error.data.message over error.message when detail is missing", () => {
      const error = {
        data: { message: "Data message" },
        message: "Regular message",
      };
      expect(getErrorMessage(error)).toBe("Data message");
    });

    it("should handle error.data being null", () => {
      const error = { data: null, message: "Fallback message" };
      expect(getErrorMessage(error)).toBe("Fallback message");
    });

    it("should handle error.data being a string", () => {
      const error = { data: "string data", message: "Regular message" };
      expect(getErrorMessage(error)).toBe("Regular message");
    });

    it("should return joined emails_to_add from error.data", () => {
      const error = {
        data: { emails_to_add: ["invalid@x.com", "bad@y.com"] },
      };
      expect(getErrorMessage(error)).toBe("invalid@x.com, bad@y.com");
    });

    it("should return joined usernames_to_add from error.data", () => {
      const error = { data: { usernames_to_add: ["alice", "bob"] } };
      expect(getErrorMessage(error)).toBe("alice, bob");
    });
  });

  describe("roleDescriptions", () => {
    it("should have editor description", () => {
      expect(roleDescriptions.editor).toBeDefined();
      expect(typeof roleDescriptions.editor).toBe("string");
    });
  });

  describe("DEFAULT_MENTOR_ROLES", () => {
    it("should include editor role", () => {
      expect(DEFAULT_MENTOR_ROLES).toContain("editor");
    });

    it("should include editor and chat roles", () => {
      expect(DEFAULT_MENTOR_ROLES.length).toBe(2);
      expect(DEFAULT_MENTOR_ROLES).toContain("chat");
    });
  });
});
