import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

import { AddResourceModal } from '../add-resource-modal';

// Stub next/script so the google api loader does not run.
vi.mock('next/script', () => ({
  default: ({ onLoad }: { onLoad?: () => void }) => {
    // call onLoad so loadGoogleApiScript is wired up but harmless.
    if (onLoad) onLoad();
    return <div data-testid="next-script" />;
  },
}));

// Stub the heavy ResourceModal child – we only need to know it rendered.
vi.mock('../resource-modal', () => ({
  ResourceModal: ({
    resource,
    onClose,
  }: {
    resource: { name: string };
    onClose: () => void;
  }) => (
    <div data-testid="resource-modal">
      <span>Resource: {resource.name}</span>
      <button onClick={onClose}>close-resource-modal</button>
    </div>
  ),
}));

// Each picker hook reports whether its tenant credential lookup has finished
// (`credentialsLoaded`) and whether a credential was found (`isConfigured`).
const dropboxState = { credentialsLoaded: true, isConfigured: true };
const googleDriveState = {
  isPickerLoaded: true,
  pickerError: null as string | null,
  credentialsLoaded: true,
  isConfigured: true,
};
const oneDriveState = { credentialsLoaded: true, isConfigured: true };

const mockOpenChooser = vi.fn();
vi.mock('@/hooks/use-dropdox-picker', () => ({
  default: () => ({ openChooser: mockOpenChooser, ...dropboxState }),
}));

const mockHandlePickerOpen = vi.fn();
const mockLoadGoogleApiScript = vi.fn();
const mockForceClosePickerModal = vi.fn();
vi.mock('@/hooks/use-google-drive-picker', () => ({
  default: () => ({
    handlePickerOpen: mockHandlePickerOpen,
    loadGoogleApiScript: mockLoadGoogleApiScript,
    isPickerLoaded: googleDriveState.isPickerLoaded,
    forceClosePickerModal: mockForceClosePickerModal,
    pickerError: googleDriveState.pickerError,
    credentialsLoaded: googleDriveState.credentialsLoaded,
    isConfigured: googleDriveState.isConfigured,
  }),
}));

const mockPickOneDriveFile = vi.fn();
vi.mock('@/hooks/use-one-drive-picker', () => ({
  default: () => ({ pickOneDriveFile: mockPickOneDriveFile, ...oneDriveState }),
}));

const mockDisabledDatasets = vi.fn(() => 'zip|courses');
vi.mock('@/lib/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/config')>();
  return {
    ...actual,
    config: {
      ...actual.config,
      disabedDatasets: () => mockDisabledDatasets(),
    },
  };
});

