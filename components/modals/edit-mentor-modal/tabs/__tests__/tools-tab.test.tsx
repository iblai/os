import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from '@testing-library/react';
import { ToolsTab } from '../tools-tab';

// ---- Mocks ----
const mockGetToolsQuery = vi.fn();
const mockGetMemsearchStatusQuery = vi.fn();
const mockGetMentorSettingsQuery = vi.fn();
const mockToggleTools = vi.fn();

vi.mock('next/navigation', () => ({
  useParams: () => ({ tenantKey: 'test-tenant', mentorId: 'mentor-1' }),
}));

vi.mock('@/hooks/use-user', () => ({
  useUsername: () => 'testuser',
}));

vi.mock('@/hooks/user-navigate', () => ({
  useNavigate: () => ({
    getMentorId: () => 'mentor-1',
  }),
}));

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useGetToolsQuery: (...args: any[]) => mockGetToolsQuery(...args),
  useGetMemsearchStatusQuery: (...args: any[]) =>
    mockGetMemsearchStatusQuery(...args),
  useGetMentorSettingsQuery: (...args: any[]) =>
    mockGetMentorSettingsQuery(...args),
}));

vi.mock('@/hooks/use-tools/use-toggle-tools', () => ({
  useToggleTools: () => ({
    toggleTools: mockToggleTools,
    isLoading: false,
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock UI components
vi.mock('@/components/ui/switch', () => ({
  Switch: ({ checked, onCheckedChange, disabled, ...props }: any) => (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange?.(!checked)}
      {...props}
    >
      {checked ? 'On' : 'Off'}
    </button>
  ),
}));

vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: any) => <div>{children}</div>,
  Tooltip: ({ children }: any) => <div>{children}</div>,
  TooltipTrigger: ({ children, ...props }: any) => (
    <span {...props}>{children}</span>
  ),
  TooltipContent: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/hoc/withPermissions', () => ({
  default: ({ children }: any) => <>{children({ disabled: false })}</>,
}));

// ---- Test Data ----
// The backend now omits the memory tool from this endpoint (its toggle lives
// in the Settings tab), so the mock mirrors that contract.
const mockTools = [
  {
    slug: 'web-search',
    name: 'Web Search',
    display_name: 'Web Search',
    description: 'Search the web for information',
  },
  {
    slug: 'code-interpreter',
    name: 'Code Interpreter',
    display_name: 'Code Interpreter',
    description: 'Run code in a sandbox',
  },
];

const mockMentorSettings = {
  mentor_tools: [{ slug: 'web-search' }],
  permissions: {
    field: {
      mentor_tools: { read: true, write: true },
    },
  },
};

