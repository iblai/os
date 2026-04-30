import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/spinner';
import { MentorCard } from './mentor-card';
import { EmptyState } from './empty-state';

interface AllMentorsSectionProps {
  mentors: any[] | undefined;
  hasNext: boolean;
  onLoadMore: () => void;
  activeTab: string;
  isFetching: boolean;
}

export function AllMentorsSection({
  mentors,
  hasNext,
  onLoadMore,
  activeTab,
  isFetching,
}: AllMentorsSectionProps) {
  const sectionTitle =
    activeTab === ''
      ? 'All Agents'
      : `${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Agents`;

  return (
    <section className="overflow-hidden" aria-labelledby="all-mentors-heading">
      <h2
        id="all-mentors-heading"
        className="mb-2 truncate text-base font-semibold sm:mb-3 sm:text-base md:mb-4 md:text-lg"
      >
        {sectionTitle}
      </h2>
      <div className="w-full space-y-4 sm:space-y-6 md:space-y-8">
        {mentors?.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <ul
              data-testid="all-mentors-card-list"
              className="grid w-full grid-cols-1 gap-2 sm:gap-3 md:grid-cols-2 md:gap-4"
              aria-label={
                activeTab === '' ? 'All agents' : `${activeTab} agents`
              }
            >
              {mentors?.map((mentor) => (
                <li key={mentor.id} role="listitem">
                  <MentorCard mentor={mentor} />
                </li>
              ))}
            </ul>
            {hasNext && (
              <div className={cn('flex w-full justify-center')}>
                <Button
                  variant="outline"
                  className="h-8 w-full py-1 text-sm sm:h-10 sm:py-2 sm:text-sm"
                  onClick={onLoadMore}
                  disabled={isFetching}
                  aria-label={
                    isFetching
                      ? `Loading more ${activeTab === '' ? 'agents' : `${activeTab} agents`}`
                      : `Load more ${activeTab === '' ? 'agents' : `${activeTab} agents`}`
                  }
                >
                  {isFetching ? (
                    <div className="flex items-center gap-2">
                      <Spinner className="h-4 w-4" aria-hidden="true" />
                      <span>Loading more</span>
                    </div>
                  ) : (
                    `See more`
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
