import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

import { SandboxTab } from './sandbox-tab';

// ============================================================================
// MOCKS
// ============================================================================

const mockUseParams = vi.fn();
const mockGetMentorId = vi.fn();
const mockSandboxConfig = vi.fn();
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

// SandboxTab renders the SDK's SandboxConfig directly — the SDK component owns
// the sandbox-kind switches (computational runtime / virtual machine / claw)
// and the claw connection flow, including persisting the flags. Vitest keys
// mocks by module specifier, so we must mock the exact path the source uses.
vi.mock('@iblai/iblai-js/web-containers', () => ({
  SandboxConfig: (props: any) => {
    mockSandboxConfig(props);
    return (
      <div
        data-testid="sandbox-config"
        data-platform-key={props.platformKey}
        data-mentor-unique-id={props.mentorUniqueId}
        data-username={props.username ?? ''}
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

    it('renders SandboxConfig with platformKey, mentorUniqueId and username', () => {
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
        username: 'testuser',
      });
    });

    it('renders SandboxConfig ungated — the kind selector must be reachable even when claw is off', () => {
      render(<SandboxTab />);

      // No CapabilityGate wrapper: the SDK component itself decides what is
      // enabled based on the mentor's sandbox flags.
      expect(
        screen.queryByTestId('capability-gate-content'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('sandbox-capability-toggle'),
      ).not.toBeInTheDocument();
      expect(screen.getByTestId('sandbox-config')).toBeInTheDocument();
    });

    it('passes a null username through to SandboxConfig when none is available', () => {
      mockUsername.mockReturnValue(null);

      render(<SandboxTab />);

      expect(mockSandboxConfig).toHaveBeenCalledWith(
        expect.objectContaining({ username: null }),
      );
    });
  });

  describe('Active mentor id resolution', () => {
    it('prefers getMentorId() from navigate hook when provided', () => {
      mockGetMentorId.mockReturnValue('nav-mentor-xyz');

      render(<SandboxTab />);

      expect(mockSandboxConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          platformKey: 'test-tenant',
          mentorUniqueId: 'nav-mentor-xyz',
        }),
      );
    });

    it('falls back to params.mentorId when getMentorId() returns null', () => {
      mockGetMentorId.mockReturnValue(null);

      render(<SandboxTab />);

      expect(mockSandboxConfig).toHaveBeenCalledWith(
        expect.objectContaining({ mentorUniqueId: 'test-mentor' }),
      );
    });

    it('falls back to params.mentorId when getMentorId() returns undefined', () => {
      mockGetMentorId.mockReturnValue(undefined);

      render(<SandboxTab />);

      expect(mockSandboxConfig).toHaveBeenCalledWith(
        expect.objectContaining({ mentorUniqueId: 'test-mentor' }),
      );
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
      expect(mockSandboxConfig).toHaveBeenCalledWith(
        expect.objectContaining({ mentorUniqueId: 'nav-mentor-xyz' }),
      );
    });
  });
});
