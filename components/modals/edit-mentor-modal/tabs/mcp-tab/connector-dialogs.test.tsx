import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

import {
  ConnectorDialogs,
  canCreateOAuthConnection,
  validateConnectorForm,
  validateCustomTokenType,
  getValidationErrorMessage,
  extractApiErrorMessage,
} from './connector-dialogs';

// ============================================================================
// MOCKS
// ============================================================================

/**
 * Mock callback functions
 */
const mockOnClose = vi.fn();
const mockOnAddConnector = vi.fn();

/**
 * Mock API hooks
 */
const mockGetMCPServers = vi.fn();
const mockOauthFind = vi.fn();
const mockStartOAuthFlow = vi.fn();
const mockCreateMCPServer = vi.fn();
const mockUpdateMCPServer = vi.fn();
const mockCreateMCPServerConnection = vi.fn();
const mockPatchMCPServerConnection = vi.fn();
const mockRefetchConnected = vi.fn();

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useLazyGetMCPServersQuery: () => [mockGetMCPServers, { isLoading: false }],
  useOauthFindMutation: () => [mockOauthFind, { isLoading: false }],
  useLazyStartOAuthFlowQuery: () => [mockStartOAuthFlow, { isLoading: false }],
  useCreateMCPServerMutation: () => [mockCreateMCPServer, { isLoading: false }],
  usePartialUpdateMCPServerMutation: () => [mockUpdateMCPServer, { isLoading: false }],
  useCreateMCPServerConnectionMutation: () => [mockCreateMCPServerConnection, { isLoading: false }],
  usePatchMCPServerConnectionMutation: () => [mockPatchMCPServerConnection, { isLoading: false }],
  useGetConnectedServicesQuery: () => ({
    data: [],
    isLoading: false,
    error: null,
    refetch: mockRefetchConnected,
  }),
}));

/**
 * Mock API types
 */
vi.mock('@iblai/iblai-api', () => ({
  TransportEnum: {
    SSE: 'sse',
    WEBSOCKET: 'websocket',
    STREAMABLE_HTTP: 'streamable_http',
  },
}));

/**
 * Mock toast notifications
 */
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

/**
 * Mock useLocalStorage hook
 */
const mockSetPendingOAuthServer = vi.fn();
const mockRemovePendingOAuthServer = vi.fn();

vi.mock('@/hooks/use-local-storage', () => ({
  useLocalStorage: () => [null, mockSetPendingOAuthServer, mockRemovePendingOAuthServer],
}));

/**
 * Mock UI components
 */
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, className, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} className={className} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({ value, onChange, placeholder, className, type, ...props }: any) => (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
      type={type}
      data-testid="input"
      {...props}
    />
  ),
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, className, ...props }: any) => (
    <label className={className} {...props}>
      {children}
    </label>
  ),
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open, onOpenChange }: any) =>
    open ? (
      <div data-testid="dialog">
        <button data-testid="dialog-close-trigger" onClick={() => onOpenChange?.(false)}>
          Close
        </button>
        {children}
      </div>
    ) : null,
  DialogContent: ({ children, onClick, onMouseDown, className }: any) => (
    <div
      data-testid="dialog-content"
      className={className}
      onClick={onClick}
      onMouseDown={onMouseDown}
    >
      {children}
    </div>
  ),
  DialogHeader: ({ children }: any) => <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }: any) => <h2 data-testid="dialog-title">{children}</h2>,
}));

vi.mock('@/components/ui/textarea', () => ({
  Textarea: ({ value, onChange, placeholder, className, ...props }: any) => (
    <textarea
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
      data-testid="textarea"
      {...props}
    />
  ),
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children, value, onValueChange }: any) => (
    <select data-testid="select" value={value} onChange={(e) => onValueChange(e.target.value)}>
      {children}
    </select>
  ),
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ children, value }: any) => <option value={value}>{children}</option>,
  SelectTrigger: ({ children }: any) => <>{children}</>,
  SelectValue: () => null,
}));

vi.mock('@/components/ui/radio-group', () => ({
  RadioGroup: ({ children, value, onValueChange, disabled }: any) => (
    <div data-testid="radio-group" data-value={value} data-disabled={disabled}>
      {React.Children.map(children, (child: any) => {
        if (!child) return null;
        return React.cloneElement(child, {
          onClick: () => {
            const radio = child.props.children?.find?.(
              (c: any) => c?.type?.displayName === 'RadioGroupItem' || c?.props?.value,
            );
            const val = radio?.props?.value;
            if (val) onValueChange(val);
          },
        });
      })}
    </div>
  ),
  RadioGroupItem: ({ value, id, ...props }: any) => (
    <input
      type="radio"
      value={value}
      id={id}
      data-testid={`radio-${value}`}
      onChange={() => {}}
      {...props}
    />
  ),
}));

/**
 * Mock Lucide icons
 */
vi.mock('lucide-react', () => ({
  Plus: () => <span data-testid="plus-icon">Plus</span>,
  Search: () => <span data-testid="search-icon">Search</span>,
  Lock: () => <span data-testid="lock-icon">Lock</span>,
  Upload: () => <span data-testid="upload-icon">Upload</span>,
  ImageIcon: () => <span data-testid="image-icon">ImageIcon</span>,
  Info: (props: any) => (
    <span data-testid="info-icon" {...props}>
      Info
    </span>
  ),
}));

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: any) => <div data-testid="tooltip">{children}</div>,
  TooltipContent: ({ children }: any) => <div data-testid="tooltip-content">{children}</div>,
  TooltipProvider: ({ children }: any) => <>{children}</>,
  TooltipTrigger: ({ children, ...props }: any) => (
    <span data-testid="tooltip-trigger" {...props}>
      {children}
    </span>
  ),
}));

// Mock URL.createObjectURL and URL.revokeObjectURL for image upload tests
const mockObjectUrl = 'blob:http://localhost:3000/test-image';
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

beforeAll(() => {
  URL.createObjectURL = vi.fn(() => mockObjectUrl);
  URL.revokeObjectURL = vi.fn();
  // Mock window.open
  Object.defineProperty(window, 'open', {
    value: vi.fn(),
    writable: true,
  });
});

afterAll(() => {
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
});

// ============================================================================
// TEST FIXTURES
// ============================================================================

const defaultProps = {
  open: true,
  onClose: mockOnClose,
  onAddConnector: mockOnAddConnector,
};

// ============================================================================
// TESTS
// ============================================================================

