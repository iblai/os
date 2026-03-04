export interface Mentor {
  id: string;
  profile_image: string;
  unique_id: string;
  slug: string;
  name: string;
  description: string;
  imageUrl: string | null;
  recently_accessed_at: string;
  llm_provider: string;
  llm_name: string;
  updated_at: string;
  metadata: { default?: boolean; featured: boolean };
}

export type MentorsFetchResponse = {
  results: Mentor[];
  count: number;
  next: string | null;
  previous: string | null;
  current_page: number;
  total_pages: number;
};

export type GetMentorsParams = {
  order_by?: string;
  featured?: boolean;
  limit?: number;
  query?: string;
  offset?: number;
  category?: string;
};

export type GetMentorsArgs = {
  tenantKey: string;
  username: string;
  params?: GetMentorsParams;
};

export type SeedMentorsArgs = {
  tenantKey: string;
  username: string;
};

export type SeedMentorsResponse = {
  details: string;
};

export type RecentMentor = Mentor & {
  platform_key: string;
};

export type DetermineMentorToRedirectToArgs = {
  tenantKey: string;
  username: string;
  isAdmin: boolean;
  isMainTenant: boolean;
};

export type DetermineMentorToRedirectToResponse = {
  mentorId: string;
};

export type GetMentorArgs = {
  tenantKey: string;
  username: string;
  mentorId: string;
};

export type CreateMentorWithSettingsArgs = {
  tenantKey: string;
  username: string;
  body: {
    template_name: string;
    new_mentor_name: string;
    display_name: string;
    description: string;
    profile_image: string;
  };
};
