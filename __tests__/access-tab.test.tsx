import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AccessTab } from "@/components/modals/edit-mentor-modal/tabs/access-tab";

const mockUseParams = vi.fn();
const mockUseUsername = vi.fn();
const mockGetMentorId = vi.fn();
const mockUseGetMentorSettingsQuery = vi.fn();
const mockUseGetRbacMentorAccessListQuery = vi.fn();
const mockGetRbacPermissions = vi.fn();
const mockDispatch = vi.fn();
const renderedAddAccessProps: Array<Record<string, unknown>> = [];
const renderedRoleAccessProps: Array<Record<string, unknown>> = [];

vi.mock("next/navigation", () => ({
  useParams: () => mockUseParams(),
}));

vi.mock("@/hooks/use-user", () => ({
  useUsername: () => mockUseUsername(),
}));

vi.mock("@/hooks/user-navigate", () => ({
  useNavigate: () => ({
    getMentorId: () => mockGetMentorId(),
  }),
}));

vi.mock("@iblai/iblai-js/data-layer", () => ({
  useGetMentorSettingsQuery: (...args: unknown[]) =>
    mockUseGetMentorSettingsQuery(...args),
  useGetRbacMentorAccessListQuery: (...args: unknown[]) =>
    mockUseGetRbacMentorAccessListQuery(...args),
  useGetRbacPermissionsMutation: () => [mockGetRbacPermissions],
}));

vi.mock("@/lib/hooks", () => ({
  useAppDispatch: () => mockDispatch,
}));

vi.mock("@/features/rbac/rbac-slice", () => ({
  updateRbacPermissions: (payload: unknown) => ({
    type: "rbac/updateRbacPermissions",
    payload,
  }),
}));

vi.mock(
  "@/components/modals/edit-mentor-modal/tabs/access-tab/add-access",
  () => ({
    AddAccessDialog: (props: {
      availableRoles: string[];
      isLoading: boolean;
      onAccessCreated: () => Promise<void>;
    }) => {
      renderedAddAccessProps.push(props);
      return (
        <div data-testid="add-access-dialog">
          add-access-{props.availableRoles.join(",")}-
          {props.isLoading ? "loading" : "ready"}
        </div>
      );
    },
  }),
);

vi.mock(
  "@/components/modals/edit-mentor-modal/tabs/access-tab/update-access",
  () => ({
    RoleAccessPanel: (props: {
      policy: Record<string, unknown>;
      onAccessUpdated: () => Promise<void>;
    }) => {
      renderedRoleAccessProps.push(props);
      return (
        <div data-testid="role-access-panel">
          role-panel-{props.policy?.role as string}
        </div>
      );
    },
  }),
);

const createAccessQueryState = (overrides: Record<string, unknown> = {}) => ({
  data: { policies: [] },
  isLoading: false,
  isFetching: false,
  isError: false,
  error: null,
  refetch: vi.fn(),
  ...overrides,
});

