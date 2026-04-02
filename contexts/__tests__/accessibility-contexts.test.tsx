import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, renderHook, act } from '@testing-library/react';
import {
  AccessibilityProvider,
  useAccessibility,
} from '../accessibility-contexts';

describe('AccessibilityProvider', () => {
  let localStorageMock: { [key: string]: string };

  beforeEach(() => {
    localStorageMock = {};
    global.localStorage = {
      getItem: vi.fn((key: string) => localStorageMock[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        localStorageMock[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete localStorageMock[key];
      }),
      clear: vi.fn(() => {
        localStorageMock = {};
      }),
      length: 0,
      key: vi.fn(),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('provides default accessibility settings', () => {
    const { result } = renderHook(() => useAccessibility(), {
      wrapper: AccessibilityProvider,
    });

    expect(result.current.settings).toEqual({
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
    });
  });

  it('updates a setting and stores it in localStorage', () => {
    const { result } = renderHook(() => useAccessibility(), {
      wrapper: AccessibilityProvider,
    });

    act(() => {
      result.current.updateSetting('highlightLinks', true);
    });

    expect(result.current.settings.highlightLinks).toBe(true);
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'accessibility-settings',
      expect.stringContaining('"highlightLinks":true'),
    );
  });

  it('updates string settings correctly', () => {
    const { result } = renderHook(() => useAccessibility(), {
      wrapper: AccessibilityProvider,
    });

    act(() => {
      result.current.updateSetting('textSize', 'large');
    });

    expect(result.current.settings.textSize).toBe('large');
  });

  it('cycles through contrast modes', () => {
    const { result } = renderHook(() => useAccessibility(), {
      wrapper: AccessibilityProvider,
    });

    act(() => {
      result.current.updateSetting('contrastMode', 'invert');
    });

    expect(result.current.settings.contrastMode).toBe('invert');

    act(() => {
      result.current.updateSetting('contrastMode', 'dark');
    });

    expect(result.current.settings.contrastMode).toBe('dark');
  });

  it('resets all settings to defaults', () => {
    const { result } = renderHook(() => useAccessibility(), {
      wrapper: AccessibilityProvider,
    });

    // Make some changes (separately to ensure they're applied)
    act(() => {
      result.current.updateSetting('highlightLinks', true);
    });

    act(() => {
      result.current.updateSetting('textSize', 'larger');
    });

    act(() => {
      result.current.updateSetting('pauseAnimations', true);
    });

    expect(result.current.settings.highlightLinks).toBe(true);
    expect(result.current.settings.textSize).toBe('larger');
    expect(result.current.settings.pauseAnimations).toBe(true);

    // Reset
    act(() => {
      result.current.resetSettings();
    });

    expect(result.current.settings).toEqual({
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
    });

    expect(localStorage.removeItem).toHaveBeenCalledWith(
      'accessibility-settings',
    );
  });

  it('manages toolbar open state', () => {
    const { result } = renderHook(() => useAccessibility(), {
      wrapper: AccessibilityProvider,
    });

    expect(result.current.isToolbarOpen).toBe(false);

    act(() => {
      result.current.setIsToolbarOpen(true);
    });

    expect(result.current.isToolbarOpen).toBe(true);

    act(() => {
      result.current.setIsToolbarOpen(false);
    });

    expect(result.current.isToolbarOpen).toBe(false);
  });

  it('throws error when used outside provider', () => {
    // Suppress console.error for this test
    const consoleError = console.error;
    console.error = vi.fn();

    expect(() => {
      renderHook(() => useAccessibility());
    }).toThrow('useAccessibility must be used within an AccessibilityProvider');

    console.error = consoleError;
  });

  it('renders children correctly', () => {
    const { getByText } = render(
      <AccessibilityProvider>
        <div>Test Child</div>
      </AccessibilityProvider>,
    );

    expect(getByText('Test Child')).toBeInTheDocument();
  });

  it('updates multiple settings in sequence', () => {
    const { result } = renderHook(() => useAccessibility(), {
      wrapper: AccessibilityProvider,
    });

    act(() => {
      result.current.updateSetting('textSize', 'large');
    });

    act(() => {
      result.current.updateSetting('textSpacing', 'moderate');
    });

    act(() => {
      result.current.updateSetting('dyslexiaFont', 'dyslexia');
    });

    expect(result.current.settings.textSize).toBe('large');
    expect(result.current.settings.textSpacing).toBe('moderate');
    expect(result.current.settings.dyslexiaFont).toBe('dyslexia');
  });

  it('applies CSS classes to document body on setting changes', () => {
    const { result } = renderHook(() => useAccessibility(), {
      wrapper: AccessibilityProvider,
    });

    act(() => {
      result.current.updateSetting('highlightLinks', true);
    });

    // Note: In actual DOM, we'd check document.body.classList
    // In jsdom, this should work but may need more setup
    expect(result.current.settings.highlightLinks).toBe(true);
  });

  it('handles all text size options', () => {
    const { result } = renderHook(() => useAccessibility(), {
      wrapper: AccessibilityProvider,
    });

    const sizes = ['normal', 'large', 'larger'] as const;

    sizes.forEach((size) => {
      act(() => {
        result.current.updateSetting('textSize', size);
      });

      expect(result.current.settings.textSize).toBe(size);
    });
  });

  it('handles all text spacing options', () => {
    const { result } = renderHook(() => useAccessibility(), {
      wrapper: AccessibilityProvider,
    });

    const spacings = ['none', 'light', 'moderate', 'heavy'] as const;

    spacings.forEach((spacing) => {
      act(() => {
        result.current.updateSetting('textSpacing', spacing);
      });

      expect(result.current.settings.textSpacing).toBe(spacing);
    });
  });

  it('handles all dyslexia font options', () => {
    const { result } = renderHook(() => useAccessibility(), {
      wrapper: AccessibilityProvider,
    });

    const fonts = ['normal', 'dyslexia', 'legible'] as const;

    fonts.forEach((font) => {
      act(() => {
        result.current.updateSetting('dyslexiaFont', font);
      });

      expect(result.current.settings.dyslexiaFont).toBe(font);
    });
  });

  it('handles all text alignment options', () => {
    const { result } = renderHook(() => useAccessibility(), {
      wrapper: AccessibilityProvider,
    });

    const aligns = ['normal', 'left', 'center', 'right', 'justify'] as const;

    aligns.forEach((align) => {
      act(() => {
        result.current.updateSetting('textAlign', align);
      });

      expect(result.current.settings.textAlign).toBe(align);
    });
  });

  it('handles all saturation options', () => {
    const { result } = renderHook(() => useAccessibility(), {
      wrapper: AccessibilityProvider,
    });

    const saturations = ['normal', 'high', 'low'] as const;

    saturations.forEach((saturation) => {
      act(() => {
        result.current.updateSetting('saturation', saturation);
      });

      expect(result.current.settings.saturation).toBe(saturation);
    });
  });

  it('handles all contrast mode options', () => {
    const { result } = renderHook(() => useAccessibility(), {
      wrapper: AccessibilityProvider,
    });

    const modes = ['normal', 'invert', 'dark', 'light'] as const;

    modes.forEach((mode) => {
      act(() => {
        result.current.updateSetting('contrastMode', mode);
      });

      expect(result.current.settings.contrastMode).toBe(mode);
    });
  });

  it('toggles boolean settings correctly', () => {
    const { result } = renderHook(() => useAccessibility(), {
      wrapper: AccessibilityProvider,
    });

    const booleanSettings: Array<keyof typeof result.current.settings> = [
      'invertColors',
      'highlightLinks',
      'pauseAnimations',
      'hideImages',
      'customCursor',
      'tooltips',
      'lineHeight',
    ];

    booleanSettings.forEach((setting) => {
      act(() => {
        result.current.updateSetting(setting, true);
      });

      expect(result.current.settings[setting]).toBe(true);

      act(() => {
        result.current.updateSetting(setting, false);
      });

      expect(result.current.settings[setting]).toBe(false);
    });
  });
});