describe('AddResourceModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
  };

  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    googleDriveState.isPickerLoaded = true;
    googleDriveState.pickerError = null;
    googleDriveState.credentialsLoaded = true;
    googleDriveState.isConfigured = true;
    dropboxState.credentialsLoaded = true;
    dropboxState.isConfigured = true;
    oneDriveState.credentialsLoaded = true;
    oneDriveState.isConfigured = true;
    mockDisabledDatasets.mockReturnValue('zip|courses');
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the modal title and description', () => {
    render(<AddResourceModal {...defaultProps} />);
    expect(screen.getByText('Add Resources')).toBeInTheDocument();
    expect(
      screen.getByText(/Add knowledge to help your agent/),
    ).toBeInTheDocument();
  });

  it('does not render content when isOpen is false', () => {
    render(<AddResourceModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByText('Add Resources')).not.toBeInTheDocument();
  });

  it('renders all resource type buttons', () => {
    render(<AddResourceModal {...defaultProps} />);
    expect(screen.getByText('PowerPoint')).toBeInTheDocument();
    expect(screen.getByText('Google Drive')).toBeInTheDocument();
    expect(screen.getByText('Dropbox')).toBeInTheDocument();
    expect(screen.getByText('Microsoft OneDrive')).toBeInTheDocument();
    expect(screen.getByText('GitHub')).toBeInTheDocument();
  });

  it('disables datasets listed in the disabled config', () => {
    render(<AddResourceModal {...defaultProps} />);
    expect(screen.getByText('ZIP').closest('button')).toBeDisabled();
    expect(screen.getByText('Course').closest('button')).toBeDisabled();
  });

  it('opens the ResourceModal when a non-link resource is clicked', () => {
    render(<AddResourceModal {...defaultProps} />);

    fireEvent.click(screen.getByText('PowerPoint'));

    expect(screen.getByTestId('resource-modal')).toBeInTheDocument();
    expect(screen.getByText('Resource: PowerPoint')).toBeInTheDocument();
  });

  it('closes the ResourceModal via its onClose', () => {
    render(<AddResourceModal {...defaultProps} />);

    fireEvent.click(screen.getByText('PowerPoint'));
    expect(screen.getByTestId('resource-modal')).toBeInTheDocument();

    fireEvent.click(screen.getByText('close-resource-modal'));
    expect(screen.queryByTestId('resource-modal')).not.toBeInTheDocument();
  });

  it('opens the Google Drive picker when loaded', () => {
    render(<AddResourceModal {...defaultProps} />);

    fireEvent.click(screen.getByText('Google Drive'));

    expect(mockHandlePickerOpen).toHaveBeenCalledTimes(1);
  });

  it('logs and does not open the picker when Google Drive is still loading', () => {
    googleDriveState.isPickerLoaded = false;
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    render(<AddResourceModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Google Drive'));

    expect(mockHandlePickerOpen).not.toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith(
      'Google Picker is still loading...',
    );

    consoleLogSpy.mockRestore();
  });

  it('opens the Dropbox chooser', () => {
    render(<AddResourceModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Dropbox'));
    expect(mockOpenChooser).toHaveBeenCalledTimes(1);
  });

  it('opens the OneDrive picker', () => {
    render(<AddResourceModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Microsoft OneDrive'));
    expect(mockPickOneDriveFile).toHaveBeenCalledTimes(1);
  });

  it('renders the google drive picker error and force close button', () => {
    googleDriveState.pickerError = 'Something went wrong';

    render(<AddResourceModal {...defaultProps} />);

    expect(screen.getByText('Google Drive Picker Error')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Force Close Picker'));
    expect(mockForceClosePickerModal).toHaveBeenCalledTimes(1);
  });

  describe('cloud providers without tenant credentials', () => {
    const NOT_CONFIGURED = 'Not configured for this tenant';

    it('leaves the cloud buttons enabled and unlabelled when credentials exist', () => {
      render(<AddResourceModal {...defaultProps} />);

      expect(screen.getByText('Google Drive').closest('button')).toBeEnabled();
      expect(screen.getByText('Dropbox').closest('button')).toBeEnabled();
      expect(
        screen.getByText('Microsoft OneDrive').closest('button'),
      ).toBeEnabled();
      expect(screen.queryByText(NOT_CONFIGURED)).not.toBeInTheDocument();
    });

    it('disables Google Drive and says why when the tenant has no credential', () => {
      googleDriveState.isConfigured = false;

      render(<AddResourceModal {...defaultProps} />);

      const button = screen.getByText('Google Drive').closest('button');
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('title', NOT_CONFIGURED);
      expect(screen.getByText(NOT_CONFIGURED)).toBeInTheDocument();
    });

    it('disables OneDrive when the tenant has no credential', () => {
      oneDriveState.isConfigured = false;

      render(<AddResourceModal {...defaultProps} />);

      expect(
        screen.getByText('Microsoft OneDrive').closest('button'),
      ).toBeDisabled();
      expect(screen.getByText('Google Drive').closest('button')).toBeEnabled();
    });

    it('disables Dropbox when the tenant has no credential', () => {
      dropboxState.isConfigured = false;

      render(<AddResourceModal {...defaultProps} />);

      expect(screen.getByText('Dropbox').closest('button')).toBeDisabled();
      expect(screen.getByText('Google Drive').closest('button')).toBeEnabled();
    });

    it('does not disable a provider while its credential lookup is in flight', () => {
      googleDriveState.credentialsLoaded = false;
      googleDriveState.isConfigured = false;

      render(<AddResourceModal {...defaultProps} />);

      expect(screen.getByText('Google Drive').closest('button')).toBeEnabled();
      expect(screen.queryByText(NOT_CONFIGURED)).not.toBeInTheDocument();
    });

    it('does not invoke a picker when its button is disabled', () => {
      googleDriveState.isConfigured = false;
      dropboxState.isConfigured = false;
      oneDriveState.isConfigured = false;

      render(<AddResourceModal {...defaultProps} />);

      fireEvent.click(screen.getByText('Google Drive'));
      fireEvent.click(screen.getByText('Dropbox'));
      fireEvent.click(screen.getByText('Microsoft OneDrive'));

      expect(mockHandlePickerOpen).not.toHaveBeenCalled();
      expect(mockOpenChooser).not.toHaveBeenCalled();
      expect(mockPickOneDriveFile).not.toHaveBeenCalled();
    });

    it('leaves non-cloud resources unaffected by credential state', () => {
      googleDriveState.isConfigured = false;
      dropboxState.isConfigured = false;
      oneDriveState.isConfigured = false;

      render(<AddResourceModal {...defaultProps} />);

      expect(screen.getByText('PowerPoint').closest('button')).toBeEnabled();
      expect(screen.getByText('GitHub').closest('button')).toBeEnabled();
    });
  });
});
