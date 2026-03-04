'use client';

import type React from 'react';

import { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  BookOpen,
  ArrowUpDown,
  Smile,
  ArrowUp,
  Pencil,
  Type,
  Layout,
  List,
  X,
} from 'lucide-react';

type ControlOption = 'length' | 'reading' | 'polish' | 'emojis' | null;

interface LengthLevel {
  label: string;
  position: number;
  prompt: string;
}

interface ReadingLevel {
  label: string;
  position: number;
  prompt: string;
}

const lengthLevels: LengthLevel[] = [
  { label: 'Longest', position: 0, prompt: 'Make the text 75% Longer' },
  { label: 'Longer', position: 1, prompt: 'Make the text 50% Longer' },
  { label: 'Keep current length', position: 2, prompt: '' },
  { label: 'Shorter', position: 3, prompt: 'Make the text 50% Shorter' },
  { label: 'Shortest', position: 4, prompt: 'Make the text 75% Shortest' },
];

const readingLevels: ReadingLevel[] = [
  {
    label: 'Graduate School',
    position: 0,
    prompt:
      'Rewrite this text at the reading level of a graduate school student who has taken a couple of classes in this subject',
  },
  {
    label: 'College',
    position: 1,
    prompt:
      'Rewrite this text at the reading level of a college student who has taken a couple of classes in this subject',
  },
  {
    label: 'High School',
    position: 2,
    prompt:
      'Rewrite this text at the reading level of a high school student who has taken a couple of classes in this subject',
  },
  { label: 'Keep current reading level', position: 3, prompt: '' },
  {
    label: 'Middle School',
    position: 4,
    prompt:
      'Rewrite this text at the reading level of a middle school student who has taken a couple of classes in this subject',
  },
  {
    label: 'Kindergarten',
    position: 5,
    prompt:
      'Rewrite this text at the reading level of a kindergarten student who has taken a couple of classes in this subject',
  },
];

const polishPrompt =
  'Add some final polish to the text. If relevant, add a large title or any section titles. Check grammar and mechanics, make sure everything is consistent and reads well. You can reply that you added some final polish and checked for grammar, but do not mention the prompt.';

const emojiPrompts = {
  words: 'Replace as many words as possible with emojis.',
  sections:
    'Add three emojis at the start or end of every major section or paragraph to give subtle decoration. Do not change the structure of the original text. Do not add emojis to lists.',
  lists: 'Add emojis to lists for visual flair. Do not change the structure of the original text.',
  remove: 'Remove emojis.',
};

interface CanvasControlsProps {
  sendFullArtifactUpdate?: (message: string) => void;
}

