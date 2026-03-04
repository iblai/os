'use client';

import React from 'react';

export interface ExplorePageFilters {
  categories: string | null;
  subjects: string | null;
  llm_providers: string | null;
  types: string | null;
  is_featured: string | null;
}

export interface ExplorePageContextValue {
  tenantKey: string;
  username: string | null;
  debouncedSearch: string;
  isSearching: boolean;
  filters: ExplorePageFilters;
  createdBy: 'me' | 'my-organization' | 'community' | null;
  includeMainPublicMentors: boolean;
  togglingMentorId: string | null;
  toggleFavorite: (mentor: any, event: React.MouseEvent) => Promise<void>;
  handleMentorClick: (mentor: any) => void;
  starredMentorsLoading: boolean;
  setStarredMentorsLoading: (isLoading: boolean) => void;
  customMentorsLoading: boolean;
  setCustomMentorsLoading: (isLoading: boolean) => void;
  featuredMentorsLoading: boolean;
  setFeaturedMentorsLoading: (isLoading: boolean) => void;
  defaultMentorsLoading: boolean;
  setDefaultMentorsLoading: (isLoading: boolean) => void;
}

export const ExplorePageContext = React.createContext<ExplorePageContextValue | null>(null);

export function useExplorePageContext() {
  const context = React.useContext(ExplorePageContext);
  if (!context) {
    throw new Error('useExplorePageContext must be used within ExplorePageContextProvider');
  }
  return context;
}

export const CUSTOM_MENTORS_LIMIT = 6;
