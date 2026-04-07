'use client';

import type React from 'react';
import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronRight, Filter, Star, ChevronLeft, Check } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Image from 'next/image';

interface Tool {
  id: string;
  name: string;
  description: string;
  icon: string;
  updatedDate: string;
  isFavorite?: boolean;
  categories: string[];
  usageCount: number;
}

const tools: Tool[] = [
  {
    id: 'quiz',
    name: 'Quiz',
    description:
      'Generate a lesson plan based on standard, topic, or objective.',
    icon: '/icons/quiz.svg',
    updatedDate: 'February 13, 2025',
    categories: ['Content', 'Questions', 'Student Success'],
    usageCount: 245,
  },
  {
    id: 'rubric',
    name: 'Rubric',
    description:
      'Generate a multiple choice assessment, quiz, or test based on any topic, standard(s), or criteria.',
    icon: '/icons/rubric.svg',
    updatedDate: 'February 13, 2025',
    isFavorite: true,
    categories: ['Content', 'Grading', 'Administrative'],
    usageCount: 189,
  },
  {
    id: 'resource',
    name: 'Resource',
    description: 'Take any text and rewrite it with custom criteria.',
    icon: '/icons/resource.svg',
    updatedDate: 'February 13, 2025',
    categories: ['Content', 'Communication'],
    usageCount: 156,
  },
  {
    id: 'lesson-plan',
    name: 'Lesson Plan',
    description: 'Generate a custom rubric for any assignment.',
    icon: '/icons/lesson-plan.svg',
    updatedDate: 'February 13, 2025',
    categories: ['Content', 'Administrative'],
    usageCount: 134,
  },
  {
    id: 'syllabus',
    name: 'Syllabus',
    description:
      'Generate a unit plan based on any topic and academic standards.',
    icon: '/icons/syllabus.svg',
    updatedDate: 'February 13, 2025',
    isFavorite: true,
    categories: ['Content', 'Administrative'],
    usageCount: 98,
  },
  {
    id: 'presentation',
    name: 'Presentation',
    description:
      'Generate custom texts that include vocabulary words for your class to practice them in context.',
    icon: '/icons/powerpoint.svg',
    updatedDate: 'February 13, 2025',
    categories: ['Content', 'Communication'],
    usageCount: 87,
  },
];

const categories = [
  'Content',
  'Questions',
  'Grading',
  'Communication',
  'Administrative',
  'Student Success',
];

type SortOption = 'most-used' | 'latest' | 'alphabetical' | 'favorites';

interface ToolsSectionProps {
  onToolSelect?: (toolName: string) => void; // Changed to toolName
}

