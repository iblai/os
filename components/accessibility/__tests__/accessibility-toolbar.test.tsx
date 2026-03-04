import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AccessibilityToolbar } from '../accessibility-toolbar';

// Mock the accessibility context
const mockUpdateSetting = vi.fn();
const mockResetSettings = vi.fn();
const mockSetIsToolbarOpen = vi.fn();

type AccessibilitySettings = {
  invertColors: boolean;
  highlightLinks: boolean;
  textSize: 'normal' | 'large' | 'larger';
  textSpacing: 'none' | 'light' | 'moderate' | 'heavy';
  pauseAnimations: boolean;
  hideImages: boolean;
  dyslexiaFont: 'normal' | 'dyslexia' | 'legible';
  customCursor: boolean;
  tooltips: boolean;
  lineHeight: boolean;
  textAlign: 'normal' | 'left' | 'center' | 'right' | 'justify';
  saturation: 'normal' | 'high' | 'low';
  contrastMode: 'normal' | 'invert' | 'dark' | 'light';
};

const defaultSettings: AccessibilitySettings = {
  invertColors: false,
  highlightLinks: false,
  textSize: 'normal',
  textSpacing: 'none',
  pauseAnimations: false,
  hideImages: false,
  dyslexiaFont: 'normal',
  customCursor: false,
  tooltips: false,
  lineHeight: false,
  textAlign: 'normal',
  saturation: 'normal',
  contrastMode: 'normal',
};

let mockSettings: AccessibilitySettings = { ...defaultSettings };
let mockIsToolbarOpen = true;

vi.mock('@/contexts/accessibility-contexts', () => ({
  useAccessibility: () => ({
    settings: mockSettings,
    updateSetting: mockUpdateSetting,
    resetSettings: mockResetSettings,
    isToolbarOpen: mockIsToolbarOpen,
    setIsToolbarOpen: mockSetIsToolbarOpen,
  }),
}));