describe("AccessTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseParams.mockReturnValue({
      tenantKey: "tenant-1",
      mentorId: "mentor-from-route",
    });
    mockUseUsername.mockReturnValue("mentor-user");
    mockGetMentorId.mockReturnValue("mentor-from-navigate");

    mockUseGetMentorSettingsQuery.mockReturnValue({
      data: { mentor_id: 101 },
      isLoading: false,
    });

    mockUseGetRbacMentorAccessListQuery.mockReturnValue(
      createAccessQueryState(),
    );
    mockGetRbacPermissions.mockReturnValue({
      unwrap: () => Promise.resolve({}),
    });

    renderedAddAccessProps.length = 0;
    renderedRoleAccessProps.length = 0;
  });

  /* ---------- RBAC permission fetch on mount ---------- */

  it("fetches RBAC permissions on mount with correct args", async () => {
    render(<AccessTab />);

    await waitFor(() => {
      expect(mockGetRbacPermissions).toHaveBeenCalledWith({
        requestBody: {
          platform_key: "tenant-1",
          resources: ["/users/", "/groups/"],
        },
      });
    });
  });

  it("dispatches updateRbacPermissions after successful fetch", async () => {
    const permResult = { "/users/": { list: true } };
    mockGetRbacPermissions.mockReturnValue({
      unwrap: () => Promise.resolve(permResult),
    });

    render(<AccessTab />);

    await waitFor(() => {
      expect(mockDispatch).toHaveBeenCalledWith({
        type: "rbac/updateRbacPermissions",
        payload: { ...permResult },
      });
    });
  });

  it("does not fetch permissions when tenantKey is missing", () => {
    mockUseParams.mockReturnValue({
      tenantKey: undefined,
      mentorId: "mentor-from-route",
    });
    render(<AccessTab />);
    expect(mockGetRbacPermissions).not.toHaveBeenCalled();
  });

  /* ---------- Loading / error / empty states ---------- */

  it("renders loading placeholders while queries are loading", () => {
    mockUseGetMentorSettingsQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
    });

    const { container } = render(<AccessTab />);

    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(2);
    expect(screen.queryByTestId("add-access-dialog")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Access management is unavailable."),
    ).not.toBeInTheDocument();
  });

  it("shows manage unavailable state when mentor context is missing", () => {
    mockUseGetMentorSettingsQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
    });

    render(<AccessTab />);

    expect(
      screen.getByText("Access management is unavailable."),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("add-access-dialog")).not.toBeInTheDocument();
  });

  it("renders table of policies and add access dialog when data is available", () => {
    const policies = [
      {
        id: 1,
        mentor_id: 101,
        platform_key: "tenant-1",
        role: "viewer",
        users: [{ id: 11, username: "alpha" }],
      },
    ];

    mockUseGetRbacMentorAccessListQuery.mockReturnValue(
      createAccessQueryState({
        data: { policies },
      }),
    );

    render(<AccessTab />);

    expect(
      screen.getByRole("heading", { name: "Access control" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Viewer")).toBeInTheDocument();
    expect(
      screen.getByText("1 user assigned to this role"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("add-access-dialog")).toHaveTextContent(
      "add-access-editor,chat-ready",
    );
  });

  it("shows empty state when there are no access policies", () => {
    mockUseGetRbacMentorAccessListQuery.mockReturnValue(
      createAccessQueryState({
        data: { policies: [] },
      }),
    );

    render(<AccessTab />);

    expect(
      screen.getByText("No roles available for this mentor."),
    ).toBeInTheDocument();
  });

  it("hides add access dialog when all default roles already exist", () => {
    const policies = [
      {
        id: 1,
        mentor_id: 101,
        platform_key: "tenant-1",
        role: "editor",
      },
      {
        id: 2,
        mentor_id: 101,
        platform_key: "tenant-1",
        role: "chat",
      },
    ];

    mockUseGetRbacMentorAccessListQuery.mockReturnValue(
      createAccessQueryState({
        data: { policies },
      }),
    );

    render(<AccessTab />);

    expect(screen.queryByTestId("add-access-dialog")).not.toBeInTheDocument();
  });

  it("renders error state when fetching policies fails", () => {
    mockUseGetRbacMentorAccessListQuery.mockReturnValue(
      createAccessQueryState({
        data: undefined,
        isError: true,
        error: { message: "Something went wrong" },
      }),
    );

    render(<AccessTab />);

    expect(
      screen.getByText("Unable to load mentor access."),
    ).toBeInTheDocument();
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("opens role access dialog when edit button is clicked", async () => {
    const user = userEvent.setup();
    const policies = [
      {
        id: 1,
        mentor_id: 101,
        platform_key: "tenant-1",
        role: "viewer",
        users: [],
      },
    ];

    mockUseGetRbacMentorAccessListQuery.mockReturnValue(
      createAccessQueryState({
        data: { policies },
      }),
    );

    render(<AccessTab />);

    await user.click(
      screen.getByRole("button", { name: "Edit Viewer access" }),
    );

    expect(screen.getByTestId("role-access-panel")).toHaveTextContent(
      "role-panel-viewer",
    );
    expect(renderedRoleAccessProps.at(-1)?.policy).toMatchObject({
      role: "viewer",
    });
  });
});
