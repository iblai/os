import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

import { SandboxTab } from './sandbox-tab';

// ============================================================================
// MOCKS
// ============================================================================

const mockUseParams = vi.fn();
const mockGetMentorId = vi.fn();
const mockSandboxConfig = vi.fn();
const mockGetMentorSettingsQuery = vi.fn();
const mockEditMentor = vi.fn();
const mockUsername = vi.fn();

vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
}));

vi.mock('@/hooks/user-navigate', () => ({
  useNavigate: () => ({
    getMentorId: mockGetMentorId,
  }),
}));

vi.mock('@/hooks/use-user', () => ({
  useUsername: () => mockUsername(),
}));

// SandboxTab now hydrates `enable_claw` from mentor settings and PATCHes it via
// the RTK Query hooks. Mock the data-layer barrel so the tab can render its
// in-tab capability toggle without a real redux store.
vi.mock('@iblai/iblai-js/data-layer', () => ({
  useGetMentorSettingsQuery: (...args: unknown[]) =>
    mockGetMentorSettingsQuery(...args),
  useEditMentorMutation: () => [mockEditMentor, { isLoading: false }],
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// CapabilityGate uses the real `@/components/ui/switch`; flatten it to a plain
// checkbox so the toggle's checked/disabled state is trivially assertable.
vi.mock('@/components/ui/switch', () => ({
  Switch: ({ checked, onCheckedChange, disabled, ...props }: any) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onCheckedChange(e.target.checked)}
      disabled={disabled}
      {...props}
    />
  ),
}));

// SandboxTab imports from `@iblai/iblai-js/web-containers` (the unified
// SDK barrel that re-exports `@iblai/iblai-js/web-containers`). Vitest keys mocks
// by module specifier, so we must mock the exact path the source uses.
vi.mock('@iblai/iblai-js/web-containers', () => ({
  SandboxConfig: (props: any) => {
    mockSandboxConfig(props);
    return (
      <div
        data-testid="sandbox-config"
        data-platform-key={props.platformKey}
        data-mentor-unique-id={props.mentorUniqueId}
      >
        SandboxConfig
      </div>
    );
  },
}));

// ============================================================================
// TESTS
// ============================================================================

describe('SandboxTab', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();

    mockUseParams.mockReturnValue({
      tenantKey: 'test-tenant',
      mentorId: 'test-mentor',
    });
    mockGetMentorId.mockReturnValue(null);
    mockUsername.mockReturnValue('testuser');
    mockGetMentorSettingsQuery.mockReturnValue({
      data: { enable_claw: false },
    });
    mockEditMentor.mockReturnValue({ unwrap: vi.fn().mockResolvedValue({}) });
  });

  afterEach(() => {
    cleanup();
  });

  describe('Rendering', () => {
    it('renders the Sandbox header and description', () => {
      render(<SandboxTab />);

      expect(screen.getByText('Sandbox')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Configure sandbox connection and deployment settings.',
        ),
      ).toBeInTheDocument();
    });

    it('renders SandboxConfig with platformKey and mentorUniqueId from url params', () => {
      render(<SandboxTab />);

      const sandboxConfig = screen.getByTestId('sandbox-config');
      expect(sandboxConfig).toHaveAttribute('data-platform-key', 'test-tenant');
      expect(sandboxConfig).toHaveAttribute(
        'data-mentor-unique-id',
        'test-mentor',
      );
      expect(mockSandboxConfig).toHaveBeenCalledWith({
        platformKey: 'test-tenant',
        mentorUniqueId: 'test-mentor',
      });
    });
  });

  describe('Capability toggle', () => {
    it('renders the in-tab dedicated-sandbox capability toggle', () => {
      render(<SandboxTab />);

      expect(
        screen.getByTestId('sandbox-capability-toggle'),
      ).toBeInTheDocument();
    });

    it('reflects enable_claw=false from mentor settings as unchecked', () => {
      render(<SandboxTab />);

      expect(screen.getByTestId('sandbox-capability-toggle')).not.toBeChecked();
    });

    it('reflects enable_claw=true from mentor settings as checked', () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: { enable_claw: true },
      });

      render(<SandboxTab />);

      expect(screen.getByTestId('sandbox-capability-toggle')).toBeChecked();
    });

    it('grays out (but still renders) the SandboxConfig when the capability is off', () => {
      render(<SandboxTab />);

      const content = screen.getByTestId('capability-gate-content');
      expect(content).toHaveAttribute('data-enabled', 'false');
      // Content is inert but present so admins can preview the config.
      expect(screen.getByTestId('sandbox-config')).toBeInTheDocument();
    });

    it('marks the content enabled when the capability is on', () => {
      mockGetMentorSettingsQuery.mockReturnValue({
        data: { enable_claw: true },
      });

      render(<SandboxTab />);

      expect(screen.getByTestId('capability-gate-content')).toHaveAttribute(
        'data-enabled',
        'true',
      );
    });

    it('PATCHes enable_claw via editMentor when the toggle is switched on', () => {
      render(<SandboxTab />);

      fireEvent.click(screen.getByTestId('sandbox-capability-toggle'));

      expect(mockEditMentor).toHaveBeenCalledWith(
        expect.objectContaining({
          mentor: 'test-mentor',
          org: 'test-tenant',
          formData: { enable_claw: true },
        }),
      );
    });
  });

  describe('Active mentor id resolution', () => {
    it('prefers getMentorId() from navigate hook when provided', () => {
      mockGetMentorId.mockReturnValue('nav-mentor-xyz');

      render(<SandboxTab />);

      expect(mockSandboxConfig).toHaveBeenCalledWith({
        platformKey: 'test-tenant',
        mentorUniqueId: 'nav-mentor-xyz',
      });
    });

    it('falls back to params.mentorId when getMentorId() returns null', () => {
      mockGetMentorId.mockReturnValue(null);

      render(<SandboxTab />);

      expect(mockSandboxConfig).toHaveBeenCalledWith({
        platformKey: 'test-tenant',
        mentorUniqueId: 'test-mentor',
      });
    });

    it('falls back to params.mentorId when getMentorId() returns undefined', () => {
      mockGetMentorId.mockReturnValue(undefined);

      render(<SandboxTab />);

      expect(mockSandboxConfig).toHaveBeenCalledWith({
        platformKey: 'test-tenant',
        mentorUniqueId: 'test-mentor',
      });
    });
  });

  describe('Guard clauses', () => {
    it('renders nothing when tenantKey is missing', () => {
      mockUseParams.mockReturnValue({
        tenantKey: undefined,
        mentorId: 'test-mentor',
      });

      const { container } = render(<SandboxTab />);

      expect(container.firstChild).toBeNull();
      expect(mockSandboxConfig).not.toHaveBeenCalled();
    });

    it('renders nothing when both mentorId and getMentorId() are missing', () => {
      mockUseParams.mockReturnValue({
        tenantKey: 'test-tenant',
        mentorId: undefined,
      });
      mockGetMentorId.mockReturnValue(null);

      const { container } = render(<SandboxTab />);

      expect(container.firstChild).toBeNull();
      expect(mockSandboxConfig).not.toHaveBeenCalled();
    });

    it('renders the tab when getMentorId() provides an id but params.mentorId is missing', () => {
      mockUseParams.mockReturnValue({
        tenantKey: 'test-tenant',
        mentorId: undefined,
      });
      mockGetMentorId.mockReturnValue('nav-mentor-xyz');

      render(<SandboxTab />);

      expect(screen.getByText('Sandbox')).toBeInTheDocument();
      expect(mockSandboxConfig).toHaveBeenCalledWith({
        platformKey: 'test-tenant',
        mentorUniqueId: 'nav-mentor-xyz',
      });
    });
  });
});