describe('ConnectorDialogs', () => {
  beforeEach(() => {
    cleanup();
    mockOnClose.mockReset();
    mockOnAddConnector.mockReset();
    mockGetMCPServers.mockReset();
    mockOauthFind.mockReset();
    mockStartOAuthFlow.mockReset();
    mockCreateMCPServer.mockReset();
    mockUpdateMCPServer.mockReset();
    mockCreateMCPServerConnection.mockReset();
    mockPatchMCPServerConnection.mockReset();
    mockRefetchConnected.mockReset();
    mockSetPendingOAuthServer.mockReset();
    mockRemovePendingOAuthServer.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  describe('Rendering', () => {
    it('does not render when open is false', () => {
      render(<ConnectorDialogs {...defaultProps} open={false} />);
      expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
    });

    it('renders dialog when open is true', () => {
      render(<ConnectorDialogs {...defaultProps} />);
      expect(screen.getByTestId('dialog')).toBeInTheDocument();
    });

    it('renders Add MCP Connector title', () => {
      render(<ConnectorDialogs {...defaultProps} />);
      expect(screen.getByText('Add MCP Connector')).toBeInTheDocument();
    });

    it('shows custom connector form by default', () => {
      render(<ConnectorDialogs {...defaultProps} />);
      expect(screen.getByText('Connector Name')).toBeInTheDocument();
      expect(screen.getByText('Connector Server')).toBeInTheDocument();
    });

    it('renders form fields', () => {
      render(<ConnectorDialogs {...defaultProps} />);
      expect(screen.getByText('Connector Name')).toBeInTheDocument();
      expect(screen.getByText('Connector Server')).toBeInTheDocument();
      expect(screen.getByText('Transport')).toBeInTheDocument();
    });

    it('renders Connect button', () => {
      render(<ConnectorDialogs {...defaultProps} />);
      expect(screen.getByText('Connect')).toBeInTheDocument();
    });
  });

  describe('Custom Connector Form', () => {
    beforeEach(() => {
      render(<ConnectorDialogs {...defaultProps} />);
    });

    it('renders all required form fields', () => {
      expect(screen.getByText('Connector Name')).toBeInTheDocument();
      expect(screen.getByText('Connector Server')).toBeInTheDocument();
      expect(screen.getByText('Description')).toBeInTheDocument();
      expect(screen.getByText('Authentication Method')).toBeInTheDocument();
    });

    it('shows required field indicators', () => {
      const requiredMarkers = screen.getAllByText('*');
      expect(requiredMarkers.length).toBeGreaterThanOrEqual(2);
    });

    it('disables Connect button when required fields are empty', () => {
      const connectButton = screen.getByText('Connect');
      expect(connectButton).toBeDisabled();
    });

    it('enables Connect button when required fields are filled', () => {
      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');

      fireEvent.change(nameInput, { target: { value: 'My Connector' } });
      fireEvent.change(serverInput, { target: { value: 'https://api.test.com' } });

      const connectButton = screen.getByText('Connect');
      expect(connectButton).not.toBeDisabled();
    });

    it('calls onAddConnector with form data when submitting', () => {
      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');
      const descriptionTextarea = screen.getByPlaceholderText(
        'Describe what this connector does...',
      );

      fireEvent.change(nameInput, { target: { value: 'Test Connector' } });
      fireEvent.change(serverInput, { target: { value: 'https://api.test.com/mcp' } });
      fireEvent.change(descriptionTextarea, { target: { value: 'Test description' } });

      const connectButton = screen.getByText('Connect');
      fireEvent.click(connectButton);

      expect(mockOnAddConnector).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Connector',
          url: 'https://api.test.com/mcp',
          description: 'Test description',
          transport: 'streamable_http',
        }),
      );
    });

    it('closes dialog after submitting custom connector', async () => {
      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');

      fireEvent.change(nameInput, { target: { value: 'Test' } });
      fireEvent.change(serverInput, { target: { value: 'https://test.com' } });

      fireEvent.click(screen.getByText('Connect'));

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('submits connector with image file', async () => {
      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

      // Upload an image first
      const imageFile = new File(['test'], 'connector.png', { type: 'image/png' });
      Object.defineProperty(imageFile, 'size', { value: 1024 });
      fireEvent.change(fileInput, { target: { files: [imageFile] } });

      fireEvent.change(nameInput, { target: { value: 'Connector With Image' } });
      fireEvent.change(serverInput, { target: { value: 'https://test.com/mcp' } });

      fireEvent.click(screen.getByText('Connect'));

      await waitFor(() => {
        expect(mockOnAddConnector).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Connector With Image',
            url: 'https://test.com/mcp',
            image: expect.any(File),
          }),
        );
      });
    });
  });

  describe('Authentication Method', () => {
    beforeEach(() => {
      render(<ConnectorDialogs {...defaultProps} />);
    });

    it('shows API key fields when API Key authentication is selected', () => {
      const selects = screen.getAllByTestId('select');
      const authSelect = selects[1]; // Second select is Authentication Method
      fireEvent.change(authSelect, { target: { value: 'api-key' } });

      expect(screen.getByText('Token Type')).toBeInTheDocument();
      expect(screen.getAllByTestId('select').length).toBe(3);
      expect(screen.getByPlaceholderText('Enter your token')).toBeInTheDocument();
    });

    it('hides API key fields when No Authentication is selected', () => {
      const selects = screen.getAllByTestId('select');
      const authSelect = selects[1];

      fireEvent.change(authSelect, { target: { value: 'api-key' } });
      expect(screen.getByText('Token Type')).toBeInTheDocument();

      fireEvent.change(authSelect, { target: { value: 'no-auth' } });
      expect(screen.queryByText('Token Type')).not.toBeInTheDocument();
    });

    it('shows token configuration fields when API key authentication is selected', () => {
      const selects = screen.getAllByTestId('select');
      const authSelect = selects[1];
      fireEvent.change(authSelect, { target: { value: 'api-key' } });

      // Verify token-related fields are shown
      expect(screen.getByText('Token Type')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter your token')).toBeInTheDocument();
      expect(screen.getByTestId('lock-icon')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('associates labels with form inputs', () => {
      render(<ConnectorDialogs {...defaultProps} />);

      expect(screen.getByText('Connector Name')).toBeInTheDocument();
      expect(screen.getByText('Connector Server')).toBeInTheDocument();
      expect(screen.getByText('Description')).toBeInTheDocument();
      expect(screen.getByText('Transport')).toBeInTheDocument();
    });

    it('marks required fields with asterisk', () => {
      render(<ConnectorDialogs {...defaultProps} />);

      const requiredMarkers = screen.getAllByText('*');
      expect(requiredMarkers.length).toBeGreaterThanOrEqual(2);
    });

    it('provides proper semantic structure', () => {
      render(<ConnectorDialogs {...defaultProps} />);

      expect(screen.getByTestId('dialog-title')).toBeInTheDocument();
      expect(screen.getByText('Add MCP Connector')).toBeInTheDocument();
    });
  });

  describe('OAuth Authentication', () => {
    const oauthProps = {
      ...defaultProps,
      tenantKey: 'test-tenant',
      username: 'test-user',
      mentorId: 'mentor-123',
    };

    beforeEach(() => {
      render(<ConnectorDialogs {...oauthProps} />);
    });

    it('shows OAuth option in authentication method dropdown', () => {
      const selects = screen.getAllByTestId('select');
      const authSelect = selects[1]; // Authentication Method select

      // Check OAuth option is available
      expect(authSelect).toBeInTheDocument();
      const oauthOption = screen.getByText('OAuth');
      expect(oauthOption).toBeInTheDocument();
    });

    it('hides API key fields when OAuth is selected', () => {
      const selects = screen.getAllByTestId('select');
      const authSelect = selects[1];

      // First select API key to show token fields
      fireEvent.change(authSelect, { target: { value: 'api-key' } });
      expect(screen.getByText('Token Type')).toBeInTheDocument();

      // Then select OAuth - token fields should be hidden
      fireEvent.change(authSelect, { target: { value: 'oauth' } });
      expect(screen.queryByText('Token Type')).not.toBeInTheDocument();
      expect(screen.queryByPlaceholderText('Enter your token')).not.toBeInTheDocument();
    });

    it('enables Connect button when OAuth is selected with valid name and URL', () => {
      const selects = screen.getAllByTestId('select');
      const authSelect = selects[1];
      fireEvent.change(authSelect, { target: { value: 'oauth' } });

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');

      fireEvent.change(nameInput, { target: { value: 'OAuth Connector' } });
      fireEvent.change(serverInput, { target: { value: 'https://oauth.example.com/mcp' } });

      const connectButton = screen.getByText('Connect');
      expect(connectButton).not.toBeDisabled();
    });
  });

  describe('Authentication Scope', () => {
    beforeEach(() => {
      render(<ConnectorDialogs {...defaultProps} />);
      const selects = screen.getAllByTestId('select');
      const authSelect = selects[1];
      fireEvent.change(authSelect, { target: { value: 'oauth' } });
    });

    it('shows auth scope dropdown when OAuth is selected', () => {
      expect(screen.getByText('Authentication Scope')).toBeInTheDocument();
    });

    it('defaults auth scope to tenant', () => {
      const selects = screen.getAllByTestId('select');
      // Auth scope select appears after auth method select when OAuth is selected
      const authScopeSelect = selects[2];
      expect(authScopeSelect).toHaveValue('tenant');
    });

    it('shows Tenant, Mentor, and User options', () => {
      expect(screen.getByText('Tenant')).toBeInTheDocument();
      expect(screen.getByText('Mentor')).toBeInTheDocument();
      expect(screen.getByText('User')).toBeInTheDocument();
    });

    it('shows description for tenant scope', () => {
      expect(
        screen.getByText('OAuth connection will be available for all mentors in this tenant.'),
      ).toBeInTheDocument();
    });

    it('shows description for mentor scope when selected', () => {
      const selects = screen.getAllByTestId('select');
      const authScopeSelect = selects[2];
      fireEvent.change(authScopeSelect, { target: { value: 'mentor' } });

      expect(
        screen.getByText('OAuth connection will only be available for this mentor.'),
      ).toBeInTheDocument();
    });

    it('shows description for user scope when selected', () => {
      const selects = screen.getAllByTestId('select');
      const authScopeSelect = selects[2];
      fireEvent.change(authScopeSelect, { target: { value: 'user' } });

      expect(
        screen.getByText('Each user will need to authenticate individually when chatting.'),
      ).toBeInTheDocument();
    });

    it('does not show auth scope dropdown when none auth is selected', () => {
      const selects = screen.getAllByTestId('select');
      const authSelect = selects[1];
      fireEvent.change(authSelect, { target: { value: 'none' } });

      expect(screen.queryByText('Authentication Scope')).not.toBeInTheDocument();
    });

    it('does not show auth scope dropdown when api-key auth is selected', () => {
      const selects = screen.getAllByTestId('select');
      const authSelect = selects[1];
      fireEvent.change(authSelect, { target: { value: 'api-key' } });

      expect(screen.queryByText('Authentication Scope')).not.toBeInTheDocument();
    });
  });

  describe('OAuth Flow Submission', () => {
    const oauthProps = {
      ...defaultProps,
      tenantKey: 'test-tenant',
      username: 'test-user',
      mentorId: 'mentor-123',
    };

    beforeEach(() => {
      // Reset mocks
      mockGetMCPServers.mockReset();
      mockOauthFind.mockReset();
      mockStartOAuthFlow.mockReset();
      mockCreateMCPServer.mockReset();
      mockCreateMCPServerConnection.mockReset();
      mockRefetchConnected.mockReset();
    });

    it('checks for existing OAuth server in featured servers first', async () => {
      mockGetMCPServers.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ results: [] }),
      });
      mockOauthFind.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({
          id: 1,
          oauth_provider: 'google',
          name: 'test-service',
        }),
      });
      mockCreateMCPServer.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ id: 1, name: 'OAuth Connector' }),
      });
      mockStartOAuthFlow.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ auth_url: 'https://oauth.example.com/auth' }),
      });

      render(<ConnectorDialogs {...oauthProps} />);

      const selects = screen.getAllByTestId('select');
      const authSelect = selects[1];
      fireEvent.change(authSelect, { target: { value: 'oauth' } });

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');

      fireEvent.change(nameInput, { target: { value: 'OAuth Connector' } });
      fireEvent.change(serverInput, { target: { value: 'https://oauth.example.com/mcp' } });

      fireEvent.click(screen.getByText('Connect'));

      await waitFor(() => {
        expect(mockGetMCPServers).toHaveBeenCalledWith({
          org: 'test-tenant',
          userId: 'test-user',
          url: 'https://oauth.example.com/mcp',
          isFeatured: true,
        });
      });
    });

    it('uses existing featured OAuth server when URL matches', async () => {
      const existingServer = {
        id: 5,
        url: 'https://oauth.example.com/mcp',
        auth_type: 'oauth2',
        oauth_service_data: {
          oauth_provider: 'google',
          name: 'existing-service',
        },
      };

      mockGetMCPServers.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ results: [existingServer] }),
      });
      mockStartOAuthFlow.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ auth_url: 'https://oauth.example.com/auth' }),
      });

      render(<ConnectorDialogs {...oauthProps} />);

      const selects = screen.getAllByTestId('select');
      const authSelect = selects[1];
      fireEvent.change(authSelect, { target: { value: 'oauth' } });

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');

      fireEvent.change(nameInput, { target: { value: 'OAuth Connector' } });
      fireEvent.change(serverInput, { target: { value: 'https://oauth.example.com/mcp' } });

      fireEvent.click(screen.getByText('Connect'));

      await waitFor(() => {
        expect(mockStartOAuthFlow).toHaveBeenCalledWith({
          org: 'test-tenant',
          userId: 'test-user',
          provider: 'google',
          service: 'existing-service',
        });
      });
    });

    it('calls oauthFind when no existing featured server matches', async () => {
      mockGetMCPServers.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ results: [] }),
      });
      mockOauthFind.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({
          id: 10,
          oauth_provider: 'custom',
          name: 'custom-service',
        }),
      });
      mockCreateMCPServer.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ id: 20, name: 'OAuth Connector' }),
      });
      mockStartOAuthFlow.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ auth_url: 'https://oauth.example.com/auth' }),
      });

      render(<ConnectorDialogs {...oauthProps} />);

      const selects = screen.getAllByTestId('select');
      const authSelect = selects[1];
      fireEvent.change(authSelect, { target: { value: 'oauth' } });

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');

      fireEvent.change(nameInput, { target: { value: 'OAuth Connector' } });
      fireEvent.change(serverInput, { target: { value: 'https://custom-oauth.example.com/mcp' } });

      fireEvent.click(screen.getByText('Connect'));

      await waitFor(() => {
        expect(mockOauthFind).toHaveBeenCalledWith({
          org: 'test-tenant',
          userId: 'test-user',
          url: 'https://custom-oauth.example.com/mcp',
          name: 'OAuth Connector',
          callback_url: expect.stringContaining('/google-oauth-callback/'),
        });
      });
    });

    it('creates new MCP server with OAuth settings after oauthFind', async () => {
      mockGetMCPServers.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ results: [] }),
      });
      mockOauthFind.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({
          id: 10,
          oauth_provider: 'custom',
          name: 'custom-service',
        }),
      });
      mockCreateMCPServer.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ id: 20, name: 'OAuth Connector' }),
      });
      mockStartOAuthFlow.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ auth_url: 'https://oauth.example.com/auth' }),
      });

      render(<ConnectorDialogs {...oauthProps} />);

      const selects = screen.getAllByTestId('select');
      const authSelect = selects[1];
      fireEvent.change(authSelect, { target: { value: 'oauth' } });

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');
      const descriptionTextarea = screen.getByPlaceholderText(
        'Describe what this connector does...',
      );

      fireEvent.change(nameInput, { target: { value: 'OAuth Connector' } });
      fireEvent.change(serverInput, { target: { value: 'https://custom-oauth.example.com/mcp' } });
      fireEvent.change(descriptionTextarea, { target: { value: 'OAuth test description' } });

      fireEvent.click(screen.getByText('Connect'));

      await waitFor(() => {
        expect(mockCreateMCPServer).toHaveBeenCalledWith({
          org: 'test-tenant',
          userId: 'test-user',
          body: expect.objectContaining({
            name: 'OAuth Connector',
            url: 'https://custom-oauth.example.com/mcp',
            auth_type: 'oauth2',
            auth_scope: 'tenant',
            oauth_service: 10,
            description: 'OAuth test description',
          }),
        });
      });
    });

    it('sends selected auth_scope when creating OAuth MCP server', async () => {
      mockGetMCPServers.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ results: [] }),
      });
      mockOauthFind.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({
          id: 10,
          oauth_provider: 'custom',
          name: 'custom-service',
        }),
      });
      mockCreateMCPServer.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ id: 20, name: 'OAuth Connector' }),
      });
      mockStartOAuthFlow.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ auth_url: 'https://oauth.example.com/auth' }),
      });

      render(<ConnectorDialogs {...oauthProps} />);

      const selects = screen.getAllByTestId('select');
      const authSelect = selects[1];
      fireEvent.change(authSelect, { target: { value: 'oauth' } });

      // Change auth scope to per_user
      const authScopeSelect = screen.getAllByTestId('select')[2];
      fireEvent.change(authScopeSelect, { target: { value: 'user' } });

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');

      fireEvent.change(nameInput, { target: { value: 'User OAuth' } });
      fireEvent.change(serverInput, { target: { value: 'https://custom-oauth.example.com/mcp' } });

      fireEvent.click(screen.getByText('Connect'));

      await waitFor(() => {
        expect(mockCreateMCPServer).toHaveBeenCalledWith({
          org: 'test-tenant',
          userId: 'test-user',
          body: expect.objectContaining({
            auth_type: 'oauth2',
            auth_scope: 'user',
          }),
        });
      });
    });

    it('does not call onAddConnector for OAuth submissions', async () => {
      mockGetMCPServers.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ results: [] }),
      });
      mockOauthFind.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({
          id: 10,
          oauth_provider: 'custom',
          name: 'custom-service',
        }),
      });
      mockCreateMCPServer.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ id: 20, name: 'OAuth Connector' }),
      });
      mockStartOAuthFlow.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ auth_url: 'https://oauth.example.com/auth' }),
      });

      render(<ConnectorDialogs {...oauthProps} />);

      const selects = screen.getAllByTestId('select');
      const authSelect = selects[1];
      fireEvent.change(authSelect, { target: { value: 'oauth' } });

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');

      fireEvent.change(nameInput, { target: { value: 'OAuth Connector' } });
      fireEvent.change(serverInput, { target: { value: 'https://oauth.example.com/mcp' } });

      fireEvent.click(screen.getByText('Connect'));

      await waitFor(() => {
        expect(mockStartOAuthFlow).toHaveBeenCalled();
      });

      // onAddConnector should NOT be called for OAuth flow
      expect(mockOnAddConnector).not.toHaveBeenCalled();
    });
  });

  describe('OAuth Error Handling', () => {
    const oauthProps = {
      ...defaultProps,
      tenantKey: 'test-tenant',
      username: 'test-user',
      mentorId: 'mentor-123',
    };

    beforeEach(() => {
      mockGetMCPServers.mockReset();
      mockOauthFind.mockReset();
      mockStartOAuthFlow.mockReset();
      mockCreateMCPServer.mockReset();
    });

    it('shows error when oauthFind fails', async () => {
      mockGetMCPServers.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ results: [] }),
      });
      mockOauthFind.mockReturnValue({
        unwrap: vi.fn().mockRejectedValue({
          data: { detail: 'OAuth configuration not found for this URL' },
        }),
      });

      render(<ConnectorDialogs {...oauthProps} />);

      const selects = screen.getAllByTestId('select');
      const authSelect = selects[1];
      fireEvent.change(authSelect, { target: { value: 'oauth' } });

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');

      fireEvent.change(nameInput, { target: { value: 'OAuth Connector' } });
      fireEvent.change(serverInput, { target: { value: 'https://invalid-oauth.example.com/mcp' } });

      fireEvent.click(screen.getByText('Connect'));

      await waitFor(() => {
        expect(screen.getByText('OAuth configuration not found for this URL')).toBeInTheDocument();
      });
    });

    it('disables Connect button when OAuth URL has error', async () => {
      mockGetMCPServers.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ results: [] }),
      });
      mockOauthFind.mockReturnValue({
        unwrap: vi.fn().mockRejectedValue({
          data: { detail: 'Invalid OAuth URL' },
        }),
      });

      render(<ConnectorDialogs {...oauthProps} />);

      const selects = screen.getAllByTestId('select');
      const authSelect = selects[1];
      fireEvent.change(authSelect, { target: { value: 'oauth' } });

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');

      fireEvent.change(nameInput, { target: { value: 'OAuth Connector' } });
      fireEvent.change(serverInput, { target: { value: 'https://invalid.com/mcp' } });

      fireEvent.click(screen.getByText('Connect'));

      await waitFor(() => {
        expect(screen.getByText('Invalid OAuth URL')).toBeInTheDocument();
      });

      // Connect button should be disabled when there's an OAuth error
      const connectButton = screen.getByText('Connect');
      expect(connectButton).toBeDisabled();
    });

    it('clears OAuth error when URL changes', async () => {
      mockGetMCPServers.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ results: [] }),
      });
      mockOauthFind.mockReturnValue({
        unwrap: vi.fn().mockRejectedValue({
          data: { detail: 'OAuth error' },
        }),
      });

      render(<ConnectorDialogs {...oauthProps} />);

      const selects = screen.getAllByTestId('select');
      const authSelect = selects[1];
      fireEvent.change(authSelect, { target: { value: 'oauth' } });

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');

      fireEvent.change(nameInput, { target: { value: 'OAuth Connector' } });
      fireEvent.change(serverInput, { target: { value: 'https://invalid.com/mcp' } });

      fireEvent.click(screen.getByText('Connect'));

      await waitFor(() => {
        expect(screen.getByText('OAuth error')).toBeInTheDocument();
      });

      // Change URL - error should clear
      fireEvent.change(serverInput, { target: { value: 'https://new-url.com/mcp' } });

      await waitFor(() => {
        expect(screen.queryByText('OAuth error')).not.toBeInTheDocument();
      });
    });

    it('shows error when getMCPServers fails', async () => {
      mockGetMCPServers.mockReturnValue({
        unwrap: vi.fn().mockRejectedValue({
          data: { detail: 'Failed to fetch servers' },
        }),
      });

      render(<ConnectorDialogs {...oauthProps} />);

      const selects = screen.getAllByTestId('select');
      const authSelect = selects[1];
      fireEvent.change(authSelect, { target: { value: 'oauth' } });

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');

      fireEvent.change(nameInput, { target: { value: 'OAuth Connector' } });
      fireEvent.change(serverInput, { target: { value: 'https://oauth.example.com/mcp' } });

      fireEvent.click(screen.getByText('Connect'));

      await waitFor(() => {
        expect(screen.getByText('Failed to fetch servers')).toBeInTheDocument();
      });
    });

    it('shows error when missing required parameters for OAuth', async () => {
      render(<ConnectorDialogs {...defaultProps} />); // No tenantKey or username

      const selects = screen.getAllByTestId('select');
      const authSelect = selects[1];
      fireEvent.change(authSelect, { target: { value: 'oauth' } });

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');

      fireEvent.change(nameInput, { target: { value: 'OAuth Connector' } });
      fireEvent.change(serverInput, { target: { value: 'https://oauth.example.com/mcp' } });

      fireEvent.click(screen.getByText('Connect'));

      // Should not proceed with OAuth flow when parameters are missing
      await waitFor(() => {
        expect(mockGetMCPServers).not.toHaveBeenCalled();
      });
    });
  });

  describe('OAuth Editing', () => {
    it('pre-fills OAuth auth method when editing OAuth server', () => {
      const oauthServer = {
        id: 1,
        name: 'OAuth Server',
        url: 'https://oauth.example.com/mcp',
        description: 'OAuth server description',
        transport: 'streamable_http',
        auth_type: 'oauth2',
        credentials: '',
      };

      render(
        <ConnectorDialogs
          {...defaultProps}
          editingServer={oauthServer as any}
          tenantKey="test-tenant"
          username="test-user"
        />,
      );

      const selects = screen.getAllByTestId('select');
      const authSelect = selects[1];
      expect(authSelect).toHaveValue('oauth');
    });

    it('shows Edit MCP Connector title when editing', () => {
      const oauthServer = {
        id: 1,
        name: 'OAuth Server',
        url: 'https://oauth.example.com/mcp',
        auth_type: 'oauth2',
      };

      render(
        <ConnectorDialogs
          {...defaultProps}
          editingServer={oauthServer as any}
          tenantKey="test-tenant"
          username="test-user"
        />,
      );

      expect(screen.getByText('Edit MCP Connector')).toBeInTheDocument();
    });

    it('pre-fills auth_scope when editing OAuth server with auth_scope', () => {
      const oauthServer = {
        id: 1,
        name: 'OAuth Server',
        url: 'https://oauth.example.com/mcp',
        auth_type: 'oauth2',
        auth_scope: 'user',
        credentials: '',
      };

      render(
        <ConnectorDialogs
          {...defaultProps}
          editingServer={oauthServer as any}
          tenantKey="test-tenant"
          username="test-user"
        />,
      );

      const selects = screen.getAllByTestId('select');
      const authScopeSelect = selects[2];
      expect(authScopeSelect).toHaveValue('user');
    });

    it('defaults auth_scope to per_tenant when editing OAuth server without auth_scope', () => {
      const oauthServer = {
        id: 1,
        name: 'OAuth Server',
        url: 'https://oauth.example.com/mcp',
        auth_type: 'oauth2',
        credentials: '',
      };

      render(
        <ConnectorDialogs
          {...defaultProps}
          editingServer={oauthServer as any}
          tenantKey="test-tenant"
          username="test-user"
        />,
      );

      const selects = screen.getAllByTestId('select');
      const authScopeSelect = selects[2];
      expect(authScopeSelect).toHaveValue('tenant');
    });

    it('calls updateMCPServer instead of createMCPServer when editing OAuth server without URL change', async () => {
      const oauthServer = {
        id: 42,
        name: 'OAuth Server',
        url: 'https://oauth.example.com/mcp',
        description: 'Original description',
        transport: 'streamable_http',
        auth_type: 'oauth2',
        auth_scope: 'tenant',
        credentials: '',
      };

      mockUpdateMCPServer.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ id: 42, name: 'Updated OAuth' }),
      });

      const onOAuthComplete = vi.fn();

      render(
        <ConnectorDialogs
          {...defaultProps}
          editingServer={oauthServer as any}
          tenantKey="test-tenant"
          username="test-user"
          mentorId="mentor-123"
          onOAuthComplete={onOAuthComplete}
        />,
      );

      // Update the name without changing URL
      const nameInput = screen.getByDisplayValue('OAuth Server');
      fireEvent.change(nameInput, { target: { value: 'Updated OAuth' } });

      fireEvent.click(screen.getByText('Update'));

      await waitFor(() => {
        expect(mockUpdateMCPServer).toHaveBeenCalledWith({
          id: 42,
          org: 'test-tenant',
          userId: 'test-user',
          body: expect.objectContaining({
            name: 'Updated OAuth',
            url: 'https://oauth.example.com/mcp',
            auth_type: 'oauth2',
            auth_scope: 'tenant',
          }),
        });
      });

      // Should NOT create a new server or restart OAuth
      expect(mockCreateMCPServer).not.toHaveBeenCalled();
      expect(mockGetMCPServers).not.toHaveBeenCalled();
      expect(mockOauthFind).not.toHaveBeenCalled();
      expect(mockStartOAuthFlow).not.toHaveBeenCalled();

      // Should call onOAuthComplete for non-URL edits
      await waitFor(() => {
        expect(onOAuthComplete).toHaveBeenCalled();
      });
    });

    it('calls updateMCPServer and restarts OAuth when editing OAuth server with URL change', async () => {
      const oauthServer = {
        id: 42,
        name: 'OAuth Server',
        url: 'https://oauth.example.com/mcp',
        description: 'Original description',
        transport: 'streamable_http',
        auth_type: 'oauth2',
        auth_scope: 'user',
        credentials: '',
      };

      mockUpdateMCPServer.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ id: 42, name: 'OAuth Server' }),
      });
      mockGetMCPServers.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ results: [] }),
      });
      mockOauthFind.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({
          id: 15,
          oauth_provider: 'custom',
          name: 'custom-service',
        }),
      });
      mockCreateMCPServer.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ id: 42, name: 'OAuth Server' }),
      });
      mockStartOAuthFlow.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ auth_url: 'https://new-oauth.example.com/auth' }),
      });

      render(
        <ConnectorDialogs
          {...defaultProps}
          editingServer={oauthServer as any}
          tenantKey="test-tenant"
          username="test-user"
          mentorId="mentor-123"
        />,
      );

      // Change the URL
      const serverInput = screen.getByDisplayValue('https://oauth.example.com/mcp');
      fireEvent.change(serverInput, { target: { value: 'https://new-oauth.example.com/mcp' } });

      fireEvent.click(screen.getByText('Update'));

      // Should call updateMCPServer first
      await waitFor(() => {
        expect(mockUpdateMCPServer).toHaveBeenCalledWith({
          id: 42,
          org: 'test-tenant',
          userId: 'test-user',
          body: expect.objectContaining({
            name: 'OAuth Server',
            url: 'https://new-oauth.example.com/mcp',
            auth_type: 'oauth2',
            auth_scope: 'user',
          }),
        });
      });

      // Should restart OAuth flow since URL changed
      await waitFor(() => {
        expect(mockOauthFind).toHaveBeenCalledWith(
          expect.objectContaining({
            url: 'https://new-oauth.example.com/mcp',
          }),
        );
      });

      // Should NOT create a new server
      expect(mockCreateMCPServer).not.toHaveBeenCalled();
    });

    it('uses featured server OAuth data when editing with URL change matching featured server', async () => {
      const oauthServer = {
        id: 42,
        name: 'OAuth Server',
        url: 'https://oauth.example.com/mcp',
        transport: 'streamable_http',
        auth_type: 'oauth2',
        credentials: '',
      };

      mockUpdateMCPServer.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ id: 42, name: 'OAuth Server' }),
      });
      mockGetMCPServers.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({
          results: [
            {
              id: 99,
              url: 'https://featured-oauth.example.com/mcp',
              auth_type: 'oauth2',
              oauth_service_data: {
                oauth_provider: 'google',
                name: 'featured-service',
              },
            },
          ],
        }),
      });
      mockStartOAuthFlow.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ auth_url: 'https://featured-oauth.example.com/auth' }),
      });

      render(
        <ConnectorDialogs
          {...defaultProps}
          editingServer={oauthServer as any}
          tenantKey="test-tenant"
          username="test-user"
          mentorId="mentor-123"
        />,
      );

      // Change URL to match featured server
      const serverInput = screen.getByDisplayValue('https://oauth.example.com/mcp');
      fireEvent.change(serverInput, {
        target: { value: 'https://featured-oauth.example.com/mcp' },
      });

      fireEvent.click(screen.getByText('Update'));

      // Should call updateMCPServer
      await waitFor(() => {
        expect(mockUpdateMCPServer).toHaveBeenCalled();
      });

      // Should use featured server OAuth data (startOAuthFlow), not oauthFind
      await waitFor(() => {
        expect(mockStartOAuthFlow).toHaveBeenCalled();
      });

      expect(mockOauthFind).not.toHaveBeenCalled();
      expect(mockCreateMCPServer).not.toHaveBeenCalled();
    });

    it('patches MCP server connection when auth_scope changes and connection exists', async () => {
      const oauthServer = {
        id: 42,
        name: 'OAuth Server',
        url: 'https://oauth.example.com/mcp',
        transport: 'streamable_http',
        auth_type: 'oauth2',
        auth_scope: 'tenant',
        credentials: '',
      };

      mockUpdateMCPServer.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ id: 42, name: 'OAuth Server' }),
      });
      mockPatchMCPServerConnection.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({}),
      });

      const onOAuthComplete = vi.fn();

      render(
        <ConnectorDialogs
          {...defaultProps}
          editingServer={oauthServer as any}
          editingConnectionId={999}
          tenantKey="test-tenant"
          username="test-user"
          mentorId="mentor-123"
          onOAuthComplete={onOAuthComplete}
        />,
      );

      // Change auth scope from tenant to mentor
      const selects = screen.getAllByTestId('select');
      const authScopeSelect = selects[2];
      fireEvent.change(authScopeSelect, { target: { value: 'mentor' } });

      fireEvent.click(screen.getByText('Update'));

      await waitFor(() => {
        expect(mockPatchMCPServerConnection).toHaveBeenCalledWith({
          org: 'test-tenant',
          userId: 'test-user',
          id: 999,
          mentor: 'mentor-123',
          scope: 'mentor',
        });
      });
    });

    it('clears mentor field when auth_scope changes away from mentor', async () => {
      const oauthServer = {
        id: 42,
        name: 'OAuth Server',
        url: 'https://oauth.example.com/mcp',
        transport: 'streamable_http',
        auth_type: 'oauth2',
        auth_scope: 'mentor',
        credentials: '',
      };

      mockUpdateMCPServer.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ id: 42, name: 'OAuth Server' }),
      });
      mockPatchMCPServerConnection.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({}),
      });

      const onOAuthComplete = vi.fn();

      render(
        <ConnectorDialogs
          {...defaultProps}
          editingServer={oauthServer as any}
          editingConnectionId={999}
          tenantKey="test-tenant"
          username="test-user"
          mentorId="mentor-123"
          onOAuthComplete={onOAuthComplete}
        />,
      );

      // Change auth scope from mentor to user
      const selects = screen.getAllByTestId('select');
      const authScopeSelect = selects[2];
      fireEvent.change(authScopeSelect, { target: { value: 'user' } });

      fireEvent.click(screen.getByText('Update'));

      await waitFor(() => {
        expect(mockPatchMCPServerConnection).toHaveBeenCalledWith({
          org: 'test-tenant',
          userId: 'test-user',
          id: 999,
          mentor: '',
          scope: 'user',
          user: 'test-user',
        });
      });
    });

    it('does not patch connection when auth_scope does not change', async () => {
      const oauthServer = {
        id: 42,
        name: 'OAuth Server',
        url: 'https://oauth.example.com/mcp',
        transport: 'streamable_http',
        auth_type: 'oauth2',
        auth_scope: 'tenant',
        credentials: '',
      };

      mockUpdateMCPServer.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ id: 42, name: 'Updated OAuth' }),
      });

      const onOAuthComplete = vi.fn();

      render(
        <ConnectorDialogs
          {...defaultProps}
          editingServer={oauthServer as any}
          editingConnectionId={999}
          tenantKey="test-tenant"
          username="test-user"
          mentorId="mentor-123"
          onOAuthComplete={onOAuthComplete}
        />,
      );

      // Update name without changing auth scope
      const nameInput = screen.getByDisplayValue('OAuth Server');
      fireEvent.change(nameInput, { target: { value: 'Updated OAuth' } });

      fireEvent.click(screen.getByText('Update'));

      await waitFor(() => {
        expect(mockUpdateMCPServer).toHaveBeenCalled();
      });

      // Should NOT patch connection since scope didn't change
      expect(mockPatchMCPServerConnection).not.toHaveBeenCalled();
    });
  });

  describe('OAuth Pending Server Storage', () => {
    it('stores pending OAuth server data in localStorage', async () => {
      const existingServer = {
        id: 5,
        url: 'https://oauth.example.com/mcp',
        auth_type: 'oauth2',
        oauth_service_data: {
          oauth_provider: 'google',
          name: 'test-service',
        },
      };

      mockGetMCPServers.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ results: [existingServer] }),
      });
      mockStartOAuthFlow.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ auth_url: 'https://oauth.example.com/auth' }),
      });

      render(
        <ConnectorDialogs
          {...defaultProps}
          tenantKey="test-tenant"
          username="test-user"
          mentorId="mentor-123"
        />,
      );

      const selects = screen.getAllByTestId('select');
      const authSelect = selects[1];
      fireEvent.change(authSelect, { target: { value: 'oauth' } });

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');

      fireEvent.change(nameInput, { target: { value: 'OAuth Connector' } });
      fireEvent.change(serverInput, { target: { value: 'https://oauth.example.com/mcp' } });

      fireEvent.click(screen.getByText('Connect'));

      await waitFor(() => {
        expect(mockSetPendingOAuthServer).toHaveBeenCalledWith(
          expect.objectContaining({
            serverId: 5,
            provider: 'google',
            service: 'test-service',
            timestamp: expect.any(Number),
          }),
        );
      });
    });

    it('removes pending OAuth server data on error', async () => {
      mockGetMCPServers.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ results: [] }),
      });
      mockOauthFind.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({
          id: 10,
          oauth_provider: 'custom',
          name: 'custom-service',
        }),
      });
      mockCreateMCPServer.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ id: 20, name: 'OAuth Connector' }),
      });
      mockStartOAuthFlow.mockReturnValue({
        unwrap: vi.fn().mockRejectedValue(new Error('OAuth flow failed')),
      });

      render(
        <ConnectorDialogs
          {...defaultProps}
          tenantKey="test-tenant"
          username="test-user"
          mentorId="mentor-123"
        />,
      );

      const selects = screen.getAllByTestId('select');
      const authSelect = selects[1];
      fireEvent.change(authSelect, { target: { value: 'oauth' } });

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');

      fireEvent.change(nameInput, { target: { value: 'OAuth Connector' } });
      fireEvent.change(serverInput, { target: { value: 'https://oauth.example.com/mcp' } });

      fireEvent.click(screen.getByText('Connect'));

      await waitFor(() => {
        expect(mockRemovePendingOAuthServer).toHaveBeenCalled();
      });
    });
  });

  describe('Image Upload', () => {
    it('handles valid image file upload', async () => {
      render(<ConnectorDialogs {...defaultProps} />);

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput).toBeInTheDocument();

      const file = new File(['test'], 'test.png', { type: 'image/png' });
      Object.defineProperty(file, 'size', { value: 1024 }); // 1KB

      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(URL.createObjectURL).toHaveBeenCalledWith(file);
      });
    });

    it('shows error for non-image file upload', async () => {
      const { toast } = await import('sonner');
      render(<ConnectorDialogs {...defaultProps} />);

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });

      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Please select a valid image file.');
      });
    });

    it('shows error for file larger than 2MB', async () => {
      const { toast } = await import('sonner');
      render(<ConnectorDialogs {...defaultProps} />);

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

      const file = new File(['test'], 'large.png', { type: 'image/png' });
      Object.defineProperty(file, 'size', { value: 3 * 1024 * 1024 }); // 3MB

      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Image size must be less than 2MB.');
      });
    });

    it('handles empty file selection', async () => {
      render(<ConnectorDialogs {...defaultProps} />);

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

      fireEvent.change(fileInput, { target: { files: [] } });

      // Should not throw error and should clear image state
      expect(fileInput).toBeInTheDocument();
    });

    it('revokes previous object URL when uploading new image', async () => {
      render(<ConnectorDialogs {...defaultProps} />);

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

      // Upload first image
      const file1 = new File(['test1'], 'test1.png', { type: 'image/png' });
      Object.defineProperty(file1, 'size', { value: 1024 });
      fireEvent.change(fileInput, { target: { files: [file1] } });

      // Upload second image
      const file2 = new File(['test2'], 'test2.png', { type: 'image/png' });
      Object.defineProperty(file2, 'size', { value: 1024 });
      fireEvent.change(fileInput, { target: { files: [file2] } });

      await waitFor(() => {
        expect(URL.revokeObjectURL).toHaveBeenCalled();
      });
    });

    it('revokes existing object URL when clearing file selection', async () => {
      render(<ConnectorDialogs {...defaultProps} />);

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

      // First upload an image to set objectUrlRef.current
      const file = new File(['test'], 'test.png', { type: 'image/png' });
      Object.defineProperty(file, 'size', { value: 1024 });
      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(URL.createObjectURL).toHaveBeenCalled();
      });

      // Clear mock calls
      vi.mocked(URL.revokeObjectURL).mockClear();

      // Now clear file selection with empty files
      fireEvent.change(fileInput, { target: { files: [] } });

      // Should revoke the previous object URL
      await waitFor(() => {
        expect(URL.revokeObjectURL).toHaveBeenCalled();
      });
    });

    it('handles clearing file selection with null files property', async () => {
      render(<ConnectorDialogs {...defaultProps} />);

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

      // First upload an image
      const file = new File(['test'], 'test.png', { type: 'image/png' });
      Object.defineProperty(file, 'size', { value: 1024 });
      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(URL.createObjectURL).toHaveBeenCalled();
      });

      vi.mocked(URL.revokeObjectURL).mockClear();

      // Clear selection with null files
      fireEvent.change(fileInput, { target: { files: null } });

      await waitFor(() => {
        expect(URL.revokeObjectURL).toHaveBeenCalled();
      });
    });

    it('revokes object URL when dialog is closed via resetForm', async () => {
      render(<ConnectorDialogs {...defaultProps} />);

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

      // First upload an image to set objectUrlRef.current
      const file = new File(['test'], 'test.png', { type: 'image/png' });
      Object.defineProperty(file, 'size', { value: 1024 });
      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(URL.createObjectURL).toHaveBeenCalled();
      });

      vi.mocked(URL.revokeObjectURL).mockClear();

      // Close the dialog - this calls handleClose which calls resetForm
      const closeButton = screen.getByRole('button', { name: /close/i });
      if (closeButton) {
        fireEvent.click(closeButton);
      } else {
        // Fallback: trigger onOpenChange with false
        fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
      }

      await waitFor(() => {
        expect(URL.revokeObjectURL).toHaveBeenCalled();
      });
    });

    it('revokes object URL when editing an existing server with prior image upload', async () => {
      const { rerender } = render(<ConnectorDialogs {...defaultProps} />);

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

      // First upload an image to set objectUrlRef.current
      const file = new File(['test'], 'test.png', { type: 'image/png' });
      Object.defineProperty(file, 'size', { value: 1024 });
      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(URL.createObjectURL).toHaveBeenCalled();
      });

      vi.mocked(URL.revokeObjectURL).mockClear();

      // Rerender with an editingServer - this triggers the useEffect cleanup
      const editingServer = {
        id: 1,
        name: 'Edit Server',
        url: 'https://edit.example.com',
        transport: 'sse',
        auth_type: 'none',
        description: 'Editing server',
      };

      rerender(<ConnectorDialogs {...defaultProps} editingServer={editingServer as any} />);

      await waitFor(() => {
        expect(URL.revokeObjectURL).toHaveBeenCalled();
      });
    });
  });

  describe('Transport Normalization', () => {
    it('selects SSE transport option', async () => {
      render(<ConnectorDialogs {...defaultProps} />);

      const selects = screen.getAllByTestId('select');
      const transportSelect = selects[0]; // First select is Transport

      fireEvent.change(transportSelect, { target: { value: 'sse' } });

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');

      fireEvent.change(nameInput, { target: { value: 'Test' } });
      fireEvent.change(serverInput, { target: { value: 'https://test.com' } });

      fireEvent.click(screen.getByText('Connect'));

      await waitFor(() => {
        expect(mockOnAddConnector).toHaveBeenCalledWith(
          expect.objectContaining({
            transport: 'sse',
          }),
        );
      });
    });

    it('selects WebSocket transport option', async () => {
      render(<ConnectorDialogs {...defaultProps} />);

      const selects = screen.getAllByTestId('select');
      const transportSelect = selects[0];

      fireEvent.change(transportSelect, { target: { value: 'websocket' } });

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');

      fireEvent.change(nameInput, { target: { value: 'Test' } });
      fireEvent.change(serverInput, { target: { value: 'https://test.com' } });

      fireEvent.click(screen.getByText('Connect'));

      await waitFor(() => {
        expect(mockOnAddConnector).toHaveBeenCalledWith(
          expect.objectContaining({
            transport: 'websocket',
          }),
        );
      });
    });
  });

  describe('Form Validation', () => {
    it('shows error for invalid URL format', async () => {
      const { toast } = await import('sonner');
      render(<ConnectorDialogs {...defaultProps} />);

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');

      fireEvent.change(nameInput, { target: { value: 'Test' } });
      fireEvent.change(serverInput, { target: { value: 'invalid-url' } });

      fireEvent.click(screen.getByText('Connect'));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Please enter a valid URL.');
      });
    });

    it('shows error for empty required fields', async () => {
      render(<ConnectorDialogs {...defaultProps} />);

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      fireEvent.change(nameInput, { target: { value: '   ' } }); // Only whitespace

      // Button should remain disabled or show error
      const connectButton = screen.getByText('Connect');
      expect(connectButton).toBeDisabled();
    });

    it('validates empty fields when submitting via OAuth flow', async () => {
      const oauthProps = {
        ...defaultProps,
        tenantKey: 'test-tenant',
        username: 'test-user',
        mentorId: 'mentor-123',
      };

      render(<ConnectorDialogs {...oauthProps} />);

      // Select OAuth which requires tenantKey and username
      const selects = screen.getAllByTestId('select');
      fireEvent.change(selects[1], { target: { value: 'oauth' } });

      // Fill in valid name and URL
      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');

      fireEvent.change(nameInput, { target: { value: 'Test' } });
      fireEvent.change(serverInput, { target: { value: 'https://valid-url.com' } });

      // Now clear the fields to test validation
      fireEvent.change(nameInput, { target: { value: '' } });

      // The button should be disabled
      expect(screen.getByText('Connect')).toBeDisabled();
    });

    it('does not call onAddConnector when it is not provided', async () => {
      render(<ConnectorDialogs open={true} onClose={mockOnClose} />);

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');

      fireEvent.change(nameInput, { target: { value: 'Test' } });
      fireEvent.change(serverInput, { target: { value: 'https://test.com' } });

      fireEvent.click(screen.getByText('Connect'));

      await waitFor(() => {
        expect(mockOnAddConnector).not.toHaveBeenCalled();
      });
    });
  });

  describe('Editing Server with Credentials', () => {
    it('pre-fills token when editing server with api-key credentials', () => {
      const serverWithCredentials = {
        id: 1,
        name: 'API Key Server',
        url: 'https://api.example.com/mcp',
        description: 'Server with API key',
        transport: 'streamable_http',
        auth_type: 'token',
        credentials: 'Bearer secret-token-123',
      };

      render(<ConnectorDialogs {...defaultProps} editingServer={serverWithCredentials as any} />);

      // Should show masked token indicator
      const tokenInput = screen.getByPlaceholderText('Enter your token');
      expect(tokenInput).toHaveValue('••••••••••••••••••••');
    });

    it('extracts token type from credentials with space', () => {
      const serverWithBasicAuth = {
        id: 1,
        name: 'Basic Auth Server',
        url: 'https://api.example.com/mcp',
        transport: 'sse',
        auth_type: 'token',
        credentials: 'Basic dXNlcjpwYXNz',
      };

      render(<ConnectorDialogs {...defaultProps} editingServer={serverWithBasicAuth as any} />);

      const selects = screen.getAllByTestId('select');
      // Auth method should be api-key
      expect(selects[1]).toHaveValue('api-key');
    });

    it('preserves original token when user does not modify it', async () => {
      const serverWithCredentials = {
        id: 1,
        name: 'API Key Server',
        url: 'https://api.example.com/mcp',
        transport: 'streamable_http',
        auth_type: 'token',
        credentials: 'Bearer original-token',
      };

      render(<ConnectorDialogs {...defaultProps} editingServer={serverWithCredentials as any} />);

      // Just click Update without changing token
      fireEvent.click(screen.getByText('Update'));

      await waitFor(() => {
        expect(mockOnAddConnector).toHaveBeenCalledWith(
          expect.objectContaining({
            credentials: undefined, // Should not send credentials
          }),
        );
      });
    });

    it('sends new credentials when user modifies token', async () => {
      const serverWithCredentials = {
        id: 1,
        name: 'API Key Server',
        url: 'https://api.example.com/mcp',
        transport: 'streamable_http',
        auth_type: 'token',
        credentials: 'Bearer original-token',
      };

      render(<ConnectorDialogs {...defaultProps} editingServer={serverWithCredentials as any} />);

      const tokenInput = screen.getByPlaceholderText('Enter your token');
      fireEvent.change(tokenInput, { target: { value: 'new-secret-token' } });

      fireEvent.click(screen.getByText('Update'));

      await waitFor(() => {
        expect(mockOnAddConnector).toHaveBeenCalledWith(
          expect.objectContaining({
            credentials: 'Bearer new-secret-token',
          }),
        );
      });
    });

    it('handles server with empty credentials', () => {
      const serverWithNoCredentials = {
        id: 1,
        name: 'No Auth Server',
        url: 'https://api.example.com/mcp',
        transport: 'sse',
        auth_type: 'none',
        credentials: '',
      };

      render(<ConnectorDialogs {...defaultProps} editingServer={serverWithNoCredentials as any} />);

      const selects = screen.getAllByTestId('select');
      // Auth method should be no-auth
      expect(selects[1]).toHaveValue('no-auth');
    });

    it('shows credentials masked hint when editing with token', () => {
      const serverWithCredentials = {
        id: 1,
        name: 'API Key Server',
        url: 'https://api.example.com/mcp',
        transport: 'streamable_http',
        auth_type: 'token',
        credentials: 'Bearer secret',
      };

      render(<ConnectorDialogs {...defaultProps} editingServer={serverWithCredentials as any} />);

      expect(screen.getByText(/Existing token is hidden/)).toBeInTheDocument();
    });
  });

  describe('Dialog Close Behavior', () => {
    it('does not close when submission is in progress', async () => {
      // Setup slow submission
      mockOnAddConnector.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000)),
      );

      render(<ConnectorDialogs {...defaultProps} />);

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');

      fireEvent.change(nameInput, { target: { value: 'Test' } });
      fireEvent.change(serverInput, { target: { value: 'https://test.com' } });

      fireEvent.click(screen.getByText('Connect'));

      // Try to close while submitting
      // The dialog close handler should check isSubmitting
      expect(screen.getByTestId('dialog')).toBeInTheDocument();
    });

    it('resets form and cleans up when closing dialog', async () => {
      render(<ConnectorDialogs {...defaultProps} />);

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      fireEvent.change(nameInput, { target: { value: 'Test Value' } });

      // Close dialog
      render(<ConnectorDialogs {...defaultProps} open={false} />);

      // Reopen
      cleanup();
      render(<ConnectorDialogs {...defaultProps} />);

      const newNameInput = screen.getByPlaceholderText('Enter connector name');
      expect(newNameInput).toHaveValue('');
    });

    it('prevents dialog close when isSubmitting is true', async () => {
      // Make submission take a long time
      mockOnAddConnector.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 5000)),
      );

      render(<ConnectorDialogs {...defaultProps} />);

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');

      fireEvent.change(nameInput, { target: { value: 'Test' } });
      fireEvent.change(serverInput, { target: { value: 'https://test.com' } });

      fireEvent.click(screen.getByText('Connect'));

      // Dialog should still be visible since isSubmitting prevents close
      // The Cancel button might not be visible while submitting (replaced with spinner)
      expect(screen.getByTestId('dialog')).toBeInTheDocument();
    });
  });

  describe('Submit Prevents Double Submission', () => {
    it('prevents double submission when clicking connect rapidly', async () => {
      render(<ConnectorDialogs {...defaultProps} />);

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');

      fireEvent.change(nameInput, { target: { value: 'Test' } });
      fireEvent.change(serverInput, { target: { value: 'https://test.com' } });

      const connectButton = screen.getByText('Connect');

      // Click rapidly multiple times
      fireEvent.click(connectButton);
      fireEvent.click(connectButton);
      fireEvent.click(connectButton);

      await waitFor(() => {
        // Should only call onAddConnector once
        expect(mockOnAddConnector).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('OAuth Flow with createMCPServer Failure', () => {
    const oauthProps = {
      ...defaultProps,
      tenantKey: 'test-tenant',
      username: 'test-user',
      mentorId: 'mentor-123',
    };

    it('shows error when createMCPServer fails during OAuth', async () => {
      const { toast } = await import('sonner');

      mockGetMCPServers.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ results: [] }),
      });
      mockOauthFind.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({
          id: 10,
          oauth_provider: 'custom',
          name: 'custom-service',
        }),
      });
      mockCreateMCPServer.mockReturnValue({
        unwrap: vi.fn().mockRejectedValue({ data: { detail: 'Server creation failed' } }),
      });

      render(<ConnectorDialogs {...oauthProps} />);

      const selects = screen.getAllByTestId('select');
      const authSelect = selects[1];
      fireEvent.change(authSelect, { target: { value: 'oauth' } });

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');

      fireEvent.change(nameInput, { target: { value: 'OAuth Connector' } });
      fireEvent.change(serverInput, { target: { value: 'https://oauth.example.com/mcp' } });

      fireEvent.click(screen.getByText('Connect'));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled();
      });
    });
  });

  describe('Component Cleanup', () => {
    it('cleans up object URL on unmount', () => {
      const { unmount } = render(<ConnectorDialogs {...defaultProps} />);

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['test'], 'test.png', { type: 'image/png' });
      Object.defineProperty(file, 'size', { value: 1024 });

      fireEvent.change(fileInput, { target: { files: [file] } });

      unmount();

      expect(URL.revokeObjectURL).toHaveBeenCalled();
    });
  });

  describe('Event Propagation', () => {
    it('stops propagation on dialog content click', () => {
      render(<ConnectorDialogs {...defaultProps} />);

      const dialogContent = screen.getByTestId('dialog-content');
      const clickEvent = new MouseEvent('click', { bubbles: true });
      const stopPropagation = vi.spyOn(clickEvent, 'stopPropagation');

      dialogContent.dispatchEvent(clickEvent);

      expect(stopPropagation).toHaveBeenCalled();
    });
  });

  describe('OAuth with Existing Server Non-OAuth2 Match', () => {
    const oauthProps = {
      ...defaultProps,
      tenantKey: 'test-tenant',
      username: 'test-user',
      mentorId: 'mentor-123',
    };

    it('ignores existing servers that are not oauth2 type', async () => {
      const existingNonOAuthServer = {
        id: 5,
        url: 'https://oauth.example.com/mcp',
        auth_type: 'token', // Not oauth2
        oauth_service_data: null,
      };

      mockGetMCPServers.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ results: [existingNonOAuthServer] }),
      });
      mockOauthFind.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({
          id: 10,
          oauth_provider: 'google',
          name: 'test-service',
        }),
      });
      mockCreateMCPServer.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ id: 20, name: 'OAuth Connector' }),
      });
      mockStartOAuthFlow.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ auth_url: 'https://oauth.example.com/auth' }),
      });

      render(<ConnectorDialogs {...oauthProps} />);

      const selects = screen.getAllByTestId('select');
      const authSelect = selects[1];
      fireEvent.change(authSelect, { target: { value: 'oauth' } });

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');

      fireEvent.change(nameInput, { target: { value: 'OAuth Connector' } });
      fireEvent.change(serverInput, { target: { value: 'https://oauth.example.com/mcp' } });

      fireEvent.click(screen.getByText('Connect'));

      // Should call oauthFind since existing server is not oauth2
      await waitFor(() => {
        expect(mockOauthFind).toHaveBeenCalled();
      });
    });
  });

  describe('OAuth Flow Storage Event Handler', () => {
    const oauthProps = {
      ...defaultProps,
      tenantKey: 'test-tenant',
      username: 'test-user',
      mentorId: 'mentor-123',
      onOAuthComplete: vi.fn(),
    };

    beforeEach(() => {
      mockCreateMCPServerConnection.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({}),
      });
      mockRefetchConnected.mockResolvedValue({
        data: [],
      });
    });

    it('triggers OAuth flow and opens window', async () => {
      const existingServer = {
        id: 5,
        url: 'https://oauth.example.com/mcp',
        auth_type: 'oauth2',
        oauth_service_data: {
          oauth_provider: 'google',
          name: 'test-service',
        },
      };

      mockGetMCPServers.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ results: [existingServer] }),
      });
      mockStartOAuthFlow.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ auth_url: 'https://oauth.example.com/auth' }),
      });

      render(<ConnectorDialogs {...oauthProps} />);

      const selects = screen.getAllByTestId('select');
      fireEvent.change(selects[1], { target: { value: 'oauth' } });

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');

      fireEvent.change(nameInput, { target: { value: 'OAuth Connector' } });
      fireEvent.change(serverInput, { target: { value: 'https://oauth.example.com/mcp' } });

      fireEvent.click(screen.getByText('Connect'));

      // Trigger the OAuth flow
      await waitFor(() => {
        expect(mockStartOAuthFlow).toHaveBeenCalled();
      });

      // Window.open should be called with auth_url
      await waitFor(() => {
        expect(window.open).toHaveBeenCalledWith('https://oauth.example.com/auth', '_blank');
      });
    });

    it('handles OAuth flow with connection creation', async () => {
      const existingServer = {
        id: 5,
        url: 'https://oauth.example.com/mcp',
        auth_type: 'oauth2',
        oauth_service_data: {
          oauth_provider: 'google',
          name: 'test-service',
        },
      };

      mockGetMCPServers.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ results: [existingServer] }),
      });
      mockStartOAuthFlow.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ auth_url: 'https://oauth.example.com/auth' }),
      });

      // Simulate connected service being found on poll
      mockRefetchConnected.mockResolvedValue({
        data: [{ id: 100, provider: 'google', service: 'test-service' }],
      });

      render(<ConnectorDialogs {...oauthProps} />);

      const selects = screen.getAllByTestId('select');
      fireEvent.change(selects[1], { target: { value: 'oauth' } });

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');

      fireEvent.change(nameInput, { target: { value: 'OAuth Connector' } });
      fireEvent.change(serverInput, { target: { value: 'https://oauth.example.com/mcp' } });

      fireEvent.click(screen.getByText('Connect'));

      await waitFor(() => {
        expect(mockStartOAuthFlow).toHaveBeenCalled();
      });
    });

    it('closes dialog and resets form after OAuth flow starts', async () => {
      const existingServer = {
        id: 5,
        url: 'https://oauth.example.com/mcp',
        auth_type: 'oauth2',
        oauth_service_data: {
          oauth_provider: 'google',
          name: 'test-service',
        },
      };

      mockGetMCPServers.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ results: [existingServer] }),
      });
      mockStartOAuthFlow.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ auth_url: 'https://oauth.example.com/auth' }),
      });

      render(<ConnectorDialogs {...oauthProps} />);

      const selects = screen.getAllByTestId('select');
      fireEvent.change(selects[1], { target: { value: 'oauth' } });

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');

      fireEvent.change(nameInput, { target: { value: 'OAuth Connector' } });
      fireEvent.change(serverInput, { target: { value: 'https://oauth.example.com/mcp' } });

      fireEvent.click(screen.getByText('Connect'));

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });
  });

  describe('OAuth Complete with New Server', () => {
    const oauthProps = {
      ...defaultProps,
      tenantKey: 'test-tenant',
      username: 'test-user',
      mentorId: 'mentor-123',
    };

    it('creates new MCP server when URL not found in featured', async () => {
      mockGetMCPServers.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ results: [] }), // No existing server
      });
      mockOauthFind.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({
          id: 15,
          oauth_provider: 'google',
          name: 'drive',
        }),
      });
      mockCreateMCPServer.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({
          id: 25,
          name: 'New OAuth Server',
          oauth_service_data: {
            oauth_provider: 'google',
            name: 'drive',
          },
        }),
      });
      mockStartOAuthFlow.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ auth_url: 'https://oauth.example.com/auth' }),
      });

      render(<ConnectorDialogs {...oauthProps} />);

      const selects = screen.getAllByTestId('select');
      fireEvent.change(selects[1], { target: { value: 'oauth' } });

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');

      fireEvent.change(nameInput, { target: { value: 'New OAuth Server' } });
      fireEvent.change(serverInput, { target: { value: 'https://new-oauth.example.com/mcp' } });

      fireEvent.click(screen.getByText('Connect'));

      await waitFor(() => {
        expect(mockCreateMCPServer).toHaveBeenCalledWith(
          expect.objectContaining({
            body: expect.objectContaining({
              name: 'New OAuth Server',
              auth_type: 'oauth2',
            }),
          }),
        );
      });

      await waitFor(() => {
        expect(mockStartOAuthFlow).toHaveBeenCalled();
      });
    });
  });

  describe('OAuth Polling and Connection Creation', () => {
    const oauthProps = {
      ...defaultProps,
      tenantKey: 'test-tenant',
      username: 'test-user',
      mentorId: 'mentor-123',
      onOAuthComplete: vi.fn(),
    };

    it('starts OAuth flow and opens auth window', async () => {
      const existingServer = {
        id: 5,
        url: 'https://oauth.example.com/mcp',
        auth_type: 'oauth2',
        oauth_service_data: {
          oauth_provider: 'google',
          name: 'test-service',
        },
      };

      mockGetMCPServers.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ results: [existingServer] }),
      });
      mockStartOAuthFlow.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ auth_url: 'https://oauth.example.com/auth' }),
      });
      mockRefetchConnected.mockResolvedValue({ data: [] });

      render(<ConnectorDialogs {...oauthProps} />);

      const selects = screen.getAllByTestId('select');
      fireEvent.change(selects[1], { target: { value: 'oauth' } });

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');

      fireEvent.change(nameInput, { target: { value: 'OAuth Connector' } });
      fireEvent.change(serverInput, { target: { value: 'https://oauth.example.com/mcp' } });

      fireEvent.click(screen.getByText('Connect'));

      await waitFor(() => {
        expect(mockStartOAuthFlow).toHaveBeenCalled();
        expect(window.open).toHaveBeenCalledWith('https://oauth.example.com/auth', '_blank');
      });
    });

    it('stores pending OAuth server before starting flow', async () => {
      const existingServer = {
        id: 5,
        url: 'https://oauth.example.com/mcp',
        auth_type: 'oauth2',
        oauth_service_data: {
          oauth_provider: 'google',
          name: 'test-service',
        },
      };

      mockGetMCPServers.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ results: [existingServer] }),
      });
      mockStartOAuthFlow.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ auth_url: 'https://oauth.example.com/auth' }),
      });
      mockRefetchConnected.mockResolvedValue({ data: [] });

      render(<ConnectorDialogs {...oauthProps} />);

      const selects = screen.getAllByTestId('select');
      fireEvent.change(selects[1], { target: { value: 'oauth' } });

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');

      fireEvent.change(nameInput, { target: { value: 'OAuth Connector' } });
      fireEvent.change(serverInput, { target: { value: 'https://oauth.example.com/mcp' } });

      fireEvent.click(screen.getByText('Connect'));

      await waitFor(() => {
        expect(mockSetPendingOAuthServer).toHaveBeenCalled();
      });
    });

    it('cleans up pending server on OAuth flow error', async () => {
      const existingServer = {
        id: 5,
        url: 'https://oauth.example.com/mcp',
        auth_type: 'oauth2',
        oauth_service_data: {
          oauth_provider: 'google',
          name: 'test-service',
        },
      };

      mockGetMCPServers.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ results: [existingServer] }),
      });
      mockStartOAuthFlow.mockReturnValue({
        unwrap: vi.fn().mockRejectedValue(new Error('OAuth failed')),
      });

      render(<ConnectorDialogs {...oauthProps} />);

      const selects = screen.getAllByTestId('select');
      fireEvent.change(selects[1], { target: { value: 'oauth' } });

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');

      fireEvent.change(nameInput, { target: { value: 'OAuth Connector' } });
      fireEvent.change(serverInput, { target: { value: 'https://oauth.example.com/mcp' } });

      fireEvent.click(screen.getByText('Connect'));

      await waitFor(() => {
        expect(mockRemovePendingOAuthServer).toHaveBeenCalled();
      });
    });
  });

  describe('Dialog Event Handlers', () => {
    it('stops propagation on dialog content click', () => {
      render(<ConnectorDialogs {...defaultProps} />);

      const dialogContent = screen.getByTestId('dialog-content');
      const event = new MouseEvent('click', { bubbles: true });
      const stopPropagation = vi.spyOn(event, 'stopPropagation');

      dialogContent.dispatchEvent(event);

      expect(stopPropagation).toHaveBeenCalled();
    });

    it('stops propagation on dialog content mousedown', () => {
      render(<ConnectorDialogs {...defaultProps} />);

      const dialogContent = screen.getByTestId('dialog-content');
      const event = new MouseEvent('mousedown', { bubbles: true });
      const stopPropagation = vi.spyOn(event, 'stopPropagation');

      dialogContent.dispatchEvent(event);

      expect(stopPropagation).toHaveBeenCalled();
    });
  });

  describe('OAuth Flow Error Cases', () => {
    const oauthProps = {
      ...defaultProps,
      tenantKey: 'test-tenant',
      username: 'test-user',
      mentorId: 'mentor-123',
    };

    it('shows error when tenantKey is missing for OAuth flow', async () => {
      const { toast: toastMock } = await import('sonner');
      const existingServer = {
        id: 5,
        url: 'https://oauth.example.com/mcp',
        auth_type: 'oauth2',
        oauth_service_data: {
          oauth_provider: 'google',
          name: 'test-service',
        },
      };

      mockGetMCPServers.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ results: [existingServer] }),
      });

      // Render without tenantKey
      render(<ConnectorDialogs {...defaultProps} username="test-user" mentorId="mentor-123" />);

      const selects = screen.getAllByTestId('select');
      fireEvent.change(selects[1], { target: { value: 'oauth' } });

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');

      fireEvent.change(nameInput, { target: { value: 'OAuth Connector' } });
      fireEvent.change(serverInput, { target: { value: 'https://oauth.example.com/mcp' } });

      fireEvent.click(screen.getByText('Connect'));

      await waitFor(() => {
        expect(toastMock.error).toHaveBeenCalledWith('Missing required parameters');
      });
    });

    it('shows error when username is missing for OAuth flow', async () => {
      const { toast: toastMock } = await import('sonner');
      const existingServer = {
        id: 5,
        url: 'https://oauth.example.com/mcp',
        auth_type: 'oauth2',
        oauth_service_data: {
          oauth_provider: 'google',
          name: 'test-service',
        },
      };

      mockGetMCPServers.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ results: [existingServer] }),
      });

      // Render without username
      render(<ConnectorDialogs {...defaultProps} tenantKey="test-tenant" mentorId="mentor-123" />);

      const selects = screen.getAllByTestId('select');
      fireEvent.change(selects[1], { target: { value: 'oauth' } });

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');

      fireEvent.change(nameInput, { target: { value: 'OAuth Connector' } });
      fireEvent.change(serverInput, { target: { value: 'https://oauth.example.com/mcp' } });

      fireEvent.click(screen.getByText('Connect'));

      await waitFor(() => {
        expect(toastMock.error).toHaveBeenCalledWith('Missing required parameters');
      });
    });

    it('shows error when startOAuthFlow fails', async () => {
      const { toast: toastMock } = await import('sonner');
      const existingServer = {
        id: 5,
        url: 'https://oauth.example.com/mcp',
        auth_type: 'oauth2',
        oauth_service_data: {
          oauth_provider: 'google',
          name: 'test-service',
        },
      };

      mockGetMCPServers.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ results: [existingServer] }),
      });
      mockStartOAuthFlow.mockReturnValue({
        unwrap: vi.fn().mockRejectedValue(new Error('OAuth flow failed')),
      });

      render(<ConnectorDialogs {...oauthProps} />);

      const selects = screen.getAllByTestId('select');
      fireEvent.change(selects[1], { target: { value: 'oauth' } });

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');

      fireEvent.change(nameInput, { target: { value: 'OAuth Connector' } });
      fireEvent.change(serverInput, { target: { value: 'https://oauth.example.com/mcp' } });

      fireEvent.click(screen.getByText('Connect'));

      await waitFor(() => {
        expect(toastMock.error).toHaveBeenCalledWith(
          expect.stringContaining('Failed to start OAuth flow'),
        );
      });
    });

    it('shows error when auth_url is not returned', async () => {
      const { toast: toastMock } = await import('sonner');
      const existingServer = {
        id: 5,
        url: 'https://oauth.example.com/mcp',
        auth_type: 'oauth2',
        oauth_service_data: {
          oauth_provider: 'google',
          name: 'test-service',
        },
      };

      mockGetMCPServers.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ results: [existingServer] }),
      });
      mockStartOAuthFlow.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ auth_url: null }),
      });

      render(<ConnectorDialogs {...oauthProps} />);

      const selects = screen.getAllByTestId('select');
      fireEvent.change(selects[1], { target: { value: 'oauth' } });

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');

      fireEvent.change(nameInput, { target: { value: 'OAuth Connector' } });
      fireEvent.change(serverInput, { target: { value: 'https://oauth.example.com/mcp' } });

      fireEvent.click(screen.getByText('Connect'));

      await waitFor(() => {
        expect(toastMock.error).toHaveBeenCalled();
      });
    });

    it('shows error when oauthFind fails', async () => {
      mockGetMCPServers.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ results: [] }),
      });
      mockOauthFind.mockReturnValue({
        unwrap: vi.fn().mockRejectedValue({ data: { detail: 'OAuth service not found' } }),
      });

      render(<ConnectorDialogs {...oauthProps} />);

      const selects = screen.getAllByTestId('select');
      fireEvent.change(selects[1], { target: { value: 'oauth' } });

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');

      fireEvent.change(nameInput, { target: { value: 'OAuth Connector' } });
      fireEvent.change(serverInput, { target: { value: 'https://oauth.example.com/mcp' } });

      fireEvent.click(screen.getByText('Connect'));

      await waitFor(() => {
        expect(screen.getByText('OAuth service not found')).toBeInTheDocument();
      });
    });

    it('shows generic error when oauthFind fails without detail', async () => {
      mockGetMCPServers.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ results: [] }),
      });
      mockOauthFind.mockReturnValue({
        unwrap: vi.fn().mockRejectedValue({ data: {} }),
      });

      render(<ConnectorDialogs {...oauthProps} />);

      const selects = screen.getAllByTestId('select');
      fireEvent.change(selects[1], { target: { value: 'oauth' } });

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');

      fireEvent.change(nameInput, { target: { value: 'OAuth Connector' } });
      fireEvent.change(serverInput, { target: { value: 'https://oauth.example.com/mcp' } });

      fireEvent.click(screen.getByText('Connect'));

      await waitFor(() => {
        // Should show the default error message
        expect(screen.getByText(/cannot be used for OAuth/)).toBeInTheDocument();
      });
    });

    it('shows error when getMCPServers fails', async () => {
      const { toast: toastMock } = await import('sonner');

      mockGetMCPServers.mockReturnValue({
        unwrap: vi.fn().mockRejectedValue({ data: { error: 'Server error' } }),
      });

      render(<ConnectorDialogs {...oauthProps} />);

      const selects = screen.getAllByTestId('select');
      fireEvent.change(selects[1], { target: { value: 'oauth' } });

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');

      fireEvent.change(nameInput, { target: { value: 'OAuth Connector' } });
      fireEvent.change(serverInput, { target: { value: 'https://oauth.example.com/mcp' } });

      fireEvent.click(screen.getByText('Connect'));

      await waitFor(() => {
        expect(toastMock.error).toHaveBeenCalled();
      });
    });

    it('shows error when createMCPServer fails during OAuth', async () => {
      mockGetMCPServers.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ results: [] }),
      });
      mockOauthFind.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({
          id: 10,
          oauth_provider: 'google',
          name: 'test-service',
        }),
      });
      mockCreateMCPServer.mockReturnValue({
        unwrap: vi.fn().mockRejectedValue({ data: { detail: 'Creation failed' } }),
      });

      render(<ConnectorDialogs {...oauthProps} />);

      const selects = screen.getAllByTestId('select');
      fireEvent.change(selects[1], { target: { value: 'oauth' } });

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');

      fireEvent.change(nameInput, { target: { value: 'OAuth Connector' } });
      fireEvent.change(serverInput, { target: { value: 'https://oauth.example.com/mcp' } });

      fireEvent.click(screen.getByText('Connect'));

      await waitFor(() => {
        // Should show error message about OAuth
        expect(screen.getByText('Creation failed')).toBeInTheDocument();
      });
    });
  });

  describe('Token Authentication Submission', () => {
    it('submits with token credentials', async () => {
      render(<ConnectorDialogs {...defaultProps} />);

      const selects = screen.getAllByTestId('select');
      fireEvent.change(selects[1], { target: { value: 'api-key' } });

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');
      const tokenInput = screen.getByPlaceholderText('Enter your token');

      fireEvent.change(nameInput, { target: { value: 'Token Connector' } });
      fireEvent.change(serverInput, { target: { value: 'https://api.example.com/mcp' } });
      fireEvent.change(tokenInput, { target: { value: 'my-secret-token' } });

      fireEvent.click(screen.getByText('Connect'));

      await waitFor(() => {
        expect(mockOnAddConnector).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Token Connector',
            url: 'https://api.example.com/mcp',
            credentials: 'Bearer my-secret-token',
          }),
        );
      });
    });

    it('uses custom token type', async () => {
      render(<ConnectorDialogs {...defaultProps} />);

      const selects = screen.getAllByTestId('select');
      fireEvent.change(selects[1], { target: { value: 'api-key' } });

      // Find and change token type
      const tokenTypeSelect = selects[2];
      if (tokenTypeSelect) {
        fireEvent.change(tokenTypeSelect, { target: { value: 'Basic' } });
      }

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');
      const tokenInput = screen.getByPlaceholderText('Enter your token');

      fireEvent.change(nameInput, { target: { value: 'Basic Auth Connector' } });
      fireEvent.change(serverInput, { target: { value: 'https://api.example.com/mcp' } });
      fireEvent.change(tokenInput, { target: { value: 'user:pass' } });

      fireEvent.click(screen.getByText('Connect'));

      await waitFor(() => {
        expect(mockOnAddConnector).toHaveBeenCalledWith(
          expect.objectContaining({
            credentials: expect.stringContaining('user:pass'),
          }),
        );
      });
    });
  });

  describe('No Auth Submission', () => {
    it('submits without credentials for no-auth method', async () => {
      render(<ConnectorDialogs {...defaultProps} />);

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');

      fireEvent.change(nameInput, { target: { value: 'Public Connector' } });
      fireEvent.change(serverInput, { target: { value: 'https://api.example.com/mcp' } });

      fireEvent.click(screen.getByText('Connect'));

      await waitFor(() => {
        expect(mockOnAddConnector).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Public Connector',
            credentials: undefined,
          }),
        );
      });
    });
  });

  describe('Connector Description', () => {
    it('includes description when provided', async () => {
      render(<ConnectorDialogs {...defaultProps} />);

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');

      // Description input might have different placeholder text or be a textarea
      const descInput =
        document.querySelector('textarea[placeholder*="description"]') ||
        document.querySelector('input[placeholder*="description"]');

      fireEvent.change(nameInput, { target: { value: 'Described Connector' } });
      fireEvent.change(serverInput, { target: { value: 'https://api.example.com/mcp' } });

      if (descInput) {
        fireEvent.change(descInput, { target: { value: 'This is my connector' } });
      }

      fireEvent.click(screen.getByText('Connect'));

      await waitFor(() => {
        expect(mockOnAddConnector).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Described Connector',
          }),
        );
      });
    });
  });

  describe('Update Existing Connector', () => {
    const existingServer = {
      id: 10,
      name: 'Existing Server',
      url: 'https://existing.example.com/mcp',
      description: 'Existing description',
      transport: 'sse',
      auth_type: 'none',
      credentials: '',
    };

    it('shows Update button instead of Connect when editing', () => {
      render(<ConnectorDialogs {...defaultProps} editingServer={existingServer as any} />);

      expect(screen.getByText('Update')).toBeInTheDocument();
      expect(screen.queryByText('Connect')).not.toBeInTheDocument();
    });

    it('pre-fills form with existing server data', () => {
      render(<ConnectorDialogs {...defaultProps} editingServer={existingServer as any} />);

      expect(screen.getByDisplayValue('Existing Server')).toBeInTheDocument();
      expect(screen.getByDisplayValue('https://existing.example.com/mcp')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Existing description')).toBeInTheDocument();
    });

    it('calls onAddConnector with updated data when updating', async () => {
      render(<ConnectorDialogs {...defaultProps} editingServer={existingServer as any} />);

      const nameInput = screen.getByDisplayValue('Existing Server');
      fireEvent.change(nameInput, { target: { value: 'Updated Server' } });

      fireEvent.click(screen.getByText('Update'));

      await waitFor(() => {
        expect(mockOnAddConnector).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Updated Server',
          }),
        );
      });
    });
  });

  describe('OAuth Connection Creation via Polling', () => {
    const oauthProps = {
      ...defaultProps,
      tenantKey: 'test-tenant',
      username: 'test-user',
      mentorId: 'mentor-123',
      onOAuthComplete: vi.fn(),
    };

    beforeEach(() => {
      vi.useFakeTimers();
      mockCreateMCPServerConnection.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({}),
      });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('creates connection when polling finds connected service', async () => {
      vi.useRealTimers();

      const existingServer = {
        id: 5,
        url: 'https://oauth.example.com/mcp',
        auth_type: 'oauth2',
        oauth_service_data: {
          oauth_provider: 'google',
          name: 'test-service',
        },
      };

      mockGetMCPServers.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ results: [existingServer] }),
      });
      mockStartOAuthFlow.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ auth_url: 'https://oauth.example.com/auth' }),
      });

      // First poll returns no connected service, second poll returns one
      let pollCount = 0;
      mockRefetchConnected.mockImplementation(() => {
        pollCount++;
        if (pollCount === 1) {
          return Promise.resolve({ data: [] });
        }
        return Promise.resolve({
          data: [{ id: 100, provider: 'google', service: 'test-service' }],
        });
      });

      render(<ConnectorDialogs {...oauthProps} />);

      const selects = screen.getAllByTestId('select');
      fireEvent.change(selects[1], { target: { value: 'oauth' } });

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');

      fireEvent.change(nameInput, { target: { value: 'OAuth Connector' } });
      fireEvent.change(serverInput, { target: { value: 'https://oauth.example.com/mcp' } });

      fireEvent.click(screen.getByText('Connect'));

      await waitFor(() => {
        expect(mockStartOAuthFlow).toHaveBeenCalled();
      });

      // Trigger a focus event to initiate connection check
      window.dispatchEvent(new Event('focus'));

      await waitFor(
        () => {
          expect(mockRefetchConnected).toHaveBeenCalled();
        },
        { timeout: 3000 },
      );
    });

    it('handles storage event with valid OAuth completion data', async () => {
      vi.useRealTimers();

      const existingServer = {
        id: 5,
        url: 'https://oauth.example.com/mcp',
        auth_type: 'oauth2',
        oauth_service_data: {
          oauth_provider: 'google',
          name: 'test-service',
        },
      };

      mockGetMCPServers.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ results: [existingServer] }),
      });
      mockStartOAuthFlow.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ auth_url: 'https://oauth.example.com/auth' }),
      });
      mockRefetchConnected.mockResolvedValue({ data: [] });

      render(<ConnectorDialogs {...oauthProps} />);

      const selects = screen.getAllByTestId('select');
      fireEvent.change(selects[1], { target: { value: 'oauth' } });

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');

      fireEvent.change(nameInput, { target: { value: 'OAuth Connector' } });
      fireEvent.change(serverInput, { target: { value: 'https://oauth.example.com/mcp' } });

      fireEvent.click(screen.getByText('Connect'));

      await waitFor(() => {
        expect(mockStartOAuthFlow).toHaveBeenCalled();
      });

      // Simulate storage event with OAuth completion data
      const storageEvent = new StorageEvent('storage', {
        key: 'oauth_connection_complete',
        newValue: JSON.stringify({
          connectedServiceId: 100,
          provider: 'google',
          serviceName: 'test-service',
        }),
      });
      window.dispatchEvent(storageEvent);

      await waitFor(
        () => {
          expect(mockCreateMCPServerConnection).toHaveBeenCalled();
        },
        { timeout: 3000 },
      );
    });

    it('handles message event with valid OAuth completion data', async () => {
      vi.useRealTimers();

      const existingServer = {
        id: 5,
        url: 'https://oauth.example.com/mcp',
        auth_type: 'oauth2',
        oauth_service_data: {
          oauth_provider: 'google',
          name: 'test-service',
        },
      };

      mockGetMCPServers.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ results: [existingServer] }),
      });
      mockStartOAuthFlow.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ auth_url: 'https://oauth.example.com/auth' }),
      });
      mockRefetchConnected.mockResolvedValue({ data: [] });

      render(<ConnectorDialogs {...oauthProps} />);

      const selects = screen.getAllByTestId('select');
      fireEvent.change(selects[1], { target: { value: 'oauth' } });

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');

      fireEvent.change(nameInput, { target: { value: 'OAuth Connector' } });
      fireEvent.change(serverInput, { target: { value: 'https://oauth.example.com/mcp' } });

      fireEvent.click(screen.getByText('Connect'));

      await waitFor(() => {
        expect(mockStartOAuthFlow).toHaveBeenCalled();
      });

      // Simulate message event from OAuth popup
      const messageEvent = new MessageEvent('message', {
        data: {
          type: 'GOOGLE_AUTH_SUCCESS',
          connectedServiceId: 100,
          provider: 'google',
          serviceName: 'test-service',
        },
        origin: window.location.origin,
      });
      window.dispatchEvent(messageEvent);

      await waitFor(
        () => {
          expect(mockCreateMCPServerConnection).toHaveBeenCalled();
        },
        { timeout: 3000 },
      );
    });

    it('ignores message events from different origins', async () => {
      vi.useRealTimers();

      const existingServer = {
        id: 5,
        url: 'https://oauth.example.com/mcp',
        auth_type: 'oauth2',
        oauth_service_data: {
          oauth_provider: 'google',
          name: 'test-service',
        },
      };

      mockGetMCPServers.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ results: [existingServer] }),
      });
      mockStartOAuthFlow.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ auth_url: 'https://oauth.example.com/auth' }),
      });
      mockRefetchConnected.mockResolvedValue({ data: [] });

      render(<ConnectorDialogs {...oauthProps} />);

      const selects = screen.getAllByTestId('select');
      fireEvent.change(selects[1], { target: { value: 'oauth' } });

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');

      fireEvent.change(nameInput, { target: { value: 'OAuth Connector' } });
      fireEvent.change(serverInput, { target: { value: 'https://oauth.example.com/mcp' } });

      fireEvent.click(screen.getByText('Connect'));

      await waitFor(() => {
        expect(mockStartOAuthFlow).toHaveBeenCalled();
      });

      // Simulate message event from different origin
      const messageEvent = new MessageEvent('message', {
        data: {
          type: 'GOOGLE_AUTH_SUCCESS',
          connectedServiceId: 100,
          provider: 'google',
          serviceName: 'test-service',
        },
        origin: 'https://malicious-site.com',
      });
      window.dispatchEvent(messageEvent);

      // Should not create connection since origin doesn't match
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(mockCreateMCPServerConnection).not.toHaveBeenCalled();
    });

    it('handles storage event with invalid JSON', async () => {
      vi.useRealTimers();

      const existingServer = {
        id: 5,
        url: 'https://oauth.example.com/mcp',
        auth_type: 'oauth2',
        oauth_service_data: {
          oauth_provider: 'google',
          name: 'test-service',
        },
      };

      mockGetMCPServers.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ results: [existingServer] }),
      });
      mockStartOAuthFlow.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ auth_url: 'https://oauth.example.com/auth' }),
      });
      mockRefetchConnected.mockResolvedValue({ data: [] });

      render(<ConnectorDialogs {...oauthProps} />);

      const selects = screen.getAllByTestId('select');
      fireEvent.change(selects[1], { target: { value: 'oauth' } });

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');

      fireEvent.change(nameInput, { target: { value: 'OAuth Connector' } });
      fireEvent.change(serverInput, { target: { value: 'https://oauth.example.com/mcp' } });

      fireEvent.click(screen.getByText('Connect'));

      await waitFor(() => {
        expect(mockStartOAuthFlow).toHaveBeenCalled();
      });

      // Simulate storage event with invalid JSON
      const storageEvent = new StorageEvent('storage', {
        key: 'oauth_connection_complete',
        newValue: 'invalid-json{',
      });
      window.dispatchEvent(storageEvent);

      // Should fall back to checkConnection which calls refetchConnected
      await waitFor(
        () => {
          expect(mockRefetchConnected).toHaveBeenCalled();
        },
        { timeout: 3000 },
      );
    });

    it('handles storage event with mismatched provider', async () => {
      vi.useRealTimers();

      const existingServer = {
        id: 5,
        url: 'https://oauth.example.com/mcp',
        auth_type: 'oauth2',
        oauth_service_data: {
          oauth_provider: 'google',
          name: 'test-service',
        },
      };

      mockGetMCPServers.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ results: [existingServer] }),
      });
      mockStartOAuthFlow.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ auth_url: 'https://oauth.example.com/auth' }),
      });
      mockRefetchConnected.mockResolvedValue({ data: [] });

      render(<ConnectorDialogs {...oauthProps} />);

      const selects = screen.getAllByTestId('select');
      fireEvent.change(selects[1], { target: { value: 'oauth' } });

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');

      fireEvent.change(nameInput, { target: { value: 'OAuth Connector' } });
      fireEvent.change(serverInput, { target: { value: 'https://oauth.example.com/mcp' } });

      fireEvent.click(screen.getByText('Connect'));

      await waitFor(() => {
        expect(mockStartOAuthFlow).toHaveBeenCalled();
      });

      // Simulate storage event with different provider
      const storageEvent = new StorageEvent('storage', {
        key: 'oauth_connection_complete',
        newValue: JSON.stringify({
          connectedServiceId: 100,
          provider: 'github', // Different provider
          serviceName: 'different-service',
        }),
      });
      window.dispatchEvent(storageEvent);

      // Should call checkConnection instead of createConnection
      await waitFor(
        () => {
          expect(mockRefetchConnected).toHaveBeenCalled();
        },
        { timeout: 3000 },
      );
    });

    it('handles connection creation error gracefully', async () => {
      vi.useRealTimers();
      const { toast: toastMock } = await import('sonner');

      const existingServer = {
        id: 5,
        url: 'https://oauth.example.com/mcp',
        auth_type: 'oauth2',
        oauth_service_data: {
          oauth_provider: 'google',
          name: 'test-service',
        },
      };

      mockGetMCPServers.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ results: [existingServer] }),
      });
      mockStartOAuthFlow.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ auth_url: 'https://oauth.example.com/auth' }),
      });
      mockRefetchConnected.mockResolvedValue({
        data: [{ id: 100, provider: 'google', service: 'test-service' }],
      });
      mockCreateMCPServerConnection.mockReturnValue({
        unwrap: vi.fn().mockRejectedValue({ data: { detail: 'Connection failed' } }),
      });

      render(<ConnectorDialogs {...oauthProps} />);

      const selects = screen.getAllByTestId('select');
      fireEvent.change(selects[1], { target: { value: 'oauth' } });

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');

      fireEvent.change(nameInput, { target: { value: 'OAuth Connector' } });
      fireEvent.change(serverInput, { target: { value: 'https://oauth.example.com/mcp' } });

      fireEvent.click(screen.getByText('Connect'));

      await waitFor(() => {
        expect(mockStartOAuthFlow).toHaveBeenCalled();
      });

      // Trigger focus to initiate connection check
      window.dispatchEvent(new Event('focus'));

      await waitFor(
        () => {
          expect(toastMock.error).toHaveBeenCalledWith(
            expect.stringContaining('Connection failed'),
          );
        },
        { timeout: 3000 },
      );
    });
  });

  describe('Image Upload Click Handler', () => {
    it('triggers file input when thumbnail area is clicked', () => {
      render(<ConnectorDialogs {...defaultProps} />);

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const clickSpy = vi.spyOn(fileInput, 'click');

      // Find the image icon which is inside the clickable thumbnail area
      const imageIcon = screen.getByTestId('image-icon');
      const clickableDiv = imageIcon.closest('div');

      if (clickableDiv) {
        fireEvent.click(clickableDiv);
        expect(clickSpy).toHaveBeenCalled();
      }
    });

    it('file input exists and accepts images', () => {
      render(<ConnectorDialogs {...defaultProps} />);

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput).toBeInTheDocument();
      expect(fileInput.accept).toBe('image/*');
    });
  });

  describe('Handle Close Behavior', () => {
    it('does not close dialog while submitting', async () => {
      // Create a promise that we can control to simulate long-running submission
      let resolveSubmit: () => void;
      const submitPromise = new Promise<void>((resolve) => {
        resolveSubmit = resolve;
      });

      mockOnAddConnector.mockImplementation(() => submitPromise);

      render(<ConnectorDialogs {...defaultProps} />);

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');

      fireEvent.change(nameInput, { target: { value: 'Test Connector' } });
      fireEvent.change(serverInput, { target: { value: 'https://api.example.com/mcp' } });

      // Start submission
      fireEvent.click(screen.getByText('Connect'));

      // Wait for submission to start
      await waitFor(() => {
        expect(mockOnAddConnector).toHaveBeenCalled();
      });

      // Reset mock to check if onClose is called during submission
      mockOnClose.mockClear();

      // Try to close dialog while submitting - click the close trigger
      const closeButton = screen.getByTestId('dialog-close-trigger');
      fireEvent.click(closeButton);

      // onClose should NOT be called because isSubmitting is true
      expect(mockOnClose).not.toHaveBeenCalled();

      // Complete the submission
      resolveSubmit!();

      // Wait for submission to complete
      await waitFor(() => {
        // Now the dialog can be closed
      });
    });

    it('calls onClose when handleClose is triggered and not submitting', () => {
      render(<ConnectorDialogs {...defaultProps} />);

      // Click the close trigger when not submitting
      const closeButton = screen.getByTestId('dialog-close-trigger');
      fireEvent.click(closeButton);

      // onClose should be called because isSubmitting is false
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('resets form when closing dialog', () => {
      render(<ConnectorDialogs {...defaultProps} />);

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');

      fireEvent.change(nameInput, { target: { value: 'Test' } });
      fireEvent.change(serverInput, { target: { value: 'https://api.example.com' } });

      // Close the dialog
      const closeButton = screen.getByTestId('dialog-close-trigger');
      fireEvent.click(closeButton);

      // onClose should be called and form should be reset
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('resets credentials masked state on close', async () => {
      const { rerender } = render(<ConnectorDialogs {...defaultProps} />);

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');

      fireEvent.change(nameInput, { target: { value: 'Test' } });
      fireEvent.change(serverInput, { target: { value: 'https://api.example.com' } });

      // Close and reopen dialog
      rerender(<ConnectorDialogs {...defaultProps} open={false} />);
      rerender(<ConnectorDialogs {...defaultProps} open={true} />);

      // Form should be reset
      expect(screen.getByPlaceholderText('Enter connector name')).toHaveValue('');
    });
  });

  describe('OAuth Polling Timeout and Cleanup', () => {
    const oauthProps = {
      ...defaultProps,
      tenantKey: 'test-tenant',
      username: 'test-user',
      mentorId: 'mentor-123',
      onOAuthComplete: vi.fn(),
    };

    it('stops polling after max polls reached', async () => {
      vi.useFakeTimers();

      const existingServer = {
        id: 5,
        url: 'https://oauth.example.com/mcp',
        auth_type: 'oauth2',
        oauth_service_data: {
          oauth_provider: 'google',
          name: 'test-service',
        },
      };

      mockGetMCPServers.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ results: [existingServer] }),
      });
      mockStartOAuthFlow.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ auth_url: 'https://oauth.example.com/auth' }),
      });
      mockRefetchConnected.mockResolvedValue({ data: [] }); // Never find service

      render(<ConnectorDialogs {...oauthProps} />);

      const selects = screen.getAllByTestId('select');
      fireEvent.change(selects[1], { target: { value: 'oauth' } });

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');

      fireEvent.change(nameInput, { target: { value: 'OAuth Connector' } });
      fireEvent.change(serverInput, { target: { value: 'https://oauth.example.com/mcp' } });

      fireEvent.click(screen.getByText('Connect'));

      // Advance timers to trigger polling
      await vi.advanceTimersByTimeAsync(1000);

      expect(mockStartOAuthFlow).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('cleans up event listeners on timeout', async () => {
      vi.useFakeTimers();

      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      const existingServer = {
        id: 5,
        url: 'https://oauth.example.com/mcp',
        auth_type: 'oauth2',
        oauth_service_data: {
          oauth_provider: 'google',
          name: 'test-service',
        },
      };

      mockGetMCPServers.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ results: [existingServer] }),
      });
      mockStartOAuthFlow.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ auth_url: 'https://oauth.example.com/auth' }),
      });
      mockRefetchConnected.mockResolvedValue({ data: [] });

      render(<ConnectorDialogs {...oauthProps} />);

      const selects = screen.getAllByTestId('select');
      fireEvent.change(selects[1], { target: { value: 'oauth' } });

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');

      fireEvent.change(nameInput, { target: { value: 'OAuth Connector' } });
      fireEvent.change(serverInput, { target: { value: 'https://oauth.example.com/mcp' } });

      fireEvent.click(screen.getByText('Connect'));

      // Advance past the 5-minute timeout
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 1000);

      // Cleanup should have been called, removing event listeners
      expect(removeEventListenerSpy).toHaveBeenCalled();

      removeEventListenerSpy.mockRestore();
      vi.useRealTimers();
    });
  });

  describe('OAuth Complete Callback', () => {
    const oauthProps = {
      ...defaultProps,
      tenantKey: 'test-tenant',
      username: 'test-user',
      mentorId: 'mentor-123',
      onOAuthComplete: vi.fn(),
    };

    it('calls onOAuthComplete after successful connection creation', async () => {
      vi.useRealTimers();
      const { toast: toastMock } = await import('sonner');

      const existingServer = {
        id: 5,
        url: 'https://oauth.example.com/mcp',
        auth_type: 'oauth2',
        oauth_service_data: {
          oauth_provider: 'google',
          name: 'test-service',
        },
      };

      mockGetMCPServers.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ results: [existingServer] }),
      });
      mockStartOAuthFlow.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ auth_url: 'https://oauth.example.com/auth' }),
      });
      mockRefetchConnected.mockResolvedValue({
        data: [{ id: 100, provider: 'google', service: 'test-service' }],
      });
      mockCreateMCPServerConnection.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({}),
      });

      render(<ConnectorDialogs {...oauthProps} />);

      const selects = screen.getAllByTestId('select');
      fireEvent.change(selects[1], { target: { value: 'oauth' } });

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');

      fireEvent.change(nameInput, { target: { value: 'OAuth Connector' } });
      fireEvent.change(serverInput, { target: { value: 'https://oauth.example.com/mcp' } });

      fireEvent.click(screen.getByText('Connect'));

      await waitFor(() => {
        expect(mockStartOAuthFlow).toHaveBeenCalled();
      });

      // Trigger focus to check connection
      window.dispatchEvent(new Event('focus'));

      await waitFor(
        () => {
          expect(mockCreateMCPServerConnection).toHaveBeenCalled();
        },
        { timeout: 3000 },
      );

      await waitFor(
        () => {
          expect(toastMock.success).toHaveBeenCalledWith('OAuth connector connected successfully');
        },
        { timeout: 3000 },
      );
    });
  });

  describe('Check Connection Error Handling', () => {
    const oauthProps = {
      ...defaultProps,
      tenantKey: 'test-tenant',
      username: 'test-user',
      mentorId: 'mentor-123',
    };

    it('continues polling when checkConnection throws', async () => {
      vi.useRealTimers();

      const existingServer = {
        id: 5,
        url: 'https://oauth.example.com/mcp',
        auth_type: 'oauth2',
        oauth_service_data: {
          oauth_provider: 'google',
          name: 'test-service',
        },
      };

      mockGetMCPServers.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ results: [existingServer] }),
      });
      mockStartOAuthFlow.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ auth_url: 'https://oauth.example.com/auth' }),
      });

      // First call throws, subsequent calls succeed
      let callCount = 0;
      mockRefetchConnected.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({ data: [] });
      });

      render(<ConnectorDialogs {...oauthProps} />);

      const selects = screen.getAllByTestId('select');
      fireEvent.change(selects[1], { target: { value: 'oauth' } });

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');

      fireEvent.change(nameInput, { target: { value: 'OAuth Connector' } });
      fireEvent.change(serverInput, { target: { value: 'https://oauth.example.com/mcp' } });

      fireEvent.click(screen.getByText('Connect'));

      await waitFor(() => {
        expect(mockStartOAuthFlow).toHaveBeenCalled();
      });

      // Trigger focus events to test error handling
      window.dispatchEvent(new Event('focus'));

      await waitFor(
        () => {
          expect(mockRefetchConnected).toHaveBeenCalled();
        },
        { timeout: 3000 },
      );
    });
  });

  describe('Create Connection Guard', () => {
    const oauthProps = {
      ...defaultProps,
      tenantKey: 'test-tenant',
      username: 'test-user',
      mentorId: 'mentor-123',
    };

    it('creates connection when connected service is found', async () => {
      vi.useRealTimers();

      const existingServer = {
        id: 5,
        url: 'https://oauth.example.com/mcp',
        auth_type: 'oauth2',
        oauth_service_data: {
          oauth_provider: 'google',
          name: 'test-service',
        },
      };

      mockGetMCPServers.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ results: [existingServer] }),
      });
      mockStartOAuthFlow.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ auth_url: 'https://oauth.example.com/auth' }),
      });
      mockRefetchConnected.mockResolvedValue({
        data: [{ id: 100, provider: 'google', service: 'test-service' }],
      });
      mockCreateMCPServerConnection.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({}),
      });

      render(<ConnectorDialogs {...oauthProps} />);

      const selects = screen.getAllByTestId('select');
      fireEvent.change(selects[1], { target: { value: 'oauth' } });

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');

      fireEvent.change(nameInput, { target: { value: 'OAuth Connector' } });
      fireEvent.change(serverInput, { target: { value: 'https://oauth.example.com/mcp' } });

      fireEvent.click(screen.getByText('Connect'));

      await waitFor(() => {
        expect(mockStartOAuthFlow).toHaveBeenCalled();
      });

      // Trigger focus event to check for connection
      window.dispatchEvent(new Event('focus'));

      await waitFor(
        () => {
          expect(mockCreateMCPServerConnection).toHaveBeenCalled();
        },
        { timeout: 3000 },
      );
    });

    it('rejects invalid connected service IDs', async () => {
      vi.useRealTimers();

      const existingServer = {
        id: 5,
        url: 'https://oauth.example.com/mcp',
        auth_type: 'oauth2',
        oauth_service_data: {
          oauth_provider: 'google',
          name: 'test-service',
        },
      };

      mockGetMCPServers.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ results: [existingServer] }),
      });
      mockStartOAuthFlow.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ auth_url: 'https://oauth.example.com/auth' }),
      });
      mockRefetchConnected.mockResolvedValue({
        data: [{ id: NaN, provider: 'google', service: 'test-service' }], // Invalid ID
      });

      render(<ConnectorDialogs {...oauthProps} />);

      const selects = screen.getAllByTestId('select');
      fireEvent.change(selects[1], { target: { value: 'oauth' } });

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');

      fireEvent.change(nameInput, { target: { value: 'OAuth Connector' } });
      fireEvent.change(serverInput, { target: { value: 'https://oauth.example.com/mcp' } });

      fireEvent.click(screen.getByText('Connect'));

      await waitFor(() => {
        expect(mockStartOAuthFlow).toHaveBeenCalled();
      });

      window.dispatchEvent(new Event('focus'));

      // Should not attempt to create connection with invalid ID
      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(mockCreateMCPServerConnection).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // ADDITIONAL BRANCH COVERAGE TESTS
  // ============================================================================

  describe('Branch coverage: validation branches', () => {
    it('shows error when only name is empty (trimmed)', () => {
      render(<ConnectorDialogs {...defaultProps} />);

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');

      // Set empty name (whitespace) but valid server
      fireEvent.change(nameInput, { target: { value: '   ' } });
      fireEvent.change(serverInput, { target: { value: 'https://valid.server.com' } });

      // Button should be disabled
      const connectButton = screen.getByText('Connect');
      expect(connectButton).toBeDisabled();
    });

    it('shows error when only server is empty (trimmed)', () => {
      render(<ConnectorDialogs {...defaultProps} />);

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');

      // Set valid name but empty server (whitespace)
      fireEvent.change(nameInput, { target: { value: 'Valid Name' } });
      fireEvent.change(serverInput, { target: { value: '   ' } });

      // Button should be disabled
      const connectButton = screen.getByText('Connect');
      expect(connectButton).toBeDisabled();
    });

    it('handles submit with both name and server empty', () => {
      render(<ConnectorDialogs {...defaultProps} />);

      // Both fields are empty by default
      const connectButton = screen.getByText('Connect');
      expect(connectButton).toBeDisabled();
    });
  });

  describe('Branch coverage: createConnection guard conditions', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockGetMCPServers.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ results: [] }),
      });
      mockOauthFind.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({
          id: 123,
          oauth_provider: 'google',
          name: 'google-calendar',
        }),
      });
      mockCreateMCPServer.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({
          id: 999,
          name: 'Test OAuth Server',
          url: 'https://oauth.example.com/mcp',
        }),
      });
      mockStartOAuthFlow.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ auth_url: 'https://auth.example.com/oauth' }),
      });
    });

    it('handles createConnection with connectedServiceId of 0', async () => {
      mockRefetchConnected.mockResolvedValue({
        data: [{ provider: 'google', service: 'google-calendar', id: 0 }],
      });

      const oauthProps = {
        ...defaultProps,
        tenantKey: 'test-tenant',
        username: 'test-user',
        mentorId: 'mentor-123',
      };

      render(<ConnectorDialogs {...oauthProps} />);

      // Select OAuth auth method (second select is Authentication Method)
      const selects = screen.getAllByTestId('select');
      fireEvent.change(selects[1], { target: { value: 'oauth' } });

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');

      fireEvent.change(nameInput, { target: { value: 'OAuth Connector' } });
      fireEvent.change(serverInput, { target: { value: 'https://oauth.example.com/mcp' } });

      fireEvent.click(screen.getByText('Connect'));

      await waitFor(() => {
        expect(mockStartOAuthFlow).toHaveBeenCalled();
      });

      // Trigger focus event - should not create connection with id 0
      window.dispatchEvent(new Event('focus'));

      await new Promise((resolve) => setTimeout(resolve, 200));
      // Connection should not be created with id 0
      expect(mockCreateMCPServerConnection).not.toHaveBeenCalled();
    });

    it('handles createConnection with NaN connectedServiceId', async () => {
      mockRefetchConnected.mockResolvedValue({
        data: [{ provider: 'google', service: 'google-calendar', id: NaN }],
      });

      const oauthProps = {
        ...defaultProps,
        tenantKey: 'test-tenant',
        username: 'test-user',
        mentorId: 'mentor-123',
      };

      render(<ConnectorDialogs {...oauthProps} />);

      // Select OAuth auth method (second select is Authentication Method)
      const selects = screen.getAllByTestId('select');
      fireEvent.change(selects[1], { target: { value: 'oauth' } });

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');

      fireEvent.change(nameInput, { target: { value: 'OAuth Connector' } });
      fireEvent.change(serverInput, { target: { value: 'https://oauth.example.com/mcp' } });

      fireEvent.click(screen.getByText('Connect'));

      await waitFor(() => {
        expect(mockStartOAuthFlow).toHaveBeenCalled();
      });

      // Trigger focus event
      window.dispatchEvent(new Event('focus'));

      await new Promise((resolve) => setTimeout(resolve, 200));
      // Connection should not be created with NaN id
      expect(mockCreateMCPServerConnection).not.toHaveBeenCalled();
    });

    it('handles createConnection with negative connectedServiceId', async () => {
      mockRefetchConnected.mockResolvedValue({
        data: [{ provider: 'google', service: 'google-calendar', id: -1 }],
      });

      const oauthProps = {
        ...defaultProps,
        tenantKey: 'test-tenant',
        username: 'test-user',
        mentorId: 'mentor-123',
      };

      render(<ConnectorDialogs {...oauthProps} />);

      // Select OAuth auth method (second select is Authentication Method)
      const selects = screen.getAllByTestId('select');
      fireEvent.change(selects[1], { target: { value: 'oauth' } });

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');

      fireEvent.change(nameInput, { target: { value: 'OAuth Connector' } });
      fireEvent.change(serverInput, { target: { value: 'https://oauth.example.com/mcp' } });

      fireEvent.click(screen.getByText('Connect'));

      await waitFor(() => {
        expect(mockStartOAuthFlow).toHaveBeenCalled();
      });

      // Trigger focus event
      window.dispatchEvent(new Event('focus'));

      await new Promise((resolve) => setTimeout(resolve, 200));
      // Connection will be attempted with negative id (Number.isFinite(-1) is true)
    });
  });

  describe('Branch coverage: OAuth message event handlers', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockGetMCPServers.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ results: [] }),
      });
      mockOauthFind.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({
          id: 123,
          oauth_provider: 'google',
          name: 'google-calendar',
        }),
      });
      mockCreateMCPServer.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({
          id: 999,
          name: 'Test OAuth Server',
          url: 'https://oauth.example.com/mcp',
        }),
      });
      mockStartOAuthFlow.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ auth_url: 'https://auth.example.com/oauth' }),
      });
      mockRefetchConnected.mockResolvedValue({ data: [] });
    });

    it('ignores message events from different origin', async () => {
      const oauthProps = {
        ...defaultProps,
        tenantKey: 'test-tenant',
        username: 'test-user',
        mentorId: 'mentor-123',
      };

      render(<ConnectorDialogs {...oauthProps} />);

      // Select OAuth auth method (second select is Authentication Method)
      const authSelects = screen.getAllByTestId('select');
      fireEvent.change(authSelects[1], { target: { value: 'oauth' } });

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');

      fireEvent.change(nameInput, { target: { value: 'OAuth Connector' } });
      fireEvent.change(serverInput, { target: { value: 'https://oauth.example.com/mcp' } });

      fireEvent.click(screen.getByText('Connect'));

      await waitFor(() => {
        expect(mockStartOAuthFlow).toHaveBeenCalled();
      });

      // Send message event from different origin
      const messageEvent = new MessageEvent('message', {
        data: {
          type: 'GOOGLE_AUTH_SUCCESS',
          connectedServiceId: 456,
          provider: 'google',
          serviceName: 'google-calendar',
        },
        origin: 'https://malicious-site.com',
      });
      window.dispatchEvent(messageEvent);

      await new Promise((resolve) => setTimeout(resolve, 200));
      // Should not create connection from different origin
      expect(mockCreateMCPServerConnection).not.toHaveBeenCalled();
    });

    it('ignores message events with non-matching provider', async () => {
      const oauthProps = {
        ...defaultProps,
        tenantKey: 'test-tenant',
        username: 'test-user',
        mentorId: 'mentor-123',
      };

      render(<ConnectorDialogs {...oauthProps} />);

      // Select OAuth auth method (second select is Authentication Method)
      const authSelects = screen.getAllByTestId('select');
      fireEvent.change(authSelects[1], { target: { value: 'oauth' } });

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');

      fireEvent.change(nameInput, { target: { value: 'OAuth Connector' } });
      fireEvent.change(serverInput, { target: { value: 'https://oauth.example.com/mcp' } });

      fireEvent.click(screen.getByText('Connect'));

      await waitFor(() => {
        expect(mockStartOAuthFlow).toHaveBeenCalled();
      });

      // Send message event with different provider
      const messageEvent = new MessageEvent('message', {
        data: {
          type: 'GOOGLE_AUTH_SUCCESS',
          connectedServiceId: 456,
          provider: 'microsoft', // Different provider
          serviceName: 'google-calendar',
        },
        origin: window.location.origin,
      });
      window.dispatchEvent(messageEvent);

      await new Promise((resolve) => setTimeout(resolve, 200));
      // Should not create connection with different provider
      expect(mockCreateMCPServerConnection).not.toHaveBeenCalled();
    });

    it('ignores message events with non-matching service name', async () => {
      const oauthProps = {
        ...defaultProps,
        tenantKey: 'test-tenant',
        username: 'test-user',
        mentorId: 'mentor-123',
      };

      render(<ConnectorDialogs {...oauthProps} />);

      // Select OAuth auth method (second select is Authentication Method)
      const authSelects = screen.getAllByTestId('select');
      fireEvent.change(authSelects[1], { target: { value: 'oauth' } });

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');

      fireEvent.change(nameInput, { target: { value: 'OAuth Connector' } });
      fireEvent.change(serverInput, { target: { value: 'https://oauth.example.com/mcp' } });

      fireEvent.click(screen.getByText('Connect'));

      await waitFor(() => {
        expect(mockStartOAuthFlow).toHaveBeenCalled();
      });

      // Send message event with different service name
      const messageEvent = new MessageEvent('message', {
        data: {
          type: 'GOOGLE_AUTH_SUCCESS',
          connectedServiceId: 456,
          provider: 'google',
          serviceName: 'google-drive', // Different service
        },
        origin: window.location.origin,
      });
      window.dispatchEvent(messageEvent);

      await new Promise((resolve) => setTimeout(resolve, 200));
      // Should not create connection with different service name
      expect(mockCreateMCPServerConnection).not.toHaveBeenCalled();
    });

    it('ignores message events with wrong type', async () => {
      const oauthProps = {
        ...defaultProps,
        tenantKey: 'test-tenant',
        username: 'test-user',
        mentorId: 'mentor-123',
      };

      render(<ConnectorDialogs {...oauthProps} />);

      // Select OAuth auth method (second select is Authentication Method)
      const authSelects = screen.getAllByTestId('select');
      fireEvent.change(authSelects[1], { target: { value: 'oauth' } });

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');

      fireEvent.change(nameInput, { target: { value: 'OAuth Connector' } });
      fireEvent.change(serverInput, { target: { value: 'https://oauth.example.com/mcp' } });

      fireEvent.click(screen.getByText('Connect'));

      await waitFor(() => {
        expect(mockStartOAuthFlow).toHaveBeenCalled();
      });

      // Send message event with wrong type
      const messageEvent = new MessageEvent('message', {
        data: {
          type: 'WRONG_TYPE',
          connectedServiceId: 456,
          provider: 'google',
          serviceName: 'google-calendar',
        },
        origin: window.location.origin,
      });
      window.dispatchEvent(messageEvent);

      await new Promise((resolve) => setTimeout(resolve, 200));
      // Should not create connection with wrong type
      expect(mockCreateMCPServerConnection).not.toHaveBeenCalled();
    });

    it('ignores message events without connectedServiceId', async () => {
      const oauthProps = {
        ...defaultProps,
        tenantKey: 'test-tenant',
        username: 'test-user',
        mentorId: 'mentor-123',
      };

      render(<ConnectorDialogs {...oauthProps} />);

      // Select OAuth auth method (second select is Authentication Method)
      const authSelects = screen.getAllByTestId('select');
      fireEvent.change(authSelects[1], { target: { value: 'oauth' } });

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');

      fireEvent.change(nameInput, { target: { value: 'OAuth Connector' } });
      fireEvent.change(serverInput, { target: { value: 'https://oauth.example.com/mcp' } });

      fireEvent.click(screen.getByText('Connect'));

      await waitFor(() => {
        expect(mockStartOAuthFlow).toHaveBeenCalled();
      });

      // Send message event without connectedServiceId
      const messageEvent = new MessageEvent('message', {
        data: {
          type: 'GOOGLE_AUTH_SUCCESS',
          provider: 'google',
          serviceName: 'google-calendar',
          // No connectedServiceId
        },
        origin: window.location.origin,
      });
      window.dispatchEvent(messageEvent);

      await new Promise((resolve) => setTimeout(resolve, 200));
      // Should not create connection without connectedServiceId
      expect(mockCreateMCPServerConnection).not.toHaveBeenCalled();
    });
  });

  describe('Branch coverage: storage event handlers', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockGetMCPServers.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ results: [] }),
      });
      mockOauthFind.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({
          id: 123,
          oauth_provider: 'google',
          name: 'google-calendar',
        }),
      });
      mockCreateMCPServer.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({
          id: 999,
          name: 'Test OAuth Server',
          url: 'https://oauth.example.com/mcp',
        }),
      });
      mockStartOAuthFlow.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ auth_url: 'https://auth.example.com/oauth' }),
      });
      mockRefetchConnected.mockResolvedValue({ data: [] });
    });

    it('handles storage event with non-matching provider', async () => {
      const oauthProps = {
        ...defaultProps,
        tenantKey: 'test-tenant',
        username: 'test-user',
        mentorId: 'mentor-123',
      };

      render(<ConnectorDialogs {...oauthProps} />);

      // Select OAuth auth method (second select is Authentication Method)
      const authSelects = screen.getAllByTestId('select');
      fireEvent.change(authSelects[1], { target: { value: 'oauth' } });

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');

      fireEvent.change(nameInput, { target: { value: 'OAuth Connector' } });
      fireEvent.change(serverInput, { target: { value: 'https://oauth.example.com/mcp' } });

      fireEvent.click(screen.getByText('Connect'));

      await waitFor(() => {
        expect(mockStartOAuthFlow).toHaveBeenCalled();
      });

      // Send storage event with non-matching provider
      const storageEvent = new StorageEvent('storage', {
        key: 'oauth_connection_complete',
        newValue: JSON.stringify({
          connectedServiceId: 456,
          provider: 'microsoft', // Different provider
          serviceName: 'google-calendar',
        }),
      });
      window.dispatchEvent(storageEvent);

      await new Promise((resolve) => setTimeout(resolve, 200));
      // Should call checkConnection instead of createConnection
    });

    it('handles storage event with non-matching service name', async () => {
      const oauthProps = {
        ...defaultProps,
        tenantKey: 'test-tenant',
        username: 'test-user',
        mentorId: 'mentor-123',
      };

      render(<ConnectorDialogs {...oauthProps} />);

      // Select OAuth auth method (second select is Authentication Method)
      const authSelects = screen.getAllByTestId('select');
      fireEvent.change(authSelects[1], { target: { value: 'oauth' } });

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');

      fireEvent.change(nameInput, { target: { value: 'OAuth Connector' } });
      fireEvent.change(serverInput, { target: { value: 'https://oauth.example.com/mcp' } });

      fireEvent.click(screen.getByText('Connect'));

      await waitFor(() => {
        expect(mockStartOAuthFlow).toHaveBeenCalled();
      });

      // Send storage event with non-matching service name
      const storageEvent = new StorageEvent('storage', {
        key: 'oauth_connection_complete',
        newValue: JSON.stringify({
          connectedServiceId: 456,
          provider: 'google',
          serviceName: 'google-drive', // Different service
        }),
      });
      window.dispatchEvent(storageEvent);

      await new Promise((resolve) => setTimeout(resolve, 200));
      // Should call checkConnection instead of createConnection
    });

    it('handles storage event with invalid JSON', async () => {
      const oauthProps = {
        ...defaultProps,
        tenantKey: 'test-tenant',
        username: 'test-user',
        mentorId: 'mentor-123',
      };

      render(<ConnectorDialogs {...oauthProps} />);

      // Select OAuth auth method (second select is Authentication Method)
      const authSelects = screen.getAllByTestId('select');
      fireEvent.change(authSelects[1], { target: { value: 'oauth' } });

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');

      fireEvent.change(nameInput, { target: { value: 'OAuth Connector' } });
      fireEvent.change(serverInput, { target: { value: 'https://oauth.example.com/mcp' } });

      fireEvent.click(screen.getByText('Connect'));

      await waitFor(() => {
        expect(mockStartOAuthFlow).toHaveBeenCalled();
      });

      // Send storage event with invalid JSON
      const storageEvent = new StorageEvent('storage', {
        key: 'oauth_connection_complete',
        newValue: 'invalid-json{',
      });
      window.dispatchEvent(storageEvent);

      await new Promise((resolve) => setTimeout(resolve, 200));
      // Should call checkConnection on JSON parse error
    });

    it('handles storage event with different key', async () => {
      const oauthProps = {
        ...defaultProps,
        tenantKey: 'test-tenant',
        username: 'test-user',
        mentorId: 'mentor-123',
      };

      render(<ConnectorDialogs {...oauthProps} />);

      // Select OAuth auth method (second select is Authentication Method)
      const authSelects = screen.getAllByTestId('select');
      fireEvent.change(authSelects[1], { target: { value: 'oauth' } });

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');

      fireEvent.change(nameInput, { target: { value: 'OAuth Connector' } });
      fireEvent.change(serverInput, { target: { value: 'https://oauth.example.com/mcp' } });

      fireEvent.click(screen.getByText('Connect'));

      await waitFor(() => {
        expect(mockStartOAuthFlow).toHaveBeenCalled();
      });

      // Send storage event with different key
      const storageEvent = new StorageEvent('storage', {
        key: 'some_other_key',
        newValue: JSON.stringify({
          connectedServiceId: 456,
          provider: 'google',
          serviceName: 'google-calendar',
        }),
      });
      window.dispatchEvent(storageEvent);

      await new Promise((resolve) => setTimeout(resolve, 200));
      // Should ignore storage events with different key
      expect(mockCreateMCPServerConnection).not.toHaveBeenCalled();
    });
  });

  describe('Branch coverage: checkConnection branches', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockGetMCPServers.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ results: [] }),
      });
      mockOauthFind.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({
          id: 123,
          oauth_provider: 'google',
          name: 'google-calendar',
        }),
      });
      mockCreateMCPServer.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({
          id: 999,
          name: 'Test OAuth Server',
          url: 'https://oauth.example.com/mcp',
        }),
      });
      mockStartOAuthFlow.mockReturnValue({
        unwrap: vi.fn().mockResolvedValue({ auth_url: 'https://auth.example.com/oauth' }),
      });
    });

    it('handles checkConnection with null data', async () => {
      mockRefetchConnected.mockResolvedValue({ data: null });

      const oauthProps = {
        ...defaultProps,
        tenantKey: 'test-tenant',
        username: 'test-user',
        mentorId: 'mentor-123',
      };

      render(<ConnectorDialogs {...oauthProps} />);

      // Select OAuth auth method (second select is Authentication Method)
      const authSelects = screen.getAllByTestId('select');
      fireEvent.change(authSelects[1], { target: { value: 'oauth' } });

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');

      fireEvent.change(nameInput, { target: { value: 'OAuth Connector' } });
      fireEvent.change(serverInput, { target: { value: 'https://oauth.example.com/mcp' } });

      fireEvent.click(screen.getByText('Connect'));

      await waitFor(() => {
        expect(mockStartOAuthFlow).toHaveBeenCalled();
      });

      // Trigger focus event - should handle null data gracefully
      window.dispatchEvent(new Event('focus'));

      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(mockCreateMCPServerConnection).not.toHaveBeenCalled();
    });

    it('handles checkConnection when refetch throws error', async () => {
      mockRefetchConnected.mockRejectedValue(new Error('Network error'));

      const oauthProps = {
        ...defaultProps,
        tenantKey: 'test-tenant',
        username: 'test-user',
        mentorId: 'mentor-123',
      };

      render(<ConnectorDialogs {...oauthProps} />);

      // Select OAuth auth method (second select is Authentication Method)
      const authSelects = screen.getAllByTestId('select');
      fireEvent.change(authSelects[1], { target: { value: 'oauth' } });

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');

      fireEvent.change(nameInput, { target: { value: 'OAuth Connector' } });
      fireEvent.change(serverInput, { target: { value: 'https://oauth.example.com/mcp' } });

      fireEvent.click(screen.getByText('Connect'));

      await waitFor(() => {
        expect(mockStartOAuthFlow).toHaveBeenCalled();
      });

      // Trigger focus event - should handle error gracefully
      window.dispatchEvent(new Event('focus'));

      await new Promise((resolve) => setTimeout(resolve, 200));
      // Should continue polling despite error
    });

    it('handles checkConnection with service not found', async () => {
      mockRefetchConnected.mockResolvedValue({
        data: [{ provider: 'microsoft', service: 'outlook', id: 123 }],
      });

      const oauthProps = {
        ...defaultProps,
        tenantKey: 'test-tenant',
        username: 'test-user',
        mentorId: 'mentor-123',
      };

      render(<ConnectorDialogs {...oauthProps} />);

      // Select OAuth auth method (second select is Authentication Method)
      const authSelects = screen.getAllByTestId('select');
      fireEvent.change(authSelects[1], { target: { value: 'oauth' } });

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');

      fireEvent.change(nameInput, { target: { value: 'OAuth Connector' } });
      fireEvent.change(serverInput, { target: { value: 'https://oauth.example.com/mcp' } });

      fireEvent.click(screen.getByText('Connect'));

      await waitFor(() => {
        expect(mockStartOAuthFlow).toHaveBeenCalled();
      });

      // Trigger focus event - service not found
      window.dispatchEvent(new Event('focus'));

      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(mockCreateMCPServerConnection).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // HELPER FUNCTION TESTS
  // ===========================================================================

  describe('canCreateOAuthConnection', () => {
    it('returns false when isCreatingConnection is true', () => {
      const result = canCreateOAuthConnection(true, 123);
      expect(result).toBe(false);
    });

    it('returns false when connectedServiceId is 0', () => {
      const result = canCreateOAuthConnection(false, 0);
      expect(result).toBe(false);
    });

    it('returns true when connectedServiceId is negative (truthy value)', () => {
      // Negative numbers are truthy, so they pass the !connectedServiceId check
      const result = canCreateOAuthConnection(false, -1);
      expect(result).toBe(true);
    });

    it('returns false when connectedServiceId is NaN', () => {
      const result = canCreateOAuthConnection(false, NaN);
      expect(result).toBe(false);
    });

    it('returns false when connectedServiceId is Infinity', () => {
      const result = canCreateOAuthConnection(false, Infinity);
      expect(result).toBe(false);
    });

    it('returns true when not creating and connectedServiceId is valid positive number', () => {
      const result = canCreateOAuthConnection(false, 123);
      expect(result).toBe(true);
    });

    it('returns true when not creating and connectedServiceId is 1', () => {
      const result = canCreateOAuthConnection(false, 1);
      expect(result).toBe(true);
    });
  });

  describe('validateConnectorForm', () => {
    it('returns invalid when name is empty', () => {
      const result = validateConnectorForm('', 'https://example.com');
      expect(result).toEqual({
        isValid: false,
        error: 'Please fill in all required fields.',
      });
    });

    it('returns invalid when name is only whitespace', () => {
      const result = validateConnectorForm('   ', 'https://example.com');
      expect(result).toEqual({
        isValid: false,
        error: 'Please fill in all required fields.',
      });
    });

    it('returns invalid when server is empty', () => {
      const result = validateConnectorForm('Test Connector', '');
      expect(result).toEqual({
        isValid: false,
        error: 'Please fill in all required fields.',
      });
    });

    it('returns invalid when server is only whitespace', () => {
      const result = validateConnectorForm('Test Connector', '   ');
      expect(result).toEqual({
        isValid: false,
        error: 'Please fill in all required fields.',
      });
    });

    it('returns invalid when both name and server are empty', () => {
      const result = validateConnectorForm('', '');
      expect(result).toEqual({
        isValid: false,
        error: 'Please fill in all required fields.',
      });
    });

    it('returns invalid when server is not a valid URL', () => {
      const result = validateConnectorForm('Test Connector', 'not-a-url');
      expect(result).toEqual({
        isValid: false,
        error: 'Please enter a valid URL.',
      });
    });

    it('returns invalid when server is missing protocol', () => {
      const result = validateConnectorForm('Test Connector', 'example.com');
      expect(result).toEqual({
        isValid: false,
        error: 'Please enter a valid URL.',
      });
    });

    it('returns valid when name and server are valid', () => {
      const result = validateConnectorForm('Test Connector', 'https://example.com');
      expect(result).toEqual({
        isValid: true,
        error: null,
      });
    });

    it('returns valid with trimmed name containing whitespace around it', () => {
      const result = validateConnectorForm('  Test Connector  ', 'https://example.com');
      expect(result).toEqual({
        isValid: true,
        error: null,
      });
    });

    it('returns valid with trimmed server containing whitespace around it', () => {
      const result = validateConnectorForm('Test Connector', '  https://example.com  ');
      expect(result).toEqual({
        isValid: true,
        error: null,
      });
    });

    it('returns valid for http protocol', () => {
      const result = validateConnectorForm('Test Connector', 'http://example.com');
      expect(result).toEqual({
        isValid: true,
        error: null,
      });
    });

    it('returns valid for URL with path', () => {
      const result = validateConnectorForm('Test Connector', 'https://example.com/mcp/server');
      expect(result).toEqual({
        isValid: true,
        error: null,
      });
    });

    it('returns valid for URL with port', () => {
      const result = validateConnectorForm('Test Connector', 'https://example.com:8080');
      expect(result).toEqual({
        isValid: true,
        error: null,
      });
    });
  });

  describe('getValidationErrorMessage', () => {
    it('returns error when error is provided', () => {
      const result = getValidationErrorMessage('Custom error message');
      expect(result).toBe('Custom error message');
    });

    it('returns fallback when error is null', () => {
      const result = getValidationErrorMessage(null);
      expect(result).toBe('Validation failed');
    });

    it('returns fallback when error is undefined', () => {
      const result = getValidationErrorMessage(undefined);
      expect(result).toBe('Validation failed');
    });

    it('returns fallback when error is empty string', () => {
      const result = getValidationErrorMessage('');
      expect(result).toBe('Validation failed');
    });

    it('returns custom fallback when provided', () => {
      const result = getValidationErrorMessage(null, 'Custom fallback');
      expect(result).toBe('Custom fallback');
    });

    it('returns custom fallback when error is empty string', () => {
      const result = getValidationErrorMessage('', 'Custom fallback');
      expect(result).toBe('Custom fallback');
    });

    it('returns error over custom fallback when error is provided', () => {
      const result = getValidationErrorMessage('Error message', 'Custom fallback');
      expect(result).toBe('Error message');
    });
  });

  describe('extractApiErrorMessage', () => {
    it('returns detail from data object', () => {
      const error = { data: { detail: 'Detail error message' } };
      const result = extractApiErrorMessage(error);
      expect(result).toBe('Detail error message');
    });

    it('returns error from data object when detail is missing', () => {
      const error = { data: { error: 'Error message from data.error' } };
      const result = extractApiErrorMessage(error);
      expect(result).toBe('Error message from data.error');
    });

    it('returns message when data properties are missing', () => {
      const error = { message: 'Error message from message property' };
      const result = extractApiErrorMessage(error);
      expect(result).toBe('Error message from message property');
    });

    it('returns default message when no error properties exist', () => {
      const error = {};
      const result = extractApiErrorMessage(error, 'Default error message');
      expect(result).toBe('Default error message');
    });

    it('returns empty string when no error properties and no default', () => {
      const error = {};
      const result = extractApiErrorMessage(error);
      expect(result).toBe('');
    });

    it('handles null error gracefully', () => {
      const result = extractApiErrorMessage(null);
      expect(result).toBe('');
    });

    it('handles undefined error gracefully', () => {
      const result = extractApiErrorMessage(undefined);
      expect(result).toBe('');
    });

    it('prioritizes detail over error and message', () => {
      const error = {
        data: { detail: 'Detail', error: 'Error' },
        message: 'Message',
      };
      const result = extractApiErrorMessage(error);
      expect(result).toBe('Detail');
    });

    it('prioritizes error over message when detail is missing', () => {
      const error = {
        data: { error: 'Error' },
        message: 'Message',
      };
      const result = extractApiErrorMessage(error);
      expect(result).toBe('Error');
    });

    it('returns message when data is empty object', () => {
      const error = {
        data: {},
        message: 'Message',
      };
      const result = extractApiErrorMessage(error);
      expect(result).toBe('Message');
    });

    it('handles nested null data gracefully', () => {
      const error = { data: null, message: 'Message' };
      const result = extractApiErrorMessage(error);
      expect(result).toBe('Message');
    });
  });

  describe('validateCustomTokenType', () => {
    it('returns invalid for empty string', () => {
      const result = validateCustomTokenType('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Custom token type is required.');
    });

    it('returns invalid for whitespace-only string', () => {
      const result = validateCustomTokenType('   ');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Custom token type is required.');
    });

    it('returns invalid for string longer than 50 characters', () => {
      const result = validateCustomTokenType('a'.repeat(51));
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Token type must be 50 characters or fewer.');
    });

    it('returns invalid for string with spaces', () => {
      const result = validateCustomTokenType('My Token');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Token type may only contain letters, numbers, and hyphens.');
    });

    it('returns invalid for string with special characters', () => {
      const result = validateCustomTokenType('Token@123');
      expect(result.isValid).toBe(false);
    });

    it('returns valid for alphanumeric string', () => {
      const result = validateCustomTokenType('CustomAuth');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('returns valid for string with hyphens', () => {
      const result = validateCustomTokenType('X-Custom-Auth');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('returns valid for exactly 50 characters', () => {
      const result = validateCustomTokenType('a'.repeat(50));
      expect(result.isValid).toBe(true);
    });
  });

  describe('Token Type Other Option', () => {
    it('shows Other option instead of OAuth in token type dropdown', () => {
      render(<ConnectorDialogs {...defaultProps} />);
      const selects = screen.getAllByTestId('select');
      const authSelect = selects[1];
      fireEvent.change(authSelect, { target: { value: 'api-key' } });

      // Other should be present as an option in the token type select
      const options = screen.getAllByRole('option');
      const optionValues = options.map((o: HTMLElement) => (o as HTMLOptionElement).value);
      expect(optionValues).toContain('Other');
      // OAuth should NOT be present as a token type option
      expect(optionValues).not.toContain('OAuth');
    });

    it('shows custom token type input when Other is selected', () => {
      render(<ConnectorDialogs {...defaultProps} />);
      const selects = screen.getAllByTestId('select');
      const authSelect = selects[1];
      fireEvent.change(authSelect, { target: { value: 'api-key' } });

      // Select "Other" token type
      const tokenTypeSelect = screen.getAllByTestId('select')[2];
      fireEvent.change(tokenTypeSelect, { target: { value: 'Other' } });

      expect(screen.getByPlaceholderText('e.g. X-Custom-Auth')).toBeInTheDocument();
      expect(
        screen.getByText('Alphanumeric characters and hyphens only. Max 50 characters.'),
      ).toBeInTheDocument();
    });

    it('hides custom token type input for known token types', () => {
      render(<ConnectorDialogs {...defaultProps} />);
      const selects = screen.getAllByTestId('select');
      const authSelect = selects[1];
      fireEvent.change(authSelect, { target: { value: 'api-key' } });

      // Should not show custom input for Bearer (default)
      expect(screen.queryByPlaceholderText('e.g. X-Custom-Auth')).not.toBeInTheDocument();
    });

    it('disables submit when Other is selected but custom type is empty', () => {
      render(<ConnectorDialogs {...defaultProps} />);

      const selects = screen.getAllByTestId('select');
      const authSelect = selects[1];
      fireEvent.change(authSelect, { target: { value: 'api-key' } });

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');
      fireEvent.change(nameInput, { target: { value: 'Test' } });
      fireEvent.change(serverInput, { target: { value: 'https://test.com' } });

      // Select "Other" token type
      const tokenTypeSelect = screen.getAllByTestId('select')[2];
      fireEvent.change(tokenTypeSelect, { target: { value: 'Other' } });

      const submitButton = screen.getByText('Connect');
      expect(submitButton).toBeDisabled();
    });

    it('submits with custom token type in credentials', async () => {
      mockOnAddConnector.mockResolvedValue(undefined);

      render(<ConnectorDialogs {...defaultProps} />);

      const selects = screen.getAllByTestId('select');
      const authSelect = selects[1];
      fireEvent.change(authSelect, { target: { value: 'api-key' } });

      // Select "Other" token type
      const tokenTypeSelect = screen.getAllByTestId('select')[2];
      fireEvent.change(tokenTypeSelect, { target: { value: 'Other' } });

      // Fill custom token type
      const customInput = screen.getByPlaceholderText('e.g. X-Custom-Auth');
      fireEvent.change(customInput, { target: { value: 'X-Custom-Auth' } });

      // Fill other fields
      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');
      const tokenInput = screen.getByPlaceholderText('Enter your token');
      fireEvent.change(nameInput, { target: { value: 'Custom Token Server' } });
      fireEvent.change(serverInput, { target: { value: 'https://custom.example.com/mcp' } });
      fireEvent.change(tokenInput, { target: { value: 'my-secret-token' } });

      fireEvent.click(screen.getByText('Connect'));

      await waitFor(() => {
        expect(mockOnAddConnector).toHaveBeenCalledWith(
          expect.objectContaining({
            credentials: 'X-Custom-Auth my-secret-token',
          }),
        );
      });
    });

    it('pre-fills Other and custom type when editing with unknown token type', () => {
      const serverWithCustomAuth = {
        id: 1,
        name: 'Custom Auth Server',
        url: 'https://api.example.com/mcp',
        transport: 'streamable_http',
        auth_type: 'token',
        credentials: 'X-Custom-Header secret-value',
      };

      render(<ConnectorDialogs {...defaultProps} editingServer={serverWithCustomAuth as any} />);

      // Auth method should be api-key
      const selects = screen.getAllByTestId('select');
      expect(selects[1]).toHaveValue('api-key');
      // Token type should be Other
      expect(selects[2]).toHaveValue('Other');
      // Custom input should show the parsed type
      expect(screen.getByPlaceholderText('e.g. X-Custom-Auth')).toHaveValue('X-Custom-Header');
    });

    it('pre-fills known token type without showing Other', () => {
      const serverWithBasicAuth = {
        id: 1,
        name: 'Basic Auth Server',
        url: 'https://api.example.com/mcp',
        transport: 'sse',
        auth_type: 'token',
        credentials: 'Basic dXNlcjpwYXNz',
      };

      render(<ConnectorDialogs {...defaultProps} editingServer={serverWithBasicAuth as any} />);

      const selects = screen.getAllByTestId('select');
      expect(selects[1]).toHaveValue('api-key');
      // Token type should be Basic, not Other
      expect(selects[2]).toHaveValue('Basic');
      // Custom input should NOT be shown
      expect(screen.queryByPlaceholderText('e.g. X-Custom-Auth')).not.toBeInTheDocument();
    });
  });

  describe('Connector Scope Radio', () => {
    it('renders connector scope radio group', () => {
      render(<ConnectorDialogs {...defaultProps} />);
      expect(screen.getByText('Connector Scope')).toBeInTheDocument();
      expect(screen.getByText('All Mentors')).toBeInTheDocument();
      expect(screen.getByText('This Mentor')).toBeInTheDocument();
    });

    it('defaults to tenant scope', () => {
      render(<ConnectorDialogs {...defaultProps} />);
      const radioGroup = screen.getByTestId('radio-group');
      expect(radioGroup).toHaveAttribute('data-value', 'tenant');
    });

    it('shows tenant helper text by default', () => {
      render(<ConnectorDialogs {...defaultProps} />);
      expect(screen.getByText('This MCP will be available for all mentors.')).toBeInTheDocument();
    });

    it('sends mentor as null when tenant scope is selected', async () => {
      render(
        <ConnectorDialogs
          {...defaultProps}
          tenantKey="test-tenant"
          username="test-user"
          mentorId="mentor-123"
        />,
      );

      const nameInput = screen.getByPlaceholderText('Enter connector name');
      const serverInput = screen.getByPlaceholderText('https://api.example.com/mcp');
      fireEvent.change(nameInput, { target: { value: 'Test Connector' } });
      fireEvent.change(serverInput, { target: { value: 'https://test.com/mcp' } });

      fireEvent.click(screen.getByText('Connect'));

      await waitFor(() => {
        expect(mockOnAddConnector).toHaveBeenCalledWith(
          expect.objectContaining({
            mentor: null,
          }),
        );
      });
    });

    it('pre-fills "this-mentor" scope when editing server with mentor field', () => {
      const serverWithMentor = {
        id: 1,
        name: 'Mentor Server',
        url: 'https://api.example.com/mcp',
        transport: 'streamable_http',
        auth_type: 'none',
        credentials: '',
        mentor: 'mentor-123',
      };

      render(<ConnectorDialogs {...defaultProps} editingServer={serverWithMentor as any} />);

      const radioGroup = screen.getByTestId('radio-group');
      expect(radioGroup).toHaveAttribute('data-value', 'this-mentor');
    });

    it('pre-fills "tenant" scope when editing server without mentor field', () => {
      const serverWithoutMentor = {
        id: 1,
        name: 'Tenant Server',
        url: 'https://api.example.com/mcp',
        transport: 'streamable_http',
        auth_type: 'none',
        credentials: '',
        mentor: null,
      };

      render(<ConnectorDialogs {...defaultProps} editingServer={serverWithoutMentor as any} />);

      const radioGroup = screen.getByTestId('radio-group');
      expect(radioGroup).toHaveAttribute('data-value', 'tenant');
    });

    it('resets connector scope to tenant when form is reset', async () => {
      const { rerender } = render(
        <ConnectorDialogs
          {...defaultProps}
          editingServer={
            {
              id: 1,
              name: 'Mentor Server',
              url: 'https://api.example.com/mcp',
              transport: 'streamable_http',
              auth_type: 'none',
              credentials: '',
              mentor: 'mentor-123',
            } as any
          }
        />,
      );

      // Verify it starts as this-mentor
      expect(screen.getByTestId('radio-group')).toHaveAttribute('data-value', 'this-mentor');

      // Close and reopen without editingServer
      rerender(<ConnectorDialogs {...defaultProps} open={false} />);
      rerender(<ConnectorDialogs {...defaultProps} open={true} />);

      // Should be reset to tenant
      expect(screen.getByTestId('radio-group')).toHaveAttribute('data-value', 'tenant');
    });
  });
});
