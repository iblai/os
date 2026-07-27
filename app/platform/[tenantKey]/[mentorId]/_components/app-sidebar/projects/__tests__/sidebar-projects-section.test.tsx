/**
 * SidebarProjectsSection — the projects list in the platform sidebar.
 *
 * Renders the real component (and, through it, the real `useSidebarProjects`
 * hook) so the infinite-scroll bootstrap effect is exercised end-to-end. The
 * SDK projects query is mocked so tests control the payload / `isFetching`
 * flag and can assert the growing `limit`.
 *
 * The bootstrap effect measures `scrollHeight`/`clientHeight` on the scroll
 * container to decide whether the loaded page fills the viewport. jsdom
 * reports 0 for both, so we (a) stub `requestAnimationFrame` to hand us the
 * measurement callback and (b) mock the element's metrics via
 * `Object.defineProperty` before invoking it — that's the only way to drive
 * the "list doesn't overflow → auto-load the next page" branch.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ---------------------------------------------------------------------------
// Mutable mock state
// ---------------------------------------------------------------------------
const pushMock = vi.fn();
const toastMock = vi.fn();
const redirectToLoginMock = vi.fn();
const executeWithTrialCheckMock = vi.fn((fn?: () => void) => fn?.());
const getUserProjectsArgsMock = vi.fn();

let mockPathname = '/platform/tenant-a/mentor-1';
let mockIsLoggedIn = true;
let mockProjectsData: unknown = {
  results: [
    { id: 'proj-1', name: 'Alpha Project', mentors: [{ unique_id: 'm-1' }] },
    { id: 'proj-2', name: 'Beta Project', mentors: [{ unique_id: 'm-2' }] },
  ],
  count: 2,
};
let mockProjectsIsFetching = false;

// ---------------------------------------------------------------------------
// Mocks (registered before the component import)
// ---------------------------------------------------------------------------
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => mockPathname,
}));

vi.mock('sonner', () => ({
  toast: (...args: unknown[]) => toastMock(...args),
}));

vi.mock('@/hooks/user-user-actions', () => ({
  useShowFreeTrialDialog: () => ({
    executeWithTrialCheck: executeWithTrialCheckMock,
  }),
}));

vi.mock('@/lib/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/utils')>();
  return {
    ...actual,
    cn: actual.cn,
    isLoggedIn: () => mockIsLoggedIn,
    redirectToLogin: (...args: unknown[]) => redirectToLoginMock(...args),
  };
});

vi.mock('@/components/projects/create-project-modal', () => ({
  CreateProjectModal: ({
    isOpen,
    onClose,
  }: {
    isOpen: boolean;
    onClose: () => void;
  }) =>
    isOpen ? (
      <div role="dialog" aria-label="Create Project Modal">
        <button onClick={onClose}>Close Create</button>
      </div>
    ) : null,
}));
vi.mock('@/components/projects/rename-project-modal', () => ({
  RenameProjectModal: ({
    isOpen,
    onClose,
  }: {
    isOpen: boolean;
    onClose: () => void;
  }) =>
    isOpen ? (
      <div role="dialog" aria-label="Rename Project Modal">
        <button onClick={onClose}>Close Rename</button>
      </div>
    ) : null,
}));
vi.mock('@/components/projects/delete-project-modal', () => ({
  DeleteProjectModal: ({
    isOpen,
    onClose,
  }: {
    isOpen: boolean;
    onClose: () => void;
  }) =>
    isOpen ? (
      <div role="dialog" aria-label="Delete Project Modal">
        <button onClick={onClose}>Close Delete</button>
      </div>
    ) : null,
}));

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useGetUserProjectsQuery: (args: unknown, options?: { skip?: boolean }) => {
    getUserProjectsArgsMock(args, options);
    if (options?.skip) {
      return { data: undefined, isFetching: false };
    }
    return { data: mockProjectsData, isFetching: mockProjectsIsFetching };
  },
}));

import { SidebarProjectsSection } from '../sidebar-projects-section';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
type Props = Partial<React.ComponentProps<typeof SidebarProjectsSection>>;

function renderSection(props: Props = {}) {
  const merged: React.ComponentProps<typeof SidebarProjectsSection> = {
    collapsed: false,
    tenantKey: 'tenant-a',
    username: 'admin-user',
    open: true,
    onOpenChange: vi.fn(),
    ...props,
  };
  return render(<SidebarProjectsSection {...merged} />);
}

function lastLimit() {
  const calls = getUserProjectsArgsMock.mock.calls;
  const last = calls[calls.length - 1][0] as { params: { limit: number } };
  return last.params.limit;
}

function everyLimitIs(n: number) {
  return getUserProjectsArgsMock.mock.calls.every(
    (c) => (c[0] as { params: { limit: number } }).params.limit === n,
  );
}

beforeEach(() => {
  pushMock.mockReset();
  toastMock.mockReset();
  redirectToLoginMock.mockReset();
  executeWithTrialCheckMock.mockClear();
  executeWithTrialCheckMock.mockImplementation((fn?: () => void) => fn?.());
  getUserProjectsArgsMock.mockClear();
  mockPathname = '/platform/tenant-a/mentor-1';
  mockIsLoggedIn = true;
  mockProjectsData = {
    results: [
      { id: 'proj-1', name: 'Alpha Project', mentors: [{ unique_id: 'm-1' }] },
      { id: 'proj-2', name: 'Beta Project', mentors: [{ unique_id: 'm-2' }] },
    ],
    count: 2,
  };
  mockProjectsIsFetching = false;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

// ===========================================================================
// Expanded (non-collapsed) rendering
// ===========================================================================
describe('SidebarProjectsSection — expanded list', () => {
  it('renders each project row by name', () => {
    renderSection();
    expect(
      screen.getByRole('button', { name: 'Alpha Project' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Beta Project' }),
    ).toBeInTheDocument();
  });

  it('applies the active-state styling to the project on the current path', () => {
    mockPathname = '/platform/tenant-a/projects/proj-1/m-1';
    renderSection();
    const row = screen
      .getByRole('button', { name: 'Alpha Project' })
      .closest('div');
    expect(row?.className).toContain('bg-[#eef6fc]');
    // The other project stays inactive.
    const other = screen
      .getByRole('button', { name: 'Beta Project' })
      .closest('div');
    expect(other?.className).not.toContain('bg-[#eef6fc]');
  });

  it('falls back to the "Untitled project" label when a project has no name', () => {
    mockProjectsData = {
      results: [{ id: 'proj-x', name: null, mentors: [{ unique_id: 'm-x' }] }],
      count: 1,
    };
    renderSection();
    expect(
      screen.getByRole('button', { name: 'Untitled project' }),
    ).toBeInTheDocument();
  });

  it('shows the empty-state placeholder when there are no projects', () => {
    mockProjectsData = { results: [], count: 0 };
    renderSection();
    expect(screen.getByText('No projects yet')).toBeInTheDocument();
    expect(
      screen.queryByTestId('sidebar-projects-scroll'),
    ).not.toBeInTheDocument();
  });

  it('shows the "loading more" affordance only while fetching AND more remain', () => {
    mockProjectsData = {
      results: [
        { id: 'proj-1', name: 'Alpha', mentors: [{ unique_id: 'm-1' }] },
      ],
      count: 25,
    };
    mockProjectsIsFetching = true;
    renderSection();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('hides the "loading more" affordance when not fetching', () => {
    renderSection();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('hides the "loading more" affordance when fetching but nothing more remains', () => {
    // isFetching true but loaded === count → hasMore false → no spinner.
    mockProjectsIsFetching = true;
    renderSection();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

// ===========================================================================
// Navigation
// ===========================================================================
describe('SidebarProjectsSection — navigation', () => {
  it('opens a project (with a default mentor) by pushing its route', () => {
    renderSection();
    fireEvent.click(screen.getByRole('button', { name: 'Alpha Project' }));
    expect(pushMock).toHaveBeenCalledWith(
      '/platform/tenant-a/projects/proj-1/m-1',
    );
  });

  it('toasts instead of navigating when a project has no default mentor', () => {
    mockProjectsData = {
      results: [{ id: 'proj-1', name: 'Alpha Project', mentors: [] }],
      count: 1,
    };
    renderSection();
    fireEvent.click(screen.getByRole('button', { name: 'Alpha Project' }));
    expect(pushMock).not.toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith(
      'Add an agent to this project first.',
    );
  });

  it('"My Projects" navigates to the projects index', () => {
    renderSection();
    fireEvent.click(screen.getByRole('button', { name: 'My Projects' }));
    expect(pushMock).toHaveBeenCalledWith('/platform/tenant-a/projects');
  });

  it('"My Projects" is a no-op without a tenant key', () => {
    renderSection({ tenantKey: '' });
    fireEvent.click(screen.getByRole('button', { name: 'My Projects' }));
    expect(pushMock).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// Create gate (logged-in vs anonymous)
// ===========================================================================
describe('SidebarProjectsSection — New Project gate', () => {
  it('opens the Create modal (via the trial gate) for a logged-in user', async () => {
    renderSection();
    fireEvent.click(screen.getByRole('button', { name: 'New Project' }));
    expect(executeWithTrialCheckMock).toHaveBeenCalled();
    // The modal is a dynamic import, so it mounts on the next microtask.
    expect(
      await screen.findByRole('dialog', { name: 'Create Project Modal' }),
    ).toBeInTheDocument();
    // And it can be closed.
    fireEvent.click(screen.getByText('Close Create'));
    expect(
      screen.queryByRole('dialog', { name: 'Create Project Modal' }),
    ).not.toBeInTheDocument();
  });

  it('redirects an anonymous user to login instead of opening the modal', () => {
    mockIsLoggedIn = false;
    renderSection();
    fireEvent.click(screen.getByRole('button', { name: 'New Project' }));
    expect(redirectToLoginMock).toHaveBeenCalledWith('tenant-a');
    expect(executeWithTrialCheckMock).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('dialog', { name: 'Create Project Modal' }),
    ).not.toBeInTheDocument();
  });
});

// ===========================================================================
// Row menu → rename / delete modals
// ===========================================================================
describe('SidebarProjectsSection — row menu', () => {
  it('opens (and closes) the Rename modal from the row menu', async () => {
    const user = userEvent.setup();
    renderSection();
    const menus = screen.getAllByRole('button', { name: 'Project actions' });
    await user.click(menus[0]);
    await user.click(await screen.findByRole('menuitem', { name: 'Rename' }));
    expect(
      await screen.findByRole('dialog', { name: 'Rename Project Modal' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByText('Close Rename'));
    expect(
      screen.queryByRole('dialog', { name: 'Rename Project Modal' }),
    ).not.toBeInTheDocument();
  });

  it('opens (and closes) the Delete modal from the row menu', async () => {
    const user = userEvent.setup();
    renderSection();
    const menus = screen.getAllByRole('button', { name: 'Project actions' });
    await user.click(menus[0]);
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    expect(
      await screen.findByRole('dialog', { name: 'Delete Project Modal' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByText('Close Delete'));
    expect(
      screen.queryByRole('dialog', { name: 'Delete Project Modal' }),
    ).not.toBeInTheDocument();
  });
});

// ===========================================================================
// Fallback branches (null name / missing mentors / empty pathname)
// ===========================================================================
describe('SidebarProjectsSection — fallback branches', () => {
  it('treats a project with no mentors array as having no default mentor', () => {
    // `p.mentors ?? []` — omitting mentors entirely exercises the `?? []` side.
    mockProjectsData = {
      results: [{ id: 'proj-x', name: 'No Mentors' }],
      count: 1,
    };
    renderSection();
    fireEvent.click(screen.getByRole('button', { name: 'No Mentors' }));
    expect(pushMock).not.toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalled();
  });

  it('marks no project active when the pathname is empty', () => {
    mockPathname = '';
    renderSection();
    const row = screen
      .getByRole('button', { name: 'Alpha Project' })
      .closest('div');
    expect(row?.className).not.toContain('bg-[#eef6fc]');
  });

  it('opens Rename for an unnamed project (name falls back to empty string)', async () => {
    const user = userEvent.setup();
    mockProjectsData = {
      results: [{ id: 'proj-x', name: null, mentors: [{ unique_id: 'm-x' }] }],
      count: 1,
    };
    renderSection();
    await user.click(screen.getByRole('button', { name: 'Project actions' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Rename' }));
    expect(
      await screen.findByRole('dialog', { name: 'Rename Project Modal' }),
    ).toBeInTheDocument();
  });

  it('opens Delete for an unnamed project (name falls back to empty string)', async () => {
    const user = userEvent.setup();
    mockProjectsData = {
      results: [{ id: 'proj-x', name: null, mentors: [{ unique_id: 'm-x' }] }],
      count: 1,
    };
    renderSection();
    await user.click(screen.getByRole('button', { name: 'Project actions' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    expect(
      await screen.findByRole('dialog', { name: 'Delete Project Modal' }),
    ).toBeInTheDocument();
  });

  it('renders an unnamed project in the flyout as "Untitled project"', async () => {
    const user = userEvent.setup();
    mockProjectsData = {
      results: [{ id: 'proj-x', name: null, mentors: [{ unique_id: 'm-x' }] }],
      count: 1,
    };
    renderSection({ collapsed: true });
    await user.hover(screen.getByRole('button', { name: 'Projects' }));
    expect(
      await screen.findByRole('button', { name: 'Untitled project' }),
    ).toBeInTheDocument();
  });
});

// ===========================================================================
// Collapsed rail flyout
// ===========================================================================
describe('SidebarProjectsSection — collapsed rail flyout', () => {
  it('renders the flyout trigger and its project rows', async () => {
    const user = userEvent.setup();
    const onCollapsedIconClick = vi.fn();
    renderSection({ collapsed: true, onCollapsedIconClick });
    const trigger = screen.getByRole('button', { name: 'Projects' });
    // Icon click still fires its handler.
    fireEvent.click(trigger);
    expect(onCollapsedIconClick).toHaveBeenCalled();
    await user.hover(trigger);
    expect(
      await screen.findByRole('button', { name: 'Alpha Project' }),
    ).toBeInTheDocument();
  });

  it('shows the empty state inside the flyout when there are no projects', async () => {
    const user = userEvent.setup();
    mockProjectsData = { results: [], count: 0 };
    renderSection({ collapsed: true });
    await user.hover(screen.getByRole('button', { name: 'Projects' }));
    expect(await screen.findByText('No projects yet')).toBeInTheDocument();
  });

  it('flyout "New Project" and "My Projects" trigger their handlers', async () => {
    const user = userEvent.setup();
    renderSection({ collapsed: true });
    await user.hover(screen.getByRole('button', { name: 'Projects' }));
    fireEvent.click(await screen.findByRole('button', { name: 'New Project' }));
    expect(executeWithTrialCheckMock).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'My Projects' }));
    expect(pushMock).toHaveBeenCalledWith('/platform/tenant-a/projects');
  });

  it('clicking a flyout project navigates to it', async () => {
    const user = userEvent.setup();
    renderSection({ collapsed: true });
    await user.hover(screen.getByRole('button', { name: 'Projects' }));
    fireEvent.click(
      await screen.findByRole('button', { name: 'Beta Project' }),
    );
    expect(pushMock).toHaveBeenCalledWith(
      '/platform/tenant-a/projects/proj-2/m-2',
    );
  });

  it('marks the active project in the flyout', async () => {
    const user = userEvent.setup();
    mockPathname = '/platform/tenant-a/projects/proj-1/m-1';
    renderSection({ collapsed: true });
    await user.hover(screen.getByRole('button', { name: 'Projects' }));
    const active = await screen.findByRole('button', { name: 'Alpha Project' });
    expect(active.className).toContain('bg-[#eef6fc]');
  });
});

// ===========================================================================
// Auto-load bootstrap effect (the DOM-metric measurement path)
// ===========================================================================
describe('SidebarProjectsSection — auto-load bootstrap', () => {
  // Hand the rAF callback to the test so we can set the element metrics
  // *before* the measurement runs (jsdom otherwise reports 0/0).
  function captureRaf() {
    const cbs: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cbs.push(cb);
      return cbs.length;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});
    return cbs;
  }

  function setMetrics(el: Element, clientHeight: number, scrollHeight: number) {
    Object.defineProperty(el, 'clientHeight', {
      configurable: true,
      value: clientHeight,
    });
    Object.defineProperty(el, 'scrollHeight', {
      configurable: true,
      value: scrollHeight,
    });
  }

  const partialPage = {
    results: Array.from({ length: 10 }, (_, i) => ({
      id: `p-${i}`,
      name: `Project ${i}`,
      mentors: [{ unique_id: `m-${i}` }],
    })),
    count: 25,
  };

  it('auto-loads the next page when the list does NOT overflow its container', () => {
    mockProjectsData = partialPage;
    const cbs = captureRaf();
    renderSection();

    const el = screen.getByTestId('sidebar-projects-scroll');
    // Non-overflowing: content height == viewport height → onScroll can never
    // fire, so the effect must grow the limit itself.
    setMetrics(el, 100, 100);
    act(() => {
      cbs.forEach((cb) => cb(0));
    });
    expect(lastLimit()).toBe(20);
  });

  it('does NOT auto-load when the list already overflows (scroll can drive it)', () => {
    mockProjectsData = partialPage;
    const cbs = captureRaf();
    renderSection();

    const el = screen.getByTestId('sidebar-projects-scroll');
    // Overflowing: scrollHeight > clientHeight + 1 → leave loading to onScroll.
    setMetrics(el, 100, 400);
    act(() => {
      cbs.forEach((cb) => cb(0));
    });
    expect(everyLimitIs(10)).toBe(true);
  });

  it('does NOT auto-load when the container has zero height (not yet laid out)', () => {
    mockProjectsData = partialPage;
    const cbs = captureRaf();
    renderSection();

    const el = screen.getByTestId('sidebar-projects-scroll');
    // clientHeight 0 fails the `clientHeight > 0` guard.
    setMetrics(el, 0, 0);
    act(() => {
      cbs.forEach((cb) => cb(0));
    });
    expect(everyLimitIs(10)).toBe(true);
  });

  // NOTE: Radix primitives (Collapsible/HoverCard) also schedule their own
  // rAF callbacks, so we cannot assert "nothing was scheduled". Instead we
  // flush every captured callback and assert the projects effect's guard kept
  // the limit at its initial page — the effect returned before measuring.
  it('does NOT auto-load while collapsed', () => {
    mockProjectsData = partialPage;
    const cbs = captureRaf();
    renderSection({ collapsed: true });
    act(() => {
      cbs.forEach((cb) => cb(0));
    });
    expect(everyLimitIs(10)).toBe(true);
  });

  it('does NOT auto-load while the section is closed', () => {
    mockProjectsData = partialPage;
    const cbs = captureRaf();
    renderSection({ open: false });
    act(() => {
      cbs.forEach((cb) => cb(0));
    });
    expect(everyLimitIs(10)).toBe(true);
  });

  it('does NOT auto-load when everything is already loaded', () => {
    mockProjectsData = {
      results: partialPage.results,
      count: partialPage.results.length, // hasMore false
    };
    const cbs = captureRaf();
    renderSection();
    act(() => {
      cbs.forEach((cb) => cb(0));
    });
    expect(everyLimitIs(10)).toBe(true);
  });
});
