export interface Tenant {
  user_id: number;
  username: string;
  email: string;
  user_active: boolean;
  key: string;
  org: string;
  lms_url: string;
  cms_url: string;
  portal_url: string | null;
  is_admin: boolean;
  is_staff: boolean;
  added_on: string;
  expired_on: string | null;
  public: boolean | null;
  active: boolean;
  name: string;
}

export interface TenantMetadata {
  platform_key: string;
  platform_name: string;
  metadata: {
    spa_domains: Record<
      'mentor' | 'skills' | 'analytics',
      { active: boolean; domain: string }
    > | null;
  };
}

export type GetUserTenantsArgs = null;

export type GetTenantMetadataArgs = {
  tenantKey: string;
};

/**
 * Per-user, per-platform metadata stored at
 * `/api/core/users/platform-metadata/`. `metadata` is a free-form JSON object
 * (empty for a user who has never been onboarded).
 */
export interface UserPlatformMetadata {
  username: string;
  platform_key: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

/** A single user returned by `/api/core/platform/users/`. */
export interface PlatformUser {
  username: string;
  user_id: number;
  name: string;
  email: string;
  is_admin: boolean;
  is_staff: boolean;
  active: boolean;
  platform_key: string;
  platform_org: string;
  added_on: string;
  expired_on: string | null;
}

export interface PlatformUsersResponse {
  count: number;
  next_page: number | null;
  previous_page: number | null;
  results: PlatformUser[];
}

export type GetUserPlatformMetadataArgs = { tenantKey: string };

export type UpdateUserPlatformMetadataArgs = {
  tenantKey: string;
  metadata: Record<string, unknown>;
};

export type GetPlatformUsersArgs = { tenantKey: string; pageSize?: number };
