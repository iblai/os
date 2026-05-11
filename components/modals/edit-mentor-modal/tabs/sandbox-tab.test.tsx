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

vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
}));

vi.mock('@/hooks/user-navigate', () => ({
  useNavigate: () => ({
    getMentorId: mockGetMentorId,
  }),
}));

// SandboxTab imports from `@iblai/iblai-js/web-containers` (the unified
// SDK barrel that re-exports `@iblai/web-containers`). Vitest keys mocks
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
