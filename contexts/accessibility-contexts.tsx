'use client';

import type React from 'react';
import { createContext, useContext, useState, useEffect } from 'react';

interface AccessibilitySettings {
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
}

interface AccessibilityContextType {
  settings: AccessibilitySettings;
  updateSetting: (key: keyof AccessibilitySettings, value: string | boolean) => void;
  resetSettings: () => void;
  isToolbarOpen: boolean;
  setIsToolbarOpen: (open: boolean) => void;
}

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

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AccessibilitySettings>(defaultSettings);
  const [isToolbarOpen, setIsToolbarOpen] = useState(false);

  useEffect(() => {
    setSettings(defaultSettings);
    localStorage.removeItem('accessibility-settings');
  }, []);

  useEffect(() => {
    const root = document.documentElement;

    if (settings.contrastMode === 'invert') {
      root.style.setProperty('--accessibility-invert', 'invert(1)');
      document.body.classList.add('accessibility-invert');
    } else {
      root.style.setProperty('--accessibility-invert', 'invert(0)');
      document.body.classList.remove('accessibility-invert');
    }

    const fontSizeMap = {
      normal: '1',
      large: '1.2',
      larger: '1.4',
    };
    root.style.setProperty('--accessibility-font-size', fontSizeMap[settings.textSize]);
    document.body.classList.toggle('accessibility-text-size', settings.textSize !== 'normal');

    const spacingMap = {
      none: { letter: 'normal', word: 'normal' },
      light: { letter: '0.05em', word: '0.1em' },
      moderate: { letter: '0.1em', word: '0.2em' },
      heavy: { letter: '0.15em', word: '0.3em' },
    };
    const spacing = spacingMap[settings.textSpacing];
    root.style.setProperty('--accessibility-letter-spacing', spacing.letter);
    root.style.setProperty('--accessibility-word-spacing', spacing.word);
    document.body.classList.toggle('accessibility-text-spacing', settings.textSpacing !== 'none');

    if (settings.pauseAnimations) {
      document.body.classList.add('accessibility-pause-animations');
    } else {
      document.body.classList.remove('accessibility-pause-animations');
    }

    if (settings.lineHeight) {
      root.style.setProperty('--accessibility-line-height', '1.8');
      document.body.classList.add('accessibility-line-height');
    } else {
      root.style.setProperty('--accessibility-line-height', '1.5');
      document.body.classList.remove('accessibility-line-height');
    }

    const saturationMap = {
      normal: 'saturate(1)',
      high: 'saturate(1.8)',
      low: 'saturate(0.3)',
    };
    root.style.setProperty('--accessibility-saturation', saturationMap[settings.saturation]);
    document.body.classList.toggle('accessibility-saturation', settings.saturation !== 'normal');

    document.body.classList.toggle('accessibility-custom-cursor', settings.customCursor);

    const body = document.body;
    body.classList.toggle('accessibility-highlight-links', settings.highlightLinks);
    body.classList.toggle('accessibility-hide-images', settings.hideImages);
    body.classList.toggle('accessibility-dyslexia-friendly', settings.dyslexiaFont === 'dyslexia');
    body.classList.toggle('accessibility-legible-font', settings.dyslexiaFont === 'legible');
    body.classList.toggle('accessibility-pause-animations', settings.pauseAnimations);
    body.classList.toggle('accessibility-tooltips', settings.tooltips);

    body.classList.remove(
      'accessibility-text-left',
      'accessibility-text-center',
      'accessibility-text-right',
      'accessibility-text-justify',
    );
    if (settings.textAlign !== 'normal') {
      body.classList.add(`accessibility-text-${settings.textAlign}`);
    }

    body.classList.remove(
      'accessibility-high-contrast',
      'accessibility-dark-contrast',
      'accessibility-light-contrast',
    );
    if (settings.contrastMode === 'dark') {
      body.classList.add('accessibility-dark-contrast');
    } else if (settings.contrastMode === 'light') {
      body.classList.add('accessibility-light-contrast');
    }
  }, [settings]);

  const updateSetting = (key: keyof AccessibilitySettings, value: string | boolean) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    localStorage.setItem('accessibility-settings', JSON.stringify(newSettings));
  };

  const resetSettings = () => {
    setSettings(defaultSettings);
    localStorage.removeItem('accessibility-settings');
  };

  return (
    <AccessibilityContext.Provider
      value={{
        settings,
        updateSetting,
        resetSettings,
        isToolbarOpen,
        setIsToolbarOpen,
      }}
    >
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility() {
  const context = useContext(AccessibilityContext);
  if (context === undefined) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider');
  }
  return context;
}