describe('ToolsTab', () => {
  beforeEach(() => {
    cleanup();
    mockGetToolsQuery.mockReset();
    mockGetMemsearchStatusQuery.mockReset();
    mockGetMentorSettingsQuery.mockReset();
    mockToggleTools.mockReset();
    mockToggleTools.mockResolvedValue(undefined);

    mockGetToolsQuery.mockReturnValue({
      data: mockTools,
      isLoading: false,
    });

    mockGetMemsearchStatusQuery.mockReturnValue({
      data: { enable_memsearch: true },
    });

    mockGetMentorSettingsQuery.mockReturnValue({
      data: mockMentorSettings,
      isLoading: false,
    });
  });

  afterEach(() => {
    cleanup();
  });

  describe('Rendering', () => {
    it('renders the header with title and description', () => {
      render(<ToolsTab />);
      expect(screen.getByText('Tools')).toBeInTheDocument();
      expect(
        screen.getByText('Configure tools and integrations for your agent.'),
      ).toBeInTheDocument();
    });

    it('renders tool names and descriptions', () => {
      render(<ToolsTab />);
      expect(screen.getByText('Web Search')).toBeInTheDocument();
      expect(screen.getByText('Code Interpreter')).toBeInTheDocument();

      expect(
        screen.getByText('Search the web for information'),
      ).toBeInTheDocument();
      expect(screen.getByText('Run code in a sandbox')).toBeInTheDocument();
    });

    it('renders one switch per returned tool', () => {
      render(<ToolsTab />);
      const switches = screen.getAllByRole('switch');
      expect(switches.length).toBe(mockTools.length);
    });

    it('shows enabled state for active tools', () => {
      render(<ToolsTab />);
      const switches = screen.getAllByRole('switch');
      // web-search is enabled
      expect(switches[0]).toHaveAttribute('aria-checked', 'true');
      // code-interpreter is not enabled
      expect(switches[1]).toHaveAttribute('aria-checked', 'false');
    });

    it('renders info icons with aria labels', () => {
      render(<ToolsTab />);
      expect(
        screen.getByLabelText('More info about Web Search'),
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText('More info about Code Interpreter'),
      ).toBeInTheDocument();
    });
  });

  describe('Tool Toggling', () => {
    it('calls toggleTools when a switch is clicked', async () => {
      render(<ToolsTab />);
      const switches = screen.getAllByRole('switch');
      fireEvent.click(switches[1]); // Toggle code-interpreter

      await waitFor(() => {
        expect(mockToggleTools).toHaveBeenCalledWith('code-interpreter');
      });
    });

    it('calls toggleTools for enabled tool to disable it', async () => {
      render(<ToolsTab />);
      const switches = screen.getAllByRole('switch');
      fireEvent.click(switches[0]); // Toggle web-search (currently enabled)

      await waitFor(() => {
        expect(mockToggleTools).toHaveBeenCalledWith('web-search');
      });
    });
  });

  describe('Loading States', () => {
    it('disables switches when tools are loading', () => {
      mockGetToolsQuery.mockReturnValue({
        data: mockTools,
        isLoading: true,
      });

      render(<ToolsTab />);
      const switches = screen.getAllByRole('switch');
      switches.forEach((sw) => {
        expect(sw).toBeDisabled();
      });
    });

    it('disables switches when mentor settings are loading', () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: mockMentorSettings,
        isLoading: true,
      });

      render(<ToolsTab />);
      const switches = screen.getAllByRole('switch');
      switches.forEach((sw) => {
        expect(sw).toBeDisabled();
      });
    });

    it('renders nothing when tools data is undefined', () => {
      mockGetToolsQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
      });

      render(<ToolsTab />);
      expect(screen.queryAllByRole('switch').length).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('handles tools with null slug', () => {
      mockGetToolsQuery.mockReturnValue({
        data: [
          {
            slug: null,
            name: 'No Slug Tool',
            display_name: 'No Slug Tool',
            description: 'A tool without slug',
          },
        ],
        isLoading: false,
      });

      render(<ToolsTab />);
      expect(screen.getByText('No Slug Tool')).toBeInTheDocument();
    });

    it('handles mentor settings without mentor_tools', () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: { permissions: { field: {} } },
        isLoading: false,
      });

      render(<ToolsTab />);
      const switches = screen.getAllByRole('switch');
      // isEnabled is undefined when mentor_tools is missing, Switch receives undefined for checked
      switches.forEach((sw) => {
        expect(sw).not.toHaveAttribute('aria-checked', 'true');
      });
    });

    it('handles undefined mentor settings', () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
      });

      render(<ToolsTab />);
      const switches = screen.getAllByRole('switch');
      switches.forEach((sw) => {
        expect(sw).not.toHaveAttribute('aria-checked', 'true');
      });
    });

    it('renders aria-label with enabled/disabled state', () => {
      render(<ToolsTab />);
      expect(screen.getByLabelText('Web Search enabled')).toBeInTheDocument();
      expect(
        screen.getByLabelText('Code Interpreter disabled'),
      ).toBeInTheDocument();
    });
  });

  describe('WithFormPermissions', () => {
    it('renders tools within permissions wrapper', () => {
      render(<ToolsTab />);
      // All tools render, meaning permissions are passing
      expect(screen.getByText('Web Search')).toBeInTheDocument();
    });
  });
});
