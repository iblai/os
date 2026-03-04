export interface FlaggedPrompt {
  id: string;
  userId: string;
  userEmail: string;
  userFullName: string;
  type: 'Moderation' | 'Safety';
  prompt: string;
  systemResponse: string;
  timestamp: string;
  timeAgo: string;
  fullDate: string;
  avatarUrl?: string;
}
