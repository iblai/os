import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

import { McpTab } from './index';

// ============================================================================
// MOCKS
// ============================================================================

/**
 * Mock routing hooks
 */
const mockUseParams = vi.fn();
const mockUseUsername = vi.fn();

/**
 * Mock next/navigation
 */
vi.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
}));

/**
 * Mock user hooks
 */
vi.mock('@/hooks/use-user', () => ({
  useUsername: () => mockUseUsername(),
}));

/**
 * Mock navigation hooks
 */
const mockGetMentorId = vi.fn();
vi.mock('@/hooks/user-navigate', () => ({
  useNavigate: () => ({
    getMentorId: mockGetMentorId,
  }),
}));

/**
 * Mock child component
 */
vi.mock('./connector-management-content', () => ({
  ConnectorManagementContent: ({ tenantKey, username, mentorId }: any) => (
    <div data-testid="connector-management-content">
      <div data-testid="tenant-key">{tenantKey}</div>
      <div data-testid="username">{username}</div>
      <div data-testid="mentor-id">{mentorId}</div>
    </div>
  ),
}));

// ============================================================================
// TEST FIXTURES
// ============================================================================

const mockParams = {
  tenantKey: 'test-tenant',
  mentorId: 'test-mentor-123',
};

const mockUsername = 'test-user';

// ============================================================================
// TESTS
// ============================================================================

