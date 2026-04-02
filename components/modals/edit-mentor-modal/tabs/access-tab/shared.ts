import type { MentorPolicy, RbacPolicyGroup, RbacUser } from '@iblai/iblai-api';

export type MentorAccessPolicy = Pick<
  MentorPolicy,
  'id' | 'mentor_id' | 'platform_key' | 'role'
> & {
  users?: RbacUser[];
  groups?: RbacPolicyGroup[];
};

export type PlatformUserOption = {
  id: number;
  name: string;
  username?: string | null;
  email?: string;
};

export type GroupOption = {
  id: number;
  name: string;
};

export type UpdateAction = 'add' | 'remove';

export const roleDescriptions: Record<string, string> = {
  // Temporarily commented out - not yet functional backend wise
  // viewer: 'Users with viewer access can chat with the mentor but cannot edit settings.',
  editor: 'Editors can update mentor configuration, prompts, and tools.',
  // Temporarily commented out - not yet functional backend wise.
  chat: 'Chat access limits users to conversations without editing capabilities.',
};

// Temporarily commented out viewer & chat roles - not yet functional backend wise
// export const DEFAULT_MENTOR_ROLES = ['viewer', 'editor', 'chat'] as const;
export const DEFAULT_MENTOR_ROLES = ['editor', 'chat'] as const;
export type DefaultMentorRole = (typeof DEFAULT_MENTOR_ROLES)[number];

export const formatRoleName = (role: string) =>
  role
    .split(/[_\s-]/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');

export const getErrorMessage = (
  error: unknown,
  fallback = 'Something went wrong.',
): string => {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const maybeError = error as {
      data?: unknown;
      error?: unknown;
      message?: string;
    };
    if (maybeError?.data && typeof maybeError.data === 'object') {
      const data = maybeError.data as Record<string, unknown>;
      if (typeof data.detail === 'string') return data.detail;
      if (typeof data.message === 'string') return data.message;
      if (data.emails_to_add && Array.isArray(data.emails_to_add)) {
        return data.emails_to_add.join(', ');
      }
      if (data.usernames_to_add && Array.isArray(data.usernames_to_add)) {
        return data.usernames_to_add.join(', ');
      }
    }
    if (
      typeof maybeError.message === 'string' &&
      maybeError.message.trim().length > 0
    ) {
      return maybeError.message;
    }
  }
  return fallback;
};
