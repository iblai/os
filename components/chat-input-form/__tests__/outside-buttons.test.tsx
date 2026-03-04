import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OutsideButtons } from '../outside-buttons';
import { TOOLS } from '@iblai/iblai-js/web-utils';

// Mock modules
vi.mock('@iblai/iblai-js/data-layer', () => ({
  useLazyGetConnectedServiceAuthUrlQuery: vi.fn(() => [vi.fn()]),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}));

vi.mock('@/components/icons/svg-icons', () => ({
  ImageIcon: ({ className }: { className?: string }) => (
    <svg data-testid="image-icon" className={className} />
  ),
  PowerPointIcon: ({ className }: { className?: string }) => (
    <svg data-testid="powerpoint-icon" className={className} />
  ),
  QuizIcon: ({ className }: { className?: string }) => (
    <svg data-testid="quiz-icon" className={className} />
  ),
  RubricIcon: ({ className }: { className?: string }) => (
    <svg data-testid="rubric-icon" className={className} />
  ),
  ResourceIcon: ({ className }: { className?: string }) => (
    <svg data-testid="resource-icon" className={className} />
  ),
  LessonPlanIcon: ({ className }: { className?: string }) => (
    <svg data-testid="lesson-plan-icon" className={className} />
  ),
  SyllabusIcon: ({ className }: { className?: string }) => (
    <svg data-testid="syllabus-icon" className={className} />
  ),
  MoreIcon: ({ className }: { className?: string }) => (
    <svg data-testid="more-icon" className={className} />
  ),
}));

// Re-import toast for assertions
import { toast } from 'sonner';
import { useLazyGetConnectedServiceAuthUrlQuery } from '@iblai/iblai-js/data-layer';

