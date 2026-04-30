'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ChevronRight } from 'lucide-react';
import { useNavigate } from '@/hooks/user-navigate';
import {
  useGetAiSearchMentorsQuery,
  useGetPublicMentorsQuery,
} from '@iblai/iblai-js/data-layer';
import { useUsername } from '@/hooks/use-user';
import { useParams } from 'next/navigation';
import { TenantKeyMentorIdParams } from '@/lib/types';
import { format } from 'date-fns';
import { useTenantMetadata } from '@iblai/iblai-js/web-utils';

const QUERY_LIMIT = 6;

export function ExploreMentors() {
  const username = useUsername();
  const { tenantKey } = useParams<TenantKeyMentorIdParams>();
  const { navigateToExplore, navigateToMentor } = useNavigate();
  const { metadata } = useTenantMetadata({ org: tenantKey });
  const { data: mentors } = useGetAiSearchMentorsQuery(
    {
      platform_key: tenantKey ?? '',
      limit: QUERY_LIMIT,
      ...(metadata?.mentor_include_community_mentors !== false && {
        include_main_public_mentors: true,
      }),
    },
    {
      skip: !tenantKey,
    },
  );

  const { data: publicMentors } = useGetPublicMentorsQuery(
    {
      includeMainPublicMentors: true,
      limit: QUERY_LIMIT,
      orderBy: 'recently_accessed_at',
    },
    {
      skip: username,
    },
  );

  const allMentors = username ? mentors : publicMentors;

  if (!allMentors?.results || allMentors?.results.length === 0) {
    return null;
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Explore Agents</h2>
        <Button
          variant="ghost"
          className="h-auto min-h-6 p-0 text-blue-600 hover:text-blue-700"
          onClick={() => navigateToExplore()}
        >
          Browse All
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {allMentors?.results.map((mentor) => (
          <div
            key={mentor.unique_id}
            className="block"
            onClick={() => navigateToMentor(mentor?.unique_id ?? '')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                navigateToMentor(mentor?.unique_id ?? '');
              }
            }}
            aria-label={`Explore agent: ${mentor.name}. ${
              // @ts-expect-error - description property may not exist on Mentor type
              mentor.description || 'No description available'
            }`}
          >
            <Card className="h-full cursor-pointer border border-[#D0E0FF] bg-[#F5F8FF] shadow-xs transition-all duration-200 focus-within:shadow-md hover:shadow-sm">
              <CardContent className="h-full p-4">
                <div className="flex h-full items-start gap-3">
                  <Avatar className="h-12 w-12 flex-shrink-0">
                    <AvatarImage
                      // @ts-expect-error - profile_image property may not exist on Mentor type
                      src={mentor.profile_image || '/default-avatar.png'}
                      alt={mentor.name}
                      className="object-cover"
                      loading="lazy"
                    />
                    <AvatarFallback>
                      {mentor.name.substring(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex h-full min-w-0 flex-1 flex-col">
                    <h3 className="mb-1 text-sm font-semibold text-gray-900">
                      {mentor.name}
                    </h3>
                    <p className="mb-2 line-clamp-2 flex-1 text-sm leading-relaxed text-gray-600">
                      {/* @ts-expect-error - description property may not exist on Mentor type */}
                      {mentor.description || 'No description available'}
                    </p>
                    <p className="mt-auto text-xs text-gray-400">
                      Updated on{' '}
                      {format(mentor.updated_at || new Date(), 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
