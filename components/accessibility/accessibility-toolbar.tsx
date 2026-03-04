'use client';

import type React from 'react';
import { Button } from '@/components/ui/button';
import { useAccessibility } from '@/contexts/accessibility-contexts';
import {
  X,
  Link,
  Type,
  Minus,
  Pause,
  ImageOff,
  MousePointer,
  MessageSquare,
  AlignLeft,
  Droplets,
  RotateCcw,
  Circle,
  AlignCenter,
  AlignRight,
  AlignJustify,
} from 'lucide-react';

interface AccessibilityOptionProps {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
  subtext?: string;
  options?: string[];
  activeIndex?: number;
}

function AccessibilityOption({
  icon,
  label,
  isActive,
  onClick,
  subtext,
  options,
  activeIndex,
}: AccessibilityOptionProps) {
  return (
    <Button
      onClick={onClick}
      variant={isActive ? 'default' : 'outline'}
      className={`h-24 w-full flex flex-col items-center justify-center gap-1 text-xs font-medium relative ${
        isActive
          ? 'bg-[#38A1E5] text-white border-[#38A1E5] hover:bg-[#D0E0FF] hover:text-gray-800'
          : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-200'
      }`}
    >
      {isActive && (
        <div className="absolute top-2 right-2 w-4 h-4 bg-[#38A1E5] rounded-full flex items-center justify-center">
          <div className="w-2 h-2 bg-white rounded-full" />
        </div>
      )}
      <div className="text-lg">{icon}</div>
      <span className="text-center leading-tight">{label}</span>
      {isActive && subtext && (
        <>
          <span className="text-xs text-[#38A1E5] font-medium">{subtext}</span>
          {options && options.length > 0 && (
            <div className="flex gap-1 mt-1">
              {options.map((_, index) => (
                <div
                  key={index}
                  className={`w-3 h-1 rounded-full ${index === activeIndex ? 'bg-[#38A1E5]' : 'bg-gray-300'}`}
                />
              ))}
            </div>
          )}
        </>
      )}
    </Button>
  );
}

