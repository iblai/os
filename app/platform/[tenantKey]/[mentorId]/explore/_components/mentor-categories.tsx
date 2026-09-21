'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Bot, ChevronDown, Check, Sparkles } from 'lucide-react';
import { MentorFacet } from '@iblai/iblai-api';
import { ExplorePageFilters } from './explore-page-context';
import { useIsAdmin, useUsername } from '@/hooks/use-user';
import {
  useCredentialsSchemaLogos,
  useLlmProviderCatalogue,
} from '@/hooks/use-llm-provider-details';
import { TenantKeyMentorIdParams } from '@/lib/types';

/**
 * A provider's logo at icon size, or a neutral bot glyph when there is none
 * or it fails to load. A plain <img> because logo hosts are backend-owned and
 * not all of them are in next.config's image patterns.
 */
function ProviderLogo({ src }: { src: string | null }) {
  // Remember which URL failed, so a new src (another provider) gets a try.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!src || failedSrc === src) {
    return (
      <span
        className="flex h-4 w-4 shrink-0 items-center justify-center text-gray-400"
        data-testid="llm-provider-logo-fallback"
        aria-hidden="true"
      >
        <Bot className="h-3.5 w-3.5" />
      </span>
    );
  }

  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      loading="lazy"
      onError={() => setFailedSrc(src)}
      className="h-4 w-4 shrink-0 rounded-sm object-contain"
      data-testid="llm-provider-logo"
    />
  );
}

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
  const t = useTranslations('exploreMentorCategories');
  // LLM provider labels come from the backend LLM catalogue.
  const { tenantKey, mentorId } = useParams<TenantKeyMentorIdParams>();
  const username = useUsername();
  const resolveLlmProvider = useLlmProviderCatalogue({
    org: tenantKey,
    userId: username,
    mentorId,
  });
  // Facet terms are provider display names, which the credentials schema
  // matches on; the catalogue's logo is the fallback for everyone the schema
  // (admin-only) is closed to.
  const isAdmin = useIsAdmin();
  const logoFromCredentialsSchema = useCredentialsSchemaLogos({
    org: tenantKey,
    enabled: !!username && isAdmin,
  });
  const llmProviderLogo = (llmProvider: string) =>
    logoFromCredentialsSchema(llmProvider) ??
    resolveLlmProvider(llmProvider).logo;

  // Extract facet options from API response
  const categories = facets?.categories?.terms
    ? Object.keys(facets.categories.terms)
    : [];
  const subjects = facets?.subjects?.terms
    ? Object.keys(facets.subjects.terms)
    : [];
  // Alphabetical by the label shown, ignoring case so "ibl.ai" and "xAI"
  // don't sink below every capitalised name.
  const llmProviders = facets?.llm_providers?.terms
    ? Object.keys(facets.llm_providers.terms).sort((a, b) =>
        resolveLlmProvider(a).displayName.localeCompare(
          resolveLlmProvider(b).displayName,
          undefined,
          { sensitivity: 'base' },
        ),
      )
    : [];
  const types = facets?.types?.terms ? Object.keys(facets.types.terms) : [];

  const createdByOptions = [
    ...(includeMeToCreatedByFilter
      ? [{ label: t('createdByMe'), value: 'me' as const }]
      : []),
    { label: t('createdByMyOrganization'), value: 'my-organization' as const },
    { label: t('createdByCommunity'), value: 'community' as const },
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

  const selectedCreatedByLabel = createdByOptions.find(
    (opt) => opt.value === selectedCreatedBy,
  )?.label;

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

  const triggerClassName = (active: boolean) =>
    `flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors duration-150 ${
      active
        ? 'border-[#38A1E5] bg-[#EAF4FC] text-[#1F6FA8] hover:bg-[#DDEEFB]'
        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
    }`;

  return (
    <div
      className="scrollbar-hide -mx-1 flex items-center gap-2 overflow-x-auto [mask-image:linear-gradient(to_right,black_calc(100%-2.5rem),transparent)] px-1 py-0.5 pr-8 text-sm text-gray-600 md:flex-wrap md:overflow-visible md:[mask-image:none] md:pr-1"
      style={{ scrollbarWidth: 'none' }}
    >
      {/* Featured toggle: the only promotion there is, so one click */}
      <Button
        variant="ghost"
        size="sm"
        type="button"
        aria-pressed={selectedFeatured === 'true'}
        onClick={(e) => handleFeaturedSelect('true', e)}
        className={triggerClassName(selectedFeatured === 'true')}
      >
        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
        <span>{t('featured')}</span>
      </Button>

      {/* Category Dropdown */}
      {categories.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              type="button"
              className={triggerClassName(!!selectedCategory)}
              aria-haspopup="menu"
            >
              <span>{selectedCategory || t('category')}</span>
              <ChevronDown
                className="h-3.5 w-3.5 opacity-60"
                aria-hidden="true"
              />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="z-[80] w-48"
            role="menu"
            aria-label={t('category')}
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
              className={triggerClassName(!!selectedSubject)}
              aria-haspopup="menu"
            >
              <span>{selectedSubject || t('subject')}</span>
              <ChevronDown
                className="h-3.5 w-3.5 opacity-60"
                aria-hidden="true"
              />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="z-[80] w-48"
            role="menu"
            aria-label={t('subject')}
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
              className={triggerClassName(!!selectedType)}
              aria-haspopup="menu"
            >
              <span>{selectedType || t('type')}</span>
              <ChevronDown
                className="h-3.5 w-3.5 opacity-60"
                aria-hidden="true"
              />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="z-[80] w-48"
            role="menu"
            aria-label={t('type')}
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
              className={triggerClassName(!!selectedLlmProvider)}
              aria-haspopup="menu"
            >
              {selectedLlmProvider && (
                <ProviderLogo src={llmProviderLogo(selectedLlmProvider)} />
              )}
              <span>
                {selectedLlmProvider
                  ? resolveLlmProvider(selectedLlmProvider).displayName
                  : t('llmProvider')}
              </span>
              <ChevronDown
                className="h-3.5 w-3.5 opacity-60"
                aria-hidden="true"
              />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="z-[80] w-48"
            role="menu"
            aria-label={t('llmProvider')}
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
                <div className="flex min-w-0 items-center gap-2">
                  <ProviderLogo src={llmProviderLogo(llmProvider)} />
                  <span className="truncate">
                    {resolveLlmProvider(llmProvider).displayName}
                  </span>
                </div>
                {selectedLlmProvider === llmProvider && (
                  <Check className="h-4 w-4 shrink-0" />
                )}
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
              className={triggerClassName(!!selectedCreatedBy)}
              aria-haspopup="menu"
            >
              <span>
                {selectedCreatedByLabel
                  ? `${t('createdBy')}: ${selectedCreatedByLabel}`
                  : t('createdBy')}
              </span>
              <ChevronDown
                className="h-3.5 w-3.5 opacity-60"
                aria-hidden="true"
              />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="z-[80] w-48"
            role="menu"
            aria-label={t('createdBy')}
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
          <span className="h-5 w-px shrink-0 bg-gray-200" aria-hidden="true" />
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearAll}
            className="h-9 shrink-0 rounded-full px-3 text-sm font-medium text-[#1F6FA8] hover:bg-[#EAF4FC] hover:text-[#1F6FA8]"
            aria-label={t('clearAll')}
            role="button"
          >
            {t('clearAll')}
          </Button>
        </>
      )}
    </div>
  );
}
