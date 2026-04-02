'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, Check } from 'lucide-react';
import { MentorFacet } from '@iblai/iblai-api';
import { ExplorePageFilters } from './explore-page-context';
import { getLLMProviderDetails } from '@/lib/utils';

interface MentorCategoriesProps {
  facets?: Record<string, MentorFacet>;
  showCreatedByFilter?: boolean;
  onFiltersChange?: (filters: ExplorePageFilters) => void;
  onCreatedByChange?: (
    createdBy: 'me' | 'my-organization' | 'community' | null,
  ) => void;
  includeMeToCreatedByFilter?: boolean;
}

export function MentorCategories({
  facets,
  showCreatedByFilter,
  onFiltersChange,
  onCreatedByChange,
  includeMeToCreatedByFilter = false,
}: MentorCategoriesProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedLlmProvider, setSelectedLlmProvider] = useState<string | null>(
    null,
  );
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedFeatured, setSelectedFeatured] = useState<string | null>(null);
  const [selectedCreatedBy, setSelectedCreatedBy] = useState<
    'me' | 'my-organization' | 'community' | ''
  >('');

  // Extract facet options from API response
  const categories = facets?.categories?.terms
    ? Object.keys(facets.categories.terms)
    : [];
  const subjects = facets?.subjects?.terms
    ? Object.keys(facets.subjects.terms)
    : [];
  const llmProviders = facets?.llm_providers?.terms
    ? Object.keys(facets.llm_providers.terms)
    : [];
  const types = facets?.types?.terms ? Object.keys(facets.types.terms) : [];

  const createdByOptions = [
    ...(includeMeToCreatedByFilter
      ? [{ label: 'Me', value: 'me' as const }]
      : []),
    { label: 'My Organization', value: 'my-organization' as const },
    { label: 'Community', value: 'community' as const },
  ];

  const handleCategorySelect = (category: string, event?: React.MouseEvent) => {
    event?.preventDefault();
    const newCategory = selectedCategory === category ? null : category;
    setSelectedCategory(newCategory);
    onFiltersChange?.({
      categories: newCategory,
      subjects: selectedSubject,
      llm_providers: selectedLlmProvider,
      types: selectedType,
      is_featured: selectedFeatured,
    });
  };

  const handleSubjectSelect = (subject: string, event?: React.MouseEvent) => {
    event?.preventDefault();
    const newSubject = selectedSubject === subject ? null : subject;
    setSelectedSubject(newSubject);
    onFiltersChange?.({
      categories: selectedCategory,
      subjects: newSubject,
      llm_providers: selectedLlmProvider,
      types: selectedType,
      is_featured: selectedFeatured,
    });
  };

  const handleLlmProviderSelect = (
    llmProvider: string,
    event?: React.MouseEvent,
  ) => {
    event?.preventDefault();
    const newLlmProvider =
      selectedLlmProvider === llmProvider ? null : llmProvider;
    setSelectedLlmProvider(newLlmProvider);
    onFiltersChange?.({
      categories: selectedCategory,
      subjects: selectedSubject,
      llm_providers: newLlmProvider,
      types: selectedType,
      is_featured: selectedFeatured,
    });
  };

  const handleTypeSelect = (type: string, event?: React.MouseEvent) => {
    event?.preventDefault();
    const newType = selectedType === type ? null : type;
    setSelectedType(newType);
    onFiltersChange?.({
      categories: selectedCategory,
      subjects: selectedSubject,
      llm_providers: selectedLlmProvider,
      types: newType,
      is_featured: selectedFeatured,
    });
  };

  const handleFeaturedSelect = (featured: string, event?: React.MouseEvent) => {
    event?.preventDefault();
    const newFeatured = selectedFeatured === featured ? null : featured;
    setSelectedFeatured(newFeatured);
    onFiltersChange?.({
      categories: selectedCategory,
      subjects: selectedSubject,
      llm_providers: selectedLlmProvider,
      types: selectedType,
      is_featured: newFeatured,
    });
  };

  const handleCreatedBySelect = (
    createdBy: 'me' | 'my-organization' | 'community',
    event?: React.MouseEvent,
  ) => {
    event?.preventDefault();
    setSelectedCreatedBy(createdBy);
    onCreatedByChange?.(createdBy);
  };

  /* istanbul ignore next -- @preserve Radix UI dropdown state interaction difficult to test in isolation */
  const handleClearAll = () => {
    setSelectedCategory(null);
    setSelectedSubject(null);
    setSelectedLlmProvider(null);
    setSelectedType(null);
    setSelectedFeatured(null);
    setSelectedCreatedBy('');
    onFiltersChange?.({
      categories: null,
      subjects: null,
      llm_providers: null,
      types: null,
      is_featured: null,
    });
    onCreatedByChange?.(null);
  };

  const hasActiveFilters =
    selectedCategory ||
    selectedSubject ||
    selectedLlmProvider ||
    selectedType ||
    selectedFeatured ||
    selectedCreatedBy;

  // Shared handler to prevent default dropdown behavior
  const preventDefaultSelect = (e: Event) => e.preventDefault();

  return (
    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
      {/* Promotion Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            type="button"
            className={`flex h-8 items-center gap-2 rounded-lg px-3 transition-all duration-200 ${
              selectedFeatured
                ? 'border border-[#38A1E5] bg-[#38A1E5] text-white hover:bg-[#2E8BD1]'
                : 'border border-gray-200 hover:border-[#D0E0FF] hover:bg-[#F5F8FF]'
            }`}
            aria-haspopup="menu"
          >
            <span>Promotion</span>
            <ChevronDown className="h-3 w-3" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="z-[80] w-48"
          role="menu"
          aria-label="Promotion"
        >
          <DropdownMenuItem
            onSelect={preventDefaultSelect}
            onClick={(e) => handleFeaturedSelect('true', e)}
            className={`flex cursor-pointer items-center justify-between ${selectedFeatured === 'true' ? 'bg-[#F5F8FF] text-[#38A1E5]' : ''}`}
            role="menuitem"
          >
            <div className="flex items-center gap-2">
              {selectedFeatured === 'true' && <Check className="h-4 w-4" />}
              <span>Featured</span>
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Category Dropdown */}
      {categories.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              type="button"
              className={`flex h-8 items-center gap-2 rounded-lg px-3 transition-all duration-200 ${
                selectedCategory
                  ? 'border border-[#38A1E5] bg-[#38A1E5] text-white hover:bg-[#2E8BD1]'
                  : 'border border-gray-200 hover:border-[#D0E0FF] hover:bg-[#F5F8FF]'
              }`}
              aria-haspopup="menu"
            >
              <span>{selectedCategory || 'Category'}</span>
              <ChevronDown className="h-3 w-3" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="z-[80] w-48"
            role="menu"
            aria-label="Category"
          >
            {categories.map((category) => (
              <DropdownMenuItem
                key={category}
                onSelect={preventDefaultSelect}
                onClick={(e) => handleCategorySelect(category, e)}
                className={`flex cursor-pointer items-center justify-between ${
                  selectedCategory === category
                    ? 'bg-[#F5F8FF] text-[#38A1E5]'
                    : ''
                }`}
                role="menuitem"
              >
                <div className="flex items-center gap-2">
                  {selectedCategory === category && (
                    <Check className="h-4 w-4" />
                  )}
                  <span>{category}</span>
                </div>
                {/* {facets?.categories?.terms[category] && (
                  <span className="text-xs text-gray-400">
                    ({facets.categories.terms[category]})
                  </span>
                )} */}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Subject Dropdown */}
      {subjects.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              type="button"
              className={`flex h-8 items-center gap-2 rounded-lg px-3 transition-all duration-200 ${
                selectedSubject
                  ? 'border border-[#38A1E5] bg-[#38A1E5] text-white hover:bg-[#2E8BD1]'
                  : 'border border-gray-200 hover:border-[#D0E0FF] hover:bg-[#F5F8FF]'
              }`}
              aria-haspopup="menu"
            >
              <span>{selectedSubject || 'Subject'}</span>
              <ChevronDown className="h-3 w-3" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="z-[80] w-48"
            role="menu"
            aria-label="Subject"
          >
            {subjects.map((subject) => (
              <DropdownMenuItem
                key={subject}
                onSelect={preventDefaultSelect}
                onClick={(e) => handleSubjectSelect(subject, e)}
                className={`flex cursor-pointer items-center justify-between ${
                  selectedSubject === subject
                    ? 'bg-[#F5F8FF] text-[#38A1E5]'
                    : ''
                }`}
                role="menuitem"
              >
                <div className="flex items-center gap-2">
                  {selectedSubject === subject && <Check className="h-4 w-4" />}
                  <span>{subject}</span>
                </div>
                {/* {facets?.subject?.terms[subject] && (
                  <span className="text-xs text-gray-400">({facets.subject.terms[subject]})</span>
                )} */}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Type Dropdown */}
      {types.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              type="button"
              className={`flex h-8 items-center gap-2 rounded-lg px-3 transition-all duration-200 ${
                selectedType
                  ? 'border border-[#38A1E5] bg-[#38A1E5] text-white hover:bg-[#2E8BD1]'
                  : 'border border-gray-200 hover:border-[#D0E0FF] hover:bg-[#F5F8FF]'
              }`}
              aria-haspopup="menu"
            >
              <span>{selectedType || 'Type'}</span>
              <ChevronDown className="h-3 w-3" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="z-[80] w-48"
            role="menu"
            aria-label="Type"
          >
            {types.map((type) => (
              <DropdownMenuItem
                key={type}
                onSelect={preventDefaultSelect}
                onClick={(e) => handleTypeSelect(type, e)}
                className={`flex cursor-pointer items-center justify-between ${selectedType === type ? 'bg-[#F5F8FF] text-[#38A1E5]' : ''}`}
                role="menuitem"
              >
                <div className="flex items-center gap-2">
                  {selectedType === type && <Check className="h-4 w-4" />}
                  <span>{type}</span>
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* LLM Providers Dropdown */}
      {llmProviders.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              type="button"
              className={`flex h-8 items-center gap-2 rounded-lg px-3 transition-all duration-200 ${
                selectedLlmProvider
                  ? 'border border-[#38A1E5] bg-[#38A1E5] text-white hover:bg-[#2E8BD1]'
                  : 'border border-gray-200 hover:border-[#D0E0FF] hover:bg-[#F5F8FF]'
              }`}
              aria-haspopup="menu"
            >
              <span>
                {selectedLlmProvider
                  ? getLLMProviderDetails(selectedLlmProvider).name
                  : 'LLM Provider'}
              </span>
              <ChevronDown className="h-3 w-3" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="z-[80] w-48"
            role="menu"
            aria-label="LLM Provider"
          >
            {llmProviders.map((llmProvider) => (
              <DropdownMenuItem
                key={llmProvider}
                onSelect={preventDefaultSelect}
                onClick={(e) => handleLlmProviderSelect(llmProvider, e)}
                className={`flex cursor-pointer items-center justify-between ${
                  selectedLlmProvider === llmProvider
                    ? 'bg-[#F5F8FF] text-[#38A1E5]'
                    : ''
                }`}
                role="menuitem"
              >
                <div className="flex items-center gap-2">
                  {selectedLlmProvider === llmProvider && (
                    <Check className="h-4 w-4" />
                  )}
                  <span>{getLLMProviderDetails(llmProvider).name}</span>
                </div>
                {/* {facets?.llm_providers?.terms[llmProvider] && (
                  <span className="text-xs text-gray-400">
                    ({facets.llm_providers.terms[llmProvider]})
                  </span>
                )} */}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Created By Dropdown - Only shown when community mentors are enabled */}
      {showCreatedByFilter && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              type="button"
              className={`flex h-8 items-center gap-2 rounded-lg px-3 transition-all duration-200 ${
                selectedCreatedBy
                  ? 'border border-[#38A1E5] bg-[#38A1E5] text-white hover:bg-[#2E8BD1]'
                  : 'border border-gray-200 hover:border-[#D0E0FF] hover:bg-[#F5F8FF]'
              }`}
              aria-haspopup="menu"
            >
              <span>
                {createdByOptions.find((opt) => opt.value === selectedCreatedBy)
                  ?.label || 'Created By'}
              </span>
              <ChevronDown className="h-3 w-3" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="z-[80] w-48"
            role="menu"
            aria-label="Created By"
          >
            {createdByOptions.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onSelect={preventDefaultSelect}
                onClick={(e) => handleCreatedBySelect(option.value, e)}
                className={`flex cursor-pointer items-center justify-between ${
                  selectedCreatedBy === option.value
                    ? 'bg-[#F5F8FF] text-[#38A1E5]'
                    : ''
                }`}
                role="menuitem"
              >
                <div className="flex items-center gap-2">
                  {selectedCreatedBy === option.value && (
                    <Check className="h-4 w-4" />
                  )}
                  <span>{option.label}</span>
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {hasActiveFilters && (
        <>
          <span className="text-gray-300">|</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearAll}
            className="h-8 px-3 text-gray-600 hover:bg-gray-100 hover:text-gray-800"
            aria-label="Clear All"
            role="button"
          >
            Clear All
          </Button>
        </>
      )}
    </div>
  );
}