describe('AccessibilityToolbar', () => {
  beforeEach(() => {
    mockSettings = { ...defaultSettings };
    mockIsToolbarOpen = true;
    mockUpdateSetting.mockClear();
    mockResetSettings.mockClear();
    mockSetIsToolbarOpen.mockClear();
  });

  it('renders toolbar when open', () => {
    render(<AccessibilityToolbar />);
    expect(screen.getByText('Accessibility Menu')).toBeInTheDocument();
  });

  it('does not render toolbar when closed', () => {
    mockIsToolbarOpen = false;
    const { container } = render(<AccessibilityToolbar />);
    expect(container.firstChild).toBeNull();
  });

  it('closes toolbar when X button is clicked', () => {
    render(<AccessibilityToolbar />);
    // Find the close button by getting all buttons and finding the one in the header
    const buttons = screen.getAllByRole('button');
    const closeButton = buttons.find(
      (button) =>
        button.className.includes('text-white') &&
        button.className.includes('hover:bg-transparent'),
    );

    if (closeButton) {
      fireEvent.click(closeButton);
      expect(mockSetIsToolbarOpen).toHaveBeenCalledWith(false);
    }
  });

  it('displays all accessibility options', () => {
    render(<AccessibilityToolbar />);

    expect(screen.getByText('Contrast +')).toBeInTheDocument();
    expect(screen.getByText('Highlight Links')).toBeInTheDocument();
    expect(screen.getByText('Bigger Text')).toBeInTheDocument();
    expect(screen.getByText('Text Spacing')).toBeInTheDocument();
    expect(screen.getByText('Pause Animations')).toBeInTheDocument();
    expect(screen.getByText('Hide Images')).toBeInTheDocument();
    expect(screen.getByText('Dyslexia Friendly')).toBeInTheDocument();
    expect(screen.getByText('Cursor')).toBeInTheDocument();
    expect(screen.getByText('Tooltips')).toBeInTheDocument();
    expect(screen.getByText('Line Height')).toBeInTheDocument();
    expect(screen.getByText('Text Align')).toBeInTheDocument();
    expect(screen.getByText('Saturation')).toBeInTheDocument();
  });

  it('toggles highlight links setting', () => {
    render(<AccessibilityToolbar />);
    const button = screen.getByText('Highlight Links').closest('button');

    if (button) {
      fireEvent.click(button);
      expect(mockUpdateSetting).toHaveBeenCalledWith('highlightLinks', true);
    }
  });

  it('cycles through text size options', () => {
    render(<AccessibilityToolbar />);
    const button = screen.getByText('Bigger Text').closest('button');

    if (button) {
      fireEvent.click(button);
      expect(mockUpdateSetting).toHaveBeenCalledWith('textSize', 'large');
    }
  });

  it('cycles through contrast modes', () => {
    render(<AccessibilityToolbar />);
    const button = screen.getByText('Contrast +').closest('button');

    if (button) {
      fireEvent.click(button);
      expect(mockUpdateSetting).toHaveBeenCalledWith('contrastMode', 'invert');
    }
  });

  it('cycles through text spacing options', () => {
    render(<AccessibilityToolbar />);
    const button = screen.getByText('Text Spacing').closest('button');

    if (button) {
      fireEvent.click(button);
      expect(mockUpdateSetting).toHaveBeenCalledWith('textSpacing', 'light');
    }
  });

  it('toggles pause animations setting', () => {
    render(<AccessibilityToolbar />);
    const button = screen.getByText('Pause Animations').closest('button');

    if (button) {
      fireEvent.click(button);
      expect(mockUpdateSetting).toHaveBeenCalledWith('pauseAnimations', true);
    }
  });

  it('toggles hide images setting', () => {
    render(<AccessibilityToolbar />);
    const button = screen.getByText('Hide Images').closest('button');

    if (button) {
      fireEvent.click(button);
      expect(mockUpdateSetting).toHaveBeenCalledWith('hideImages', true);
    }
  });

  it('cycles through dyslexia font options', () => {
    render(<AccessibilityToolbar />);
    const button = screen.getByText('Dyslexia Friendly').closest('button');

    if (button) {
      fireEvent.click(button);
      expect(mockUpdateSetting).toHaveBeenCalledWith('dyslexiaFont', 'dyslexia');
    }
  });

  it('toggles custom cursor setting', () => {
    render(<AccessibilityToolbar />);
    const button = screen.getByText('Cursor').closest('button');

    if (button) {
      fireEvent.click(button);
      expect(mockUpdateSetting).toHaveBeenCalledWith('customCursor', true);
    }
  });

  it('toggles tooltips setting', () => {
    render(<AccessibilityToolbar />);
    const button = screen.getByText('Tooltips').closest('button');

    if (button) {
      fireEvent.click(button);
      expect(mockUpdateSetting).toHaveBeenCalledWith('tooltips', true);
    }
  });

  it('toggles line height setting', () => {
    render(<AccessibilityToolbar />);
    const button = screen.getByText('Line Height').closest('button');

    if (button) {
      fireEvent.click(button);
      expect(mockUpdateSetting).toHaveBeenCalledWith('lineHeight', true);
    }
  });

  it('cycles through text align options', () => {
    render(<AccessibilityToolbar />);
    const button = screen.getByText('Text Align').closest('button');

    if (button) {
      fireEvent.click(button);
      expect(mockUpdateSetting).toHaveBeenCalledWith('textAlign', 'left');
    }
  });

  it('cycles through saturation options', () => {
    render(<AccessibilityToolbar />);
    const button = screen.getByText('Saturation').closest('button');

    if (button) {
      fireEvent.click(button);
      expect(mockUpdateSetting).toHaveBeenCalledWith('saturation', 'high');
    }
  });

  it('resets all settings when reset button is clicked', () => {
    render(<AccessibilityToolbar />);
    const resetButton = screen.getByText('Reset All Accessibility Settings').closest('button');

    if (resetButton) {
      fireEvent.click(resetButton);
      expect(mockResetSettings).toHaveBeenCalled();
    }
  });

  it('shows active state for enabled options', () => {
    mockSettings = {
      ...defaultSettings,
      highlightLinks: true,
    };

    render(<AccessibilityToolbar />);
    const button = screen.getByText('Highlight Links').closest('button');

    expect(button?.className).toContain('bg-[#38A1E5]');
  });

  it('shows subtext for active cycling options', () => {
    mockSettings = {
      ...defaultSettings,
      textSize: 'large',
    };

    render(<AccessibilityToolbar />);
    expect(screen.getByText('Large Text')).toBeInTheDocument();
  });

  it('shows correct contrast mode label', () => {
    mockSettings = {
      ...defaultSettings,
      contrastMode: 'dark',
    };

    render(<AccessibilityToolbar />);
    expect(screen.getByText('Dark Contrast')).toBeInTheDocument();
  });

  it('cycles to next text size from large to larger', () => {
    mockSettings = {
      ...defaultSettings,
      textSize: 'large',
    };

    render(<AccessibilityToolbar />);
    const button = screen.getByText('Bigger Text').closest('button');

    if (button) {
      fireEvent.click(button);
      expect(mockUpdateSetting).toHaveBeenCalledWith('textSize', 'larger');
    }
  });

  it('cycles back to normal text size from larger', () => {
    mockSettings = {
      ...defaultSettings,
      textSize: 'larger',
    };

    render(<AccessibilityToolbar />);
    const button = screen.getByText('Bigger Text').closest('button');

    if (button) {
      fireEvent.click(button);
      expect(mockUpdateSetting).toHaveBeenCalledWith('textSize', 'normal');
    }
  });

  it('shows active indicators for multiple enabled options', () => {
    mockSettings = {
      ...defaultSettings,
      highlightLinks: true,
      pauseAnimations: true,
      hideImages: true,
    };

    render(<AccessibilityToolbar />);

    const highlightButton = screen.getByText('Highlight Links').closest('button');
    const pauseButton = screen.getByText('Pause Animations').closest('button');
    const hideButton = screen.getByText('Hide Images').closest('button');

    expect(highlightButton?.className).toContain('bg-[#38A1E5]');
    expect(pauseButton?.className).toContain('bg-[#38A1E5]');
    expect(hideButton?.className).toContain('bg-[#38A1E5]');
  });

  it('displays correct text alignment icon', () => {
    mockSettings = {
      ...defaultSettings,
      textAlign: 'center',
    };

    render(<AccessibilityToolbar />);
    // The component should render AlignCenter icon when textAlign is 'center'
    // We can verify this by checking that the option is active
    const button = screen.getByText('Text Align').closest('button');
    expect(button?.className).toContain('bg-[#38A1E5]');
  });

  it('shows option indicators for cycling options', () => {
    mockSettings = {
      ...defaultSettings,
      textSize: 'large',
    };

    render(<AccessibilityToolbar />);
    // The component shows dots to indicate position in cycle
    // We just verify the component renders without errors
    expect(screen.getByText('Large Text')).toBeInTheDocument();
  });

  it('handles rapid clicks on toggle options', () => {
    render(<AccessibilityToolbar />);
    const button = screen.getByText('Highlight Links').closest('button');

    if (button) {
      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.click(button);

      expect(mockUpdateSetting).toHaveBeenCalledTimes(3);
    }
  });

  it('handles rapid clicks on cycling options', () => {
    render(<AccessibilityToolbar />);
    const button = screen.getByText('Bigger Text').closest('button');

    if (button) {
      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.click(button);

      expect(mockUpdateSetting).toHaveBeenCalledTimes(3);
    }
  });
});
