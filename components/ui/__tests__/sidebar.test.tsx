import React from 'react';
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  beforeAll,
} from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from '../sidebar';

// SidebarProvider -> useIsMobile reads window.matchMedia; jsdom needs a stub.
function stubMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

beforeAll(() => stubMatchMedia(false));

const originalInnerWidth = window.innerWidth;

afterEach(() => {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: originalInnerWidth,
  });
  // Reset cookies set by setOpen.
  document.cookie = 'sidebar_state=; path=/; max-age=0';
});

/** Reads context values and exposes buttons to drive them. */
function Controls() {
  const { state, open, isMobile, openMobile, setOpen, toggleSidebar } =
    useSidebar();
  return (
    <div>
      <span data-testid="state">{state}</span>
      <span data-testid="open">{String(open)}</span>
      <span data-testid="is-mobile">{String(isMobile)}</span>
      <span data-testid="open-mobile">{String(openMobile)}</span>
      <button onClick={() => setOpen(true)}>set-open-true</button>
      <button onClick={() => setOpen(false)}>set-open-false</button>
      <button onClick={() => toggleSidebar()}>toggle</button>
    </div>
  );
}

describe('sidebar', () => {
  beforeEach(() => {
    stubMatchMedia(false);
  });

  describe('useSidebar', () => {
    it('throws when used outside of a SidebarProvider', () => {
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      function Orphan() {
        useSidebar();
        return null;
      }

      expect(() => render(<Orphan />)).toThrow(
        'useSidebar must be used within a SidebarProvider.',
      );

      consoleError.mockRestore();
    });
  });

  describe('SidebarProvider state management', () => {
    it('toggles open state (uncontrolled) and persists to cookie', () => {
      render(
        <SidebarProvider>
          <Controls />
        </SidebarProvider>,
      );

      expect(screen.getByTestId('state')).toHaveTextContent('expanded');

      fireEvent.click(screen.getByText('toggle'));

      expect(screen.getByTestId('state')).toHaveTextContent('collapsed');
      expect(screen.getByTestId('open')).toHaveTextContent('false');
      // setOpen writes the sidebar_state cookie.
      expect(document.cookie).toContain('sidebar_state=false');
    });

    it('honours a direct setOpen(true/false) call', () => {
      render(
        <SidebarProvider defaultOpen={false}>
          <Controls />
        </SidebarProvider>,
      );

      expect(screen.getByTestId('open')).toHaveTextContent('false');

      fireEvent.click(screen.getByText('set-open-true'));
      expect(screen.getByTestId('open')).toHaveTextContent('true');

      fireEvent.click(screen.getByText('set-open-false'));
      expect(screen.getByTestId('open')).toHaveTextContent('false');
    });

    it('delegates to onOpenChange when controlled', () => {
      const onOpenChange = vi.fn();
      render(
        <SidebarProvider open={true} onOpenChange={onOpenChange}>
          <Controls />
        </SidebarProvider>,
      );

      fireEvent.click(screen.getByText('toggle'));

      // Controlled: the external setter is called instead of internal state.
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('toggles the mobile sheet when on a mobile viewport', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 500,
      });
      stubMatchMedia(true);

      render(
        <SidebarProvider>
          <Controls />
        </SidebarProvider>,
      );

      expect(screen.getByTestId('is-mobile')).toHaveTextContent('true');
      expect(screen.getByTestId('open-mobile')).toHaveTextContent('false');

      fireEvent.click(screen.getByText('toggle'));

      expect(screen.getByTestId('open-mobile')).toHaveTextContent('true');
    });

    it('toggles via the cmd/ctrl+b keyboard shortcut', () => {
      render(
        <SidebarProvider>
          <Controls />
        </SidebarProvider>,
      );

      expect(screen.getByTestId('state')).toHaveTextContent('expanded');

      act(() => {
        window.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: 'b',
            metaKey: true,
            cancelable: true,
          }),
        );
      });

      expect(screen.getByTestId('state')).toHaveTextContent('collapsed');
    });

    it('ignores unrelated keydown events', () => {
      render(
        <SidebarProvider>
          <Controls />
        </SidebarProvider>,
      );

      act(() => {
        window.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'a', metaKey: true }),
        );
      });

      // No modifier + matching key combo => state unchanged.
      expect(screen.getByTestId('state')).toHaveTextContent('expanded');
    });
  });

  describe('SidebarTrigger', () => {
    it('toggles the sidebar and forwards the onClick handler', () => {
      const onClick = vi.fn();
      render(
        <SidebarProvider>
          <Controls />
          <SidebarTrigger onClick={onClick} />
        </SidebarProvider>,
      );

      fireEvent.click(screen.getByRole('button', { name: /toggle sidebar/i }));

      expect(onClick).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('state')).toHaveTextContent('collapsed');
    });
  });

  describe('SidebarRail', () => {
    it('toggles the sidebar when clicked', () => {
      render(
        <SidebarProvider>
          <Controls />
          <Sidebar>
            <SidebarRail data-testid="rail" />
          </Sidebar>
        </SidebarProvider>,
      );

      fireEvent.click(screen.getByTestId('rail'));

      expect(screen.getByTestId('state')).toHaveTextContent('collapsed');
    });
  });

  describe('Sidebar variants', () => {
    it('renders the non-collapsible variant', () => {
      render(
        <SidebarProvider>
          <Sidebar collapsible="none" data-testid="sidebar">
            <span>none-content</span>
          </Sidebar>
        </SidebarProvider>,
      );

      expect(screen.getByTestId('sidebar')).toHaveTextContent('none-content');
    });

    it('renders the mobile sheet variant once opened', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 500,
      });
      stubMatchMedia(true);

      render(
        <SidebarProvider>
          <Controls />
          <Sidebar>
            <span>mobile-content</span>
          </Sidebar>
        </SidebarProvider>,
      );

      // The sheet only mounts its content once open, so toggle it first.
      fireEvent.click(screen.getByText('toggle'));

      expect(screen.getByText('mobile-content')).toBeInTheDocument();
      // The mobile sheet keeps an accessible title for screen readers.
      expect(screen.getByText('Sidebar')).toBeInTheDocument();
    });

    it('renders the desktop sidebar with floating variant', () => {
      render(
        <SidebarProvider>
          <Sidebar variant="floating" side="right">
            <span>desktop-content</span>
          </Sidebar>
        </SidebarProvider>,
      );

      expect(screen.getByText('desktop-content')).toBeInTheDocument();
    });
  });

  describe('Sidebar building blocks', () => {
    it('renders the full set of sidebar sub-components', () => {
      render(
        <SidebarProvider>
          <Sidebar>
            <SidebarHeader>
              <SidebarInput placeholder="search" />
            </SidebarHeader>
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupLabel>Group</SidebarGroupLabel>
                <SidebarGroupAction>Action</SidebarGroupAction>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton tooltip="Home button">
                        Home
                      </SidebarMenuButton>
                      <SidebarMenuAction showOnHover>act</SidebarMenuAction>
                      <SidebarMenuBadge>5</SidebarMenuBadge>
                      <SidebarMenuSub>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton isActive>
                            Sub
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      </SidebarMenuSub>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuSkeleton showIcon />
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
              <SidebarSeparator />
            </SidebarContent>
            <SidebarFooter>footer</SidebarFooter>
          </Sidebar>
          <SidebarInset>inset-content</SidebarInset>
        </SidebarProvider>,
      );

      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('Sub')).toBeInTheDocument();
      expect(screen.getByText('inset-content')).toBeInTheDocument();
      expect(screen.getByText('footer')).toBeInTheDocument();
    });

    it('supports the asChild escape hatch on slot-based parts', () => {
      render(
        <SidebarProvider>
          <Sidebar>
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupLabel asChild>
                  <a href="#group">Group link</a>
                </SidebarGroupLabel>
                <SidebarGroupAction asChild>
                  <a href="#action">Action link</a>
                </SidebarGroupAction>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <a href="#home">Home link</a>
                    </SidebarMenuButton>
                    <SidebarMenuAction asChild>
                      <a href="#more">More link</a>
                    </SidebarMenuAction>
                  </SidebarMenuItem>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton asChild>
                      <a href="#sub">Sub link</a>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                </SidebarMenu>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>
          <SidebarInset asChild>
            <section>inset-section</section>
          </SidebarInset>
        </SidebarProvider>,
      );

      expect(screen.getByText('Home link')).toHaveAttribute('href', '#home');
      expect(screen.getByText('inset-section')).toBeInTheDocument();
    });

    it('accepts a tooltip config object on the menu button', () => {
      render(
        <SidebarProvider>
          <Sidebar>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  variant="outline"
                  size="lg"
                  tooltip={{ children: 'Configured tip' }}
                >
                  Configured
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </Sidebar>
        </SidebarProvider>,
      );

      expect(screen.getByText('Configured')).toBeInTheDocument();
    });
  });
});
