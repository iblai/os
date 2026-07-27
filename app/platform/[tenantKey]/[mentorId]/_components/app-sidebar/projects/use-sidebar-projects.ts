'use client';

import * as React from 'react';

import { useGetUserProjectsQuery } from '@iblai/iblai-js/data-layer';

// Sidebar projects list page size — the initial fetch loads this many, and
// each scroll-to-bottom grows the query `limit` by another page. RTK Query
// refetches the larger list and returns the growing `results`, so appending
// is automatic (no manual page accumulation).
const PROJECTS_PAGE_SIZE = 10;

export type SdkProject = {
  id: number | string;
  name?: string | null;
  mentors?: Array<{ unique_id?: string | null; name?: string | null }> | null;
};

export type UseSidebarProjectsArgs = {
  tenantKey: string;
  username: string;
  open: boolean;
  collapsed: boolean;
};

export function useSidebarProjects({
  tenantKey,
  username,
  open,
  collapsed,
}: UseSidebarProjectsArgs) {
  // Infinite scroll: grow the fetch `limit` as the user scrolls to the bottom
  // of the list. The query refetches the larger list and returns the growing
  // `results`, so the extra rows simply append.
  const [limit, setLimit] = React.useState(PROJECTS_PAGE_SIZE);
  const scrollRef = React.useRef<HTMLUListElement>(null);

  const { data: projectsQueryData, isFetching } = useGetUserProjectsQuery(
    {
      tenantKey,
      username,
      params: { limit },
    } as never,
    { skip: !tenantKey || !username },
  );

  const projects = React.useMemo<SdkProject[]>(() => {
    return (
      (projectsQueryData as { results?: SdkProject[] } | undefined)?.results ??
      []
    );
  }, [projectsQueryData]);

  // Total number of projects the API reports — used to know whether growing
  // the limit would fetch anything new.
  const count =
    (projectsQueryData as { count?: number } | undefined)?.count ?? 0;
  const hasMore = projects.length < count;

  // Bump the limit by one page when the user nears the bottom of the list —
  // but only when there ARE more to load and a fetch isn't already in flight,
  // so a single scroll-to-bottom triggers at most one additional fetch.
  const onScroll = React.useCallback(
    (e: React.UIEvent<HTMLUListElement>) => {
      if (!hasMore || isFetching) return;
      const el = e.currentTarget;
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 48) {
        setLimit((prev) => prev + PROJECTS_PAGE_SIZE);
      }
    },
    [hasMore, isFetching],
  );

  // Bootstrap the infinite scroll: if a loaded page doesn't fill the scroll
  // container it never overflows, so `onScroll` can never fire and the rest of
  // the projects stay unreachable. Keep loading until the list overflows (after
  // which scrolling drives it) or everything is loaded. `open`/`collapsed` are
  // dependencies because the list only mounts once the section is expanded, and
  // the measure is deferred a frame so the just-mounted list is laid out first.
  React.useEffect(() => {
    if (collapsed || !open || !hasMore || isFetching) return;
    const raf = requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el && el.clientHeight > 0 && el.scrollHeight <= el.clientHeight + 1) {
        setLimit((prev) => prev + PROJECTS_PAGE_SIZE);
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [hasMore, isFetching, projects.length, open, collapsed]);

  return { projects, isFetching, hasMore, scrollRef, onScroll };
}