export function ToolsSection({ onToolSelect }: ToolsSectionProps) {
  const [selectedCategory, setSelectedCategory] = useState('Content');
  const [filterOpen, setFilterOpen] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [favorites, setFavorites] = useState<Set<string>>(
    new Set(tools.filter((t) => t.isFavorite).map((t) => t.id)),
  );
  const [sortBy, setSortBy] = useState<SortOption>('most-used');
  const categoryRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});

  const filteredTools = tools.filter((tool) =>
    tool.categories.includes(selectedCategory),
  );

  // Sort tools based on selected sort option
  const sortedTools = [...filteredTools].sort((a, b) => {
    switch (sortBy) {
      case 'most-used':
        return b.usageCount - a.usageCount;
      case 'latest':
        return (
          new Date(b.updatedDate).getTime() - new Date(a.updatedDate).getTime()
        );
      case 'alphabetical':
        return a.name.localeCompare(b.name);
      case 'favorites':
        const aFav = favorites.has(a.id) ? 1 : 0;
        const bFav = favorites.has(b.id) ? 1 : 0;
        if (aFav !== bFav) return bFav - aFav;
        return b.usageCount - a.usageCount; // Secondary sort by usage
      default:
        return 0;
    }
  });

  const toggleFavorite = (toolId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const newFavorites = new Set(favorites);
    if (newFavorites.has(toolId)) {
      newFavorites.delete(toolId);
    } else {
      newFavorites.add(toolId);
    }
    setFavorites(newFavorites);
  };

  const scrollCategories = (direction: 'left' | 'right') => {
    const container = document.getElementById('categories-container');
    if (container) {
      const scrollAmount = 200;
      const newPosition =
        direction === 'left'
          ? Math.max(0, scrollPosition - scrollAmount)
          : Math.min(
              container.scrollWidth - container.clientWidth,
              scrollPosition + scrollAmount,
            );

      container.scrollTo({ left: newPosition, behavior: 'smooth' });
      setScrollPosition(newPosition);
    }
  };

  const getSortLabel = (option: SortOption) => {
    switch (option) {
      case 'most-used':
        return 'Sort by Most Used';
      case 'latest':
        return 'Latest';
      case 'alphabetical':
        return 'Alphabetical';
      case 'favorites':
        return 'Favorites';
      default:
        return 'Sort by Most Used';
    }
  };

  const handleSortChange = (option: SortOption) => {
    setSortBy(option);
    setFilterOpen(false);
  };

  const handleToolCardClick = (toolId: string) => {
    onToolSelect?.(toolId); // Call original onToolSelect if it exists
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Tools</h2>
        <Button
          variant="ghost"
          className="h-auto min-h-6 p-0 text-blue-600 hover:text-blue-700"
        >
          Browse All
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>

      {/* Category Filters and Filter Button */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {/* Scroll Left Button - visible on small screens */}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 flex-shrink-0 p-1 md:hidden"
            onClick={() => scrollCategories('left')}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div
            id="categories-container"
            className="scrollbar-hide flex flex-1 items-center gap-1 overflow-x-auto scroll-smooth"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {categories.map((category) => (
              <Button
                key={category}
                ref={(el) => {
                  categoryRefs.current[category] = el;
                }}
                variant="ghost"
                size="sm"
                className={`relative flex-shrink-0 px-3 py-2 whitespace-nowrap ${
                  selectedCategory === category
                    ? 'text-[#38A1E5] hover:bg-transparent hover:text-[#38A1E5]'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
                onClick={() => setSelectedCategory(category)}
              >
                {category}
                {selectedCategory === category && (
                  <div
                    className="absolute right-3 bottom-0 left-3 h-0.5 rounded-full bg-[#38A1E5]"
                    style={{
                      width: `${category.length * 0.6}em`,
                    }}
                  />
                )}
              </Button>
            ))}
          </div>

          {/* Scroll Right Button - visible on small screens */}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 flex-shrink-0 p-1 md:hidden"
            onClick={() => scrollCategories('right')}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <DropdownMenu open={filterOpen} onOpenChange={setFilterOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="ml-4 flex-shrink-0 bg-transparent"
            >
              <Filter className="mr-2 h-4 w-4" />
              Filter
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {(
              [
                'most-used',
                'latest',
                'alphabetical',
                'favorites',
              ] as SortOption[]
            ).map((option) => (
              <DropdownMenuItem
                key={option}
                onClick={() => handleSortChange(option)}
                className="flex cursor-pointer items-center justify-between"
              >
                <span>{getSortLabel(option)}</span>
                {sortBy === option && (
                  <Check className="h-4 w-4 text-[#38A1E5]" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Tools Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {sortedTools.map((tool) => (
          <Card
            key={tool.id}
            className="relative h-full cursor-pointer border border-[#D0E0FF] bg-[#F5F8FF] shadow-xs transition-shadow duration-200 hover:shadow-sm"
            onClick={() => handleToolCardClick(tool.id)} // Use the new handler
          >
            <CardContent className="h-full p-4">
              <div className="flex h-full items-start gap-3">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-[#D0E0FF]">
                  <Image
                    src={tool.icon || '/placeholder.svg'}
                    alt={tool.name}
                    width={24}
                    height={24}
                    className="text-[#38A1E5]"
                    style={{
                      filter:
                        'brightness(0) saturate(100%) invert(47%) sepia(89%) saturate(1352%) hue-rotate(180deg) brightness(95%) contrast(89%)',
                    }}
                  />
                </div>
                <div className="flex h-full min-w-0 flex-1 flex-col">
                  <div className="mb-1 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-900">
                      {tool.name}
                    </h3>
                    <button
                      onClick={(e) => toggleFavorite(tool.id, e)}
                      className="rounded p-1 transition-colors hover:bg-gray-100"
                    >
                      <Star
                        className={`h-4 w-4 ${
                          favorites.has(tool.id)
                            ? 'fill-current text-[#38A1E5]'
                            : 'text-gray-400 hover:text-[#38A1E5]'
                        }`}
                      />
                    </button>
                  </div>
                  <p className="mb-2 flex-1 text-sm leading-relaxed text-gray-600">
                    {tool.description}
                  </p>
                  <div className="mt-auto flex items-center justify-between">
                    <p className="text-xs text-gray-400">
                      Updated on {tool.updatedDate}
                    </p>
                    {sortBy === 'most-used' && (
                      <p className="text-xs text-gray-500">
                        {tool.usageCount} uses
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