export function AccessibilityToolbar() {
  const { settings, updateSetting, resetSettings, isToolbarOpen, setIsToolbarOpen } =
    useAccessibility();

  if (!isToolbarOpen) return null;

  const cycleContrastMode = () => {
    const modes = ['normal', 'invert', 'dark', 'light'] as const;
    const currentIndex = modes.indexOf(settings.contrastMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    updateSetting('contrastMode', modes[nextIndex]);
  };

  const cycleTextSize = () => {
    const sizes = ['normal', 'large', 'larger'] as const;
    const currentIndex = sizes.indexOf(settings.textSize);
    const nextIndex = (currentIndex + 1) % sizes.length;
    updateSetting('textSize', sizes[nextIndex]);
  };

  const cycleTextSpacing = () => {
    const spacings = ['none', 'light', 'moderate', 'heavy'] as const;
    const currentIndex = spacings.indexOf(settings.textSpacing);
    const nextIndex = (currentIndex + 1) % spacings.length;
    updateSetting('textSpacing', spacings[nextIndex]);
  };

  const cycleDyslexiaFont = () => {
    const fonts = ['normal', 'dyslexia', 'legible'] as const;
    const currentIndex = fonts.indexOf(settings.dyslexiaFont);
    const nextIndex = (currentIndex + 1) % fonts.length;
    updateSetting('dyslexiaFont', fonts[nextIndex]);
  };

  const cycleTextAlign = () => {
    const aligns = ['normal', 'left', 'center', 'right', 'justify'] as const;
    const currentIndex = aligns.indexOf(settings.textAlign);
    const nextIndex = (currentIndex + 1) % aligns.length;
    updateSetting('textAlign', aligns[nextIndex]);
  };

  const cycleSaturation = () => {
    const saturations = ['normal', 'high', 'low'] as const;
    const currentIndex = saturations.indexOf(settings.saturation);
    const nextIndex = (currentIndex + 1) % saturations.length;
    updateSetting('saturation', saturations[nextIndex]);
  };

  const getContrastLabel = () => {
    const labels = {
      normal: 'Contrast +',
      invert: 'Invert Colors',
      dark: 'Dark Contrast',
      light: 'Light Contrast',
    };
    return labels[settings.contrastMode];
  };

  const getTextSizeLabel = () => {
    const labels = { normal: 'Normal Text', large: 'Large Text', larger: 'Larger Text' };
    return labels[settings.textSize];
  };

  const getTextSpacingLabel = () => {
    const labels = {
      none: 'Text Spacing',
      light: 'Light Spacing',
      moderate: 'Moderate Spacing',
      heavy: 'Heavy Spacing',
    };
    return labels[settings.textSpacing];
  };

  const getDyslexiaLabel = () => {
    const labels = {
      normal: 'Dyslexia Friendly',
      dyslexia: 'Dyslexia Font',
      legible: 'Legible Font',
    };
    return labels[settings.dyslexiaFont];
  };

  const getTextAlignLabel = () => {
    const labels = {
      normal: 'Text Align',
      left: 'Align Left',
      center: 'Align Center',
      right: 'Align Right',
      justify: 'Justify',
    };
    return labels[settings.textAlign];
  };

  const getSaturationLabel = () => {
    const labels = { normal: 'Normal Saturation', high: 'High Saturation', low: 'Low Saturation' };
    return labels[settings.saturation];
  };

  const getTextAlignIcon = () => {
    const icons = {
      normal: <AlignLeft className="h-5 w-5" />,
      left: <AlignLeft className="h-5 w-5" />,
      center: <AlignCenter className="h-5 w-5" />,
      right: <AlignRight className="h-5 w-5" />,
      justify: <AlignJustify className="h-5 w-5" />,
    };
    return icons[settings.textAlign];
  };

  const toggleTooltips = () => {
    updateSetting('tooltips', !settings.tooltips);
  };

  const toggleCustomCursor = () => {
    updateSetting('customCursor', !settings.customCursor);
  };

  return (
    <>
      <div className="fixed top-0 right-0 h-full w-80 bg-white z-50 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-[#38A1E5] to-[#7284FF]  text-white flex-shrink-0">
          <h2 className="text-lg font-semibold">Accessibility Menu</h2>
          <Button
            onClick={() => setIsToolbarOpen(false)}
            variant="ghost"
            size="icon"
            className="text-white hover:bg-transparent hover:text-white"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div
          className="flex-1 flex flex-col p-4 bg-white overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="grid grid-cols-2 gap-3 flex-1">
            <AccessibilityOption
              icon={<Circle className="h-5 w-5" />}
              label="Contrast +"
              isActive={settings.contrastMode !== 'normal'}
              onClick={cycleContrastMode}
              subtext={settings.contrastMode !== 'normal' ? getContrastLabel() : undefined}
              options={['normal', 'invert', 'dark', 'light']}
              activeIndex={['normal', 'invert', 'dark', 'light'].indexOf(settings.contrastMode)}
            />

            <AccessibilityOption
              icon={<Link className="h-5 w-5" />}
              label="Highlight Links"
              isActive={settings.highlightLinks}
              onClick={() => updateSetting('highlightLinks', !settings.highlightLinks)}
            />

            <AccessibilityOption
              icon={<Type className="h-5 w-5" />}
              label="Bigger Text"
              isActive={settings.textSize !== 'normal'}
              onClick={cycleTextSize}
              subtext={settings.textSize !== 'normal' ? getTextSizeLabel() : undefined}
              options={['normal', 'large', 'larger']}
              activeIndex={['normal', 'large', 'larger'].indexOf(settings.textSize)}
            />

            <AccessibilityOption
              icon={<Minus className="h-5 w-5 rotate-90" />}
              label="Text Spacing"
              isActive={settings.textSpacing !== 'none'}
              onClick={cycleTextSpacing}
              subtext={settings.textSpacing !== 'none' ? getTextSpacingLabel() : undefined}
              options={['none', 'light', 'moderate', 'heavy']}
              activeIndex={['none', 'light', 'moderate', 'heavy'].indexOf(settings.textSpacing)}
            />

            <AccessibilityOption
              icon={<Pause className="h-5 w-5" />}
              label="Pause Animations"
              isActive={settings.pauseAnimations}
              onClick={() => updateSetting('pauseAnimations', !settings.pauseAnimations)}
            />

            <AccessibilityOption
              icon={<ImageOff className="h-5 w-5" />}
              label="Hide Images"
              isActive={settings.hideImages}
              onClick={() => updateSetting('hideImages', !settings.hideImages)}
            />

            <AccessibilityOption
              icon={<span className="text-sm font-bold">Df</span>}
              label="Dyslexia Friendly"
              isActive={settings.dyslexiaFont !== 'normal'}
              onClick={cycleDyslexiaFont}
              subtext={settings.dyslexiaFont !== 'normal' ? getDyslexiaLabel() : undefined}
              options={['normal', 'dyslexia', 'legible']}
              activeIndex={['normal', 'dyslexia', 'legible'].indexOf(settings.dyslexiaFont)}
            />

            <AccessibilityOption
              icon={<MousePointer className="h-5 w-5" />}
              label="Cursor"
              isActive={settings.customCursor}
              onClick={toggleCustomCursor}
            />

            <AccessibilityOption
              icon={<MessageSquare className="h-5 w-5" />}
              label="Tooltips"
              isActive={settings.tooltips}
              onClick={toggleTooltips}
            />

            <AccessibilityOption
              icon={
                <div className="flex flex-col gap-0.5">
                  <div className="h-0.5 w-4 bg-current"></div>
                  <div className="h-0.5 w-4 bg-current"></div>
                  <div className="h-0.5 w-4 bg-current"></div>
                </div>
              }
              label="Line Height"
              isActive={settings.lineHeight}
              onClick={() => updateSetting('lineHeight', !settings.lineHeight)}
            />

            <AccessibilityOption
              icon={getTextAlignIcon()}
              label="Text Align"
              isActive={settings.textAlign !== 'normal'}
              onClick={cycleTextAlign}
              subtext={settings.textAlign !== 'normal' ? getTextAlignLabel() : undefined}
              options={['normal', 'left', 'center', 'right', 'justify']}
              activeIndex={['normal', 'left', 'center', 'right', 'justify'].indexOf(
                settings.textAlign,
              )}
            />

            <AccessibilityOption
              icon={<Droplets className="h-5 w-5" />}
              label="Saturation"
              isActive={settings.saturation !== 'normal'}
              onClick={cycleSaturation}
              subtext={settings.saturation !== 'normal' ? getSaturationLabel() : undefined}
              options={['normal', 'high', 'low']}
              activeIndex={['normal', 'high', 'low'].indexOf(settings.saturation)}
            />
          </div>

          <Button
            onClick={resetSettings}
            className="w-full bg-gradient-to-r from-[#38A1E5] to-[#7284FF] hover:from-[#2E8BC7] hover:to-[#0066DD] text-white py-3 mt-4 shadow-lg flex-shrink-0"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset All Accessibility Settings
          </Button>
        </div>
      </div>
    </>
  );
}