export function CanvasControls({ sendFullArtifactUpdate }: CanvasControlsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedOption, setSelectedOption] = useState<ControlOption>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [lengthPosition, setLengthPosition] = useState(2); // Default: Keep current length
  const [readingPosition, setReadingPosition] = useState(3); // Default: Keep current reading level
  const [showSendOnIcon, setShowSendOnIcon] = useState<ControlOption>(null);

  const sliderRef = useRef<HTMLDivElement>(null);
  const startDragY = useRef<number>(0);
  const startPosition = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setSelectedOption(null);
        setShowSendOnIcon(null);
        setIsExpanded(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isDragging) {
      const handleMouseMove = (e: MouseEvent) => {
        if (!sliderRef.current) return;

        const sliderRect = sliderRef.current.getBoundingClientRect();
        const dotCount = selectedOption === 'length' ? lengthLevels.length : readingLevels.length;
        const sliderHeight = sliderRect.height - 60; // Accounting for padding
        const dotSpacing = sliderHeight / (dotCount - 1);

        const relativeY = e.clientY - sliderRect.top - 30; // Offset for padding
        const newPosition = Math.round(relativeY / dotSpacing);
        const clampedPosition = Math.max(0, Math.min(dotCount - 1, newPosition));

        if (selectedOption === 'length') {
          setLengthPosition(clampedPosition);
        } else if (selectedOption === 'reading') {
          setReadingPosition(clampedPosition);
        }
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        const currentPosition = selectedOption === 'length' ? lengthPosition : readingPosition;
        const keepCurrentPosition = selectedOption === 'length' ? 2 : 3;

        if (currentPosition === keepCurrentPosition) {
          setSelectedOption(null);
          setShowSendOnIcon(null);
          setIsExpanded(true);
        } else {
          setShowSendOnIcon(selectedOption);
        }
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, selectedOption, lengthPosition, readingPosition]);

  const handleDotMouseDown = (e: React.MouseEvent) => {
    // Don't prevent default if send button is shown - allow click to work
    if (showSendOnIcon === selectedOption) {
      return;
    }
    e.preventDefault();
    setShowSendOnIcon(null); // Reset send button on mousedown to allow dragging again
    setIsDragging(true);
    startDragY.current = e.clientY;
    startPosition.current = selectedOption === 'length' ? lengthPosition : readingPosition;
  };

  const handleIconClick = (option: ControlOption) => {
    if (option === 'polish') {
      setShowSendOnIcon('polish');
    } else {
      setSelectedOption(option);
      if (option === 'emojis') {
        setShowSendOnIcon(null);
      } else {
        setShowSendOnIcon(null);
      }
    }
  };

  const handleSend = () => {
    let prompt = '';

    if (showSendOnIcon === 'length') {
      prompt = lengthLevels[lengthPosition].prompt;
      console.log('[v0] Length adjustment prompt:', prompt);
    } else if (showSendOnIcon === 'reading') {
      prompt = readingLevels[readingPosition].prompt;
      console.log('[v0] Reading level prompt:', prompt);
    } else if (showSendOnIcon === 'polish') {
      prompt = polishPrompt;
      console.log('[v0] Polish prompt:', prompt);
    }

    // Only send if we have a valid prompt and the function is available
    if (prompt && sendFullArtifactUpdate) {
      sendFullArtifactUpdate(prompt);
    }

    setSelectedOption(null);
    setShowSendOnIcon(null);
    setIsExpanded(false);
  };

  const handleEmojiOption = (option: string) => {
    const prompts: { [key: string]: string } = {
      Words: emojiPrompts.words,
      Sections: emojiPrompts.sections,
      Lists: emojiPrompts.lists,
      Remove: emojiPrompts.remove,
    };
    const prompt = prompts[option];
    console.log('[v0] Emoji prompt:', prompt);

    // Send the prompt with full artifact update if function is available
    if (prompt && sendFullArtifactUpdate) {
      sendFullArtifactUpdate(prompt);
    }

    setSelectedOption(null);
    setShowSendOnIcon(null);
    setIsExpanded(false);
  };

  const handleContainerMouseLeave = () => {
    if (!selectedOption) {
      setIsExpanded(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-10 flex items-end gap-4 z-40" ref={containerRef}>
      {(selectedOption === 'length' || selectedOption === 'reading') && (
        <div className="flex items-center gap-4 animate-in fade-in slide-in-from-right duration-300">
          {/* Slider with dots */}
          <div
            ref={sliderRef}
            className="bg-gray-100 rounded-full px-5 py-6 shadow-lg flex flex-col items-center relative"
            style={{ height: '300px', width: '70px' }}
          >
            {/* Static dots */}
            <div className="absolute inset-0 flex flex-col justify-between items-center py-8">
              {(selectedOption === 'length' ? lengthLevels : readingLevels).map((level, index) => {
                const isActive =
                  selectedOption === 'length'
                    ? lengthPosition === index
                    : readingPosition === index;

                return (
                  <div
                    key={index}
                    className="flex items-center justify-center"
                    style={{ position: 'relative' }}
                  >
                    <div
                      className={`absolute right-full mr-8 bg-black text-white px-3 py-1 rounded text-xs whitespace-nowrap transition-opacity duration-200 ${
                        isActive ? 'opacity-100' : 'opacity-0'
                      }`}
                    >
                      {level.label}
                    </div>
                    <div
                      className={`rounded-full transition-all duration-200 ${
                        isActive ? 'w-2 h-2 bg-gray-400' : 'w-2 h-2 bg-gray-300'
                      }`}
                    />
                  </div>
                );
              })}
            </div>

            <div
              className="absolute z-10"
              style={{
                top: `${30 + ((selectedOption === 'length' ? lengthPosition : readingPosition) / ((selectedOption === 'length' ? lengthLevels.length : readingLevels.length) - 1)) * (300 - 60)}px`,
                left: '50%',
                transform: 'translate(-50%, -50%)',
                transition: isDragging ? 'none' : 'top 0.3s ease-out',
              }}
              onMouseDown={handleDotMouseDown}
            >
              <div
                className={`w-11 h-11 bg-white rounded-full shadow-xl flex items-center justify-center ${
                  showSendOnIcon === selectedOption
                    ? 'cursor-pointer hover:bg-gray-50'
                    : 'cursor-grab active:cursor-grabbing'
                }`}
                onClick={
                  showSendOnIcon === selectedOption
                    ? (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleSend();
                      }
                    : undefined
                }
              >
                {showSendOnIcon === selectedOption ? (
                  <ArrowUp className="w-5 h-5 text-gray-700" />
                ) : selectedOption === 'length' ? (
                  <ArrowUpDown className="w-5 h-5 text-gray-700" />
                ) : (
                  <BookOpen className="w-5 h-5 text-gray-700" />
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedOption === 'emojis' && showSendOnIcon !== 'emojis' && (
        <div className="bg-white rounded-2xl p-6 shadow-xl animate-in fade-in slide-in-from-right duration-300 min-w-[280px]">
          <h3 className="text-center text-lg font-semibold mb-4">Add emojis</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: Type, label: 'Words' },
              { icon: Layout, label: 'Sections' },
              { icon: List, label: 'Lists' },
              { icon: X, label: 'Remove' },
            ].map((option, index) => {
              const IconComponent = option.icon;
              return (
                <button
                  key={index}
                  className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all duration-200"
                  onClick={() => handleEmojiOption(option.label)}
                >
                  <IconComponent className="w-6 h-6 text-gray-700" />
                  <span className="text-sm text-gray-700">{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div
        className={`flex flex-col gap-3 rounded-full p-2 transition-all duration-300 relative ${
          (isExpanded || showSendOnIcon === 'polish') && !selectedOption
            ? 'bg-white shadow-lg border border-gray-200'
            : 'bg-transparent'
        }`}
        onMouseEnter={() => setIsExpanded(true)}
        onMouseLeave={handleContainerMouseLeave}
      >
        <div
          className={`flex flex-col gap-3 transition-all duration-500 ease-out ${
            (isExpanded || showSendOnIcon === 'polish') && !selectedOption
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-4 pointer-events-none h-0 overflow-hidden'
          }`}
        >
          {/* Add Emojis */}
          <div className="relative group flex items-center justify-center">
            <button
              className="h-12 w-12 flex items-center justify-center transition-all duration-200"
              onClick={() => handleIconClick('emojis')}
            >
              <Smile className="h-5 w-5 text-gray-500 group-hover:text-gray-700 group-hover:scale-110 transition-all duration-200" />
            </button>
            <div className="absolute right-full mr-2 top-1/2 transform -translate-y-1/2 bg-black text-white px-3 py-1 rounded text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
              Add emojis
            </div>
          </div>

          {/* Add final polish */}
          <div className="relative group flex items-center justify-center">
            <button
              className="h-12 w-12 flex items-center justify-center transition-all duration-200"
              onClick={
                showSendOnIcon === 'polish'
                  ? (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSend();
                    }
                  : () => handleIconClick('polish')
              }
            >
              {showSendOnIcon === 'polish' ? (
                <ArrowUp className="h-5 w-5 text-gray-700" />
              ) : (
                <Sparkles className="h-5 w-5 text-gray-500 group-hover:text-gray-700 group-hover:scale-110 transition-all duration-200" />
              )}
            </button>
            <div className="absolute right-full mr-2 top-1/2 transform -translate-y-1/2 bg-black text-white px-3 py-1 rounded text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
              {showSendOnIcon === 'polish' ? 'Send' : 'Add final polish'}
            </div>
          </div>

          {/* Reading Level */}
          <div className="relative group flex items-center justify-center">
            <button
              className="h-12 w-12 flex items-center justify-center transition-all duration-200"
              onClick={() => handleIconClick('reading')}
            >
              <BookOpen className="h-5 w-5 text-gray-500 group-hover:text-gray-700 group-hover:scale-110 transition-all duration-200" />
            </button>
            <div className="absolute right-full mr-2 top-1/2 transform -translate-y-1/2 bg-black text-white px-3 py-1 rounded text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
              Reading level
            </div>
          </div>

          {/* Adjust the length */}
          <div className="relative group flex items-center justify-center">
            <button
              className="h-12 w-12 flex items-center justify-center transition-all duration-200"
              onClick={() => handleIconClick('length')}
            >
              <ArrowUpDown className="h-5 w-5 text-gray-500 group-hover:text-gray-700 group-hover:scale-110 transition-all duration-200" />
            </button>
            <div className="absolute right-full mr-2 top-1/2 transform -translate-y-1/2 bg-black text-white px-3 py-1 rounded text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
              Adjust the length
            </div>
          </div>
        </div>

        {/* Main Pencil Button */}
        <button
          type="button"
          className="h-14 w-14 rounded-full bg-white shadow-lg hover:bg-gray-50 transition-all duration-200 hover:scale-105 flex items-center justify-center border-0 outline-none cursor-pointer"
          style={{
            backgroundColor: '#ffffff',
            position: 'relative',
            zIndex: 10,
            isolation: 'isolate',
          }}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <Pencil className="h-6 w-6 text-gray-600" style={{ position: 'relative', zIndex: 11 }} />
        </button>
      </div>
    </div>
  );
}
