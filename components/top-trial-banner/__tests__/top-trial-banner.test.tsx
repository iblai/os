import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TopTrialBanner } from '../top-trial-banner';

// ============================================================================
// MOCKS
// ============================================================================

const mockSetVisible = vi.fn();
const mockSetShowTooltip = vi.fn();
const mockBannerButtonTriggerHandler = vi.fn();
const mockUseTopTrialBanner = vi.fn();

vi.mock('@/hooks/use-top-trial-banner', () => ({
  useTopTrialBanner: (...args: unknown[]) => mockUseTopTrialBanner(...args),
}));

function defaultHookReturn(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    visible: true,
    setVisible: mockSetVisible,
    bannerButtonTriggerHandler: mockBannerButtonTriggerHandler,
    showTooltip: false,
    setShowTooltip: mockSetShowTooltip,
    bannerRef: React.createRef<HTMLDivElement>(),
    isLoading: false,
    ...overrides,
  };
}

const baseProps = {
  parentContainer: '#parent',
  bannerText: 'Custom banner text',
  onUpgrade: 'PRICING_MODAL',
  loading: false,
  tooltipText: 'Custom tooltip',
};

describe('TopTrialBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseTopTrialBanner.mockReturnValue(defaultHookReturn());
  });

  it('returns null when not visible', () => {
    mockUseTopTrialBanner.mockReturnValue(
      defaultHookReturn({ visible: false }),
    );
    const { container } = render(<TopTrialBanner {...baseProps} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the provided banner text', () => {
    render(<TopTrialBanner {...baseProps} />);
    expect(screen.getByText('Custom banner text')).toBeInTheDocument();
  });

  it('falls back to the default banner text when none is provided', () => {
    render(<TopTrialBanner {...baseProps} bannerText={undefined} />);
    expect(
      screen.getByText(/Upgrade to create your own agents/),
    ).toBeInTheDocument();
  });

  it('renders the upgrade button label and close button', () => {
    render(<TopTrialBanner {...baseProps} />);
    expect(screen.getByText('Upgrade')).toBeInTheDocument();
    expect(screen.getByLabelText('Close banner')).toBeInTheDocument();
    expect(screen.getByLabelText('Upgrade')).toBeInTheDocument();
  });

  it('shows the tooltip text when showTooltip is true', () => {
    mockUseTopTrialBanner.mockReturnValue(
      defaultHookReturn({ showTooltip: true }),
    );
    render(<TopTrialBanner {...baseProps} />);
    expect(screen.getByText('Custom tooltip')).toBeInTheDocument();
  });

  it('falls back to default tooltip text when tooltipText is missing', () => {
    mockUseTopTrialBanner.mockReturnValue(
      defaultHookReturn({ showTooltip: true }),
    );
    render(<TopTrialBanner {...baseProps} tooltipText={undefined} />);
    // The default banner text is reused for the tooltip.
    expect(
      screen.getByText(/Upgrade to create your own agents/),
    ).toBeInTheDocument();
  });

  it('toggles tooltip visibility on mouse enter/leave of the info icon', () => {
    const { container } = render(<TopTrialBanner {...baseProps} />);
    const infoWrapper = container.querySelector(
      'div[class*="flex-shrink-0"]',
    ) as HTMLElement;

    fireEvent.mouseEnter(infoWrapper);
    expect(mockSetShowTooltip).toHaveBeenCalledWith(true);

    fireEvent.mouseLeave(infoWrapper);
    expect(mockSetShowTooltip).toHaveBeenCalledWith(false);
  });

  it('triggers the upgrade handler when the desktop upgrade button is clicked', () => {
    render(<TopTrialBanner {...baseProps} />);
    fireEvent.click(screen.getByText('Upgrade'));
    expect(mockBannerButtonTriggerHandler).toHaveBeenCalled();
  });

  it('triggers the upgrade handler when the mobile (icon) upgrade button is clicked', () => {
    render(<TopTrialBanner {...baseProps} />);
    fireEvent.click(screen.getByLabelText('Upgrade'));
    expect(mockBannerButtonTriggerHandler).toHaveBeenCalled();
  });

  it('does not trigger the upgrade handler when isLoading is true', () => {
    mockUseTopTrialBanner.mockReturnValue(
      defaultHookReturn({ isLoading: true }),
    );
    render(<TopTrialBanner {...baseProps} />);

    const desktopButton = screen.getByText('Upgrade');
    fireEvent.click(desktopButton);
    expect(mockBannerButtonTriggerHandler).not.toHaveBeenCalled();
    expect(desktopButton.closest('button')).toBeDisabled();
  });

  it('renders spinners instead of labels when loading prop is true', () => {
    const { container } = render(
      <TopTrialBanner {...baseProps} loading={true} />,
    );
    // When loading, the "Upgrade" text label is replaced by a spinner SVG.
    expect(screen.queryByText('Upgrade')).not.toBeInTheDocument();
    expect(
      container.querySelectorAll('svg.animate-spin').length,
    ).toBeGreaterThanOrEqual(1);
  });

  it('hides the banner when the close button is clicked', () => {
    render(<TopTrialBanner {...baseProps} />);
    fireEvent.click(screen.getByLabelText('Close banner'));
    expect(mockSetVisible).toHaveBeenCalledWith(false);
  });

  it('passes resolved tooltip text and props to the hook', () => {
    render(<TopTrialBanner {...baseProps} />);
    expect(mockUseTopTrialBanner).toHaveBeenCalledWith(
      expect.objectContaining({
        parentContainer: '#parent',
        onUpgrade: 'PRICING_MODAL',
        loading: false,
        tooltipText: 'Custom tooltip',
      }),
    );
  });

  it('passes the default banner text as the hook tooltipText fallback', () => {
    render(<TopTrialBanner {...baseProps} tooltipText={undefined} />);
    expect(mockUseTopTrialBanner).toHaveBeenCalledWith(
      expect.objectContaining({
        tooltipText: expect.stringContaining(
          'Upgrade to create your own agents',
        ),
      }),
    );
  });
});