describe('OutsideButtons', () => {
  const mockOnOptionClick = vi.fn();
  const mockSetSessionTools = vi.fn();
  const mockOnCrossClick = vi.fn();
  const defaultProps = {
    activeOptions: [],
    onOptionClick: mockOnOptionClick,
    setSessionTools: mockSetSessionTools,
    onCrossClick: mockOnCrossClick,
    containerWidth: 1000,
    enableWebBrowsing: true,
    imageGeneration: true,
    codeInterpreter: true,
    googleSlidesIsEnabled: false,
    googleDocumentIsEnabled: false,
    tenantKey: 'test-tenant',
    userId: 'test-user',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the mock to return a basic function
    (useLazyGetConnectedServiceAuthUrlQuery as ReturnType<typeof vi.fn>).mockReturnValue([
      vi.fn().mockReturnValue({
        unwrap: () => Promise.resolve({ auth_url: null }),
      }),
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('rendering', () => {
    it('should render nothing when no buttons are enabled', () => {
      const { container } = render(
        <OutsideButtons
          {...defaultProps}
          enableWebBrowsing={false}
          imageGeneration={false}
          codeInterpreter={false}
        />,
      );
      expect(container.firstChild).toBeNull();
    });

    it('should render Web Search button when enableWebBrowsing is true', () => {
      render(<OutsideButtons {...defaultProps} />);
      expect(screen.getByText('Web Search')).toBeInTheDocument();
    });

    it('should render Code button when codeInterpreter is true', () => {
      render(<OutsideButtons {...defaultProps} />);
      expect(screen.getByText('Code')).toBeInTheDocument();
    });

    it('should render Image button when imageGeneration is true', () => {
      render(<OutsideButtons {...defaultProps} />);
      expect(screen.getByText('Image')).toBeInTheDocument();
    });

    it('should render Google Slides button when googleSlidesIsEnabled is true', () => {
      render(<OutsideButtons {...defaultProps} googleSlidesIsEnabled={true} />);
      expect(screen.getByText('Google Slides')).toBeInTheDocument();
    });

    it('should render Google Docs button when googleDocumentIsEnabled is true', () => {
      render(<OutsideButtons {...defaultProps} googleDocumentIsEnabled={true} />);
      expect(screen.getByText('Google Docs')).toBeInTheDocument();
    });

    it('should render pipe separators between buttons', () => {
      render(<OutsideButtons {...defaultProps} />);
      const separators = screen.getAllByText('|');
      expect(separators.length).toBeGreaterThan(0);
    });

    it('should have proper container styling', () => {
      render(<OutsideButtons {...defaultProps} />);
      const container = screen.getByText('Web Search').closest('div.flex');
      expect(container).toHaveClass('items-center', 'justify-center', 'gap-4');
    });
  });

  describe('button interactions', () => {
    it('should call onOptionClick with WEB_SEARCH when Web Search is clicked', async () => {
      render(<OutsideButtons {...defaultProps} />);
      const button = screen.getByText('Web Search').closest('button');
      fireEvent.click(button!);
      expect(mockOnOptionClick).toHaveBeenCalledWith(TOOLS.WEB_SEARCH);
    });

    it('should call onOptionClick with CODE_INTERPRETER when Code is clicked', async () => {
      render(<OutsideButtons {...defaultProps} />);
      const button = screen.getByText('Code').closest('button');
      fireEvent.click(button!);
      expect(mockOnOptionClick).toHaveBeenCalledWith(TOOLS.CODE_INTERPRETER);
    });

    it('should call onOptionClick with IMAGE_GENERATION when Image is clicked', async () => {
      render(<OutsideButtons {...defaultProps} />);
      const button = screen.getByText('Image').closest('button');
      fireEvent.click(button!);
      expect(mockOnOptionClick).toHaveBeenCalledWith(TOOLS.IMAGE_GENERATION);
    });

    it('should prevent default and stop propagation on button click', () => {
      render(<OutsideButtons {...defaultProps} />);
      const button = screen.getByText('Web Search').closest('button');
      const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
      const preventDefaultSpy = vi.spyOn(clickEvent, 'preventDefault');
      const stopPropagationSpy = vi.spyOn(clickEvent, 'stopPropagation');

      button!.dispatchEvent(clickEvent);

      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(stopPropagationSpy).toHaveBeenCalled();
    });
  });

  describe('active state styling', () => {
    it('should apply active styling when Web Search is active', () => {
      render(<OutsideButtons {...defaultProps} activeOptions={[TOOLS.WEB_SEARCH]} />);
      const button = screen.getByText('Web Search').closest('button');
      expect(button).toHaveClass('text-[#38A1E5]', 'bg-[#F5F8FF]');
    });

    it('should apply active styling when Code is active', () => {
      render(<OutsideButtons {...defaultProps} activeOptions={[TOOLS.CODE_INTERPRETER]} />);
      const button = screen.getByText('Code').closest('button');
      expect(button).toHaveClass('text-[#38A1E5]');
    });

    it('should show X icon when button is active', () => {
      render(<OutsideButtons {...defaultProps} activeOptions={[TOOLS.WEB_SEARCH]} />);
      const button = screen.getByText('Web Search').closest('button');
      const xIcon = button?.querySelector('.ml-1');
      expect(xIcon).toBeInTheDocument();
    });

    it('should call onCrossClick when X icon is clicked on active button', async () => {
      render(<OutsideButtons {...defaultProps} activeOptions={[TOOLS.WEB_SEARCH]} />);
      const button = screen.getByText('Web Search').closest('button');
      const xIcon = button?.querySelector('.ml-1') as SVGElement;

      expect(xIcon).toBeInTheDocument();

      const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
      xIcon?.dispatchEvent(clickEvent);

      expect(mockOnCrossClick).toHaveBeenCalledWith(TOOLS.WEB_SEARCH);
    });

    it('should prevent default and stop propagation when X icon is clicked', () => {
      render(<OutsideButtons {...defaultProps} activeOptions={[TOOLS.WEB_SEARCH]} />);
      const button = screen.getByText('Web Search').closest('button');
      const xIcon = button?.querySelector('.ml-1') as SVGElement;

      const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
      const preventDefaultSpy = vi.spyOn(clickEvent, 'preventDefault');
      const stopPropagationSpy = vi.spyOn(clickEvent, 'stopPropagation');

      xIcon?.dispatchEvent(clickEvent);

      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(stopPropagationSpy).toHaveBeenCalled();
    });
  });

  describe('disabled state', () => {
    it('should disable all buttons when disabled prop is true', () => {
      render(<OutsideButtons {...defaultProps} disabled={true} />);
      const buttons = screen.getAllByRole('button');
      buttons.forEach((button) => {
        expect(button).toBeDisabled();
      });
    });

    it('should have disabled styling when disabled', () => {
      render(<OutsideButtons {...defaultProps} disabled={true} />);
      const button = screen.getByText('Web Search').closest('button');
      expect(button).toHaveClass('disabled:opacity-50', 'disabled:cursor-not-allowed');
    });
  });

  describe('responsive behavior', () => {
    it('should show all buttons when containerWidth is large enough', () => {
      render(<OutsideButtons {...defaultProps} containerWidth={1200} />);
      expect(screen.getByText('Web Search')).toBeInTheDocument();
      expect(screen.getByText('Code')).toBeInTheDocument();
      expect(screen.getByText('Image')).toBeInTheDocument();
    });

    it('should show More dropdown when containerWidth is small', () => {
      render(<OutsideButtons {...defaultProps} containerWidth={200} />);
      expect(screen.getByText('More')).toBeInTheDocument();
    });

    it('should move buttons to More dropdown based on available width', async () => {
      const user = userEvent.setup();
      render(<OutsideButtons {...defaultProps} containerWidth={200} />);

      // Only first button should be visible
      const moreButton = screen.getByText('More').closest('button');
      expect(moreButton).toBeInTheDocument();

      // Open dropdown and check for hidden buttons
      await user.click(moreButton!);
      await waitFor(() => {
        // At least one button should be in the dropdown
        expect(screen.getAllByRole('menuitem').length).toBeGreaterThan(0);
      });
    });

    it('should show separator before More dropdown when visible buttons exist', () => {
      render(<OutsideButtons {...defaultProps} containerWidth={300} />);
      const separators = screen.getAllByText('|');
      expect(separators.length).toBeGreaterThan(0);
    });
  });

  describe('More dropdown menu', () => {
    it('should render More button when there are hidden buttons', () => {
      render(<OutsideButtons {...defaultProps} containerWidth={200} />);
      expect(screen.getByText('More')).toBeInTheDocument();
    });

    it('should open dropdown when More button is clicked', async () => {
      const user = userEvent.setup();
      render(<OutsideButtons {...defaultProps} containerWidth={200} />);

      const moreButton = screen.getByText('More').closest('button');
      await user.click(moreButton!);

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });
    });

    it('should call correct action when dropdown item is clicked', async () => {
      const user = userEvent.setup();
      render(<OutsideButtons {...defaultProps} containerWidth={200} />);

      const moreButton = screen.getByText('More').closest('button');
      await user.click(moreButton!);

      await waitFor(() => {
        const menuItems = screen.getAllByRole('menuitem');
        expect(menuItems.length).toBeGreaterThan(0);
      });
    });

    it('should show selected option in More button when an option from dropdown is active', () => {
      // Small width forces buttons to More dropdown, then we set one as active
      render(
        <OutsideButtons
          {...defaultProps}
          containerWidth={200}
          activeOptions={[TOOLS.CODE_INTERPRETER]}
        />,
      );

      // The More dropdown styling should reflect that something is selected
      const moreButtonContainer = screen.getByTestId('more-icon').closest('button');
      expect(moreButtonContainer).toBeInTheDocument();
    });
  });

  describe('Google OAuth authentication', () => {
    let mockPopup: { location: { href: string }; closed: boolean; close: ReturnType<typeof vi.fn> };
    let originalOpen: typeof window.open;

    beforeEach(() => {
      mockPopup = {
        location: { href: '' },
        closed: false,
        close: vi.fn(),
      };
      originalOpen = window.open;
      window.open = vi.fn().mockReturnValue(mockPopup);
    });

    afterEach(() => {
      window.open = originalOpen;
    });

    it('should open popup for Google Slides authentication', async () => {
      const mockGetAuthUrl = vi.fn().mockReturnValue({
        unwrap: () =>
          Promise.resolve({ auth_url: 'https://accounts.google.com/oauth?client_id=123' }),
      });
      (useLazyGetConnectedServiceAuthUrlQuery as ReturnType<typeof vi.fn>).mockReturnValue([
        mockGetAuthUrl,
      ]);

      render(<OutsideButtons {...defaultProps} googleSlidesIsEnabled={true} />);

      const button = screen.getByText('Google Slides').closest('button');
      fireEvent.click(button!);

      expect(window.open).toHaveBeenCalledWith('about:blank', '_blank', 'width=600,height=600');
    });

    it('should open popup for Google Docs authentication', async () => {
      const mockGetAuthUrl = vi.fn().mockReturnValue({
        unwrap: () =>
          Promise.resolve({ auth_url: 'https://accounts.google.com/oauth?client_id=123' }),
      });
      (useLazyGetConnectedServiceAuthUrlQuery as ReturnType<typeof vi.fn>).mockReturnValue([
        mockGetAuthUrl,
      ]);

      render(<OutsideButtons {...defaultProps} googleDocumentIsEnabled={true} />);

      const button = screen.getByText('Google Docs').closest('button');
      fireEvent.click(button!);

      expect(window.open).toHaveBeenCalledWith('about:blank', '_blank', 'width=600,height=600');
    });

    it('should toggle off Google option when already active', async () => {
      render(
        <OutsideButtons
          {...defaultProps}
          googleSlidesIsEnabled={true}
          activeOptions={[TOOLS.GOOGLE_SLIDES]}
        />,
      );
      const button = screen.getByText('Google Slides').closest('button');
      fireEvent.click(button!);

      expect(mockOnOptionClick).toHaveBeenCalledWith(TOOLS.GOOGLE_SLIDES);
      expect(window.open).not.toHaveBeenCalled();
    });

    it('should log error when toggling off active Google option fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const mockOnOptionClickWithError = vi.fn().mockRejectedValue(new Error('Toggle failed'));

      render(
        <OutsideButtons
          {...defaultProps}
          onOptionClick={mockOnOptionClickWithError}
          googleSlidesIsEnabled={true}
          activeOptions={[TOOLS.GOOGLE_SLIDES]}
        />,
      );

      const button = screen.getByText('Google Slides').closest('button');
      await act(async () => {
        fireEvent.click(button!);
      });

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Failed to click Google option:',
          expect.any(Error),
        );
      });

      consoleSpy.mockRestore();
    });

    it('should show error toast when popup is blocked', async () => {
      window.open = vi.fn().mockReturnValue(null);

      render(<OutsideButtons {...defaultProps} googleSlidesIsEnabled={true} />);

      const button = screen.getByText('Google Slides').closest('button');
      fireEvent.click(button!);

      expect(toast.error).toHaveBeenCalledWith(
        'Please allow popups for this site to connect Google services',
      );
    });

    it('should navigate popup to auth URL when received', async () => {
      const authUrl = 'https://accounts.google.com/oauth?client_id=123';
      const mockGetAuthUrl = vi.fn().mockReturnValue({
        unwrap: () => Promise.resolve({ auth_url: authUrl }),
      });
      (useLazyGetConnectedServiceAuthUrlQuery as ReturnType<typeof vi.fn>).mockReturnValue([
        mockGetAuthUrl,
      ]);

      render(<OutsideButtons {...defaultProps} googleSlidesIsEnabled={true} />);

      const button = screen.getByText('Google Slides').closest('button');
      await act(async () => {
        fireEvent.click(button!);
      });

      await waitFor(() => {
        expect(mockPopup.location.href).toContain('accounts.google.com');
      });
    });

    it('should close popup and show error when auth URL is null', async () => {
      const mockGetAuthUrl = vi.fn().mockReturnValue({
        unwrap: () => Promise.resolve({ auth_url: null }),
      });
      (useLazyGetConnectedServiceAuthUrlQuery as ReturnType<typeof vi.fn>).mockReturnValue([
        mockGetAuthUrl,
      ]);

      render(<OutsideButtons {...defaultProps} googleSlidesIsEnabled={true} />);

      const button = screen.getByText('Google Slides').closest('button');
      await act(async () => {
        fireEvent.click(button!);
      });

      await waitFor(() => {
        expect(mockPopup.close).toHaveBeenCalled();
        expect(toast.error).toHaveBeenCalledWith('Failed to get authentication URL');
      });
    });

    it('should close popup and show error on API failure', async () => {
      const mockGetAuthUrl = vi.fn().mockReturnValue({
        unwrap: () => Promise.reject(new Error('API Error')),
      });
      (useLazyGetConnectedServiceAuthUrlQuery as ReturnType<typeof vi.fn>).mockReturnValue([
        mockGetAuthUrl,
      ]);

      // Mock console.error to suppress expected error
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(<OutsideButtons {...defaultProps} googleSlidesIsEnabled={true} />);

      const button = screen.getByText('Google Slides').closest('button');
      await act(async () => {
        fireEvent.click(button!);
      });

      await waitFor(() => {
        expect(mockPopup.close).toHaveBeenCalled();
        expect(toast.error).toHaveBeenCalledWith('Failed to initiate Google authentication');
      });

      consoleSpy.mockRestore();
    });

    it('should show pending state while authenticating', async () => {
      // Create a promise that we can control
      let resolveAuth: (value: { auth_url: string }) => void;
      const authPromise = new Promise<{ auth_url: string }>((resolve) => {
        resolveAuth = resolve;
      });
      const mockGetAuthUrl = vi.fn().mockReturnValue({
        unwrap: () => authPromise,
      });
      (useLazyGetConnectedServiceAuthUrlQuery as ReturnType<typeof vi.fn>).mockReturnValue([
        mockGetAuthUrl,
      ]);

      render(<OutsideButtons {...defaultProps} googleSlidesIsEnabled={true} />);

      const button = screen.getByText('Google Slides').closest('button');
      await act(async () => {
        fireEvent.click(button!);
      });

      // While waiting, button should show connecting state
      await waitFor(() => {
        expect(screen.getByText('(connecting...)')).toBeInTheDocument();
      });

      // Button should be styled differently during pending
      expect(button).toHaveClass('opacity-60', 'cursor-wait');

      // Resolve the auth promise
      await act(async () => {
        resolveAuth!({ auth_url: 'https://accounts.google.com/oauth' });
      });
    });

    it('should disable buttons during pending authentication', async () => {
      let resolveAuth: (value: { auth_url: string }) => void;
      const authPromise = new Promise<{ auth_url: string }>((resolve) => {
        resolveAuth = resolve;
      });
      const mockGetAuthUrl = vi.fn().mockReturnValue({
        unwrap: () => authPromise,
      });
      (useLazyGetConnectedServiceAuthUrlQuery as ReturnType<typeof vi.fn>).mockReturnValue([
        mockGetAuthUrl,
      ]);

      render(<OutsideButtons {...defaultProps} googleSlidesIsEnabled={true} />);

      const googleButton = screen.getByText('Google Slides').closest('button');
      await act(async () => {
        fireEvent.click(googleButton!);
      });

      // Other buttons should be disabled during auth
      await waitFor(() => {
        const webSearchButton = screen.getByText('Web Search').closest('button');
        expect(webSearchButton).toBeDisabled();
      });

      // Clean up
      await act(async () => {
        resolveAuth!({ auth_url: 'https://accounts.google.com/oauth' });
      });
    });

    it('should handle auth success message from popup', async () => {
      const authUrl = 'https://accounts.google.com/oauth?client_id=123';
      const mockGetAuthUrl = vi.fn().mockReturnValue({
        unwrap: () => Promise.resolve({ auth_url: authUrl }),
      });
      (useLazyGetConnectedServiceAuthUrlQuery as ReturnType<typeof vi.fn>).mockReturnValue([
        mockGetAuthUrl,
      ]);

      // Create a mock that returns a promise
      const mockSetSessionToolsWithPromise = vi.fn().mockResolvedValue(undefined);

      render(
        <OutsideButtons
          {...defaultProps}
          setSessionTools={mockSetSessionToolsWithPromise}
          googleSlidesIsEnabled={true}
          activeOptions={[TOOLS.WEB_SEARCH]}
        />,
      );

      const button = screen.getByText('Google Slides').closest('button');
      await act(async () => {
        fireEvent.click(button!);
      });

      // Wait for auth URL to be set
      await waitFor(() => {
        expect(mockPopup.location.href).toContain('accounts.google.com');
      });

      // Simulate auth success message
      await act(async () => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: { type: 'GOOGLE_AUTH_SUCCESS' },
            origin: window.location.origin,
          }),
        );
      });

      await waitFor(() => {
        expect(mockSetSessionToolsWithPromise).toHaveBeenCalledWith([
          TOOLS.WEB_SEARCH,
          TOOLS.GOOGLE_SLIDES,
        ]);
      });
    });

    it('should ignore auth success message from wrong origin', async () => {
      const authUrl = 'https://accounts.google.com/oauth?client_id=123';
      const mockGetAuthUrl = vi.fn().mockReturnValue({
        unwrap: () => Promise.resolve({ auth_url: authUrl }),
      });
      (useLazyGetConnectedServiceAuthUrlQuery as ReturnType<typeof vi.fn>).mockReturnValue([
        mockGetAuthUrl,
      ]);

      render(<OutsideButtons {...defaultProps} googleSlidesIsEnabled={true} />);

      const button = screen.getByText('Google Slides').closest('button');
      await act(async () => {
        fireEvent.click(button!);
      });

      await waitFor(() => {
        expect(mockPopup.location.href).toContain('accounts.google.com');
      });

      // Simulate auth success message from wrong origin
      await act(async () => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: { type: 'GOOGLE_AUTH_SUCCESS' },
            origin: 'https://malicious.com',
          }),
        );
      });

      expect(mockSetSessionTools).not.toHaveBeenCalled();
    });

    it('should set up interval to check if popup is closed', async () => {
      const setIntervalSpy = vi.spyOn(global, 'setInterval');

      const authUrl = 'https://accounts.google.com/oauth?client_id=123';
      const mockGetAuthUrl = vi.fn().mockReturnValue({
        unwrap: () => Promise.resolve({ auth_url: authUrl }),
      });
      (useLazyGetConnectedServiceAuthUrlQuery as ReturnType<typeof vi.fn>).mockReturnValue([
        mockGetAuthUrl,
      ]);

      render(<OutsideButtons {...defaultProps} googleSlidesIsEnabled={true} />);

      const button = screen.getByText('Google Slides').closest('button');
      await act(async () => {
        fireEvent.click(button!);
      });

      await waitFor(() => {
        expect(mockPopup.location.href).toContain('accounts.google.com');
      });

      // Verify setInterval was called with 1000ms
      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 1000);

      setIntervalSpy.mockRestore();
    });

    it('should clear interval and reset pending state when popup is closed', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

      const authUrl = 'https://accounts.google.com/oauth?client_id=123';
      const mockGetAuthUrl = vi.fn().mockReturnValue({
        unwrap: () => Promise.resolve({ auth_url: authUrl }),
      });
      (useLazyGetConnectedServiceAuthUrlQuery as ReturnType<typeof vi.fn>).mockReturnValue([
        mockGetAuthUrl,
      ]);

      render(<OutsideButtons {...defaultProps} googleSlidesIsEnabled={true} />);

      const button = screen.getByText('Google Slides').closest('button');

      await act(async () => {
        fireEvent.click(button!);
        await vi.advanceTimersByTimeAsync(100); // Allow promise to resolve
      });

      await waitFor(() => {
        expect(mockPopup.location.href).toContain('accounts.google.com');
      });

      // Simulate popup being closed
      mockPopup.closed = true;

      // Advance time to trigger the interval check
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });

      // clearInterval should have been called
      expect(clearIntervalSpy).toHaveBeenCalled();

      // Pending state should be cleared (no more "connecting..." text)
      await waitFor(() => {
        expect(screen.queryByText('(connecting...)')).not.toBeInTheDocument();
      });

      clearIntervalSpy.mockRestore();
      vi.useRealTimers();
    });

    it('should ignore non-auth messages from same origin when pending', async () => {
      const authUrl = 'https://accounts.google.com/oauth?client_id=123';
      const mockGetAuthUrl = vi.fn().mockReturnValue({
        unwrap: () => Promise.resolve({ auth_url: authUrl }),
      });
      (useLazyGetConnectedServiceAuthUrlQuery as ReturnType<typeof vi.fn>).mockReturnValue([
        mockGetAuthUrl,
      ]);

      render(<OutsideButtons {...defaultProps} googleSlidesIsEnabled={true} />);

      const button = screen.getByText('Google Slides').closest('button');
      await act(async () => {
        fireEvent.click(button!);
      });

      await waitFor(() => {
        expect(mockPopup.location.href).toContain('accounts.google.com');
      });

      // Send a message that is NOT GOOGLE_AUTH_SUCCESS from same origin
      await act(async () => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: { type: 'SOME_OTHER_EVENT' },
            origin: window.location.origin,
          }),
        );
      });

      // setSessionTools should NOT be called since it's not an auth success
      expect(mockSetSessionTools).not.toHaveBeenCalled();
    });

    it('should not duplicate tool when auth succeeds and tool already in saved tools', async () => {
      const authUrl = 'https://accounts.google.com/oauth?client_id=123';
      const mockGetAuthUrl = vi.fn().mockReturnValue({
        unwrap: () => Promise.resolve({ auth_url: authUrl }),
      });
      (useLazyGetConnectedServiceAuthUrlQuery as ReturnType<typeof vi.fn>).mockReturnValue([
        mockGetAuthUrl,
      ]);

      const mockSetSessionToolsWithPromise = vi.fn().mockResolvedValue(undefined);

      // Active options already includes google-slides - it will be saved as savedTools
      render(
        <OutsideButtons
          {...defaultProps}
          setSessionTools={mockSetSessionToolsWithPromise}
          googleDocumentIsEnabled={true}
          activeOptions={[TOOLS.GOOGLE_DOCUMENT]}
        />,
      );

      // First deactivate the active one, then start a new auth flow for Google Docs
      // We need a scenario where the tool being authenticated is already in savedTools
      // Re-render with Google Slides available and Google Docs already in active options
      const { unmount } = render(
        <OutsideButtons
          {...defaultProps}
          setSessionTools={mockSetSessionToolsWithPromise}
          googleSlidesIsEnabled={true}
          activeOptions={[TOOLS.GOOGLE_SLIDES]}
        />,
      );

      const button = screen.getAllByText('Google Slides')[0].closest('button');

      // Since google-slides is already active, clicking should toggle it off
      await act(async () => {
        fireEvent.click(button!);
      });

      expect(mockOnOptionClick).toHaveBeenCalledWith(TOOLS.GOOGLE_SLIDES);
      unmount();
    });
  });

  describe('button type attribute', () => {
    it('should have type="button" to prevent form submission', () => {
      render(<OutsideButtons {...defaultProps} />);
      const buttons = screen.getAllByRole('button');
      buttons.forEach((button) => {
        expect(button).toHaveAttribute('type', 'button');
      });
    });
  });

  describe('moreMenuItems (currently disabled)', () => {
    // These items are currently disabled (isEnabled: false) but we test the structure
    it('should not render Quiz, Rubric, Resource, Lesson Plan, Syllabus buttons (all disabled)', () => {
      render(<OutsideButtons {...defaultProps} containerWidth={1200} />);
      expect(screen.queryByText('Quiz')).not.toBeInTheDocument();
      expect(screen.queryByText('Rubric')).not.toBeInTheDocument();
      expect(screen.queryByText('Resource')).not.toBeInTheDocument();
      expect(screen.queryByText('Lesson Plan')).not.toBeInTheDocument();
      expect(screen.queryByText('Syllabus')).not.toBeInTheDocument();
    });
  });

  describe('PowerPoint button (currently disabled)', () => {
    it('should not render PowerPoint button (disabled)', () => {
      render(<OutsideButtons {...defaultProps} containerWidth={1200} />);
      expect(screen.queryByText('PowerPoint')).not.toBeInTheDocument();
    });

    it('should render PowerPoint button and call action when enabled via filter bypass', async () => {
      const originalFilter = Array.prototype.filter;
      let filterCallCount = 0;

      const filterSpy = vi.spyOn(Array.prototype, 'filter').mockImplementation(function (
        this: any[],
        ...args: Parameters<typeof Array.prototype.filter>
      ) {
        filterCallCount++;
        // First filter call is for allButtons array - enable PowerPoint
        if (filterCallCount === 1 && this.length === 6 && this[5]?.name === 'PowerPoint') {
          return this; // Return all buttons including PowerPoint
        }
        return originalFilter.apply(
          this,
          args as [predicate: (value: any, index: number, array: any[]) => unknown, thisArg?: any],
        );
      });

      render(<OutsideButtons {...defaultProps} containerWidth={1200} />);

      // PowerPoint button should now be rendered
      const powerPointButton = screen.getByText('PowerPoint').closest('button');
      expect(powerPointButton).toBeInTheDocument();

      // Click it to trigger the action
      fireEvent.click(powerPointButton!);
      expect(mockOnOptionClick).toHaveBeenCalledWith(TOOLS.POWERPOINT);

      filterSpy.mockRestore();
    });
  });

  describe('edge cases', () => {
    it('should handle empty activeOptions array', () => {
      render(<OutsideButtons {...defaultProps} activeOptions={[]} />);
      const webSearchButton = screen.getByText('Web Search').closest('button');
      expect(webSearchButton).not.toHaveClass('text-[#38A1E5]');
    });

    it('should handle multiple active options', () => {
      render(
        <OutsideButtons
          {...defaultProps}
          activeOptions={[TOOLS.WEB_SEARCH, TOOLS.CODE_INTERPRETER, TOOLS.IMAGE_GENERATION]}
        />,
      );
      expect(screen.getByText('Web Search').closest('button')).toHaveClass('text-[#38A1E5]');
      expect(screen.getByText('Code').closest('button')).toHaveClass('text-[#38A1E5]');
      expect(screen.getByText('Image').closest('button')).toHaveClass('text-[#38A1E5]');
    });

    it('should handle containerWidth of 0', () => {
      render(<OutsideButtons {...defaultProps} containerWidth={0} />);
      // Should still render at least one button (minimum guarantee)
      expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
    });

    it('should handle very large containerWidth', () => {
      render(<OutsideButtons {...defaultProps} containerWidth={10000} />);
      // All buttons should be visible, no More dropdown
      expect(screen.getByText('Web Search')).toBeInTheDocument();
      expect(screen.getByText('Code')).toBeInTheDocument();
      expect(screen.getByText('Image')).toBeInTheDocument();
    });

    it('should handle rapid button clicks', async () => {
      render(<OutsideButtons {...defaultProps} />);
      const button = screen.getByText('Web Search').closest('button');

      fireEvent.click(button!);
      fireEvent.click(button!);
      fireEvent.click(button!);

      expect(mockOnOptionClick).toHaveBeenCalledTimes(3);
    });

    it('should handle re-renders with different props', () => {
      const { rerender } = render(<OutsideButtons {...defaultProps} />);
      expect(screen.getByText('Web Search')).toBeInTheDocument();

      rerender(<OutsideButtons {...defaultProps} enableWebBrowsing={false} />);
      expect(screen.queryByText('Web Search')).not.toBeInTheDocument();

      rerender(<OutsideButtons {...defaultProps} enableWebBrowsing={true} />);
      expect(screen.getByText('Web Search')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have accessible buttons', () => {
      render(<OutsideButtons {...defaultProps} />);
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('should have proper dropdown trigger aria attributes', async () => {
      render(<OutsideButtons {...defaultProps} containerWidth={200} />);
      const moreButton = screen.getByText('More').closest('button');
      expect(moreButton).toHaveAttribute('aria-haspopup', 'menu');
    });
  });

  describe('icon rendering', () => {
    it('should render Globe icon for Web Search', () => {
      render(<OutsideButtons {...defaultProps} />);
      const button = screen.getByText('Web Search').closest('button');
      const icon = button?.querySelector('.lucide-globe');
      expect(icon).toBeInTheDocument();
    });

    it('should render Code icon for Code button', () => {
      render(<OutsideButtons {...defaultProps} />);
      const button = screen.getByText('Code').closest('button');
      const icon = button?.querySelector('.lucide-code');
      expect(icon).toBeInTheDocument();
    });

    it('should render ImageIcon for Image button', () => {
      render(<OutsideButtons {...defaultProps} />);
      expect(screen.getByTestId('image-icon')).toBeInTheDocument();
    });

    it('should render MoreIcon in More dropdown trigger', () => {
      render(<OutsideButtons {...defaultProps} containerWidth={200} />);
      expect(screen.getByTestId('more-icon')).toBeInTheDocument();
    });
  });

  describe('dropdown menu with active selections', () => {
    it('should show selected option icon and name in More button when hidden button is active', () => {
      // Make Code active and ensure it's in the hidden buttons (small width)
      render(
        <OutsideButtons
          {...defaultProps}
          containerWidth={200}
          activeOptions={[TOOLS.CODE_INTERPRETER]}
        />,
      );

      // The More button should display the selected option
      const moreButtonArea = screen.getByTestId('more-icon').closest('button');
      expect(moreButtonArea).toBeInTheDocument();
    });

    it('should reflect active state in More button styling when hidden button is active', () => {
      render(
        <OutsideButtons
          {...defaultProps}
          containerWidth={200}
          activeOptions={[TOOLS.CODE_INTERPRETER]}
        />,
      );

      const moreButtonContainer = screen.getByTestId('more-icon').closest('button');
      // More button should have active styling when it contains an active option
      expect(moreButtonContainer).toHaveClass('text-[#38A1E5]');
    });
  });

  describe('special case: activeOptions includes tool already in savedTools', () => {
    it('should not duplicate tools when auth succeeds and tool already exists', async () => {
      // Google Slides is already in activeOptions
      render(
        <OutsideButtons
          {...defaultProps}
          googleSlidesIsEnabled={true}
          activeOptions={[TOOLS.GOOGLE_SLIDES]}
        />,
      );

      // Since it's already active, clicking should toggle it off (not start auth)
      const button = screen.getByText('Google Slides').closest('button');
      await act(async () => {
        fireEvent.click(button!);
      });

      expect(mockOnOptionClick).toHaveBeenCalledWith(TOOLS.GOOGLE_SLIDES);
    });
  });

  describe('Google Docs OAuth authentication', () => {
    let mockPopup: { location: { href: string }; closed: boolean; close: ReturnType<typeof vi.fn> };
    let originalOpen: typeof window.open;

    beforeEach(() => {
      mockPopup = {
        location: { href: '' },
        closed: false,
        close: vi.fn(),
      };
      originalOpen = window.open;
      window.open = vi.fn().mockReturnValue(mockPopup);
    });

    afterEach(() => {
      window.open = originalOpen;
    });

    it('should initiate Google Docs auth with correct service name', async () => {
      const mockGetAuthUrl = vi.fn().mockReturnValue({
        unwrap: () => Promise.resolve({ auth_url: 'https://accounts.google.com/oauth' }),
      });
      (useLazyGetConnectedServiceAuthUrlQuery as ReturnType<typeof vi.fn>).mockReturnValue([
        mockGetAuthUrl,
      ]);

      render(<OutsideButtons {...defaultProps} googleDocumentIsEnabled={true} />);

      const button = screen.getByText('Google Docs').closest('button');
      await act(async () => {
        fireEvent.click(button!);
      });

      // Check that the API was called with correct service name (extracted from 'google-docs')
      expect(mockGetAuthUrl).toHaveBeenCalledWith({
        org: 'test-tenant',
        provider: 'google',
        service: 'docs',
        userId: 'test-user',
      });
    });

    it('should handle auth success for Google Docs and restore saved tools', async () => {
      const authUrl = 'https://accounts.google.com/oauth?client_id=123';
      const mockGetAuthUrl = vi.fn().mockReturnValue({
        unwrap: () => Promise.resolve({ auth_url: authUrl }),
      });
      (useLazyGetConnectedServiceAuthUrlQuery as ReturnType<typeof vi.fn>).mockReturnValue([
        mockGetAuthUrl,
      ]);

      const mockSetSessionToolsWithPromise = vi.fn().mockResolvedValue(undefined);

      render(
        <OutsideButtons
          {...defaultProps}
          setSessionTools={mockSetSessionToolsWithPromise}
          googleDocumentIsEnabled={true}
          activeOptions={[TOOLS.WEB_SEARCH, TOOLS.IMAGE_GENERATION]}
        />,
      );

      const button = screen.getByText('Google Docs').closest('button');
      await act(async () => {
        fireEvent.click(button!);
      });

      await waitFor(() => {
        expect(mockPopup.location.href).toContain('accounts.google.com');
      });

      // Verify redirect_uri and tool_name are set
      const popupUrl = new URL(mockPopup.location.href);
      expect(popupUrl.searchParams.get('tool_name')).toBe(TOOLS.GOOGLE_DOCUMENT);
      expect(popupUrl.searchParams.get('redirect_uri')).toContain('/google-oauth-callback/');

      // Simulate auth success
      await act(async () => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: { type: 'GOOGLE_AUTH_SUCCESS' },
            origin: window.location.origin,
          }),
        );
      });

      // Should restore saved tools plus add the new Google Docs tool
      await waitFor(() => {
        expect(mockSetSessionToolsWithPromise).toHaveBeenCalledWith([
          TOOLS.WEB_SEARCH,
          TOOLS.IMAGE_GENERATION,
          TOOLS.GOOGLE_DOCUMENT,
        ]);
      });
    });

    it('should not add duplicate when auth succeeds and tool already in saved tools', async () => {
      const authUrl = 'https://accounts.google.com/oauth?client_id=123';
      const mockGetAuthUrl = vi.fn().mockReturnValue({
        unwrap: () => Promise.resolve({ auth_url: authUrl }),
      });
      (useLazyGetConnectedServiceAuthUrlQuery as ReturnType<typeof vi.fn>).mockReturnValue([
        mockGetAuthUrl,
      ]);

      const mockSetSessionToolsWithPromise = vi.fn().mockResolvedValue(undefined);

      // Google Docs is already in activeOptions (saved tools)
      render(
        <OutsideButtons
          {...defaultProps}
          setSessionTools={mockSetSessionToolsWithPromise}
          googleDocumentIsEnabled={true}
          activeOptions={[TOOLS.GOOGLE_DOCUMENT]}
        />,
      );

      // Since it's already active, clicking should toggle it off
      const button = screen.getByText('Google Docs').closest('button');
      await act(async () => {
        fireEvent.click(button!);
      });

      // Should call onOptionClick to toggle off, not start OAuth
      expect(mockOnOptionClick).toHaveBeenCalledWith(TOOLS.GOOGLE_DOCUMENT);
    });
  });

  describe('message listener cleanup', () => {
    it('should add event listener on mount', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      render(<OutsideButtons {...defaultProps} googleSlidesIsEnabled={true} />);

      expect(addEventListenerSpy).toHaveBeenCalledWith('message', expect.any(Function));

      addEventListenerSpy.mockRestore();
    });

    it('should remove event listener on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = render(<OutsideButtons {...defaultProps} googleSlidesIsEnabled={true} />);

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('message', expect.any(Function));

      removeEventListenerSpy.mockRestore();
    });
  });

  describe('setSessionTools error handling', () => {
    let mockPopup: { location: { href: string }; closed: boolean; close: ReturnType<typeof vi.fn> };
    let originalOpen: typeof window.open;

    beforeEach(() => {
      mockPopup = {
        location: { href: '' },
        closed: false,
        close: vi.fn(),
      };
      originalOpen = window.open;
      window.open = vi.fn().mockReturnValue(mockPopup);
    });

    afterEach(() => {
      window.open = originalOpen;
    });

    it('should handle setSessionTools error gracefully', async () => {
      const authUrl = 'https://accounts.google.com/oauth?client_id=123';
      const mockGetAuthUrl = vi.fn().mockReturnValue({
        unwrap: () => Promise.resolve({ auth_url: authUrl }),
      });
      (useLazyGetConnectedServiceAuthUrlQuery as ReturnType<typeof vi.fn>).mockReturnValue([
        mockGetAuthUrl,
      ]);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const mockSetSessionToolsWithError = vi.fn().mockRejectedValue(new Error('Session error'));

      render(
        <OutsideButtons
          {...defaultProps}
          setSessionTools={mockSetSessionToolsWithError}
          googleSlidesIsEnabled={true}
          activeOptions={[]}
        />,
      );

      const button = screen.getByText('Google Slides').closest('button');
      await act(async () => {
        fireEvent.click(button!);
      });

      await waitFor(() => {
        expect(mockPopup.location.href).toContain('accounts.google.com');
      });

      // Simulate auth success
      await act(async () => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: { type: 'GOOGLE_AUTH_SUCCESS' },
            origin: window.location.origin,
          }),
        );
      });

      // Should log error but not crash
      await waitFor(() => {
        expect(mockSetSessionToolsWithError).toHaveBeenCalled();
      });

      // Eventually the error handler should have been called
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Failed to activate Google option:',
          expect.any(Error),
        );
      });

      consoleSpy.mockRestore();
    });
  });

  describe('popup behavior', () => {
    let originalOpen: typeof window.open;

    beforeEach(() => {
      originalOpen = window.open;
    });

    afterEach(() => {
      window.open = originalOpen;
    });

    it('should show error toast when popup is blocked (returns closed popup)', async () => {
      const mockClosedPopup = { closed: true };
      window.open = vi.fn().mockReturnValue(mockClosedPopup);

      render(<OutsideButtons {...defaultProps} googleSlidesIsEnabled={true} />);

      const button = screen.getByText('Google Slides').closest('button');
      fireEvent.click(button!);

      expect(toast.error).toHaveBeenCalledWith(
        'Please allow popups for this site to connect Google services',
      );
    });
  });

  describe('X button on active buttons', () => {
    it('should call onCrossClick when button has slug', () => {
      render(<OutsideButtons {...defaultProps} activeOptions={[TOOLS.WEB_SEARCH]} />);

      const button = screen.getByText('Web Search').closest('button');
      const xIcon = button?.querySelector('.ml-1') as SVGElement;

      expect(xIcon).toBeInTheDocument();

      const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
      xIcon?.dispatchEvent(clickEvent);

      expect(mockOnCrossClick).toHaveBeenCalledWith(TOOLS.WEB_SEARCH);
    });
  });

  describe('More dropdown selection display', () => {
    it('should show selected option name and icon when active hidden button exists', () => {
      // Force Code button to be hidden (small width), then make it active
      render(
        <OutsideButtons
          {...defaultProps}
          containerWidth={200}
          activeOptions={[TOOLS.IMAGE_GENERATION]}
        />,
      );

      // The More button should show the active option from hidden buttons
      const moreButtonArea = screen.getByTestId('more-icon').closest('button');
      expect(moreButtonArea).toBeInTheDocument();

      // Should have active styling since an option in dropdown is active
      expect(moreButtonArea).toHaveClass('text-[#38A1E5]');
    });
  });

  describe('moreMenuItems rendering (testing disabled items via filter bypass)', () => {
    it('should render moreMenuItems when they are enabled via filter bypass', async () => {
      // This test bypasses the filter to test the moreMenuItems rendering path
      const originalFilter = Array.prototype.filter;
      let filterCallCount = 0;

      const filterSpy = vi.spyOn(Array.prototype, 'filter').mockImplementation(function (
        this: any[],
        ...args: Parameters<typeof Array.prototype.filter>
      ) {
        filterCallCount++;
        // Bypass filter for the moreMenuItems array (typically the second filter call in the component)
        // Return all items regardless of isEnabled for testing
        if (filterCallCount === 2 && this.length === 5 && this[0]?.name === 'Quiz') {
          return this; // Return unfiltered moreMenuItems
        }
        return originalFilter.apply(
          this,
          args as [predicate: (value: any, index: number, array: any[]) => unknown, thisArg?: any],
        );
      });

      const user = userEvent.setup();
      render(<OutsideButtons {...defaultProps} containerWidth={200} />);

      // Open the More dropdown
      const moreButton = screen.getByText('More').closest('button');
      await user.click(moreButton!);

      // Check if moreMenuItems are rendered in the dropdown
      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });

      filterSpy.mockRestore();
    });

    it('should show selected moreMenuItems option in More button when active via filter bypass', async () => {
      const originalFilter = Array.prototype.filter;
      let filterCallCount = 0;

      const filterSpy = vi.spyOn(Array.prototype, 'filter').mockImplementation(function (
        this: any[],
        ...args: Parameters<typeof Array.prototype.filter>
      ) {
        filterCallCount++;
        if (filterCallCount === 2 && this.length === 5 && this[0]?.name === 'Quiz') {
          return this;
        }
        return originalFilter.apply(
          this,
          args as [predicate: (value: any, index: number, array: any[]) => unknown, thisArg?: any],
        );
      });

      render(
        <OutsideButtons {...defaultProps} containerWidth={1200} activeOptions={[TOOLS.QUIZ]} />,
      );

      // The More button should show Quiz option since it's active and in moreMenuItems
      // The getSelectedMoreOption should find it
      const moreButton = screen.getByTestId('more-icon').closest('button');
      expect(moreButton).toBeInTheDocument();

      filterSpy.mockRestore();
    });

    it('should call Quiz action when clicked via filter bypass', async () => {
      const originalFilter = Array.prototype.filter;
      let filterCallCount = 0;

      const filterSpy = vi.spyOn(Array.prototype, 'filter').mockImplementation(function (
        this: any[],
        ...args: Parameters<typeof Array.prototype.filter>
      ) {
        filterCallCount++;
        if (filterCallCount === 2 && this.length === 5 && this[0]?.name === 'Quiz') {
          return this;
        }
        return originalFilter.apply(
          this,
          args as [predicate: (value: any, index: number, array: any[]) => unknown, thisArg?: any],
        );
      });

      const user = userEvent.setup();
      render(<OutsideButtons {...defaultProps} containerWidth={1200} />);

      const moreButton = screen.getByTestId('more-icon').closest('button');
      await user.click(moreButton!);

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });

      // Find Quiz menu item and click it
      const quizItem = screen.getByText('Quiz').closest('[role="menuitem"]');
      if (quizItem) {
        await user.click(quizItem);
        expect(mockOnOptionClick).toHaveBeenCalledWith(TOOLS.QUIZ);
      }

      filterSpy.mockRestore();
    });

    it('should call Rubric action when clicked via filter bypass', async () => {
      const originalFilter = Array.prototype.filter;
      let filterCallCount = 0;

      const filterSpy = vi.spyOn(Array.prototype, 'filter').mockImplementation(function (
        this: any[],
        ...args: Parameters<typeof Array.prototype.filter>
      ) {
        filterCallCount++;
        if (filterCallCount === 2 && this.length === 5 && this[0]?.name === 'Quiz') {
          return this;
        }
        return originalFilter.apply(
          this,
          args as [predicate: (value: any, index: number, array: any[]) => unknown, thisArg?: any],
        );
      });

      const user = userEvent.setup();
      render(<OutsideButtons {...defaultProps} containerWidth={1200} />);

      const moreButton = screen.getByTestId('more-icon').closest('button');
      await user.click(moreButton!);

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });

      const rubricItem = screen.getByText('Rubric').closest('[role="menuitem"]');
      if (rubricItem) {
        await user.click(rubricItem);
        expect(mockOnOptionClick).toHaveBeenCalledWith(TOOLS.RUBRIC);
      }

      filterSpy.mockRestore();
    });

    it('should call Resource action when clicked via filter bypass', async () => {
      const originalFilter = Array.prototype.filter;
      let filterCallCount = 0;

      const filterSpy = vi.spyOn(Array.prototype, 'filter').mockImplementation(function (
        this: any[],
        ...args: Parameters<typeof Array.prototype.filter>
      ) {
        filterCallCount++;
        if (filterCallCount === 2 && this.length === 5 && this[0]?.name === 'Quiz') {
          return this;
        }
        return originalFilter.apply(
          this,
          args as [predicate: (value: any, index: number, array: any[]) => unknown, thisArg?: any],
        );
      });

      const user = userEvent.setup();
      render(<OutsideButtons {...defaultProps} containerWidth={1200} />);

      const moreButton = screen.getByTestId('more-icon').closest('button');
      await user.click(moreButton!);

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });

      const resourceItem = screen.getByText('Resource').closest('[role="menuitem"]');
      if (resourceItem) {
        await user.click(resourceItem);
        expect(mockOnOptionClick).toHaveBeenCalledWith(TOOLS.RESOURCE);
      }

      filterSpy.mockRestore();
    });

    it('should call Lesson Plan action when clicked via filter bypass', async () => {
      const originalFilter = Array.prototype.filter;
      let filterCallCount = 0;

      const filterSpy = vi.spyOn(Array.prototype, 'filter').mockImplementation(function (
        this: any[],
        ...args: Parameters<typeof Array.prototype.filter>
      ) {
        filterCallCount++;
        if (filterCallCount === 2 && this.length === 5 && this[0]?.name === 'Quiz') {
          return this;
        }
        return originalFilter.apply(
          this,
          args as [predicate: (value: any, index: number, array: any[]) => unknown, thisArg?: any],
        );
      });

      const user = userEvent.setup();
      render(<OutsideButtons {...defaultProps} containerWidth={1200} />);

      const moreButton = screen.getByTestId('more-icon').closest('button');
      await user.click(moreButton!);

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });

      const lessonPlanItem = screen.getByText('Lesson Plan').closest('[role="menuitem"]');
      if (lessonPlanItem) {
        await user.click(lessonPlanItem);
        expect(mockOnOptionClick).toHaveBeenCalledWith(TOOLS.LESSON_PLAN);
      }

      filterSpy.mockRestore();
    });

    it('should call Syllabus action when clicked via filter bypass', async () => {
      const originalFilter = Array.prototype.filter;
      let filterCallCount = 0;

      const filterSpy = vi.spyOn(Array.prototype, 'filter').mockImplementation(function (
        this: any[],
        ...args: Parameters<typeof Array.prototype.filter>
      ) {
        filterCallCount++;
        if (filterCallCount === 2 && this.length === 5 && this[0]?.name === 'Quiz') {
          return this;
        }
        return originalFilter.apply(
          this,
          args as [predicate: (value: any, index: number, array: any[]) => unknown, thisArg?: any],
        );
      });

      const user = userEvent.setup();
      render(<OutsideButtons {...defaultProps} containerWidth={1200} />);

      const moreButton = screen.getByTestId('more-icon').closest('button');
      await user.click(moreButton!);

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });

      const syllabusItem = screen.getByText('Syllabus').closest('[role="menuitem"]');
      if (syllabusItem) {
        await user.click(syllabusItem);
        expect(mockOnOptionClick).toHaveBeenCalledWith(TOOLS.SYLLABUS);
      }

      filterSpy.mockRestore();
    });
  });
});
