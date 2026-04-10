import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';

import { useGetPromptsSearchQuery } from '@iblai/iblai-js/data-layer';

import { PromptCard } from './prompt-card';
import { TenantKeyMentorIdParams } from '@/lib/types';
import { useUsername } from '@/hooks/use-user';
import { EmptyPrompts } from './empty-prompts';
import { SelectedPrompt } from '../edit-prompt-modal';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/spinner';

type Props = {
  title: string;
  onEdit: (prompt: SelectedPrompt) => void;
  onSelect?: (promptText: string) => void;
  uniqueMentorId?: string;
  category: string;
  activeCategory: string;
};

export function CategorySection({
  title,
  onEdit,
  onSelect,
  uniqueMentorId,
  category,
  activeCategory,
}: Props) {
  const { tenantKey } = useParams<TenantKeyMentorIdParams>();
  const username = useUsername();

  const [offset, setOffset] = useState(0);
  const [allResults, setAllResults] = useState<any[]>([]);
  const [hasMore, setHasMore] = useState(true);

  const getPromptsSearchQuery = useGetPromptsSearchQuery(
    {
      org: tenantKey,
      username: username ?? '',
      category: activeCategory === 'All' ? '' : category.toLowerCase(),
      limit: 6,
      offset: offset,
      mentor: uniqueMentorId,
      orderDirection: 'asc',
    },
    {
      skip: !tenantKey || !username || !uniqueMentorId || !category,
    },
  );

  // Handle accumulating results and checking for more data
  useEffect(() => {
    if (getPromptsSearchQuery?.status === 'fulfilled') {
      const newResults = getPromptsSearchQuery.data?.results ?? [];
      if (offset === 0) {
        // First load - replace all results
        setAllResults([...newResults]);
      } else {
        // Subsequent loads - append new results
        setAllResults((prev) => [...prev, ...newResults]);
      }

      // Check if there are more items to load
      const totalCount = getPromptsSearchQuery.data?.count ?? 0;
      const currentTotal = offset + newResults.length;
      setHasMore(currentTotal < totalCount);
    }
  }, [offset, activeCategory, getPromptsSearchQuery?.status]);

  // Reset state when category changes
  useEffect(() => {
    setOffset(0);
    setHasMore(false);
  }, [category, uniqueMentorId]);

  const loadMore = () => {
    if (hasMore && !getPromptsSearchQuery?.isLoading) {
      setOffset((prev) => prev + 6);
    }
  };

  // Show loading only on initial load
  if (getPromptsSearchQuery?.isLoading)
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Spinner />
      </div>
    );

  // Show empty state only if no results after initial load
  if (allResults.length === 0 && !getPromptsSearchQuery?.isLoading) {
    // Only show EmptyPrompts if this category is the active one (not when showing all)
    if (activeCategory === category) {
      return <EmptyPrompts />;
    }
    return null;
  }

  return (
    <div className="mb-8 space-y-4">
      {activeCategory !== 'All' && (
        <h2 className="text-sm font-medium text-gray-700 capitalize">
          {title}
        </h2>
      )}
      <div className="grid w-full gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {allResults.map((prompt) => (
          <PromptCard
            key={prompt.id}
            prompt={{
              id: prompt.id,
              category: prompt?.category?.name ?? '',
              label: 'Prompt',
              prompt: prompt.prompt,
              isSystem: false,
              name: 'prompt',
              promptVisibility: prompt?.prompt_visibility,
            }}
            title={prompt?.title}
            onEdit={onEdit}
            onSelect={onSelect}
          />
        ))}
      </div>
      {hasMore && (
        <div className="mt-4 flex justify-end">
          <Button
            variant="outline"
            size="sm"
            className="flex h-7 items-center border-gray-200 px-3 text-xs font-normal text-gray-600"
            onClick={loadMore}
            disabled={getPromptsSearchQuery?.isFetching}
          >
            {getPromptsSearchQuery?.isFetching ? 'Loading...' : 'See More'}
          </Button>
        </div>
      )}
    </div>
  );
}