describe('McpTab', () => {
  beforeEach(() => {
    cleanup();
    mockUseParams.mockReset();
    mockUseUsername.mockReset();
    mockGetMentorId.mockReset();

    // Default return values
    mockUseParams.mockReturnValue(mockParams);
    mockUseUsername.mockReturnValue(mockUsername);
    mockGetMentorId.mockReturnValue(null); // Default to null
  });

  afterEach(() => {
    cleanup();
  });

  // --------------------------------------------------------------------------
  // Rendering Tests
  // --------------------------------------------------------------------------

  describe('Rendering', () => {
    /**
     * Test: Component should render header section
     */
    it('renders header section with title and description', () => {
      render(<McpTab />);

      expect(screen.getByText('MCP')).toBeInTheDocument();
      expect(
        screen.getByText('Manage Model Context Protocol connectors for your mentor.'),
      ).toBeInTheDocument();
    });

    /**
     * Test: Header should be present in the component
     */
    it('renders header section', () => {
      render(<McpTab />);

      const header = screen.getByText('MCP');
      expect(header).toBeInTheDocument();
    });

    /**
     * Test: Should render ConnectorManagementContent component
     */
    it('renders ConnectorManagementContent component', () => {
      render(<McpTab />);

      expect(screen.getByTestId('connector-management-content')).toBeInTheDocument();
    });

    /**
     * Test: Should render content area with styling
     */
    it('renders content area', () => {
      const { container } = render(<McpTab />);

      // Check that content area exists
      const contentArea = container.querySelector('.flex-1');
      expect(contentArea).toBeTruthy();
    });

    /**
     * Test: Should apply responsive padding to content area
     */
    it('applies responsive padding to content area', () => {
      const { container } = render(<McpTab />);

      const contentDiv = container.querySelector('.p-3.lg\\:p-4');
      expect(contentDiv).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Props Passing Tests
  // --------------------------------------------------------------------------

  describe('Props Passing', () => {
    /**
     * Test: Should pass tenantKey from params to ConnectorManagementContent
     */
    it('passes tenantKey from useParams to ConnectorManagementContent', () => {
      render(<McpTab />);

      const tenantKeyDiv = screen.getByTestId('tenant-key');
      expect(tenantKeyDiv).toHaveTextContent('test-tenant');
    });

    /**
     * Test: Should pass username to ConnectorManagementContent
     */
    it('passes username to ConnectorManagementContent', () => {
      render(<McpTab />);

      const usernameDiv = screen.getByTestId('username');
      expect(usernameDiv).toHaveTextContent('test-user');
    });

    /**
     * Test: Should pass empty string when username is null
     */
    it('passes empty string when username is null', () => {
      mockUseUsername.mockReturnValue(null);

      render(<McpTab />);

      const usernameDiv = screen.getByTestId('username');
      expect(usernameDiv).toHaveTextContent('');
    });

    /**
     * Test: Should pass empty string when username is undefined
     */
    it('passes empty string when username is undefined', () => {
      mockUseUsername.mockReturnValue(undefined);

      render(<McpTab />);

      const usernameDiv = screen.getByTestId('username');
      expect(usernameDiv).toHaveTextContent('');
    });

    /**
     * Test: Should use mentorId from params when getMentorId returns null
     */
    it('uses mentorId from params when getMentorId returns null', () => {
      mockGetMentorId.mockReturnValue(null);

      render(<McpTab />);

      const mentorIdDiv = screen.getByTestId('mentor-id');
      expect(mentorIdDiv).toHaveTextContent('test-mentor-123');
    });

    /**
     * Test: Should use mentorId from getMentorId when available
     */
    it('uses mentorId from getMentorId when available', () => {
      mockGetMentorId.mockReturnValue('active-mentor-456');

      render(<McpTab />);

      const mentorIdDiv = screen.getByTestId('mentor-id');
      expect(mentorIdDiv).toHaveTextContent('active-mentor-456');
    });

    /**
     * Test: Should prefer getMentorId over params mentorId
     */
    it('prefers getMentorId over params mentorId when both available', () => {
      mockGetMentorId.mockReturnValue('priority-mentor-789');
      mockUseParams.mockReturnValue({
        tenantKey: 'test-tenant',
        mentorId: 'params-mentor-123',
      });

      render(<McpTab />);

      const mentorIdDiv = screen.getByTestId('mentor-id');
      expect(mentorIdDiv).toHaveTextContent('priority-mentor-789');
    });
  });

  // --------------------------------------------------------------------------
  // Routing Hook Tests
  // --------------------------------------------------------------------------

  describe('Routing Hooks', () => {
    /**
     * Test: Should handle different tenantKey values
     */
    it('handles different tenantKey values', () => {
      mockUseParams.mockReturnValue({
        tenantKey: 'another-tenant',
        mentorId: 'mentor-456',
      });

      render(<McpTab />);

      const tenantKeyDiv = screen.getByTestId('tenant-key');
      expect(tenantKeyDiv).toHaveTextContent('another-tenant');
    });

    /**
     * Test: Should handle missing tenantKey gracefully
     */
    it('handles missing tenantKey gracefully', () => {
      mockUseParams.mockReturnValue({
        tenantKey: undefined,
        mentorId: 'mentor-456',
      });

      render(<McpTab />);

      // Should still render without crashing
      expect(screen.getByTestId('connector-management-content')).toBeInTheDocument();
    });

    /**
     * Test: Should handle missing mentorId in params
     */
    it('handles missing mentorId in params', () => {
      mockUseParams.mockReturnValue({
        tenantKey: 'test-tenant',
      });

      render(<McpTab />);

      expect(screen.getByTestId('connector-management-content')).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Edge Cases
  // --------------------------------------------------------------------------

  describe('Edge Cases', () => {
    /**
     * Test: Should handle empty params object
     */
    it('handles empty params from useParams', () => {
      mockUseParams.mockReturnValue({});

      expect(() => render(<McpTab />)).not.toThrow();
    });

    /**
     * Test: Should handle very long tenantKey
     */
    it('handles very long tenantKey', () => {
      const longTenantKey = 'a'.repeat(1000);
      mockUseParams.mockReturnValue({
        tenantKey: longTenantKey,
        mentorId: 'mentor-123',
      });

      render(<McpTab />);

      const tenantKeyDiv = screen.getByTestId('tenant-key');
      expect(tenantKeyDiv).toHaveTextContent(longTenantKey);
    });

    /**
     * Test: Should handle special characters in params
     */
    it('handles special characters in params', () => {
      mockUseParams.mockReturnValue({
        tenantKey: 'tenant-with-special-chars-@#$%',
        mentorId: 'mentor-123',
      });

      render(<McpTab />);

      const tenantKeyDiv = screen.getByTestId('tenant-key');
      expect(tenantKeyDiv).toHaveTextContent('tenant-with-special-chars-@#$%');
    });

    /**
     * Test: Should handle special characters in username
     */
    it('handles special characters in username', () => {
      mockUseUsername.mockReturnValue('user+test@example.com');

      render(<McpTab />);

      const usernameDiv = screen.getByTestId('username');
      expect(usernameDiv).toHaveTextContent('user+test@example.com');
    });
  });

  // --------------------------------------------------------------------------
  // Styling Tests
  // --------------------------------------------------------------------------

  describe('Styling', () => {
    /**
     * Test: Header section should exist
     */
    it('renders header section with content', () => {
      render(<McpTab />);

      const header = screen.getByText('MCP');
      expect(header).toBeInTheDocument();
    });

    /**
     * Test: Description should be present
     */
    it('renders description text', () => {
      render(<McpTab />);

      const description = screen.getByText(/Manage Model Context Protocol connectors/);
      expect(description).toBeInTheDocument();
    });

    /**
     * Test: Content area should exist
     */
    it('renders content area', () => {
      const { container } = render(<McpTab />);

      const contentDiv = container.querySelector('.flex-1');
      expect(contentDiv).toBeTruthy();
    });

    /**
     * Test: Header should be hidden on mobile (lg:block)
     */
    it('applies mobile-hidden styling to header', () => {
      const { container } = render(<McpTab />);

      const headerDiv = container.querySelector('.hidden.lg\\:block');
      expect(headerDiv).toBeInTheDocument();
    });

    /**
     * Test: Content area should have responsive padding
     */
    it('applies responsive padding to content area', () => {
      const { container } = render(<McpTab />);

      const contentDiv = container.querySelector('.p-3.lg\\:p-4');
      expect(contentDiv).toBeInTheDocument();
    });

    /**
     * Test: Content area should have overflow styling
     */
    it('applies overflow styling to content area', () => {
      const { container } = render(<McpTab />);

      const contentDiv = container.querySelector('.flex-1');
      expect(contentDiv).toHaveStyle({
        overflowY: 'auto',
        overflowX: 'hidden',
      });
    });
  });

  // --------------------------------------------------------------------------
  // Typography Tests
  // --------------------------------------------------------------------------

  describe('Typography', () => {
    /**
     * Test: Title should have correct typography classes
     */
    it('applies correct typography to title', () => {
      render(<McpTab />);

      const title = screen.getByText('MCP');
      expect(title).toHaveClass('text-base', 'font-medium', 'text-gray-900');
    });

    /**
     * Test: Description should have correct typography classes
     */
    it('applies correct typography to description', () => {
      render(<McpTab />);

      const description = screen.getByText(
        'Manage Model Context Protocol connectors for your mentor.',
      );
      expect(description).toHaveClass('text-gray-700', 'text-xs');
    });

    /**
     * Test: Title should have margin bottom
     */
    it('applies margin bottom to title', () => {
      render(<McpTab />);

      const title = screen.getByText('MCP');
      expect(title).toHaveClass('mb-1');
    });
  });

  // --------------------------------------------------------------------------
  // Layout Tests
  // --------------------------------------------------------------------------

  describe('Layout', () => {
    /**
     * Test: Should render component structure
     */
    it('renders component with proper structure', () => {
      const { container } = render(<McpTab />);

      // Should have content rendered
      expect(container.firstChild).toBeTruthy();
    });

    /**
     * Test: Header content should be present
     */
    it('renders header content', () => {
      render(<McpTab />);

      const header = screen.getByText('MCP');
      expect(header).toBeInTheDocument();
    });

    /**
     * Test: Should render child component
     */
    it('renders ConnectorManagementContent component', () => {
      render(<McpTab />);

      expect(screen.getByTestId('connector-management-content')).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Responsive Design Tests
  // --------------------------------------------------------------------------

  describe('Responsive Design', () => {
    /**
     * Test: Content area should be present
     */
    it('renders content area with styling', () => {
      const { container } = render(<McpTab />);

      const contentDiv = container.querySelector('.flex-1');
      expect(contentDiv).toBeTruthy();
    });

    /**
     * Test: Header should be visible
     */
    it('renders header section', () => {
      render(<McpTab />);

      const header = screen.getByText('MCP');
      expect(header).toBeInTheDocument();
    });

    /**
     * Test: Component structure should be maintained
     */
    it('maintains component structure', () => {
      const { container } = render(<McpTab />);

      // Should have rendered content
      expect(container.querySelector('.flex-1')).toBeTruthy();
      expect(screen.getByTestId('connector-management-content')).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Integration Tests
  // --------------------------------------------------------------------------

  describe('Integration', () => {
    /**
     * Test: Complete component flow with all props
     */
    it('renders complete component with all props correctly', () => {
      render(<McpTab />);

      // Header present
      expect(screen.getByText('MCP')).toBeInTheDocument();
      expect(
        screen.getByText('Manage Model Context Protocol connectors for your mentor.'),
      ).toBeInTheDocument();

      // Child component present
      expect(screen.getByTestId('connector-management-content')).toBeInTheDocument();

      // Props passed correctly
      expect(screen.getByTestId('tenant-key')).toHaveTextContent('test-tenant');
      expect(screen.getByTestId('username')).toHaveTextContent('test-user');
    });

    /**
     * Test: Should re-render when params change
     */
    it('updates when params change', () => {
      const { rerender } = render(<McpTab />);

      expect(screen.getByTestId('tenant-key')).toHaveTextContent('test-tenant');

      // Update params
      mockUseParams.mockReturnValue({
        tenantKey: 'new-tenant',
        mentorId: 'new-mentor',
      });

      rerender(<McpTab />);

      expect(screen.getByTestId('tenant-key')).toHaveTextContent('new-tenant');
    });

    /**
     * Test: Should re-render when username changes
     */
    it('updates when username changes', () => {
      const { rerender } = render(<McpTab />);

      expect(screen.getByTestId('username')).toHaveTextContent('test-user');

      // Update username
      mockUseUsername.mockReturnValue('new-user');

      rerender(<McpTab />);

      expect(screen.getByTestId('username')).toHaveTextContent('new-user');
    });
  });
});
